import "server-only";
import type { Id, RichText, Summary, SummaryContent } from "@/types";
import { db } from "./client";
import { check, unwrap, unwrapMaybe } from "./errors";
import { toSummary, type SummaryRow } from "./rows";

/** 요약이 아직 없으면 null */
export async function getSummary(articleId: Id): Promise<Summary | null> {
  const row = unwrapMaybe<SummaryRow>(
    await db().from("summaries").select("*").eq("article_id", articleId).maybeSingle(),
  );
  return row ? toSummary(row) : null;
}

/** 카드 목록·메일 미리보기에서 한 번에 읽기 */
export async function listSummaries(articleIds: Id[]): Promise<Map<Id, Summary>> {
  if (articleIds.length === 0) return new Map();
  const rows = unwrap(
    await db().from("summaries").select("*").in("article_id", articleIds),
  ) as SummaryRow[];
  return new Map(rows.map((r) => [r.article_id, toSummary(r)]));
}

/**
 * AI 요약 결과를 저장한다. 재요약(F8)이면 사용자 수정본(edited)은 지운다.
 * 덮어쓰기 전에 확인받는 것은 화면 쪽 책임이다.
 */
export async function saveAiSummary(input: {
  articleId: Id;
  aiOriginal: SummaryContent<string>;
  highlightCandidates: string[];
  model: string;
}): Promise<Summary> {
  const row = unwrap(
    await db()
      .from("summaries")
      .upsert({
        article_id: input.articleId,
        ai_original: input.aiOriginal,
        edited: null,
        highlight_candidates: input.highlightCandidates,
        model: input.model,
      })
      .select()
      .single(),
  );
  return toSummary(row as SummaryRow);
}

/** 카드 편집 자동 저장 (F6). AI 원본은 그대로 둔다 */
export async function saveEditedSummary(
  articleId: Id,
  edited: SummaryContent<RichText>,
): Promise<Summary> {
  const row = unwrap(
    await db()
      .from("summaries")
      .update({ edited })
      .eq("article_id", articleId)
      .select()
      .single(),
  );
  return toSummary(row as SummaryRow);
}

/** 수정본을 버리고 AI 원본으로 되돌린다 */
export async function resetEditedSummary(articleId: Id): Promise<void> {
  check(await db().from("summaries").update({ edited: null }).eq("article_id", articleId));
}
