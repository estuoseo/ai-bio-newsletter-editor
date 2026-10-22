"use client";
// Design Ref: §3.2 — 메일 편집(왼쪽)과 실제 메일과 같은 미리보기(오른쪽)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import * as actions from "@/app/actions";
import { askConfirm, askText } from "@/components/dialog";
import { FormatToolbar, RichText } from "@/components/rich-text";
import { Notice, useRunner } from "@/components/use-runner";
import { applySubjectTemplate, buildNewsletterHtml, type NewsletterItem } from "@/lib/mail/newsletter";
import { CATEGORY_LABELS, type Contact, type DateTab, type MailLayout, type MailTemplate, type RecipientMode, type SendLog } from "@/types";

type LogView = Omit<SendLog, "html"> & { size: number };

const DEFAULT_SUBJECT = "[AI·바이오 정책 브리핑] {날짜}";
const DEFAULT_GREETING = "안녕하세요. 오늘의 AI·바이오 분야 정부 보도자료를 정리해 드립니다.";
const DEFAULT_CLOSING = "감사합니다.";

const STATUS = { sending: "보내는 중", sent: "완료", failed: "실패" };

export function SendPage(props: {
  tabs: DateTab[];
  tab: DateTab | null;
  items: NewsletterItem[];
  contacts: Contact[];
  templates: MailTemplate[];
  logs: LogView[];
  smtpReady: boolean;
}) {
  const { tab, items, contacts, templates } = props;
  const base = templates.find((t) => t.isDefault);
  const [subject, setSubject] = useState(base?.subject ?? DEFAULT_SUBJECT);
  const [greeting, setGreeting] = useState(base?.greeting ?? DEFAULT_GREETING);
  const [closing, setClosing] = useState(base?.closing ?? DEFAULT_CLOSING);
  const [editorKey, setEditorKey] = useState(0);
  const [layout, setLayout] = useState<MailLayout>("by_category");
  const [order, setOrder] = useState(items.map((i) => i.article.id));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const [mode, setMode] = useState<RecipientMode>("bcc");
  const [width, setWidth] = useState<"pc" | "mobile">("pc");
  const { pending, notice, run } = useRunner();
  const router = useRouter();

  const byId = new Map(items.map((i) => [i.article.id, i]));
  const ordered = order.flatMap((id) => byId.get(id) ?? []);
  const fullSubject = tab ? applySubjectTemplate(subject, tab.date) : subject;
  const html = useMemo(
    () => buildNewsletterHtml({ subject: fullSubject, date: tab?.date ?? "", greeting, closing, layout, items: ordered }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fullSubject, greeting, closing, layout, order],
  );
  const recipients = [
    ...new Set([
      ...contacts.filter((c) => picked.has(c.id)).map((c) => c.email),
      ...extra.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")),
    ]),
  ];
  const groups = [...new Set(contacts.map((c) => c.groupName ?? "그룹 없음"))];

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const draft = () => ({ dateTabId: tab!.id, subject, greeting, closing, layout, articleIds: order, recipients, recipientMode: mode });
  const loadTemplate = (t: MailTemplate) => {
    setSubject(t.subject);
    setGreeting(t.greeting);
    setClosing(t.closing);
    setEditorKey((k) => k + 1);
  };

  if (!tab) return <p className="card p-10 text-center text-slate-400">먼저 <Link href="/" className="underline">보도자료 편집</Link>에서 날짜 탭을 만들어 주세요.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <b>날짜 탭</b>
            <select value={tab.id} onChange={(e) => router.push(`/send?tab=${e.target.value}`)} className="input !py-1">
              {props.tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <span className="text-slate-500">메일 포함 기사 {items.length}건</span>
          </div>
          <label className="block text-sm">
            <b>제목</b> <span className="text-xs text-slate-400">{"{날짜}"}는 자동으로 바뀌어요</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input mt-1 w-full" />
          </label>
          <div className="flex items-center justify-between">
            <FormatToolbar />
            <select className="input !py-1 text-xs" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) loadTemplate(t); }}>
              <option value="">템플릿 불러오기</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (기본)" : ""}</option>)}
            </select>
          </div>
          <div className="text-sm"><b>인삿말</b><RichText key={`g${editorKey}`} html={greeting} onChange={setGreeting} className="mt-1 rounded-lg border border-slate-200 p-2" /></div>
          <div className="text-sm"><b>맺음말</b><RichText key={`c${editorKey}`} html={closing} onChange={setClosing} className="mt-1 rounded-lg border border-slate-200 p-2" /></div>
          <button
            className="btn text-xs"
            onClick={async () => {
              const name = await askText("템플릿 이름");
              if (!name) return;
              const isDefault = await askConfirm("기본 템플릿으로 지정할까요?\n(메일 발송 화면을 열 때 자동으로 불러와요)");
              run(() => actions.saveMailTemplate({ name, subject, greeting, closing, isDefault }));
            }}
          >
            지금 제목·인삿말을 템플릿으로 저장
          </button>
        </section>

        <section className="card space-y-2 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <b>배치</b>
            <label><input type="radio" checked={layout === "by_category"} onChange={() => setLayout("by_category")} /> 카테고리별 1부·2부</label>
            <label><input type="radio" checked={layout === "sequential"} onChange={() => setLayout("sequential")} /> 1~N위 순서대로</label>
          </div>
          <ol className="space-y-1">
            {ordered.map((it, i) => (
              <li key={it.article.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                <span className="w-5 text-center font-bold text-slate-400">{i + 1}</span>
                <span className="rounded bg-white px-1.5 text-xs ring-1 ring-slate-200">{CATEGORY_LABELS[it.article.category]}</span>
                <span className="flex-1 truncate">{it.article.title}</span>
                <button className="btn-icon" onClick={() => move(i, -1)}>▲</button>
                <button className="btn-icon" onClick={() => move(i, 1)}>▼</button>
                <button className="btn-icon" title="이번 메일에서 빼기" onClick={() => setOrder(order.filter((id) => id !== it.article.id))}>✕</button>
              </li>
            ))}
            {ordered.length === 0 && <li className="text-slate-400">메일에 넣을 기사가 없어요. 보도자료 편집에서 &quot;메일 포함&quot;을 체크해 주세요.</li>}
          </ol>
        </section>

        <section className="card space-y-3 p-4 text-sm">
          <b>받는 사람 ({recipients.length}명)</b>
          {contacts.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {groups.map((g) => (
                  <button key={g} className="btn !py-0.5 text-xs" onClick={() => setPicked(new Set([...picked, ...contacts.filter((c) => (c.groupName ?? "그룹 없음") === g).map((c) => c.id)]))}>+ {g} 전체</button>
                ))}
                <button className="btn !py-0.5 text-xs" onClick={() => setPicked(new Set())}>선택 해제</button>
              </div>
              <div className="flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-auto">
                {contacts.map((c) => (
                  <label key={c.id} className="flex items-center gap-1">
                    <input type="checkbox" checked={picked.has(c.id)} onChange={(e) => { const s = new Set(picked); if (e.target.checked) s.add(c.id); else s.delete(c.id); setPicked(s); }} />
                    {c.name} <span className="text-xs text-slate-400">{c.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="직접 입력 (쉼표로 구분)" className="input w-full" />
          <div className="flex gap-3">
            <label><input type="radio" checked={mode === "bcc"} onChange={() => setMode("bcc")} /> 숨은참조(BCC) — 서로 주소가 안 보여요</label>
            <label><input type="radio" checked={mode === "to"} onChange={() => setMode("to")} /> 받는사람</label>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button disabled={pending || !props.smtpReady || ordered.length === 0} className="btn" onClick={() => run(() => actions.sendNewsletter(draft(), "test"))}>
              나에게 테스트 발송
            </button>
            <button
              disabled={pending || !props.smtpReady || ordered.length === 0 || recipients.length === 0}
              className="btn-primary"
              onClick={async () =>
                (await askConfirm(`제목: ${fullSubject}\n받는 사람: ${recipients.length}명\n기사: ${ordered.length}건\n\n발송할까요?`)) &&
                run(() => actions.sendNewsletter(draft(), "real"))
              }
            >
              {pending ? "처리 중…" : "발송하기"}
            </button>
            {!props.smtpReady && <span className="text-xs text-red-600">메일 서버(SMTP) 설정이 필요해요 → <Link href="/settings" className="underline">설정</Link></span>}
          </div>
          <Notice notice={notice} />
        </section>

        <section className="card p-4 text-sm">
          <b>발송 이력</b>
          <ul className="mt-2 divide-y divide-slate-100">
            {props.logs.map((l) => (
              <li key={l.id} className="flex flex-wrap gap-x-3 py-1.5">
                <span className="text-slate-500">{new Date(l.sentAt).toLocaleString("ko-KR")}</span>
                <span className="flex-1 truncate">{l.subject}</span>
                <span>{l.recipients.length}명</span>
                <span className={l.status === "failed" ? "text-red-600" : l.status === "sent" ? "text-emerald-700" : ""} title={l.error ?? ""}>{STATUS[l.status]}</span>
              </li>
            ))}
            {props.logs.length === 0 && <li className="py-1.5 text-slate-400">아직 없어요.</li>}
          </ul>
        </section>
      </div>

      <section className="lg:sticky lg:top-14 lg:self-start">
        <div className="mb-2 flex items-center gap-2 text-sm">
          <b>미리보기</b>
          {(["pc", "mobile"] as const).map((w) => (
            <button key={w} onClick={() => setWidth(w)} className={`rounded-full px-3 py-0.5 ${width === w ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>{w === "pc" ? "PC" : "모바일"}</button>
          ))}
        </div>
        <iframe title="메일 미리보기" srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="mx-auto h-[80vh] rounded-xl bg-white ring-1 ring-slate-200" style={{ width: width === "pc" ? "100%" : 390 }} />
      </section>
    </div>
  );
}
