-- The Researcher account type (the owner asked for it, 30 October 2026).
--
-- Run once in the Supabase SQL editor. Until it has run, the site keeps to the three existing roles: it
-- offers Researcher (in the admin panel, the account request form and the dashboards) only once the role
-- has permissions in role_permissions, so nothing breaks in the meantime.
--
-- A researcher reads the registered (not stakeholder) data, downloads the open data, sees the platform
-- analytics and writes to the team; the permissions stay editable in Admin Panel > Role permissions.

begin;

alter table users drop constraint users_role_check;
alter table users add constraint users_role_check
  check (role = any (array['public', 'researcher', 'stakeholder', 'admin']));

alter table access_requests drop constraint access_requests_role_requested_check;
alter table access_requests add constraint access_requests_role_requested_check
  check (role_requested = any (array['public', 'researcher', 'stakeholder']));

insert into role_permissions (role, permission) values
  ('researcher', 'view_public'),
  ('researcher', 'view_registered_data'),
  ('researcher', 'download_open_data'),
  ('researcher', 'analytics'),
  ('researcher', 'messaging')
on conflict (role, permission) do nothing;

commit;

-- To undo: move any researchers to another role first, then
--   delete from role_permissions where role = 'researcher';
--   and restore the two checks without 'researcher'.
