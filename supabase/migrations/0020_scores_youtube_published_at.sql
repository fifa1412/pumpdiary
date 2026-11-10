-- 0020_scores_youtube_published_at.sql — when each score's clip went up on
-- YouTube, so the video dashboard can show how long it has been online.
-- Filled by the same sync as the counts (0019); null until the next sync.

alter table public.scores
  add column if not exists youtube_published_at timestamptz;

comment on column public.scores.youtube_published_at is 'When the clip was published on YouTube, at the last sync.';

grant update (youtube_published_at) on public.scores to authenticated;

notify pgrst, 'reload schema';
