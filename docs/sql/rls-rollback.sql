-- Undo docs/sql/rls-lockdown.sql (returns the database to the open demo posture).
-- Use only if the site breaks after the lockdown and you need it back immediately.
begin;
alter table public.counties          disable row level security;
alter table public.indicators        disable row level security;
alter table public.data_points       disable row level security;
alter table public.users             disable row level security;
alter table public.sessions          disable row level security;
alter table public.role_permissions  disable row level security;
alter table public.settings          disable row level security;
alter table public.site_content      disable row level security;
alter table public.data_submissions  disable row level security;
alter table public.access_requests   disable row level security;
alter table public.saved_queries     disable row level security;
alter table public.papers            disable row level security;
alter table public.updates           disable row level security;
alter table public.media             disable row level security;
alter table public.conversations     disable row level security;
alter table public.messages          disable row level security;
alter table public.events            disable row level security;
alter table public.media_generations disable row level security;
alter table public.partners          disable row level security;
-- the NIIS console tables (docs/sql/niis-console.sql, 10 Nov 2026)
alter table public.niis_batches      disable row level security;
alter table public.niis_raw_rows     disable row level security;
alter table public.niis_runs         disable row level security;
alter table public.niis_staged       disable row level security;
alter table public.niis_revisions    disable row level security;
alter table public.niis_denominators disable row level security;
alter table public.niis_sources      disable row level security;
alter table public.niis_reports      disable row level security;
alter table public.niis_audit        disable row level security;
alter table public.niis_api_keys     disable row level security;
alter view public.indicator_catalog reset (security_invoker);
grant execute on all functions in schema public to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
commit;
