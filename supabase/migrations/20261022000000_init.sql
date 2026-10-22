-- Design Ref: §6 — types/index.ts의 데이터 구조를 그대로 옮긴 테이블.
-- 앱은 서버에서 service_role 키로만 접속한다. 모든 테이블에 RLS를 켜고 정책을 두지 않아
-- 브라우저용 공개 키(anon)로는 아무것도 읽거나 쓸 수 없게 막는다.

create table public.date_tabs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  end_date date,
  label text not null,
  created_at timestamptz not null default now(),
  constraint date_tabs_period check (end_date is null or end_date >= date)
);
create index date_tabs_date_idx on public.date_tabs (date desc);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  date_tab_id uuid not null references public.date_tabs (id) on delete cascade,
  url text not null,
  title text not null default '',
  ministry text not null default '',
  department text,
  contact text,
  raw_text text not null default '',
  category text not null default 'ai' check (category in ('ai', 'bio', 'ai_bio')),
  tags text[] not null default '{}',
  include_in_mail boolean not null default true,
  position integer not null default 0,
  status text not null default 'fetching' check (status in ('fetching', 'summarizing', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  -- 같은 날짜 탭에 같은 링크를 두 번 넣지 못하게 한다 (DESIGN §8 "이미 추가한 링크")
  constraint articles_tab_url_unique unique (date_tab_id, url)
);
create index articles_tab_position_idx on public.articles (date_tab_id, position);

create table public.summaries (
  article_id uuid primary key references public.articles (id) on delete cascade,
  ai_original jsonb not null,
  edited jsonb,
  highlight_candidates text[] not null default '{}',
  model text not null,
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  group_name text
);

create table public.mail_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  greeting jsonb not null,
  closing jsonb not null,
  is_default boolean not null default false
);
-- 기본 템플릿은 하나만
create unique index mail_templates_one_default on public.mail_templates (is_default) where is_default;

create table public.send_logs (
  id uuid primary key default gen_random_uuid(),
  -- 날짜 탭을 지워도 발송 이력은 남긴다
  date_tab_id uuid references public.date_tabs (id) on delete set null,
  subject text not null,
  recipients text[] not null,
  article_ids uuid[] not null,
  html text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  error text,
  sent_at timestamptz not null default now()
);
create index send_logs_sent_at_idx on public.send_logs (sent_at desc);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger summaries_touch_updated_at
  before update on public.summaries
  for each row execute function public.touch_updated_at();

alter table public.date_tabs enable row level security;
alter table public.articles enable row level security;
alter table public.summaries enable row level security;
alter table public.contacts enable row level security;
alter table public.mail_templates enable row level security;
alter table public.send_logs enable row level security;
