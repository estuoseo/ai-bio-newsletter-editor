import "server-only";
import nodemailer from "nodemailer";
import { smtpConfig } from "@/lib/server/env";
import type { RecipientMode } from "@/types";

function transport() {
  const c = smtpConfig();
  if (!c) throw new Error("메일 서버(SMTP)가 설정되지 않았어요. Vercel/.env의 SMTP_* 값을 확인하세요.");
  return {
    from: c.from,
    t: nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass } }),
  };
}

export async function verifySmtp(): Promise<void> {
  await transport().t.verify();
}

/** 받는 사람 모두에게 1통. BCC 방식이면 받는사람 칸에는 보내는 주소만 보인다 */
export async function sendMail(input: { subject: string; html: string; recipients: string[]; mode: RecipientMode }): Promise<void> {
  const { from, t } = transport();
  await t.sendMail({
    from,
    subject: input.subject,
    html: input.html,
    ...(input.mode === "bcc" ? { to: from, bcc: input.recipients } : { to: input.recipients }),
  });
}

export function smtpFrom(): string | null {
  return smtpConfig()?.from ?? null;
}
