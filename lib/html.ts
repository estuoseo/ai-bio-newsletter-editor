// 서식 있는 글(RichText)을 다루는 순수 함수. 화면·서버·메일이 함께 쓴다.
import type { HighlightColor, RichText, Summary, SummaryContent } from "@/types";

export const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: "#fff1a8",
  green: "#c9f2d4",
  blue: "#cfe3ff",
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** AI가 고른 핵심 문구에 노란 형광펜을 미리 칠한다. 사용자가 편집기에서 지울 수 있다 */
function withHighlights(text: string, phrases: string[]): RichText {
  let html = escapeHtml(text);
  for (const phrase of phrases) {
    const p = escapeHtml(phrase.trim());
    if (p.length < 2 || !html.includes(p)) continue;
    html = html.replace(p, `<mark data-color="yellow">${p}</mark>`);
  }
  return html;
}

export function mapContent<A, B>(c: SummaryContent<A>, f: (a: A) => B): SummaryContent<B> {
  return {
    background: c.background.map(f),
    mainPoints: c.mainPoints.map((s) => ({ heading: String(s.heading), items: s.items.map(f) })),
    effects: c.effects.map(f),
    notes: c.notes.map(f),
  };
}

/** 화면·메일에 보여줄 요약: 수정본이 있으면 수정본, 없으면 AI 원본 + 형광펜 후보 */
export function displayContent(summary: Summary): SummaryContent<RichText> {
  return summary.edited ?? mapContent(summary.aiOriginal, (t) => withHighlights(t, summary.highlightCandidates));
}

/** 메일 프로그램은 class·data 속성을 무시하므로 형광펜을 인라인 스타일로 바꾼다 */
export function richToEmailHtml(html: RichText): string {
  return html.replace(
    /<mark data-color="(yellow|green|blue)">/g,
    (_, c: HighlightColor) => `<span style="background-color:${HIGHLIGHT_HEX[c]};padding:0 2px;">`,
  ).replace(/<\/mark>/g, "</span>");
}
