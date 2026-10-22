"use client";
// Design Ref: §3.3 — 메일 서버 상태, 주소록, 템플릿
import { useState } from "react";
import * as actions from "@/app/actions";
import { askConfirm, askText, tell } from "@/components/dialog";
import { Notice, useRunner } from "@/components/use-runner";
import type { Contact, MailTemplate } from "@/types";

type SmtpView = { host: string; port: number; secure: boolean; user: string; from: string } | null;

/** "이름,이메일,그룹" 한 줄씩. 첫 줄이 제목줄이면 건너뛴다 */
function parseCsv(text: string) {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")))
    .filter(([, email]) => email?.includes("@"))
    .map(([name, email, groupName]) => ({ name: name || email, email, groupName: groupName || null }));
}

export function SettingsPage({ contacts, templates, smtp }: { contacts: Contact[]; templates: MailTemplate[]; smtp: SmtpView }) {
  const { pending, notice, run } = useRunner();
  const [form, setForm] = useState({ name: "", email: "", groupName: "" });

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-5 text-sm">
        <h2 className="text-base font-bold">메일 서버 (SMTP)</h2>
        {smtp ? (
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1">
            <dt className="text-slate-500">서버</dt><dd>{smtp.host}:{smtp.port} ({smtp.secure ? "SSL" : "STARTTLS"})</dd>
            <dt className="text-slate-500">계정</dt><dd>{smtp.user}</dd>
            <dt className="text-slate-500">보내는 주소</dt><dd>{smtp.from}</dd>
            <dt className="text-slate-500">비밀번호</dt><dd>••••••••</dd>
          </dl>
        ) : (
          <p className="text-red-600">아직 설정되지 않았어요.</p>
        )}
        <p className="text-xs text-slate-500">
          값은 보안을 위해 화면이 아니라 <code>.env</code>(배포 후에는 Vercel 환경변수)에서 바꿔요:
          <code> SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM</code>. Gmail은 smtp.gmail.com:465 + 앱 비밀번호, 네이버는 smtp.naver.com:465.
        </p>
        <button disabled={pending || !smtp} className="btn" onClick={() => run(actions.testSmtp)}>연결 테스트</button>
      </section>

      <section className="card space-y-3 p-5 text-sm">
        <h2 className="text-base font-bold">주소록 ({contacts.length}명)</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => actions.saveContact({ ...form, groupName: form.groupName || null }), () => setForm({ name: "", email: "", groupName: "" }));
          }}
        >
          <input required placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-28" />
          <input required type="email" placeholder="이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input flex-1" />
          <input placeholder="그룹 (예: 업무용)" value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} className="input w-36" />
          <button disabled={pending} className="btn-primary">추가</button>
        </form>
        <label className="btn cursor-pointer">
          CSV 가져오기 (이름,이메일,그룹)
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 900_000) return tell("파일이 너무 커요 (900KB 이하).");
              run(async () => actions.importContacts(parseCsv(await file.text())));
            }}
          />
        </label>
        <Notice notice={notice} />
        <table className="w-full text-left">
          <thead className="text-xs text-slate-500"><tr><th className="py-1">이름</th><th>이메일</th><th>그룹</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <tr key={c.id}>
                <td className="py-1.5">{c.name}</td>
                <td>{c.email}</td>
                <td>{c.groupName}</td>
                <td className="text-right">
                  <button className="btn-icon" onClick={async () => { const g = await askText("그룹", c.groupName ?? ""); if (g !== null) run(() => actions.saveContact({ id: c.id, name: c.name, email: c.email, groupName: g || null })); }}>그룹 변경</button>
                  <button className="btn-icon !text-red-500" onClick={async () => (await askConfirm(`${c.name} 님을 지울까요?`, { danger: true })) && run(() => actions.deleteContact(c.id))}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-base font-bold">메일 템플릿</h2>
        <p className="text-xs text-slate-500">템플릿은 메일 발송 화면에서 &quot;지금 제목·인삿말을 템플릿으로 저장&quot;으로 만들어요.</p>
        <ul className="divide-y divide-slate-100">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-1.5">
              <b>{t.name}</b>
              {t.isDefault && <span className="rounded bg-indigo-100 px-1.5 text-xs text-indigo-700">기본</span>}
              <span className="flex-1 truncate text-slate-500">{t.subject}</span>
              {!t.isDefault && <button className="btn-icon" onClick={() => run(() => actions.saveMailTemplate({ ...t, isDefault: true }))}>기본으로</button>}
              <button className="btn-icon !text-red-500" onClick={async () => (await askConfirm("템플릿을 지울까요?", { danger: true })) && run(() => actions.deleteMailTemplate(t.id))}>삭제</button>
            </li>
          ))}
          {templates.length === 0 && <li className="py-1.5 text-slate-400">아직 없어요.</li>}
        </ul>
      </section>
    </div>
  );
}
