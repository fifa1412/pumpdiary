-- 0006_cabinets.sql — shared cabinet catalog and optional score association.

create table if not exists public.cabinets (
  id            bigint generated always as identity primary key,
  serial_number text not null unique check (btrim(serial_number) <> ''),
  name          text not null check (btrim(name) <> ''),
  location      text not null check (btrim(location) <> ''),
  country       text not null check (btrim(country) <> ''),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.cabinets is 'Shared user-contributed catalog of physical Pump It Up cabinets.';
comment on column public.cabinets.created_by is 'Creator account; null when that account has been deleted.';

create index if not exists cabinets_name_idx on public.cabinets (name);
create index if not exists cabinets_location_idx on public.cabinets (location);

drop trigger if exists set_updated_at on public.cabinets;
create trigger set_updated_at
  before update on public.cabinets
  for each row execute function public.set_updated_at();

alter table public.cabinets enable row level security;

drop policy if exists cabinets_read_all on public.cabinets;
create policy cabinets_read_all on public.cabinets
  for select to anon, authenticated using (true);

drop policy if exists cabinets_insert_authenticated on public.cabinets;
create policy cabinets_insert_authenticated on public.cabinets
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists cabinets_update_own on public.cabinets;
create policy cabinets_update_own on public.cabinets
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

drop policy if exists cabinets_delete_own on public.cabinets;
create policy cabinets_delete_own on public.cabinets
  for delete to authenticated
  using (created_by = (select auth.uid()));

revoke all on public.cabinets from anon, authenticated;
grant select on public.cabinets to anon, authenticated;
grant insert (serial_number, name, location, country, created_by)
  on public.cabinets to authenticated;
grant update (serial_number, name, location, country)
  on public.cabinets to authenticated;
grant delete on public.cabinets to authenticated;

alter table public.scores
  add column if not exists cabinet_id bigint
  references public.cabinets (id) on delete set null;

grant insert (cabinet_id) on public.scores to authenticated;
grant update (cabinet_id) on public.scores to authenticated;

notify pgrst, 'reload schema';
