-- 0001_profiles.sql — player profiles linked to Supabase Auth users.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- 1. Table ---------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  player_name text not null check (char_length(player_name) between 2 and 20),
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'PumpDiary player profile, one row per auth user.';

-- 2. Row Level Security: each user can only see and edit their own profile.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert/delete policies: rows are created by the trigger below and
-- removed by the cascade when the auth user is deleted.

-- 3. Auto-create the profile on sign-up ---------------------------------
-- The app passes the player name as sign-up metadata: options.data.player_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, player_name)
  values (new.id, new.raw_user_meta_data ->> 'player_name');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tell PostgREST (the REST API) to pick up the new table immediately.
notify pgrst, 'reload schema';
