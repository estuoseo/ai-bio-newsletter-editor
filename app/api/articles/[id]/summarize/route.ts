import { z } from "zod";
import { updateArticle } from "@/lib/db";
import { summarizeStored } from "@/lib/server/ingest";

export const maxDuration = 60;

// rawText가 있으면 붙여넣은 본문으로 바꾼 뒤 요약, 없으면 저장된 원문으로 재요약 (F3, F8)
const body = z.object({ rawText: z.string().min(50).max(50_000).optional() });

export async function POST(request: Request, ctx: RouteContext<"/api/articles/[id]/summarize">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return Response.json({ error: "본문은 50자 이상 붙여넣어 주세요." }, { status: 400 });
  }
  try {
    if (parsed.data.rawText) await updateArticle(id, { rawText: parsed.data.rawText });
    return Response.json({ article: await summarizeStored(id) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "알 수 없는 오류" }, { status: 500 });
  }
}
