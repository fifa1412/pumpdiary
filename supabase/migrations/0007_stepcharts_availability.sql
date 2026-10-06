-- 0007_stepcharts_availability.sql — keep charts that are no longer in the
-- current game version, so existing scores stay linked, and flag whether each
-- chart is still playable. Mirrors songs.is_available (0004).
--
-- Existing grants already cover the new column: API roles keep read-only
-- access to stepcharts, and writes still come only from migrations and seeds.

alter table public.stepcharts
  add column if not exists is_available boolean not null default true;

comment on column public.stepcharts.is_available is 'False when the chart is not in the current game version (removed, or its song was removed).';

notify pgrst, 'reload schema';
