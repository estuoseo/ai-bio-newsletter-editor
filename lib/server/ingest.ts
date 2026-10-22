// 수집 → 요약 → 저장 흐름 (DESIGN §4.1). Route Handler에서 부른다.
import "server-only";
import { summarizeArticle } from "@/lib/ai/summarize";
import { getArticle, saveAiSummary, updateArticle } from "@/lib/db";
import { fetchArticle } from "@/lib/ingest/fetch-article";
import { parseOwner } from "@/lib/ingest/owner";
import type { Article, Id } from "@/types";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 저장된 원문으로 요약한다. 실패하면 기사 상태를 failed로 남긴다 */
export async function summarizeStored(id: Id): Promise<Article> {
  const article = await getArticle(id);
  await updateArticle(id, { status: "summarizing", error: null });
  try {
    const { result, model } = await summarizeArticle({ title: article.title, text: article.rawText });
    // 담당 과·연락처는 원문 맨 아래 "담당 부서" 표에서 직접 읽은 값을 AI 추측보다 우선한다
    const owner = parseOwner(article.rawText);
    await saveAiSummary({
      articleId: id,
      aiOriginal: { background: result.background, mainPoints: result.mainPoints, effects: result.effects, notes: result.notes },
      highlightCandidates: result.highlights,
      model,
    });
    return await updateArticle(id, {
      title: article.title || result.title,
      ministry: result.ministry || article.ministry,
      department: owner.division ?? result.department,
      contact: owner.contact ?? result.contact,
      category: result.category,
      tags: result.tags,
      status: "ready",
      error: null,
    });
  } catch (e) {
    return await updateArticle(id, { status: "failed", error: errorMessage(e) });
  }
}

/** 링크에서 본문을 가져온 뒤 요약까지. 본문을 못 가져오면 "붙여넣기"를 기다리는 failed 상태 */
export async function ingestUrl(id: Id): Promise<Article> {
  const article = await getArticle(id);
  try {
    const { title, text } = await fetchArticle(article.url);
    await updateArticle(id, { title, rawText: text });
  } catch (e) {
    return await updateArticle(id, { status: "failed", error: `본문을 가져오지 못했어요: ${errorMessage(e)}` });
  }
  return summarizeStored(id);
}
