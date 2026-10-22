"use client";
// Design Ref: §3.1 — 보도자료 편집 화면: 날짜 탭, 링크 입력, 필터, 기사 카드
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import * as actions from "@/app/actions";
import { ArticleCard } from "@/components/article-card";
import { askConfirm, askText } from "@/components/dialog";
import { Notice, useRunner } from "@/components/use-runner";
import type { ArticleView } from "@/lib/server/load";
import { CATEGORIES, CATEGORY_LABELS, type Category, type DateTab } from "@/types";

const tabLabel = (date: string, end?: string | null) => {
  const f = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return end && end !== date ? `${f(date)}~${f(end)}` : f(date);
};

function TabBar({ tabs, tab }: { tabs: DateTab[]; tab: DateTab | null }) {
  const router = useRouter();
  const { pending, notice, run } = useRunner();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState("");

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/?tab=${t.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${t.id === tab?.id ? "bg-indigo-600 font-semibold text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {t.label}
          </Link>
        ))}
        {tabs.length === 0 && <span className="text-sm text-slate-400">아직 날짜 탭이 없어요. 아래에서 날짜를 고르고 &quot;+ 날짜 탭&quot;을 눌러 주세요.</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input !py-1" />
        <span className="text-slate-400">~</span>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input !py-1" title="기간 탭일 때만" />
        <button
          disabled={pending || !date}
          className="btn-primary !py-1.5"
          onClick={() =>
            run(async () => {
              const r = await actions.createDateTab({ date, endDate: end || null, label: tabLabel(date, end) });
              if (r.ok && "id" in r) router.push(`/?tab=${r.id}`);
              return r;
            }, () => setEnd(""))
          }
        >
          + 날짜 탭
        </button>
        {tab && (
          <span className="ml-auto flex gap-1">
            <button className="btn" onClick={async () => { const l = await askText("탭 이름", tab.label); if (l) run(() => actions.renameDateTab(tab.id, l)); }}>
              이름 변경
            </button>
            <button
              className="btn !text-red-600"
              onClick={async () => (await askConfirm(`"${tab.label}" 탭과 안의 기사를 모두 지울까요?`, { danger: true })) && run(() => actions.deleteDateTab(tab.id), () => router.push("/"))}
            >
              탭 삭제
            </button>
          </span>
        )}
      </div>
      <Notice notice={notice} />
    </section>
  );
}

function LinkInput({ tabId }: { tabId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const busy = progress !== null && progress.done < progress.total;

  // 한 건씩 차례로 보내 Vercel 제한 시간을 넘기지 않게 한다 (DESIGN §1)
  async function ingest() {
    const urls = [...new Set(text.split(/\s+/).map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u)))];
    if (urls.length === 0) return;
    const errors: string[] = [];
    setProgress({ done: 0, total: urls.length, errors });
    for (const [i, url] of urls.entries()) {
      const res = await fetch("/api/articles/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateTabId: tabId, url }),
      });
      if (!res.ok) errors.push(`${url} — ${(await res.json().catch(() => ({}))).error ?? res.status}`);
      setProgress({ done: i + 1, total: urls.length, errors: [...errors] });
      router.refresh();
    }
    setText("");
  }

  return (
    <section className="card space-y-2 p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="보도자료 링크를 붙여넣으세요 (여러 개는 줄바꿈으로)"
        className="input w-full resize-y"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy || !text.trim()} onClick={ingest} className="btn-primary">
          {busy ? `가져오는 중… (${progress.done}/${progress.total})` : "가져와서 AI 요약"}
        </button>
        {progress && !busy && (
          <span className="text-sm text-slate-500">
            {progress.total}건 중 {progress.total - progress.errors.length}건 추가
          </span>
        )}
      </div>
      {progress?.errors.map((e) => (
        <p key={e} className="text-sm text-red-600">{e}</p>
      ))}
    </section>
  );
}

export function EditorPage({ tabs, tab, views }: { tabs: DateTab[]; tab: DateTab | null; views: ArticleView[] }) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [ministry, setMinistry] = useState("all");
  const [query, setQuery] = useState("");
  const { run } = useRunner();

  const ministries = useMemo(() => [...new Set(views.map((v) => v.article.ministry).filter(Boolean))], [views]);
  const shown = views.filter(({ article: a, content }) => {
    if (category !== "all" && a.category !== category) return false;
    if (ministry !== "all" && a.ministry !== ministry) return false;
    if (!query) return true;
    return `${a.title} ${a.ministry} ${a.tags.join(" ")} ${JSON.stringify(content ?? "")}`.toLowerCase().includes(query.toLowerCase());
  });
  const included = views.filter((v) => v.article.includeInMail && v.article.status === "ready").length;
  const ids = views.map((v) => v.article.id);
  const move = (id: string, d: -1 | 1) => {
    const i = ids.indexOf(id);
    const j = i + d;
    if (!tab || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    run(() => actions.reorderArticles(tab.id, next));
  };

  return (
    <div className="space-y-4">
      <TabBar tabs={tabs} tab={tab} />
      {tab && (
        <>
          <LinkInput tabId={tab.id} />
          <section className="flex flex-wrap items-center gap-2 text-sm">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-3 py-1 ${category === c ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>
                {c === "all" ? "전체" : CATEGORY_LABELS[c]}
              </button>
            ))}
            <select value={ministry} onChange={(e) => setMinistry(e.target.value)} className="input !py-1">
              <option value="all">전체 부처</option>
              {ministries.map((m) => <option key={m}>{m}</option>)}
            </select>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 제목·내용·태그 검색" className="input !py-1" />
            <span className="ml-auto text-slate-500">
              메일 포함 <b className="text-indigo-600">{included}</b> / 전체 {views.length}건
            </span>
            <button className="btn" onClick={() => run(() => actions.setAllIncludeInMail(tab.id, true))}>전체 선택</button>
            <button className="btn" onClick={() => run(() => actions.setAllIncludeInMail(tab.id, false))}>전체 해제</button>
          </section>
          {views.length === 0 ? (
            <p className="card p-10 text-center text-slate-400">위에 보도자료 링크를 붙여넣으면 AI가 요약해 카드로 만들어요.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {shown.map((v) => (
                <ArticleCard key={`${v.article.id}-${v.version}`} view={v} onMove={(d) => move(v.article.id, d)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
