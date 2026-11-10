-- NIIS database lockdown (formerly NICTD)
-- ---------------------------------------------------------------------------
-- The browser never talks to Supabase: only server.js does, through supadb.js.
-- So the public roles (anon, authenticated) need NO access at all. This script:
--   1. enables Row Level Security on every table, with no policies (deny-all for public roles);
--   2. makes the indicator_catalog view respect the caller's permissions;
--   3. pins each function's search_path;
--   4. removes EXECUTE on the RPC functions from the public roles.
-- The server's secret key (service_role) bypasses RLS and keeps full access.
--
-- PREREQUISITE: the server must run with SUPABASE_SECRET_KEY set (see docs/SECURITY.md).
-- Run this with the publishable key still in use and the site will stop returning data.
-- Undo: docs/sql/rls-rollback.sql
-- ---------------------------------------------------------------------------

begin;

-- 1. Row Level Security on every table, no policies
alter table public.counties          enable row level security;
alter table public.indicators        enable row level security;
alter table public.data_points       enable row level security;
alter table public.users             enable row level security;
alter table public.sessions          enable row level security;
alter table public.role_permissions  enable row level security;
alter table public.settings          enable row level security;
alter table public.site_content      enable row level security;
alter table public.data_submissions  enable row level security;
alter table public.access_requests   enable row level security;
alter table public.saved_queries     enable row level security;
alter table public.papers            enable row level security;
alter table public.updates           enable row level security;
alter table public.media             enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.events            enable row level security;
alter table public.media_generations enable row level security;
alter table public.partners          enable row level security;
-- the NIIS console tables (docs/sql/niis-console.sql, 10 Nov 2026)
alter table public.niis_batches      enable row level security;
alter table public.niis_raw_rows     enable row level security;
alter table public.niis_runs         enable row level security;
alter table public.niis_staged       enable row level security;
alter table public.niis_revisions    enable row level security;
alter table public.niis_denominators enable row level security;
alter table public.niis_sources      enable row level security;
alter table public.niis_reports      enable row level security;
alter table public.niis_audit        enable row level security;
alter table public.niis_api_keys     enable row level security;

-- 2. The view runs with the caller's rights instead of its owner's
alter view public.indicator_catalog set (security_invoker = true);

-- 3. Fixed search_path on every function
alter function public.all_years()                                              set search_path = public, pg_temp;
alter function public.analytics_summary()                                      set search_path = public, pg_temp;
alter function public.auth_session(text)                                       set search_path = public, pg_temp;
alter function public.bulk_publish(jsonb)                                      set search_path = public, pg_temp;
alter function public.explorer_table(text, integer)                            set search_path = public, pg_temp;
alter function public.growth_gaps()                                            set search_path = public, pg_temp;
alter function public.portal_stats()                                           set search_path = public, pg_temp;
alter function public.publish_data_point(text, integer, integer, double precision, text) set search_path = public, pg_temp;
alter function public.user_badges(integer, boolean)                            set search_path = public, pg_temp;

-- 4. Only the server may call the functions
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;
-- and the same for functions created later
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant  execute on functions to service_role;

commit;
