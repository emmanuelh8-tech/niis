-- NIIS Console: the system behind the site (Collect, Calculate, Store, Keep, Output), as in docs/NIIS-SYSTEM-PLAN.md.
-- Applied by Claude on 10 Nov 2026 with the owner's approval. Additive only: new tables, one new nullable
-- column on data_submissions, two storage buckets and one read-only function. No existing row is changed.
--
--   niis_batches        every intake (file, paste, link, open data, API push, form, provider portal), its
--                       original file's fingerprint (SHA-256) and where the file is kept
--   niis_raw_rows       the batch's rows as received, with what intake recognised in them
--   niis_runs           each "Process new data" run and its stage-by-stage log
--   niis_staged         the indicator values a run produced, with their quality checks (Q01 to Q12),
--                       waiting for approval and release
--   niis_revisions      every change to a published figure: old value, new value, who and why (Q12)
--   niis_denominators   the agreed population table (LISGIS) the rates are computed against (Q04)
--   niis_sources        linked sources pulled on demand: CSV/JSON links, World Bank series
--   niis_reports        ICT reports: generated from the data, or uploaded as PDF
--   niis_audit          who did what in the console
--   niis_api_keys       keys providers use to push data (only a hash is kept)
--
-- Row Level Security: like the other tables, these are reached only by server.js. docs/sql/rls-lockdown.sql
-- now covers them too, so the lockdown closes them with the rest.

begin;

create table if not exists public.niis_batches (
  id          bigint generated always as identity primary key,
  ref         text not null unique,
  method      text not null check (method in ('file', 'paste', 'url', 'open_data', 'api', 'form', 'portal')),
  title       text not null,
  provider    text,
  source_url  text,
  file_name   text,
  file_type   text,
  file_path   text,
  sha256      text,
  byte_size   integer,
  mapping     jsonb,
  row_count   integer not null default 0,
  status      text not null default 'mapping' check (status in ('mapping', 'received', 'processed', 'failed', 'archived')),
  signoff_by  text,
  signoff_at  timestamptz,
  signoff_note text,
  note        text,
  created_by  integer references public.users(id),
  created_at  timestamptz not null default now(),
  processed_at timestamptz,
  run_id      bigint
);
create index if not exists niis_batches_status_idx on public.niis_batches (status, created_at desc);

create table if not exists public.niis_raw_rows (
  id            bigint generated always as identity primary key,
  batch_id      bigint not null references public.niis_batches(id) on delete cascade,
  row_no        integer not null,
  indicator_text text,
  indicator_code text references public.indicators(code),
  county_text   text,
  county_id     integer references public.counties(id),
  level         text check (level in ('national', 'county')),
  period_text   text,
  year          integer,
  value_text    text,
  value         double precision,
  numerator     double precision,
  denominator   double precision,
  unit_text     text,
  source        text,
  submission_id integer references public.data_submissions(id) on delete set null,
  notes         text,
  status        text not null default 'new' check (status in ('new', 'ok', 'flagged', 'rejected', 'used'))
);
create index if not exists niis_raw_rows_batch_idx on public.niis_raw_rows (batch_id, row_no);

create table if not exists public.niis_runs (
  id          bigint generated always as identity primary key,
  started_by  integer references public.users(id),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running', 'done', 'failed')),
  batch_ids   bigint[] not null default '{}',
  stats       jsonb,
  log         jsonb,
  error       text
);

create table if not exists public.niis_staged (
  id              bigint generated always as identity primary key,
  run_id          bigint not null references public.niis_runs(id) on delete cascade,
  indicator_code  text not null references public.indicators(code),
  county_id       integer references public.counties(id),
  year            integer not null,
  value           double precision,
  numerator       double precision,
  denominator     double precision,
  published_value double precision,
  published_source text,
  prev_year_value double precision,
  method          text not null default 'reported',
  coverage        text,
  sources         text,
  batch_ids       bigint[] not null default '{}',
  raw_ids         bigint[] not null default '{}',
  checks          jsonb not null default '[]',
  severity        text not null default 'ok' check (severity in ('ok', 'warn', 'fail')),
  status          text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'released', 'superseded', 'suppressed')),
  decision_note   text,
  approved_by     integer references public.users(id),
  approved_at     timestamptz,
  released_by     integer references public.users(id),
  released_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists niis_staged_status_idx on public.niis_staged (status, indicator_code, year);

create table if not exists public.niis_revisions (
  id             bigint generated always as identity primary key,
  indicator_code text not null,
  county_id      integer,
  year           integer not null,
  old_value      double precision,
  new_value      double precision,
  old_source     text,
  new_source     text,
  staged_id      bigint references public.niis_staged(id) on delete set null,
  reason         text,
  released_by    integer references public.users(id),
  created_at     timestamptz not null default now()
);

create table if not exists public.niis_denominators (
  id         bigint generated always as identity primary key,
  county_id  integer references public.counties(id),
  year       integer not null,
  kind       text not null default 'population' check (kind in ('population', 'adults', 'households')),
  value      double precision not null check (value > 0),
  source     text not null,
  agreed_on  date,
  updated_at timestamptz not null default now()
);
create unique index if not exists niis_denominators_cell on public.niis_denominators (coalesce(county_id, 0), year, kind);

create table if not exists public.niis_sources (
  id             bigint generated always as identity primary key,
  name           text not null,
  kind           text not null check (kind in ('url', 'world_bank')),
  url            text,
  config         jsonb not null default '{}',
  provider       text,
  active         boolean not null default true,
  last_pulled_at timestamptz,
  last_sha256    text,
  last_status    text,
  created_by     integer references public.users(id),
  created_at     timestamptz not null default now()
);

create table if not exists public.niis_reports (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  title        text not null,
  tag          text not null default 'Report',
  period       text,
  summary      text,
  body         text,
  file_path    text,
  params       jsonb,
  generated    boolean not null default false,
  status       text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  created_by   integer references public.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_on date
);

create table if not exists public.niis_audit (
  id         bigint generated always as identity primary key,
  user_id    integer references public.users(id),
  user_name  text,
  action     text not null,
  target     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists niis_audit_time_idx on public.niis_audit (created_at desc);

create table if not exists public.niis_api_keys (
  id           bigint generated always as identity primary key,
  label        text not null,
  provider     text not null,
  key_prefix   text not null,
  key_hash     text not null unique,
  created_by   integer references public.users(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

-- a provider's portal submission, once it has been gathered into a batch
alter table public.data_submissions add column if not exists batch_id bigint references public.niis_batches(id) on delete set null;

-- coverage of the published store: one row per indicator and year (Data Analytics)
create or replace function public.niis_coverage()
returns table (indicator_code text, year integer, counties bigint, has_national boolean, demo bigint, total bigint)
language sql stable set search_path = public, pg_temp as $$
  select d.indicator_code, d.year,
         count(*) filter (where d.county_id is not null),
         bool_or(d.county_id is null),
         count(*) filter (where d.source ilike '%mock data%' or d.source ilike '%demonstration data%'),
         count(*)
  from data_points d group by d.indicator_code, d.year;
$$;

-- original files: private, read only by the server (secret key); 4 MB per file, as the server's limit
insert into storage.buckets (id, name, public, file_size_limit) values
  ('niis-raw', 'niis-raw', false, 4194304),
  ('niis-reports', 'niis-reports', true, 4194304)
on conflict (id) do nothing;

commit;

-- To undo (empty the two buckets in the dashboard first):
--   drop function if exists public.niis_coverage();
--   alter table public.data_submissions drop column if exists batch_id;
--   drop table if exists public.niis_api_keys, public.niis_audit, public.niis_reports, public.niis_sources,
--     public.niis_denominators, public.niis_revisions, public.niis_staged, public.niis_runs, public.niis_raw_rows,
--     public.niis_batches;
--   delete from storage.buckets where id in ('niis-raw', 'niis-reports');
