-- 0003_song_catalog.sql — game series, songs and stepcharts, plus shared
-- created_at/updated_at handling for every table.

-- 1. Shared updated_at trigger ------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Bring profiles in line with the timestamp rule.
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 2. Enums ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'song_type' and typnamespace = 'public'::regnamespace) then
    create type public.song_type as enum ('NORMAL', 'REMIX', 'FULLSONG', 'SHORTCUT');
  end if;
  if not exists (select 1 from pg_type where typname = 'step_type' and typnamespace = 'public'::regnamespace) then
    create type public.step_type as enum ('SINGLE', 'DOUBLE', 'HALFDOUBLE');
  end if;
end;
$$;

-- 3. Tables --------------------------------------------------------------
create table if not exists public.game_series (
  id          bigint generated always as identity primary key,
  name        text not null unique check (btrim(name) <> ''),
  sort_order  smallint not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.game_series is 'Pump It Up game versions, ordered oldest to newest by sort_order.';

create table if not exists public.songs (
  id           bigint generated always as identity primary key,
  series_id    bigint not null references public.game_series (id) on delete restrict,
  song_type    public.song_type not null,
  title        text not null check (btrim(title) <> ''),
  composer     text not null check (btrim(composer) <> ''),
  bpm_min      numeric(6, 2) not null check (bpm_min > 0),
  bpm_max      numeric(6, 2) not null,
  jacket_path  text check (jacket_path is null or btrim(jacket_path) <> ''),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint songs_bpm_range check (bpm_max >= bpm_min)
);

comment on column public.songs.series_id is 'Game version the song debuted in.';
comment on column public.songs.jacket_path is 'Object path inside the "jackets" storage bucket, e.g. songs/123.webp.';

create unique index if not exists songs_title_type_key
  on public.songs (lower(title), song_type);
create index if not exists songs_series_id_idx on public.songs (series_id);

create table if not exists public.stepcharts (
  id          bigint generated always as identity primary key,
  song_id     bigint not null references public.songs (id) on delete restrict,
  step_type   public.step_type not null,
  level       smallint not null check (level between 1 and 29),
  step_maker  text check (step_maker is null or btrim(step_maker) <> ''),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint stepcharts_song_type_level_key unique (song_id, step_type, level)
);

create index if not exists stepcharts_type_level_idx on public.stepcharts (step_type, level);
-- (song_id lookups are covered by the unique constraint's index.)

-- 4. updated_at triggers -------------------------------------------------
drop trigger if exists set_updated_at on public.game_series;
create trigger set_updated_at
  before update on public.game_series
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.songs;
create trigger set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.stepcharts;
create trigger set_updated_at
  before update on public.stepcharts
  for each row execute function public.set_updated_at();

-- 5. Row Level Security: catalog is public to read, written only via
--    migrations/seeds (no insert/update/delete policies for API roles).
alter table public.game_series enable row level security;
alter table public.songs       enable row level security;
alter table public.stepcharts  enable row level security;

drop policy if exists "game_series_read_all" on public.game_series;
create policy "game_series_read_all" on public.game_series
  for select to anon, authenticated using (true);

drop policy if exists "songs_read_all" on public.songs;
create policy "songs_read_all" on public.songs
  for select to anon, authenticated using (true);

drop policy if exists "stepcharts_read_all" on public.stepcharts;
create policy "stepcharts_read_all" on public.stepcharts
  for select to anon, authenticated using (true);

-- Explicit least-privilege grants (this project does not auto-grant).
revoke all on public.game_series, public.songs, public.stepcharts from anon, authenticated;
grant select on public.game_series, public.songs, public.stepcharts to anon, authenticated;

-- 6. Storage bucket for song jackets: public read, no client writes.
insert into storage.buckets (id, name, public)
values ('jackets', 'jackets', true)
on conflict (id) do update set public = excluded.public;

notify pgrst, 'reload schema';
