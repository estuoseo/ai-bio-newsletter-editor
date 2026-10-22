// 화면(Server Component)에 넘길 데이터를 한 번에 읽는다
import "server-only";
import { listArticles, listDateTabs, listSummaries, listTabIdsWithMailArticles } from "@/lib/db";
import { displayContent } from "@/lib/html";
import type { Article, DateTab, RichText, SummaryContent } from "@/types";

export type ArticleView = {
  article: Article;
  content: SummaryContent<RichText> | null;
  edited: boolean;
  /** AI 요약이 새로 나오거나 원본으로 되돌렸을 때만 바뀐다. 바뀌면 카드 편집 상태를 새로 시작한다 */
  version: string;
};

/** preferMail: 탭을 지정하지 않았으면 메일에 넣을 기사가 있는 가장 최근 탭을 연다 (메일 발송 화면용) */
export async function loadTab(tabParam: string | string[] | undefined, opts: { preferMail?: boolean } = {}) {
  const tabs: DateTab[] = await listDateTabs();
  let tab = tabs.find((t) => t.id === tabParam) ?? null;
  if (!tab && opts.preferMail) {
    const withMail = await listTabIdsWithMailArticles();
    tab = tabs.find((t) => withMail.has(t.id)) ?? null;
  }
  tab ??= tabs[0] ?? null;
  if (!tab) return { tabs, tab, views: [] as ArticleView[] };
  const articles = await listArticles(tab.id);
  const summaries = await listSummaries(articles.map((a) => a.id));
  const views = articles.map((article): ArticleView => {
    const s = summaries.get(article.id);
    return {
      article,
      content: s ? displayContent(s) : null,
      edited: Boolean(s?.edited),
      // 직접 수정 저장(updatedAt만 바뀜)으로는 바뀌지 않아야 입력 중 카드가 다시 그려지지 않는다
      version: `${article.status}-${s?.edited ? "e" : "o"}-${s ? JSON.stringify(s.aiOriginal).length : 0}-${s?.highlightCandidates.join("|") ?? ""}`,
    };
  });
  return { tabs, tab, views };
}
