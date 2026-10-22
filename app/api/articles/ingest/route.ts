import { z } from "zod";
import { createArticle, DbError } from "@/lib/db";
import { ingestUrl } from "@/lib/server/ingest";

export const maxDuration = 60;

const body = z.object({ dateTabId: z.uuid(), url: z.url() });

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "링크 형식이 올바르지 않아요." }, { status: 400 });
  try {
    const article = await createArticle({ dateTabId: parsed.data.dateTabId, url: parsed.data.url.trim() });
    return Response.json({ article: await ingestUrl(article.id) });
  } catch (e) {
    if (e instanceof DbError && e.code === "duplicate") {
      return Response.json({ error: "이 날짜 탭에 이미 있는 보도자료예요." }, { status: 409 });
    }
    return Response.json({ error: e instanceof Error ? e.message : "알 수 없는 오류" }, { status: 500 });
  }
}
