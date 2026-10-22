// DB 칸 이름(snake_case) ↔ 앱 타입(camelCase) 변환. 테이블 정의: supabase/migrations/20261022000000_init.sql
import type {
  Article,
  ArticleStatus,
  Category,
  Contact,
  DateTab,
  MailTemplate,
  RichText,
  SendLog,
  SendStatus,
  Summary,
  SummaryContent,
} from "@/types";

export type DateTabRow = {
  id: string;
  date: string;
  end_date: string | null;
  label: string;
  created_at: string;
};

export const toDateTab = (r: DateTabRow): DateTab => ({
  id: r.id,
  date: r.date,
  endDate: r.end_date,
  label: r.label,
  createdAt: r.created_at,
});

export type ArticleRow = {
  id: string;
  date_tab_id: string;
  url: string;
  title: string;
  ministry: string;
  department: string | null;
  contact: string | null;
  raw_text: string;
  category: Category;
  tags: string[];
  include_in_mail: boolean;
  position: number;
  status: ArticleStatus;
  error: string | null;
  created_at: string;
};

export const toArticle = (r: ArticleRow): Article => ({
  id: r.id,
  dateTabId: r.date_tab_id,
  url: r.url,
  title: r.title,
  ministry: r.ministry,
  department: r.department,
  contact: r.contact,
  rawText: r.raw_text,
  category: r.category,
  tags: r.tags,
  includeInMail: r.include_in_mail,
  position: r.position,
  status: r.status,
  error: r.error,
  createdAt: r.created_at,
});

/** 앱 타입의 일부만 바꿀 때 쓰는 칸 이름 대응표 */
export const ARTICLE_COLUMNS = {
  url: "url",
  title: "title",
  ministry: "ministry",
  department: "department",
  contact: "contact",
  rawText: "raw_text",
  category: "category",
  tags: "tags",
  includeInMail: "include_in_mail",
  position: "position",
  status: "status",
  error: "error",
} as const satisfies Partial<Record<keyof Article, keyof ArticleRow>>;

export type SummaryRow = {
  article_id: string;
  ai_original: SummaryContent<string>;
  edited: SummaryContent<RichText> | null;
  highlight_candidates: string[];
  model: string;
  updated_at: string;
};

export const toSummary = (r: SummaryRow): Summary => ({
  articleId: r.article_id,
  aiOriginal: r.ai_original,
  edited: r.edited,
  highlightCandidates: r.highlight_candidates,
  model: r.model,
  updatedAt: r.updated_at,
});

export type ContactRow = {
  id: string;
  name: string;
  email: string;
  group_name: string | null;
};

export const toContact = (r: ContactRow): Contact => ({
  id: r.id,
  name: r.name,
  email: r.email,
  groupName: r.group_name,
});

export type MailTemplateRow = {
  id: string;
  name: string;
  subject: string;
  greeting: RichText;
  closing: RichText;
  is_default: boolean;
};

export const toMailTemplate = (r: MailTemplateRow): MailTemplate => ({
  id: r.id,
  name: r.name,
  subject: r.subject,
  greeting: r.greeting,
  closing: r.closing,
  isDefault: r.is_default,
});

export type SendLogRow = {
  id: string;
  date_tab_id: string | null;
  subject: string;
  recipients: string[];
  article_ids: string[];
  html: string;
  status: SendStatus;
  error: string | null;
  sent_at: string;
};

export const toSendLog = (r: SendLogRow): SendLog => ({
  id: r.id,
  dateTabId: r.date_tab_id,
  subject: r.subject,
  recipients: r.recipients,
  articleIds: r.article_ids,
  html: r.html,
  status: r.status,
  error: r.error,
  sentAt: r.sent_at,
});

/** camelCase 객체를 대응표대로 snake_case로 바꾼다. 값이 undefined인 칸은 빼서 "안 바꿈"으로 둔다 */
export function toRow<K extends string>(
  patch: Partial<Record<K, unknown>>,
  columns: Record<K, string>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as K[]) {
    if (patch[key] !== undefined && key in columns) row[columns[key]] = patch[key];
  }
  return row;
}
