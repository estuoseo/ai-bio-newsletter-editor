// Design Ref: §4.3 — 메일 HTML 만들기. 메일 프로그램에서 깨지지 않게 표(table) + 인라인 스타일만 쓴다.
// 브라우저(미리보기)와 서버(실제 발송)가 같은 함수를 써서 미리보기와 받는 메일이 같다.
import { escapeHtml, richToEmailHtml } from "@/lib/html";
import { CATEGORY_LABELS, type Article, type Category, type MailLayout, type RichText, type SummaryContent } from "@/types";

export type NewsletterItem = { article: Article; content: SummaryContent<RichText> };

export type NewsletterInput = {
  subject: string;
  /** 날짜 탭의 날짜 (기사 옆 날짜 표시용) */
  date: string;
  greeting: RichText;
  closing: RichText;
  layout: MailLayout;
  items: NewsletterItem[];
};

/** 제목의 {날짜}를 "10월 6일(월)" 형식으로 바꾼다 */
export function applySubjectTemplate(subject: string, date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  const label = Number.isNaN(d.getTime())
    ? date
    : `${d.getMonth() + 1}월 ${d.getDate()}일(${"일월화수목금토"[d.getDay()]})`;
  return subject.replaceAll("{날짜}", label);
}

// --- 디자인 값 ------------------------------------------------------------

const FONT = "'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif";
const INK = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const INDIGO = "#4f46e5";

const THEME: Record<Category, { main: string; soft: string; chip: string; chipText: string }> = {
  ai: { main: "#4f46e5", soft: "#eef2ff", chip: "#e0e7ff", chipText: "#4338ca" },
  bio: { main: "#059669", soft: "#ecfdf5", chip: "#d1fae5", chipText: "#047857" },
  ai_bio: { main: "#7c3aed", soft: "#f5f3ff", chip: "#ede9fe", chipText: "#6d28d9" },
};

const PARTS: { cat: Category; title: string; desc: string; empty: string }[] = [
  { cat: "ai", title: "인공지능 (AI) 분야 보도자료", desc: "정부 부처 인공지능 정책, 피지컬 AI·로보틱스 및 산업 진흥 관련 보도자료", empty: "해당 일자에 등록된 인공지능 보도자료가 없습니다." },
  { cat: "bio", title: "바이오 (BIO) 분야 보도자료", desc: "정부 부처 첨단바이오, 바이오 오가노이드 및 바이오헬스 관련 보도자료", empty: "해당 일자에 등록된 바이오 보도자료가 없습니다." },
  { cat: "ai_bio", title: "AI + 바이오 융합 보도자료", desc: "인공지능과 바이오가 함께 다뤄진 융합 분야 보도자료", empty: "" },
];

const SECTIONS = [
  { key: "background", n: 1, title: "추진 배경 &amp; 경과" },
  { key: "mainPoints", n: 2, title: "주요 내용 &amp; 세부 지원방안" },
  { key: "effects", n: 3, title: "기대 효과 &amp; 향후 일정" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** 원문 사이트 이름. 정책브리핑(korea.kr)이 아니면 사이트 주소를 보여준다 */
function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.endsWith("korea.kr") ? "대한민국 정책브리핑" : escapeHtml(host);
  } catch {
    return "보도자료 원문";
  }
}

// --- 조각 ------------------------------------------------------------------

const chip = (text: string, bg: string, color: string, border = bg) =>
  `<span style="display:inline-block;margin:0 4px 4px 0;padding:3px 8px;border-radius:4px;background:${bg};border:1px solid ${border};color:${color};font-size:11px;font-weight:700;line-height:1.3;">${text}</span>`;

const bullet = (html: RichText) =>
  `<tr><td width="14" valign="top" style="padding:3px 0 3px 2px;color:${MUTED};font-size:13px;line-height:1.7;">•</td><td style="padding:3px 0;font-size:13px;line-height:1.7;color:${BODY};">${richToEmailHtml(html)}</td></tr>`;

const dash = (html: RichText) =>
  `<tr><td width="22" valign="top" style="padding:3px 0 3px 10px;color:#94a3b8;font-size:13px;line-height:1.7;">-</td><td style="padding:3px 0;font-size:13px;line-height:1.7;color:#475569;">${richToEmailHtml(html)}</td></tr>`;

const rows = (inner: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table>`;

function sectionBox(n: number, title: string, body: string, color: string): string {
  return `<tr><td style="padding:0 0 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;background:#ffffff;">
<tr><td style="padding:12px 14px 4px;">
<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;background:${color};color:#ffffff;font-size:11px;font-weight:800;text-align:center;">${n}</span>
<span style="padding-left:6px;font-size:13px;font-weight:800;color:${INK};">${title}</span>
</td></tr>
<tr><td style="padding:2px 14px 10px;">${body}</td></tr>
</table></td></tr>`;
}

function mainPointsBody(c: SummaryContent<RichText>, color: string, soft: string): string {
  return c.mainPoints
    .map((s) => {
      const heading = s.heading
        ? `<tr><td colspan="2" style="padding:8px 0 4px;"><span style="color:${color};font-size:11px;">■</span> <span style="background:${soft};color:${INK};font-size:13px;font-weight:800;padding:2px 6px;border-radius:3px;">${escapeHtml(s.heading)}</span></td></tr>`
        : "";
      return heading + s.items.map(dash).join("");
    })
    .join("");
}

function articleBlock(no: number, date: string, { article: a, content: c }: NewsletterItem): string {
  const t = THEME[a.category];
  const chips = [
    chip(escapeHtml(a.ministry || "부처 미상"), INK, "#ffffff"),
    a.department ? chip(escapeHtml(a.department), "#ffffff", BODY, "#cbd5e1") : "",
    chip(CATEGORY_LABELS[a.category], t.chip, t.chipText),
  ].join("");
  const url = escapeHtml(a.url);
  const bodies: Record<(typeof SECTIONS)[number]["key"], string> = {
    background: rows(c.background.map(bullet).join("")),
    mainPoints: rows(mainPointsBody(c, t.main, t.soft)),
    effects: rows(c.effects.map(bullet).join("")),
  };
  const sections = SECTIONS.filter((s) => (s.key === "mainPoints" ? c.mainPoints.length : c[s.key].length))
    .map((s) => sectionBox(s.n, s.title, bodies[s.key], t.main))
    .join("");
  const notes = c.notes.length
    ? `<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;"><tr><td style="padding:10px 14px;"><div style="font-size:12px;font-weight:800;color:#b45309;padding-bottom:2px;">💡 참고사항</div>${rows(c.notes.map(bullet).join(""))}</td></tr></table></td></tr>`
    : "";
  const owner = [a.ministry, a.department].filter(Boolean).map((v) => escapeHtml(String(v))).join(" ");
  const contact = a.contact ? ` · ☎ ${escapeHtml(a.contact)}` : "";

  return `<tr><td style="padding:0 0 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px;background:#ffffff;">
<tr><td style="padding:14px 14px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top">${chips}</td>
<td valign="top" align="right" style="white-space:nowrap;font-size:11px;color:${MUTED};padding-top:3px;">📅 ${date}</td>
</tr></table>
</td></tr>
<tr><td style="padding:4px 14px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.soft};border-left:4px solid ${t.main};border-radius:8px;">
<tr><td style="padding:14px 16px;">
<div style="font-size:11px;font-weight:800;color:${t.main};padding-bottom:6px;"><span style="background:${t.main};color:#ffffff;padding:2px 7px;border-radius:3px;">보도자료 ${pad(no)}</span>&nbsp; ✦ 핵심 정책 발표</div>
<a href="${url}" target="_blank" style="display:block;font-size:20px;line-height:1.45;font-weight:800;color:${INK};text-decoration:none;">${escapeHtml(a.title)}</a>
<div style="margin-top:12px;padding-top:12px;border-top:1px dashed #cbd5e1;">
<a href="${url}" target="_blank" style="display:inline-block;white-space:nowrap;background:${t.main};color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;padding:7px 12px;border-radius:6px;">공식원문 바로보기 →</a>
<div style="padding-top:8px;font-size:11px;color:${MUTED};">출처: ${sourceName(a.url)}</div>
</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 14px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:13px;font-weight:800;color:${INK};">✦ 핵심 브리핑 요약</td>
<td align="right"><span style="font-size:10px;color:${INDIGO};border:1px solid #c7d2fe;background:#eef2ff;padding:2px 6px;border-radius:4px;">공식 배포문 기준</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:8px 14px 4px;">${rows(sections + notes)}</td></tr>
<tr><td style="padding:10px 14px 14px;border-top:1px solid ${LINE};font-size:11px;color:${MUTED};">소관: <b style="color:${BODY};">${owner}</b>${contact}</td></tr>
</table></td></tr>`;
}

function partHeader(index: number, part: (typeof PARTS)[number], count: number): string {
  const t = THEME[part.cat];
  return `<tr><td style="padding:6px 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.soft};border-left:4px solid ${t.main};border-radius:8px;">
<tr><td style="padding:12px 16px;">
<div style="font-size:15px;font-weight:800;color:${t.main};">[${index}부] ${part.title} (${count}건)</div>
<div style="font-size:11px;color:${MUTED};padding-top:3px;">${part.desc}</div>
</td></tr></table></td></tr>`;
}

const emptyPart = (text: string) =>
  `<tr><td style="padding:0 0 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed #cbd5e1;border-radius:10px;"><tr><td align="center" style="padding:22px;font-size:12px;color:#94a3b8;">${text}</td></tr></table></td></tr>`;

// --- 전체 ------------------------------------------------------------------

export function buildNewsletterHtml(input: NewsletterInput): string {
  let no = 0;
  let body: string;
  if (input.layout === "by_category") {
    // AI와 바이오는 0건이어도 항상 보여주고, 융합은 있을 때만 3부로 붙인다
    body = PARTS.filter((p) => p.cat !== "ai_bio" || input.items.some((i) => i.article.category === "ai_bio"))
      .map((p, i) => {
        const items = input.items.filter((it) => it.article.category === p.cat);
        return partHeader(i + 1, p, items.length) + (items.length ? items.map((it) => articleBlock(++no, input.date, it)).join("") : emptyPart(p.empty));
      })
      .join("");
  } else {
    body = input.items.map((it) => articleBlock(++no, input.date, it)).join("");
  }

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:20px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;">
<tr><td style="background:${INK};padding:26px 24px;color:#ffffff;">
<div style="font-size:11px;letter-spacing:.5px;color:#a5b4fc;font-weight:700;">AI · BIO POLICY BRIEFING</div>
<div style="font-size:22px;line-height:1.4;font-weight:800;padding-top:6px;">${escapeHtml(input.subject)}</div>
</td></tr>
<tr><td style="padding:20px 12px 6px;">
${input.greeting ? `<div style="font-size:14px;line-height:1.75;color:${BODY};padding:0 4px 20px;">${richToEmailHtml(input.greeting)}</div>` : ""}
${rows(body)}
${input.closing ? `<div style="font-size:14px;line-height:1.75;color:${BODY};padding:2px 4px 18px;">${richToEmailHtml(input.closing)}</div>` : ""}
</td></tr>
<tr><td style="background:${INK};padding:18px 24px;">
<div style="font-size:12px;font-weight:800;color:#ffffff;">정부 부처 보도자료 일일 브리핑 서비스</div>
<div style="font-size:11px;line-height:1.6;color:#94a3b8;padding-top:4px;">본 메일은 대한민국 정책브리핑에 게시된 정부 부처 공식 보도자료를 바탕으로 요약·편집한 브리핑입니다. 정확한 내용은 각 보도자료 원문을 확인해 주세요.</div>
</td></tr>
</table></td></tr></table></body></html>`;
}
