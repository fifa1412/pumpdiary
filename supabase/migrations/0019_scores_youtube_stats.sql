-- 0019_scores_youtube_stats.sql — views, likes and comments of each score's
-- YouTube clip, for the video dashboard.
--
-- The numbers are a snapshot: the player presses Sync, the server reads them
-- from the YouTube Data API (videos.list) and writes them to the player's own
-- scores. They stay null until the first sync. A clip YouTube does not
-- return (deleted or private) gets synced_at with null numbers, which is how
-- the page tells it was not found.

alter table public.scores
  add column if not exists youtube_title     text,
  add column if not exists youtube_views     bigint check (youtube_views >= 0),
  add column if not exists youtube_likes     bigint check (youtube_likes >= 0),
  add column if not exists youtube_comments  bigint check (youtube_comments >= 0),
  add column if not exists youtube_synced_at timestamptz;

comment on column public.scores.youtube_title is 'Title of the clip on YouTube at the last sync.';
comment on column public.scores.youtube_views is 'View count of the clip at the last sync.';
comment on column public.scores.youtube_likes is 'Like count of the clip at the last sync; null when the owner hides it.';
comment on column public.scores.youtube_comments is 'Comment count of the clip at the last sync; null when comments are off.';
comment on column public.scores.youtube_synced_at is 'Last sync with YouTube; set with null numbers when YouTube did not return the clip.';

-- The sync runs as the player, so RLS (scores_update_own) keeps it to their rows.
grant update (youtube_title, youtube_views, youtube_likes, youtube_comments, youtube_synced_at)
  on public.scores to authenticated;

-- Log the sync's videos.list calls with the rest, at 1 unit each.
alter table public.youtube_api_calls drop constraint if exists youtube_api_calls_call_check;
alter table public.youtube_api_calls add constraint youtube_api_calls_call_check check (call in (
  'videos.insert', 'thumbnails.set', 'playlists.list', 'playlists.insert',
  'playlistItems.insert', 'videos.delete', 'videos.list'
));

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
      when 'videos.list' then 1
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
