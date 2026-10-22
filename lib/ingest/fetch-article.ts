// Design Ref: §4.1 — 보도자료 웹페이지에서 제목·본문을 뽑는다. 부처·연락처 등은 AI가 본문에서 찾는다.
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";

export class IngestError extends Error {}

const BODY_SELECTORS = [
  ".view_cont", // korea.kr 정책브리핑
  ".article_body",
  ".bbs_view",
  ".board_view",
  ".view_con",
  "#content_body",
  "article",
  "main",
];

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  const v4 = ip.replace(/^::ffff:/, "");
  if (isIP(v4) !== 4) return false;
  const [a, b] = v4.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** http(s)만, 내부 주소는 막는다 (서버가 내부망 공격에 쓰이지 않게) */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new IngestError("올바른 링크가 아니에요.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new IngestError("http/https 링크만 넣을 수 있어요.");
  const { address } = await lookup(url.hostname).catch(() => {
    throw new IngestError("사이트 주소를 찾을 수 없어요.");
  });
  if (url.hostname === "localhost" || isPrivateIp(address)) throw new IngestError("내부 주소는 가져올 수 없어요.");
  return url;
}

// 사이트 공통 안내문(저작권·첨부파일 등)이 들어간 줄은 버린다
const BOILERPLATE = /공공누리|저작권|출처표시|첨부파일|\.hwpx?\b|\.pdf\b|바로보기|내려받기|이용조건|무단 ?전재|재배포/;

const clean = (s: string) =>
  s
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .filter((line) => !BOILERPLATE.test(line))
    .join("\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

const get = (url: URL | string) =>
  fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (newsletter-editor)" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

/**
 * korea.kr은 본문을 첨부 한글파일을 변환한 문서 뷰어(iframe)로 보여준다.
 * 뷰어 주소의 fn·rs 값으로 변환된 페이지({rs}/{fn}.files/{n}.html)를 직접 읽는다.
 */
async function readKoreaKrViewer($: cheerio.CheerioAPI, base: URL): Promise<string> {
  const src = $("iframe#content_press, .docConversion iframe").attr("src");
  if (!src) return "";
  const viewer = new URL(src, base);
  const fn = viewer.searchParams.get("fn");
  const rs = viewer.searchParams.get("rs");
  if (!fn || !rs || !/^[\w.]+$/.test(fn) || !rs.startsWith("/docViewer/")) return "";
  const dir = new URL(`${rs}/`, base);
  const index = await get(new URL(`${fn}.xml`, dir)).then((r) => (r.ok ? r.text() : ""));
  const pages = Math.min(Number(index.match(/<filespage_cnt>(\d+)</)?.[1] ?? 3), 20);
  const texts = await Promise.all(
    Array.from({ length: pages + 1 }, (_, i) =>
      get(new URL(`${fn}.files/${i}.html`, dir))
        .then((r) => (r.ok ? r.text() : ""))
        .then((html) => {
          const p = cheerio.load(html);
          p("br").replaceWith("\n");
          p("p, div, tr, li").append("\n");
          return p("body").text();
        })
        .catch(() => ""),
    ),
  );
  return clean(texts.join("\n"));
}

export async function fetchArticle(rawUrl: string): Promise<{ title: string; text: string }> {
  const url = await assertPublicUrl(rawUrl);
  const res = await get(url).catch(() => {
    throw new IngestError("사이트에 접속하지 못했어요.");
  });
  if (!res.ok) throw new IngestError(`사이트가 응답하지 않아요 (${res.status}).`);
  const $ = cheerio.load(await res.text());
  const viewerText = url.hostname.endsWith("korea.kr") ? await readKoreaKrViewer($, url) : "";
  $("script, style, noscript, nav, header, footer, iframe, form, [class*='copyright'], [class*='kogl'], [class*='file'], [class*='attach'], [class*='share'], [class*='sns']").remove();

  const title = clean(
    $('meta[property="og:title"]').attr("content") || $("h1").first().text() || $("title").text(),
  );
  $("br").replaceWith("\n");
  $("p, li, div, tr, h2, h3, h4").append("\n");

  let text = viewerText;
  for (const sel of viewerText.length > 300 ? [] : BODY_SELECTORS) {
    const t = clean($(sel).first().text());
    if (t.length > text.length) text = t;
    if (text.length > 500) break;
  }
  if (text.length < 300) text = clean($("body").text());
  // 제목은 사이트 머리말("[보도자료] ")을 뺀다
  const pageTitle = title.replace(/^\[(보도자료|참고자료|보도참고자료)\]\s*/, "");
  if (text.length < 200) throw new IngestError("본문을 찾지 못했어요.");
  return { title: pageTitle, text: text.slice(0, 30_000) };
}
