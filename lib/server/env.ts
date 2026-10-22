// Design Ref: §5, §9 — 비밀 값은 이 파일에서만 읽는다. 브라우저 코드에서 import하면 빌드가 실패한다.
import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다.`);
  return value;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiApiKey: () => required("OPENAI_API_KEY"),
  openaiModel: () => process.env.OPENAI_MODEL || "gpt-5-mini",
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

/** 화면에 보여줄 때 메일 주소를 가린다. 예: example123@gmail.com → ex••••••••@gmail.com */
export function maskEmail(email: string): string {
  return email.replace(/^(.{0,2})[^@]*(@.*)$/, (_, head: string, domain: string) => `${head}••••••••${domain}`);
}

/** SMTP는 아직 설정 전일 수 있으므로 없으면 null */
export function smtpConfig(): SmtpConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 465);
  return {
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === "true" : port === 465,
    user: SMTP_USER,
    // Gmail 앱 비밀번호는 "abcd efgh ijkl mnop"처럼 띄어 써서 복사되므로 공백을 뺀다
    pass: SMTP_PASS.replace(/\s/g, ""),
    from: MAIL_FROM || SMTP_USER,
  };
}
