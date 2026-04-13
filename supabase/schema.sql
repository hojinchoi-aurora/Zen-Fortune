-- Zen Fortune · Supabase schema
-- Run this in Supabase SQL editor (or via CLI) on a fresh project.

-- ──────────────────────────────────────────
-- Tables
-- ──────────────────────────────────────────

create table if not exists drinks (
  id         bigserial primary key,
  name       text   not null,
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id                bigserial primary key,
  content           text   not null,
  drink_override_id bigint references drinks(id) on delete set null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- Per-device daily fortune. Acts as cache + view log.
create table if not exists daily_fortunes (
  date_key     date   not null,
  device_token text   not null,
  quote_id     bigint not null references quotes(id) on delete cascade,
  drink_id     bigint          references drinks(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (date_key, device_token)
);

-- Per-device daily like. Unique constraint = 1 like/device/day.
create table if not exists likes (
  date_key     date   not null,
  device_token text   not null,
  quote_id     bigint not null references quotes(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (date_key, device_token)
);

create index if not exists idx_daily_fortunes_quote on daily_fortunes(quote_id);
create index if not exists idx_daily_fortunes_date  on daily_fortunes(date_key);
create index if not exists idx_likes_quote          on likes(quote_id);
create index if not exists idx_likes_date           on likes(date_key);
create index if not exists idx_quotes_active        on quotes(is_active);
create index if not exists idx_drinks_active        on drinks(is_active);

-- ──────────────────────────────────────────
-- Views (analytics, derived)
-- ──────────────────────────────────────────

create or replace view quote_stats
with (security_invoker = true) as
  select
    q.id,
    q.content,
    q.is_active,
    coalesce(v.views_total, 0) as views_total,
    coalesce(l.likes_total, 0) as likes_total,
    coalesce(v.views_7d,    0) as views_7d,
    coalesce(l.likes_7d,    0) as likes_7d
  from quotes q
  left join (
    select quote_id,
           count(*)::int                                             as views_total,
           count(*) filter (where date_key >= current_date - 6)::int as views_7d
    from daily_fortunes
    group by quote_id
  ) v on v.quote_id = q.id
  left join (
    select quote_id,
           count(*)::int                                             as likes_total,
           count(*) filter (where date_key >= current_date - 6)::int as likes_7d
    from likes
    group by quote_id
  ) l on l.quote_id = q.id;

create or replace view drink_usage
with (security_invoker = true) as
  select
    d.id,
    d.name,
    d.note,
    d.is_active,
    coalesce(u.usage_total, 0) as usage_total,
    coalesce(u.usage_7d,    0) as usage_7d
  from drinks d
  left join (
    select drink_id,
           count(*)::int                                             as usage_total,
           count(*) filter (where date_key >= current_date - 6)::int as usage_7d
    from daily_fortunes
    where drink_id is not null
    group by drink_id
  ) u on u.drink_id = d.id;

-- ──────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────
-- All mutations happen via the service role key on the server (CF Pages Functions).
-- The anon key is never exposed to admin endpoints, and public endpoints also go
-- through the server, so we lock everything down at the row level.

alter table drinks          enable row level security;
alter table quotes          enable row level security;
alter table daily_fortunes  enable row level security;
alter table likes           enable row level security;

-- No policies = no public read/write. service_role bypasses RLS.
