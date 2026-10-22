import Link from "next/link";

const LINKS = [
  { href: "/", label: "보도자료 편집" },
  { href: "/send", label: "메일 발송" },
  { href: "/settings", label: "설정" },
] as const;

const MINISTRIES = ["과학기술정보통신부", "산업통상부", "중소벤처기업부", "보건복지부"];

const STEPS = [
  { n: "1", title: "보도자료 선별", body: "정책브리핑에서 필요한 보도자료 링크를 골라 붙여넣기" },
  { n: "2", title: "AI 자동 요약", body: "추진 배경 · 주요 내용 · 기대 효과를 개조식으로 정리" },
  { n: "3", title: "직접 편집", body: "굵게 · 형광펜 · 항목 추가 · 참고사항 등 자유롭게 수정" },
  { n: "4", title: "뉴스레터 발송", body: "과장님 · 사무관님께 보기 좋은 메일로 바로 발송" },
];

/** 편집기의 목적과 사용 흐름. 처음 쓰는 사람이 바로 이해하도록 모든 화면 맨 위에 둔다 */
function Purpose() {
  return (
    <details open className="group mx-auto max-w-7xl px-4 pb-4">
      <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-xs text-white/50 hover:text-white/80">
        <span className="transition group-open:rotate-90">▶</span> 이 편집기는 무엇인가요?
      </summary>
      <div className="grid gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3 text-sm leading-relaxed text-white/80">
          <p>
            <b className="text-white">재정경제부 인공지능경제과</b>는 업무 특성상{" "}
            {MINISTRIES.map((m, i) => (
              <span key={m}>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-white">{m}</span>
                {i < MINISTRIES.length - 1 ? " " : ""}
              </span>
            ))}{" "}
            의 정책을 참고해야 할 일이 많습니다.
          </p>
          <p>
            <a href="https://www.korea.kr/briefing/pressReleaseList.do" target="_blank" rel="noreferrer" className="font-semibold text-indigo-300 underline-offset-2 hover:underline">
              대한민국 정책브리핑 보도자료 ↗
            </a>
            에서 관련 부처 최신 정책을 골라 링크만 넣으면, AI가 핵심을 요약하고 <b className="text-white">단순 문서보다 훨씬 보기 좋은 뉴스레터</b>로 만들어 메일로 보내 드립니다.
          </p>
        </div>
        <ol className="grid grid-cols-2 gap-2 text-xs">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <span className="mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white">{s.n}</span>
              <p className="font-bold text-white">{s.title}</p>
              <p className="mt-0.5 text-white/60">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

export function Nav({ active }: { active: (typeof LINKS)[number]["href"] }) {
  return (
    <>
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 pb-3 pt-5">
          <h1 className="text-xl font-extrabold">📰 AI·바이오 보도자료 뉴스레터 편집기</h1>
        </div>
        <Purpose />
      </header>
      {/* 스크롤해도 탭은 위에 붙어 있게 header 밖에 둔다 */}
      <nav className="sticky top-0 z-20 border-t border-white/10 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 py-2 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 ${active === l.href ? "bg-white/15 font-semibold" : "text-white/70 hover:text-white"}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
