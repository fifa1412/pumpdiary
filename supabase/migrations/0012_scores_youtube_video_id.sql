-- 0012_scores_youtube_video_id.sql — remember which video PumpDiary itself
-- uploaded for a score.
--
-- video_url can hold any YouTube link a player pastes. Only a video the app
-- uploaded is offered for deletion along with the score, so the ID of that
-- upload is kept here and cleared when the link changes to another video.

alter table public.scores
  add column if not exists youtube_video_id text
  check (youtube_video_id ~ '^[A-Za-z0-9_-]{6,20}$');

comment on column public.scores.youtube_video_id is 'ID of the YouTube video uploaded through PumpDiary for this score, if any.';

grant insert (youtube_video_id) on public.scores to authenticated;
grant update (youtube_video_id) on public.scores to authenticated;

notify pgrst, 'reload schema';
