// 실제 Supabase에 테스트 데이터를 넣고 읽은 뒤 모두 지운다. 키가 없으면 건너뛴다.
import { afterAll, describe, expect, it } from "vitest";
import {
  createArticle,
  createDateTab,
  DbError,
  deleteContact,
  deleteDateTab,
  deleteMailTemplate,
  finishSendLog,
  getDateTab,
  getDefaultMailTemplate,
  getSendLog,
  getSummary,
  hasSendingLog,
  importContacts,
  listArticles,
  listContacts,
  listDateTabs,
  listMailArticles,
  listSummaries,
  reorderArticles,
  resetEditedSummary,
  saveAiSummary,
  saveEditedSummary,
  saveMailTemplate,
  setAllIncludeInMail,
  startSendLog,
  updateArticle,
  updateDateTab,
} from "@/lib/db";
import { db } from "@/lib/db/client";
import type { RichText } from "@/types";

const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const stamp = Date.now();
const doc = (text: string): RichText => `<b>${text}</b>`;

const cleanup: (() => Promise<void>)[] = [];
afterAll(async () => {
  for (const fn of cleanup.reverse()) await fn().catch(() => {});
});

describe.skipIf(!hasDb)("lib/db (Supabase 연동)", () => {
  it("날짜 탭 → 기사 → 요약 → 메일 대상까지 이어진다", async () => {
    const tab = await createDateTab({ date: "2026-10-06", label: `테스트 ${stamp}` });
    cleanup.push(() => deleteDateTab(tab.id));
    expect((await listDateTabs()).some((t) => t.id === tab.id)).toBe(true);
    expect((await updateDateTab(tab.id, { label: "이름 변경" })).label).toBe("이름 변경");

    const a1 = await createArticle({ dateTabId: tab.id, url: `https://www.korea.kr/test/${stamp}/1` });
    const a2 = await createArticle({ dateTabId: tab.id, url: `https://www.korea.kr/test/${stamp}/2` });
    expect([a1.status, a1.position, a2.position]).toEqual(["fetching", 0, 1]);

    // 같은 탭에 같은 링크는 막힌다
    await expect(createArticle({ dateTabId: tab.id, url: a1.url })).rejects.toMatchObject({
      code: "duplicate",
    });

    const updated = await updateArticle(a1.id, {
      title: "피지컬 AI 테스트베드",
      ministry: "과학기술정보통신부",
      category: "ai",
      tags: ["인공지능"],
      status: "ready",
    });
    expect(updated).toMatchObject({ title: "피지컬 AI 테스트베드", status: "ready", department: null });

    await reorderArticles(tab.id, [a2.id, a1.id]);
    expect((await listArticles(tab.id)).map((a) => a.id)).toEqual([a2.id, a1.id]);

    // 메일 대상: ready + 포함된 기사만
    expect((await listMailArticles(tab.id)).map((a) => a.id)).toEqual([a1.id]);
    await setAllIncludeInMail(tab.id, false);
    expect(await listMailArticles(tab.id)).toEqual([]);

    // 요약: AI 원본 저장 → 수정본 저장 → 되돌리기 → 재요약 시 수정본 삭제
    const content = { background: ["배경"], mainPoints: [{ heading: "핵심", items: ["내용"] }], effects: ["효과"], notes: [] };
    expect(await getSummary(a1.id)).toBeNull();
    await saveAiSummary({ articleId: a1.id, aiOriginal: content, highlightCandidates: ["핵심 문구"], model: "test" });
    const edited = { ...content, background: [doc("고친 배경")], mainPoints: [{ heading: "핵심", items: [doc("내용")] }], effects: [doc("효과")], notes: [] };
    expect((await saveEditedSummary(a1.id, edited)).edited).toEqual(edited);
    await resetEditedSummary(a1.id);
    expect((await getSummary(a1.id))?.edited).toBeNull();
    await saveEditedSummary(a1.id, edited);
    expect((await saveAiSummary({ articleId: a1.id, aiOriginal: content, highlightCandidates: [], model: "test" })).edited).toBeNull();
    expect((await listSummaries([a1.id, a2.id])).size).toBe(1);

    // 발송 이력: 보내는 중 → 완료, 탭을 지워도 이력은 남는다
    const log = await startSendLog({ dateTabId: tab.id, subject: "테스트", recipients: ["a@example.com"], articleIds: [a1.id], html: "<p>x</p>" });
    // 앱에는 이력 삭제 기능이 없으므로 테스트가 직접 지운다
    cleanup.push(async () => void (await db().from("send_logs").delete().eq("id", log.id)));
    expect(await hasSendingLog(tab.id)).toBe(true);
    await finishSendLog(log.id, { status: "sent" });
    expect(await hasSendingLog(tab.id)).toBe(false);

    await deleteDateTab(tab.id);
    await expect(getDateTab(tab.id)).rejects.toBeInstanceOf(DbError);
    expect(await listArticles(tab.id)).toEqual([]);
    expect(await getSummary(a1.id)).toBeNull();
    const kept = await getSendLog(log.id);
    expect(kept).toMatchObject({ status: "sent", dateTabId: null });
  });

  it("주소록 CSV 가져오기는 같은 이메일을 합친다", async () => {
    const email = `Tester${stamp}@Example.com`;
    const count = await importContacts([
      { name: "테스터", email, groupName: "업무용" },
      { name: "테스터(수정)", email: email.toLowerCase(), groupName: "업무용" },
    ]);
    expect(count).toBe(1);
    const found = (await listContacts()).find((c) => c.email === email.toLowerCase());
    expect(found?.name).toBe("테스터(수정)");
    if (found) await deleteContact(found.id);
  });

  it("기본 템플릿은 하나만 남는다", async () => {
    const before = await getDefaultMailTemplate();
    const t1 = await saveMailTemplate({ name: `t1-${stamp}`, subject: "[브리핑] {날짜}", greeting: doc("안녕하세요"), closing: doc("감사합니다"), isDefault: true });
    cleanup.push(() => deleteMailTemplate(t1.id));
    const t2 = await saveMailTemplate({ name: `t2-${stamp}`, subject: "[브리핑] {날짜}", greeting: doc("안녕하세요"), closing: doc("감사합니다"), isDefault: true });
    cleanup.push(() => deleteMailTemplate(t2.id));
    expect((await getDefaultMailTemplate())?.id).toBe(t2.id);
    if (before) cleanup.push(async () => void (await saveMailTemplate({ ...before, isDefault: true })));
  });
});
