// Design Ref: §4.1 — 보도자료 원문 → 개조식 3개 영역 요약 + 분류. 원문에 없는 내용은 쓰지 않는다.
import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { env } from "@/lib/server/env";
import type { AiSummaryResult } from "@/types";

const schema = z.object({
  title: z.string(),
  ministry: z.string(),
  department: z.string().nullable(),
  contact: z.string().nullable(),
  background: z.array(z.string()),
  mainPoints: z.array(z.object({ heading: z.string(), items: z.array(z.string()) })),
  effects: z.array(z.string()),
  notes: z.array(z.string()),
  category: z.enum(["ai", "bio", "ai_bio"]),
  tags: z.array(z.string()).max(5),
  highlights: z.array(z.string()).max(3),
});

const PROMPT = `너는 정부 부처 보도자료를 정책 담당자용 뉴스레터로 요약하는 편집자다.
반드시 아래 규칙을 지킨다.
1. 보도자료 원문에 있는 내용만 쓴다. 숫자·기관명·일정·금액은 원문 그대로 쓰고, 추측하거나 지어내지 않는다.
2. 개조식 문장으로 쓴다(명사형 종결: "~추진", "~예정", "~마련", "~함"). 항목당 1~2줄.
3. background(추진 배경) 2~3개, mainPoints(주요 내용) 소제목 1~3개와 각 항목 2~4개, effects(기대 효과·향후 계획) 2~3개.
4. notes는 용어 설명 등 참고사항이 꼭 필요할 때만, 없으면 빈 배열.
5. category: 인공지능 중심이면 "ai", 바이오·의료·제약·보건 중심이면 "bio", 둘 다 핵심이면 "ai_bio".
6. tags: 핵심 키워드 2~5개(# 없이). highlights: 요약 항목 안에 그대로 들어 있는 핵심 문구 1~3개.
7. 정책 내용만 요약한다. 웹사이트 안내문(저작권·공공누리·첨부파일·배포일·담당자 안내·사진 설명)은 요약에 넣지 않는다.
8. title은 보도자료 제목, ministry는 배포 부처명(예: 과학기술정보통신부).
   department는 원문 맨 아래 "담당 부서" 표의 담당 과 이름(예: 전략경제분석과). 실·국 이름(예: 혁신성장실)이 아니라 "~과"·"~팀"을 쓴다. contact는 책임자 직함·이름·전화번호. 없으면 null.
다음 JSON 형식으로만 답한다:
{"title":"","ministry":"","department":null,"contact":null,"background":[],"mainPoints":[{"heading":"","items":[]}],"effects":[],"notes":[],"category":"ai","tags":[],"highlights":[]}`;

let client: OpenAI | undefined;

export async function summarizeArticle(input: { title: string; text: string }): Promise<{ result: AiSummaryResult; model: string }> {
  client ??= new OpenAI({ apiKey: env.openaiApiKey() });
  const model = env.openaiModel();
  let lastError: unknown;
  // 형식이 틀리면 1번 더 시도한다 (DESIGN §4.1)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: `제목: ${input.title || "(없음)"}\n\n원문:\n${input.text}` },
        ],
      });
      const parsed = schema.parse(JSON.parse(res.choices[0]?.message.content ?? ""));
      return { result: parsed, model };
    } catch (e) {
      lastError = e;
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`AI 요약에 실패했어요: ${message.slice(0, 200)}`);
}
