-- 0005_scores.sql — public score history, player display names, and screenshots.

-- Keep enum ordering aligned with the PHOENIX 2 grade and plate ladders.
do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'score_grade' and typnamespace = 'public'::regnamespace
  ) then
    create type public.score_grade as enum (
      'SSS+', 'SSS', 'SS+', 'SS', 'S+', 'S',
      'AAA+', 'AAA', 'AA+', 'AA', 'A+', 'A', 'B', 'C', 'D', 'F'
    );
  end if;
  if not exists (
    select 1 from pg_type
    where typname = 'score_plate' and typnamespace = 'public'::regnamespace
  ) then
    create type public.score_plate as enum (
      'PERFECT GAME', 'ULTIMATE GAME', 'EXTREME GAME', 'SUPERB GAME',
      'MARVELOUS GAME', 'TALENTED GAME', 'FAIR GAME', 'ROUGH GAME'
    );
  end if;
end;
$$;

create table if not exists public.scores (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  stepchart_id   bigint not null references public.stepcharts (id) on delete restrict,
  score          integer not null check (score between 0 and 1000000),
  grade          public.score_grade not null,
  perfect        integer not null check (perfect >= 0),
  great          integer not null check (great >= 0),
  good           integer not null check (good >= 0),
  bad            integer not null check (bad >= 0),
  miss           integer not null check (miss >= 0),
  max_combo      integer not null check (max_combo >= 0),
  video_url      text,
  played_at      timestamptz not null default now(),
  note           text check (note is null or char_length(note) <= 500),
  plate          public.score_plate,
  stage_pass     boolean not null,
  screenshot_path text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint scores_youtube_url check (
    video_url is null or
    video_url ~* '^https://(www\.)?youtube\.com/watch\?v=[A-Za-z0-9_-]+(&[^[:space:]]*)?$' or
    video_url ~* '^https://youtu\.be/[A-Za-z0-9_-]+(\?[^[:space:]]*)?$' or
    video_url ~* '^https://(www\.)?youtube\.com/shorts/[A-Za-z0-9_-]+(\?[^[:space:]]*)?$'
  ),
  constraint scores_screenshot_owner_path check (
    screenshot_path is null or screenshot_path ~ ('^' || user_id::text || '/[^/]+$')
  ),
  -- Plates are only awarded after the stage is cleared; failed runs have no plate.
  constraint scores_failed_stage_no_plate check (stage_pass or plate is null)
);

comment on table public.scores is 'Public Pump It Up score history; each player may record multiple attempts per chart.';
comment on column public.scores.grade is 'Player-selected PHOENIX 2 score grade.';
comment on column public.scores.plate is 'Nullable PHOENIX-style clear plate; failed stages cannot have a plate.';
comment on column public.scores.screenshot_path is 'Object path in score-screenshots, restricted to this row owner’s folder.';

create index if not exists scores_user_history_idx
  on public.scores (user_id, played_at desc);
create index if not exists scores_chart_score_idx
  on public.scores (stepchart_id, score desc);
create index if not exists scores_user_best_idx
  on public.scores (user_id, stepchart_id, score desc, played_at asc, id asc);

drop trigger if exists set_updated_at on public.scores;
create trigger set_updated_at
  before update on public.scores
  for each row execute function public.set_updated_at();

alter table public.scores enable row level security;

drop policy if exists scores_read_all on public.scores;
create policy scores_read_all on public.scores
  for select to anon, authenticated using (true);

drop policy if exists scores_insert_own on public.scores;
create policy scores_insert_own on public.scores
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists scores_update_own on public.scores;
create policy scores_update_own on public.scores
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists scores_delete_own on public.scores;
create policy scores_delete_own on public.scores
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.scores from anon, authenticated;
grant select on public.scores to anon, authenticated;
grant insert (
  user_id, stepchart_id, score, grade, perfect, great, good, bad, miss,
  max_combo, video_url, played_at, note, plate, stage_pass, screenshot_path
) on public.scores to authenticated;
grant update (
  stepchart_id, score, grade, perfect, great, good, bad, miss, max_combo,
  video_url, played_at, note, plate, stage_pass, screenshot_path
) on public.scores to authenticated;
grant delete on public.scores to authenticated;

-- A public view must run with the caller's table grants and RLS policies.
create or replace view public.best_scores
with (security_invoker = true)
as
  select distinct on (s.user_id, s.stepchart_id) s.*
  from public.scores as s
  order by s.user_id, s.stepchart_id, s.score desc, s.played_at asc, s.id asc;

revoke all on public.best_scores from anon, authenticated;
grant select on public.best_scores to anon, authenticated;

-- Public score pages need names but not private profile fields. Regrant only
-- the public display columns and preserve owner-only player_name updates.
drop policy if exists profiles_read_public_display on public.profiles;
create policy profiles_read_public_display on public.profiles
  for select to anon, authenticated using (true);

revoke all on public.profiles from anon, authenticated;
grant select (id, player_name, created_at) on public.profiles to anon, authenticated;
grant update (player_name) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'score-screenshots',
  'score-screenshots',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists score_screenshots_insert_own_folder on storage.objects;
create policy score_screenshots_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'score-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- The Storage API reads the object row before deleting or overwriting it, so
-- owners need SELECT on their own folder. Public viewing goes through the public
-- bucket URL and doesn't need this; other users still can't list the folder.
drop policy if exists score_screenshots_select_own_folder on storage.objects;
create policy score_screenshots_select_own_folder on storage.objects
  for select to authenticated
  using (
    bucket_id = 'score-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists score_screenshots_update_own_folder on storage.objects;
create policy score_screenshots_update_own_folder on storage.objects
  for update to authenticated
  using (
    bucket_id = 'score-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'score-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists score_screenshots_delete_own_folder on storage.objects;
create policy score_screenshots_delete_own_folder on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'score-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

notify pgrst, 'reload schema';
