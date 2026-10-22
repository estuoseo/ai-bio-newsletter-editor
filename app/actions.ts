"use server";
// Design Ref: §7 — 화면에서 부르는 서버 기능. 모두 입력값을 검사한다. (로그인 기능은 사용자 요청으로 제거)
import { refresh } from "next/cache";
import { z } from "zod";
import * as dbx from "@/lib/db";
import { displayContent } from "@/lib/html";
import { applySubjectTemplate, buildNewsletterHtml, type NewsletterItem } from "@/lib/mail/newsletter";
import { sendMail, smtpFrom, verifySmtp } from "@/lib/mail/send";
import { maskEmail } from "@/lib/server/env";
import { sanitizeContent, sanitizeRich } from "@/lib/server/sanitize";
import { CATEGORIES, MAIL_LAYOUTS, RECIPIENT_MODES } from "@/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const fail = (e: unknown): ActionResult => ({
  ok: false,
  error: e instanceof z.ZodError ? "입력값을 확인해 주세요." : e instanceof Error ? e.message : String(e),
});

/** 공통: 실행 → 화면 새로고침 */
async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    refresh();
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    return fail(e);
  }
}

const id = z.uuid();
const date = z.iso.date();

// --- 날짜 탭 (F1) ----------------------------------------------------------

export async function createDateTab(input: { date: string; endDate?: string | null; label: string }) {
  let newId = "";
  const r = await run(async () => {
    const v = z.object({ date, endDate: date.nullish(), label: z.string().trim().min(1).max(40) }).parse(input);
    // 같은 날짜(기간) 탭이 이미 있으면 새로 만들지 않고 그 탭으로 간다
    const same = (await dbx.listDateTabs()).find((t) => t.date === v.date && (t.endDate ?? null) === (v.endDate ?? null));
    if (same) {
      newId = same.id;
      return `이미 있는 "${same.label}" 탭으로 이동했어요.`;
    }
    newId = (await dbx.createDateTab(v)).id;
  });
  return r.ok ? { ...r, id: newId } : r;
}

export const renameDateTab = async (tabId: string, label: string) =>
  run(async () => void (await dbx.updateDateTab(id.parse(tabId), { label: z.string().trim().min(1).max(40).parse(label) })));

export const deleteDateTab = async (tabId: string) => run(async () => dbx.deleteDateTab(id.parse(tabId)));

// --- 기사·요약 편집 (F5~F7) --------------------------------------------------

const articlePatch = z.object({
  category: z.enum(CATEGORIES).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  includeInMail: z.boolean().optional(),
  title: z.string().trim().min(1).max(300).optional(),
});

export const updateArticle = async (articleId: string, patch: z.input<typeof articlePatch>) =>
  run(async () => void (await dbx.updateArticle(id.parse(articleId), articlePatch.parse(patch))));

export const deleteArticle = async (articleId: string) => run(async () => dbx.deleteArticle(id.parse(articleId)));

export const reorderArticles = async (tabId: string, ids: string[]) =>
  run(async () => dbx.reorderArticles(id.parse(tabId), z.array(id).parse(ids)));

export const setAllIncludeInMail = async (tabId: string, include: boolean) =>
  run(async () => dbx.setAllIncludeInMail(id.parse(tabId), z.boolean().parse(include)));

const items = z.array(z.string().max(5_000)).max(30);
const content = z.object({
  background: items,
  mainPoints: z.array(z.object({ heading: z.string().max(200), items })).max(10),
  effects: items,
  notes: items,
});

export const saveEditedSummary = async (articleId: string, edited: z.input<typeof content>) =>
  run(async () => void (await dbx.saveEditedSummary(id.parse(articleId), sanitizeContent(content.parse(edited)))));

export const resetEditedSummary = async (articleId: string) => run(async () => dbx.resetEditedSummary(id.parse(articleId)));

// --- 주소록·템플릿 (M1, M2, M5) ----------------------------------------------

const contact = z.object({
  name: z.string().trim().min(1).max(50),
  email: z.email(),
  groupName: z.string().trim().max(30).nullish(),
});

export const saveContact = async (input: z.input<typeof contact> & { id?: string }) =>
  run(async () => void (await dbx.saveContact({ ...contact.parse(input), id: input.id ? id.parse(input.id) : undefined })));

export const deleteContact = async (contactId: string) => run(async () => dbx.deleteContact(id.parse(contactId)));

export const importContacts = async (rows: z.input<typeof contact>[]) =>
  run(async () => `${await dbx.importContacts(z.array(contact).max(2_000).parse(rows))}명을 저장했어요.`);

const template = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(40),
  subject: z.string().trim().min(1).max(200),
  greeting: z.string().max(5_000),
  closing: z.string().max(5_000),
  isDefault: z.boolean(),
});

export const saveMailTemplate = async (input: z.input<typeof template>) =>
  run(async () => {
    const t = template.parse(input);
    await dbx.saveMailTemplate({ ...t, greeting: sanitizeRich(t.greeting), closing: sanitizeRich(t.closing) });
    return "템플릿을 저장했어요.";
  });

export const deleteMailTemplate = async (templateId: string) => run(async () => dbx.deleteMailTemplate(id.parse(templateId)));

// --- 메일 발송 (M7~M10) ------------------------------------------------------

export const testSmtp = async () => run(async () => (await verifySmtp(), "메일 서버에 연결됐어요."));

const draft = z.object({
  dateTabId: id,
  subject: z.string().trim().min(1).max(200),
  greeting: z.string().max(5_000),
  closing: z.string().max(5_000),
  layout: z.enum(MAIL_LAYOUTS),
  articleIds: z.array(id).min(1, "메일에 넣을 기사가 없어요.").max(50),
  recipients: z.array(z.email()).max(500),
  recipientMode: z.enum(RECIPIENT_MODES),
});

/** 브라우저가 보낸 HTML은 쓰지 않고, DB에서 다시 읽어 서버에서 메일을 만든다 */
async function buildFromDb(d: z.output<typeof draft>) {
  const tab = await dbx.getDateTab(d.dateTabId);
  const allowed = new Map((await dbx.listMailArticles(tab.id)).map((a) => [a.id, a]));
  const summaries = await dbx.listSummaries(d.articleIds);
  const newsletterItems: NewsletterItem[] = d.articleIds.flatMap((aid) => {
    const article = allowed.get(aid);
    const summary = summaries.get(aid);
    return article && summary ? [{ article, content: displayContent(summary) }] : [];
  });
  if (newsletterItems.length === 0) throw new Error("메일에 넣을 기사가 없어요.");
  const subject = applySubjectTemplate(d.subject, tab.date);
  const html = buildNewsletterHtml({
    subject,
    date: tab.date,
    greeting: sanitizeRich(d.greeting),
    closing: sanitizeRich(d.closing),
    layout: d.layout,
    items: newsletterItems,
  });
  return { tab, subject, html, articleIds: newsletterItems.map((i) => i.article.id) };
}

export async function sendNewsletter(input: z.input<typeof draft>, mode: "test" | "real") {
  return run(async () => {
    const d = draft.parse(input);
    const { tab, subject, html, articleIds } = await buildFromDb(d);
    if (mode === "test") {
      const me = smtpFrom();
      if (!me) throw new Error("메일 서버(SMTP)가 설정되지 않았어요.");
      await sendMail({ subject: `[테스트] ${subject}`, html, recipients: [me], mode: "to" });
      return `${maskEmail(me)}(으)로 테스트 메일을 보냈어요.`;
    }
    const recipients = [...new Set(d.recipients.map((r) => r.toLowerCase()))];
    if (recipients.length === 0) throw new Error("받는 사람을 1명 이상 넣어 주세요.");
    if (await dbx.hasSendingLog(tab.id)) throw new Error("이 날짜 탭 메일을 이미 보내는 중이에요.");
    const log = await dbx.startSendLog({ dateTabId: tab.id, subject, recipients, articleIds, html });
    try {
      await sendMail({ subject, html, recipients, mode: d.recipientMode });
      await dbx.finishSendLog(log.id, { status: "sent" });
    } catch (e) {
      await dbx.finishSendLog(log.id, { status: "failed", error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
    return `${recipients.length}명에게 발송했어요.`;
  });
}
