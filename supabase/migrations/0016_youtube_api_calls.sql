-- 0016_youtube_api_calls.sql — one row per YouTube Data API call the site
-- makes, so players can see roughly how much of the day's quota is left.
--
-- YouTube offers no way to read the remaining quota. The quota belongs to the
-- site's Google Cloud project and is shared by every player: 100 uploads a
-- day, plus 10,000 units for the other calls. Both reset at midnight Pacific
-- time. The browser logs each call before making it, since a call uses quota
-- even when it fails. Players can't read the log; youtube_quota_usage()
-- returns today's totals only.

create table if not exists public.youtube_api_calls (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  call       text not null check (call in (
    'videos.insert', 'thumbnails.set', 'playlists.list', 'playlists.insert',
    'playlistItems.insert', 'videos.delete'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists youtube_api_calls_created_idx
  on public.youtube_api_calls (created_at desc);

drop trigger if exists set_updated_at on public.youtube_api_calls;
create trigger set_updated_at
  before update on public.youtube_api_calls
  for each row execute function public.set_updated_at();

alter table public.youtube_api_calls enable row level security;

drop policy if exists youtube_api_calls_insert_own on public.youtube_api_calls;
create policy youtube_api_calls_insert_own on public.youtube_api_calls
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Append-only, and nobody reads rows directly.
revoke all on public.youtube_api_calls from anon, authenticated;
grant insert (call) on public.youtube_api_calls to authenticated;

-- Calls since the last quota reset, as uploads and units, without saying who
-- made them. Unit costs follow YouTube's quota table; uploads have their own
-- limit and cost no units.
create or replace function public.youtube_quota_usage()
returns table (uploads bigint, units bigint, resets_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with day as (
    select date_trunc('day', now() at time zone 'America/Los_Angeles') as start
  )
  select
    count(*) filter (where c.call = 'videos.insert'),
    coalesce(sum(case c.call
      when 'playlists.list' then 1
      when 'videos.insert' then 0
      else 50
    end), 0),
    ((select start from day) + interval '1 day') at time zone 'America/Los_Angeles'
  from public.youtube_api_calls c
  where c.created_at >= (select start from day) at time zone 'America/Los_Angeles';
$$;

revoke execute on function public.youtube_quota_usage() from public, anon;
grant execute on function public.youtube_quota_usage() to authenticated;

notify pgrst, 'reload schema';
