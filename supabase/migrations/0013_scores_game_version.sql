-- 0013_scores_game_version.sql — record which game version a score was played on.
--
-- Phoenix and Phoenix 2 score out of 1,000,000 with the full Phoenix grade
-- ladder and clear plates. XX and Prime use the older system: the score has
-- no 1,000,000 cap, grades run SSS, SS, S, A, B, C, D, F, and there are no
-- plates. The rules sit on game_series so a trigger can check every score
-- against the version it was played on. Existing scores are all Phoenix 2.

-- 1. Which versions take scores, and under which rules -------------------
alter table public.game_series
  add column if not exists score_rules text
  check (score_rules in ('phoenix', 'classic'));

comment on column public.game_series.score_rules is
  'Scoring rules for scores logged on this version (phoenix or classic); null when scores cannot be logged for it.';

update public.game_series set score_rules = 'phoenix' where name in ('Phoenix 2', 'Phoenix');
update public.game_series set score_rules = 'classic' where name in ('XX', 'Prime');

-- 2. The version on each score -------------------------------------------
alter table public.scores
  add column if not exists series_id bigint
  references public.game_series (id) on delete restrict;

update public.scores
  set series_id = (select id from public.game_series where name = 'Phoenix 2')
  where series_id is null;

alter table public.scores alter column series_id set not null;

comment on column public.scores.series_id is 'Game version the score was played on.';

grant insert (series_id) on public.scores to authenticated;
grant update (series_id) on public.scores to authenticated;

-- Classic scores go past 1,000,000; the per-version cap is in the trigger below.
alter table public.scores drop constraint if exists scores_score_check;
alter table public.scores
  add constraint scores_score_check check (score between 0 and 99999999);

-- 3. Per-version rules ----------------------------------------------------
create or replace function public.check_score_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rules text;
begin
  select score_rules into rules from public.game_series where id = new.series_id;
  if rules is null then
    raise exception 'scores cannot be logged for game version %', new.series_id
      using errcode = 'check_violation';
  end if;
  if rules = 'phoenix' and new.score > 1000000 then
    raise exception 'Phoenix scores cannot exceed 1,000,000'
      using errcode = 'check_violation';
  end if;
  if rules = 'classic' and new.plate is not null then
    raise exception 'XX and Prime scores have no plate'
      using errcode = 'check_violation';
  end if;
  if rules = 'classic' and new.grade::text not in ('SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'F') then
    raise exception 'grade % does not exist on this game version', new.grade
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists check_score_rules on public.scores;
create trigger check_score_rules
  before insert or update of series_id, score, grade, plate on public.scores
  for each row execute function public.check_score_rules();

-- 4. Best scores per version ----------------------------------------------
-- Scores from different versions are not comparable, so each player keeps a
-- best per chart per version. New columns are appended after the old ones.
create or replace view public.best_scores
with (security_invoker = true)
as
  select distinct on (s.user_id, s.stepchart_id, s.series_id) s.*
  from public.scores as s
  order by s.user_id, s.stepchart_id, s.series_id, s.score desc, s.played_at asc, s.id asc;

revoke all on public.best_scores from anon, authenticated;
grant select on public.best_scores to anon, authenticated;

drop index if exists public.scores_user_best_idx;
create index if not exists scores_user_best_idx
  on public.scores (user_id, stepchart_id, series_id, score desc, played_at asc, id asc);
create index if not exists scores_series_chart_score_idx
  on public.scores (series_id, stepchart_id, score desc);

notify pgrst, 'reload schema';
