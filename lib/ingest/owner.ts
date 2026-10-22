// 보도자료 맨 아래 "담당 부서" 표에서 담당 과와 책임자 연락처를 뽑는다.
// 표가 줄 단위로 풀리면 보통 이런 순서다:
//   담당 부서 / 혁신성장실 / 책임자 / 과 장 / 김혜련 / (044-215-4930) / 전략경제분석과 / 담당자 / 사무관 / …
// 첫 칸은 실·국 이름일 때가 많으므로, "~과"·"~팀"으로 끝나는 칸을 담당 과로 본다.

export type Owner = { division: string | null; contact: string | null };

const DIVISION = /^[가-힣A-Za-z0-9·()]+(과|팀)$/;
const UNIT = /^[가-힣A-Za-z0-9·()]+(실|국|관|단|센터|본부|과|팀)$/;
const PHONE = /0\d{1,2}-\d{3,4}-\d{4}/;
const NAME = /^[가-힣]{2,4}$/;
const TITLE = /^(과장|팀장|국장|실장|단장|센터장|본부장|부장|사무관|서기관|주무관|연구관|연구원)$/;

export function parseOwner(rawText: string): Owner {
  const lines = rawText.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const start = lines.findIndex((l) => /^담당\s*부서/.test(l));
  if (start < 0) return { division: null, contact: null };
  // 첫 번째 담당 부서 표만 본다 (함께 배포한 다른 기관 표는 제외)
  const next = lines.findIndex((l, i) => i > start && /^담당\s*부서/.test(l));
  const block = lines.slice(start + 1, next > 0 ? next : start + 40).map((l) => l.replace(/^담당\s*부서\s*/, ""));

  const division = block.find((l) => DIVISION.test(l)) ?? block.find((l) => UNIT.test(l)) ?? null;

  let contact: string | null = null;
  const boss = block.findIndex((l) => /^책임자/.test(l));
  if (boss >= 0) {
    // "과 장"처럼 띄어 쓴 직함도 있으므로 공백을 빼고 비교한다
    const after = block.slice(boss + 1, boss + 6).map((l) => l.replace(/\s/g, ""));
    const title = after.find((l) => TITLE.test(l));
    const name = after.find((l) => NAME.test(l) && !TITLE.test(l));
    const phone = after.join(" ").match(PHONE)?.[0];
    contact = [title, name].filter(Boolean).join(" ") + (phone ? ` (${phone})` : "") || null;
  }
  if (!contact) contact = block.join(" ").match(PHONE)?.[0] ?? null;
  return { division, contact: contact?.trim() || null };
}
