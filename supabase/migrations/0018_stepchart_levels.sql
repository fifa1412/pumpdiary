-- 0018_stepchart_levels.sql — a chart can sit at a different level in another
-- game version. Odin S20 in Phoenix 2 was S21 in Phoenix.
--
-- stepcharts.level stays the Phoenix 2 level. This table holds only the
-- versions where the level differs, so a chart keeps one row in stepcharts
-- and every score on it stays on the same chart whichever version it was
-- played on. The level for a version is the row here when there is one,
-- otherwise stepcharts.level.
--
-- Catalog table: public to read, written only by migrations and seeds
-- (supabase/seed/0004_stepchart_levels.sql).

create table if not exists public.stepchart_levels (
  stepchart_id bigint not null references public.stepcharts (id) on delete cascade,
  series_id    bigint not null references public.game_series (id) on delete restrict,
  level        smallint not null check (level between 1 and 29),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (stepchart_id, series_id)
);

comment on table public.stepchart_levels is
  'Level of a chart on a game version where it differs from stepcharts.level (the Phoenix 2 level).';

-- Lookups by version and level (the overview page lists one level at a time).
create index if not exists stepchart_levels_series_level_idx
  on public.stepchart_levels (series_id, level);

drop trigger if exists set_updated_at on public.stepchart_levels;
create trigger set_updated_at
  before update on public.stepchart_levels
  for each row execute function public.set_updated_at();

alter table public.stepchart_levels enable row level security;

drop policy if exists "stepchart_levels_read_all" on public.stepchart_levels;
create policy "stepchart_levels_read_all" on public.stepchart_levels
  for select to anon, authenticated using (true);

revoke all on public.stepchart_levels from anon, authenticated;
grant select on public.stepchart_levels to anon, authenticated;

notify pgrst, 'reload schema';
