// Design Ref: §6 — 앱 전체가 공유하는 데이터 구조. DB 테이블·API·화면이 모두 이 타입을 기준으로 한다.

/** DB가 만들어 주는 id (uuid 문자열) */
export type Id = string;

/** ISO 8601 날짜·시각 문자열. 예: "2026-10-22T09:00:00Z" */
export type Timestamp = string;

/** 날짜만 있는 문자열. 예: "2026-10-06" */
export type DateString = string;

export const CATEGORIES = ["ai", "bio", "ai_bio"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  ai: "AI",
  bio: "바이오",
  ai_bio: "AI+바이오",
};

export const ARTICLE_STATUSES = ["fetching", "summarizing", "ready", "failed"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export type DateTab = {
  id: Id;
  date: DateString;
  /** 기간 탭(예: 9/22~27)일 때만 값이 있다 */
  endDate: DateString | null;
  label: string;
  createdAt: Timestamp;
};

export type Article = {
  id: Id;
  dateTabId: Id;
  url: string;
  title: string;
  ministry: string;
  department: string | null;
  contact: string | null;
  /** 수집했거나 사용자가 붙여넣은 원문. AI 요약의 유일한 근거 */
  rawText: string;
  category: Category;
  tags: string[];
  includeInMail: boolean;
  position: number;
  status: ArticleStatus;
  error: string | null;
  createdAt: Timestamp;
};

// --- 서식 있는 글 ------------------------------------------------------------

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/**
 * 서식 있는 글 한 덩어리. 허용된 태그만 남긴 HTML 문자열이다
 * (<b> 굵게, <mark data-color="yellow|green|blue"> 형광펜). 저장 전에 lib/html.ts에서 정리한다.
 */
export type RichText = string;

// --- 요약 ------------------------------------------------------------------

export type SummarySection<T> = { heading: string; items: T[] };

/**
 * 요약 본문. AI 원본은 T = string, 사용자 수정본은 T = RichText.
 * 같은 모양을 쓰기 때문에 원본과 수정본을 바로 비교·교체할 수 있다.
 */
export type SummaryContent<T> = {
  background: T[];
  mainPoints: SummarySection<T>[];
  effects: T[];
  notes: T[];
};

/** AI가 돌려주는 JSON 전체 (원문에서 찾은 기본 정보 + 요약 + 분류 정보) */
export type AiSummaryResult = SummaryContent<string> & {
  title: string;
  ministry: string;
  department: string | null;
  contact: string | null;
  category: Category;
  tags: string[];
  /** 원문에 그대로 있는 핵심 문구. 형광펜 후보 */
  highlights: string[];
};

export type Summary = {
  articleId: Id;
  aiOriginal: SummaryContent<string>;
  /** 사용자가 고친 적이 없으면 null */
  edited: SummaryContent<RichText> | null;
  highlightCandidates: string[];
  model: string;
  updatedAt: Timestamp;
};

// --- 메일 ------------------------------------------------------------------

export type Contact = {
  id: Id;
  name: string;
  email: string;
  groupName: string | null;
};

export type MailTemplate = {
  id: Id;
  name: string;
  /** "{날짜}"가 발송 날짜로 바뀐다 */
  subject: string;
  greeting: RichText;
  closing: RichText;
  isDefault: boolean;
};

export const MAIL_LAYOUTS = ["by_category", "sequential"] as const;
/** by_category: 카테고리별 1부·2부 분리(기본) / sequential: 1~N위 순차 */
export type MailLayout = (typeof MAIL_LAYOUTS)[number];

export const RECIPIENT_MODES = ["bcc", "to"] as const;
export type RecipientMode = (typeof RECIPIENT_MODES)[number];

/** 메일 편집 화면의 입력값. 미리보기와 발송이 같은 값을 쓴다 */
export type MailDraft = {
  dateTabId: Id;
  subject: string;
  greeting: RichText;
  closing: RichText;
  layout: MailLayout;
  articleIds: Id[];
  recipients: string[];
  recipientMode: RecipientMode;
};

export const SEND_STATUSES = ["sending", "sent", "failed"] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export type SendLog = {
  id: Id;
  /** 날짜 탭을 지워도 이력은 남기 때문에 null일 수 있다 */
  dateTabId: Id | null;
  subject: string;
  recipients: string[];
  articleIds: Id[];
  html: string;
  status: SendStatus;
  error: string | null;
  sentAt: Timestamp;
};
