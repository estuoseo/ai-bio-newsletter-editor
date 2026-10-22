// Design Ref: §9 — 브라우저에서 온 서식 HTML은 굵게·형광펜만 남기고 모두 지운다.
import "server-only";
import sanitizeHtml from "sanitize-html";
import { mapContent } from "@/lib/html";
import type { RichText, SummaryContent } from "@/types";

export function sanitizeRich(html: string): RichText {
  return sanitizeHtml(html, {
    allowedTags: ["b", "mark", "br"],
    allowedAttributes: { mark: ["data-color"] },
    allowedClasses: {},
    transformTags: { strong: "b" },
    exclusiveFilter: (frame) =>
      frame.tag === "mark" && !["yellow", "green", "blue"].includes(frame.attribs["data-color"] ?? ""),
  })
    .replace(/(<br\s*\/?>\s*)+$/g, "")
    .trim();
}

export function sanitizeContent(c: SummaryContent<string>): SummaryContent<RichText> {
  const clean = mapContent(c, sanitizeRich);
  const nonEmpty = (items: RichText[]) => items.filter((i) => i.length > 0);
  return {
    background: nonEmpty(clean.background),
    mainPoints: clean.mainPoints.map((s) => ({ heading: s.heading.replace(/<[^>]*>/g, "").trim(), items: nonEmpty(s.items) })),
    effects: nonEmpty(clean.effects),
    notes: nonEmpty(clean.notes),
  };
}
