-- 0002_profiles_grants.sql — explicit, least-privilege table grants for profiles.
-- This project doesn't auto-grant SELECT/UPDATE on new tables to the API roles,
-- and the default grants included TRUNCATE (which RLS does not restrict).

revoke all on public.profiles from anon, authenticated;

-- Signed-in users: read rows (RLS limits them to their own) and change only the name.
grant select on public.profiles to authenticated;
grant update (player_name) on public.profiles to authenticated;

-- anon gets nothing: logged-out visitors never read profiles.

notify pgrst, 'reload schema';
