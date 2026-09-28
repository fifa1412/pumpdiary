-- 0004_songs_availability.sql — keep songs that were removed from the current
-- game version, so existing scores stay linked, and flag whether each song is
-- still playable.

alter table public.songs
  add column if not exists is_available boolean not null default true;

comment on column public.songs.is_available is 'False when the song has been removed from the current game version.';

create index if not exists songs_available_idx on public.songs (is_available);

notify pgrst, 'reload schema';
