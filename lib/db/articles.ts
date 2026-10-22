import "server-only";
import type { Article, Id } from "@/types";
import { db } from "./client";
import { check, unwrap } from "./errors";
import { ARTICLE_COLUMNS, toArticle, toRow, type ArticleRow } from "./rows";

/** 화면에 보이는 순서대로 (position) */
export async function listArticles(dateTabId: Id): Promise<Article[]> {
  const rows = unwrap(
    await db()
      .from("articles")
      .select("*")
      .eq("date_tab_id", dateTabId)
      .order("position")
      .order("created_at"),
  );
  return (rows as ArticleRow[]).map(toArticle);
}

/** 메일에 넣을 기사만 (M1~M4 미리보기·발송용) */
export async function listMailArticles(dateTabId: Id): Promise<Article[]> {
  const rows = unwrap(
    await db()
      .from("articles")
      .select("*")
      .eq("date_tab_id", dateTabId)
      .eq("include_in_mail", true)
      .eq("status", "ready")
      .order("position"),
  );
  return (rows as ArticleRow[]).map(toArticle);
}

/** 메일에 넣을 기사가 1건이라도 있는 날짜 탭 id들 (메일 발송 화면의 기본 탭 고르기용) */
export async function listTabIdsWithMailArticles(): Promise<Set<Id>> {
  const rows = unwrap<{ date_tab_id: Id }[]>(
    await db().from("articles").select("date_tab_id").eq("include_in_mail", true).eq("status", "ready"),
  );
  return new Set(rows.map((r) => r.date_tab_id));
}

export async function getArticle(id: Id): Promise<Article> {
  const row = unwrap(await db().from("articles").select("*").eq("id", id).single());
  return toArticle(row as ArticleRow);
}

/**
 * 링크를 붙여넣은 순간 "수집 중" 상태로 먼저 만든다.
 * 같은 탭에 같은 링크가 있으면 DbError("duplicate")가 난다 (DESIGN §8).
 */
export async function createArticle(input: { dateTabId: Id; url: string }): Promise<Article> {
  const last = unwrap(
    await db()
      .from("articles")
      .select("position")
      .eq("date_tab_id", input.dateTabId)
      .order("position", { ascending: false })
      .limit(1),
  ) as { position: number }[];
  const row = unwrap(
    await db()
      .from("articles")
      .insert({
        date_tab_id: input.dateTabId,
        url: input.url,
        position: (last[0]?.position ?? -1) + 1,
        status: "fetching",
      })
      .select()
      .single(),
  );
  return toArticle(row as ArticleRow);
}

export type ArticlePatch = Partial<Pick<Article, keyof typeof ARTICLE_COLUMNS>>;

export async function updateArticle(id: Id, patch: ArticlePatch): Promise<Article> {
  const row = unwrap(
    await db()
      .from("articles")
      .update(toRow(patch, ARTICLE_COLUMNS))
      .eq("id", id)
      .select()
      .single(),
  );
  return toArticle(row as ArticleRow);
}

export async function deleteArticle(id: Id): Promise<void> {
  check(await db().from("articles").delete().eq("id", id));
}

/** 끌어서 바꾼 순서를 그대로 저장한다. orderedIds[0]이 맨 위 */
export async function reorderArticles(dateTabId: Id, orderedIds: Id[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      db().from("articles").update({ position }).eq("id", id).eq("date_tab_id", dateTabId),
    ),
  );
  results.forEach(check);
}

/** 전체 선택/해제 (F7) */
export async function setAllIncludeInMail(dateTabId: Id, include: boolean): Promise<void> {
  check(
    await db().from("articles").update({ include_in_mail: include }).eq("date_tab_id", dateTabId),
  );
}
