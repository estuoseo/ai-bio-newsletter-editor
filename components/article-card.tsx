"use client";
// Design Ref: §3.1 ④ — 기사 카드: 요약 편집(굵게·형광펜), 메일 포함, 카테고리, 재요약
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import * as actions from "@/app/actions";
import { askConfirm, askText } from "@/components/dialog";
import { FormatToolbar, RichText } from "@/components/rich-text";
import { Notice, useRunner } from "@/components/use-runner";
import type { ArticleView } from "@/lib/server/load";
import { CATEGORIES, CATEGORY_LABELS, type RichText as Rich, type SummaryContent } from "@/types";

const BADGE = { ai: "bg-blue-100 text-blue-700", bio: "bg-green-100 text-green-700", ai_bio: "bg-violet-100 text-violet-700" };
const BORDER = { ai: "border-l-blue-500", bio: "border-l-green-500", ai_bio: "border-l-violet-500" };

function ItemList({ items, onChange, onSave }: { items: Rich[]; onChange: (items: Rich[]) => void; onSave: () => void }) {
  return (
    <ul className="space-y-1">
      {items.map((html, i) => (
        <li key={i} className="group flex gap-2 text-sm">
          <span className="text-slate-400">•</span>
          <RichText
            html={html}
            className="flex-1"
            onChange={(h) => onChange(items.map((x, j) => (j === i ? h : x)))}
            onBlur={onSave}
          />
          <button className="btn-icon invisible group-hover:visible" title="항목 삭제" onClick={() => { onChange(items.filter((_, j) => j !== i)); setTimeout(onSave); }}>✕</button>
        </li>
      ))}
      <li>
        <button className="btn-icon" onClick={() => onChange([...items, ""])}>+ 항목 추가</button>
      </li>
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <h4 className="mb-1.5 text-xs font-bold text-indigo-700">{title}</h4>
      {children}
    </div>
  );
}

function PastePanel({ id, error }: { id: string; error: string | null }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function submit(rawText?: string) {
    setBusy(true);
    const res = await fetch(`/api/articles/${id}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rawText ? { rawText } : {}),
    });
    setBusy(false);
    if (!res.ok) setMsg((await res.json().catch(() => ({}))).error ?? "실패");
    router.refresh();
  }
  return (
    <div className="space-y-2 p-4">
      <p className="text-sm text-red-600">{error ?? "요약에 실패했어요."}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="보도자료 본문을 복사해 붙여넣으세요" className="input w-full" />
      <div className="flex gap-2">
        <button disabled={busy || text.trim().length < 50} onClick={() => submit(text)} className="btn-primary">{busy ? "요약 중…" : "붙여넣은 본문으로 요약"}</button>
        <button disabled={busy} onClick={() => submit()} className="btn">다시 시도</button>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}

export function ArticleCard({ view, onMove }: { view: ArticleView; onMove: (d: -1 | 1) => void }) {
  const { article: a } = view;
  const router = useRouter();
  const { pending, notice, run } = useRunner();
  const [content, setContent] = useState<SummaryContent<Rich> | null>(view.content);
  const latest = useRef(view.content);
  const [dirty, setDirty] = useState(false);
  const [resumming, setResumming] = useState(false);

  const update = (next: SummaryContent<Rich>) => {
    latest.current = next;
    setContent(next);
    setDirty(true);
  };
  // 글상자에서 벗어날 때 자동 저장. setTimeout: 같은 순간의 삭제·수정이 반영된 뒤 저장
  const save = () =>
    setTimeout(() => {
      const c = latest.current;
      if (c) run(() => actions.saveEditedSummary(a.id, c), () => setDirty(false));
    });

  async function resummarize() {
    if (view.edited && !(await askConfirm("직접 고친 내용이 AI 요약으로 덮어써져요. 계속할까요?"))) return;
    setResumming(true);
    await fetch(`/api/articles/${a.id}/summarize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setResumming(false);
    router.refresh();
  }

  const busy = a.status === "fetching" || a.status === "summarizing" || resumming;

  return (
    <article className={`card overflow-hidden border-l-4 ${BORDER[a.category]} ${a.includeInMail ? "" : "opacity-60"}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs">
        <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
          <input type="checkbox" checked={a.includeInMail} onChange={(e) => run(() => actions.updateArticle(a.id, { includeInMail: e.target.checked }))} />
          메일 포함
        </label>
        <select value={a.category} onChange={(e) => run(() => actions.updateArticle(a.id, { category: e.target.value as typeof a.category }))} className={`rounded-full px-2 py-0.5 font-semibold ${BADGE[a.category]}`}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <span className="ml-auto flex items-center gap-1 text-slate-500">
          {pending ? "저장 중…" : dirty ? "수정됨" : view.edited ? "직접 수정함 ✓" : ""}
          <button className="btn-icon" title="위로" onClick={() => onMove(-1)}>▲</button>
          <button className="btn-icon" title="아래로" onClick={() => onMove(1)}>▼</button>
          <button className="btn-icon !text-red-500" title="삭제" onClick={async () => (await askConfirm("이 기사를 지울까요?", { danger: true })) && run(() => actions.deleteArticle(a.id))}>삭제</button>
        </span>
      </header>

      <div className="space-y-1 px-4 pt-3">
        <p className="text-xs text-slate-500">{[a.ministry, a.department].filter(Boolean).join(" · ") || "부처 확인 중"}</p>
        <h3 className="text-lg font-bold leading-snug">
          <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.title || a.url} ↗</a>
        </h3>
      </div>

      {busy ? (
        <p className="p-6 text-center text-sm text-slate-400">⏳ {a.status === "fetching" ? "본문을 가져오는 중…" : "AI가 요약하는 중…"}</p>
      ) : a.status === "failed" || !content ? (
        <PastePanel id={a.id} error={a.error} />
      ) : (
        <div className="space-y-2 p-4">
          <div className="sticky top-12 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/90 px-1 py-1 backdrop-blur">
            <FormatToolbar />
            <span className="flex gap-1">
              {view.edited && <button className="btn !py-0.5 text-xs" onClick={async () => (await askConfirm("직접 고친 내용을 버리고 AI 원본으로 되돌릴까요?")) && run(() => actions.resetEditedSummary(a.id))}>원본으로</button>}
              <button className="btn !py-0.5 text-xs" onClick={resummarize}>AI 재요약</button>
            </span>
          </div>
          <Section title="① 추진 배경">
            <ItemList items={content.background} onChange={(v) => update({ ...content, background: v })} onSave={save} />
          </Section>
          <Section title="② 주요 내용">
            <div className="space-y-2">
              {content.mainPoints.map((s, i) => (
                <div key={i}>
                  <input
                    value={s.heading}
                    onChange={(e) => update({ ...content, mainPoints: content.mainPoints.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)) })}
                    onBlur={save}
                    className="mb-1 w-full bg-transparent text-sm font-bold outline-none before:content-['■']"
                    placeholder="■ 소제목"
                  />
                  <ItemList items={s.items} onChange={(v) => update({ ...content, mainPoints: content.mainPoints.map((x, j) => (j === i ? { ...x, items: v } : x)) })} onSave={save} />
                </div>
              ))}
              <button className="btn-icon" onClick={() => update({ ...content, mainPoints: [...content.mainPoints, { heading: "", items: [""] }] })}>+ 소제목 추가</button>
            </div>
          </Section>
          <Section title="③ 기대 효과 및 향후 계획">
            <ItemList items={content.effects} onChange={(v) => update({ ...content, effects: v })} onSave={save} />
          </Section>
          {(content.notes.length > 0 || dirty) && (
            <Section title="※ 참고사항">
              <ItemList items={content.notes} onChange={(v) => update({ ...content, notes: v })} onSave={save} />
            </Section>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        {a.tags.map((t) => <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5">#{t}</span>)}
        <button className="btn-icon" onClick={async () => { const t = await askText("태그 (쉼표로 구분)", a.tags.join(", ")); if (t !== null) run(() => actions.updateArticle(a.id, { tags: t.split(",").map((x) => x.trim()).filter(Boolean) })); }}>태그 편집</button>
        <span className="ml-auto">{a.contact}</span>
      </footer>
      <div className="px-4 pb-2"><Notice notice={notice?.ok ? null : notice} /></div>
    </article>
  );
}
