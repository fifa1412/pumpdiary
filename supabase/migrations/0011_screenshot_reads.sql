-- 0011_screenshot_reads.sql — one row per score screenshot read by the AI
-- reader, with the tokens it used and what that cost.
--
-- The server route inserts rows with the player's own session. Players can
-- read only their own rows (for the daily cap); the site-wide spend that
-- drives the budget bar comes from ai_read_totals(), which returns sums only.

create table if not exists public.screenshot_reads (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  model         text not null check (btrim(model) <> ''),
  input_tokens  integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  cost_usd      numeric(12, 8) not null check (cost_usd >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists screenshot_reads_user_created_idx
  on public.screenshot_reads (user_id, created_at desc);

drop trigger if exists set_updated_at on public.screenshot_reads;
create trigger set_updated_at
  before update on public.screenshot_reads
  for each row execute function public.set_updated_at();

alter table public.screenshot_reads enable row level security;

drop policy if exists screenshot_reads_read_own on public.screenshot_reads;
create policy screenshot_reads_read_own on public.screenshot_reads
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists screenshot_reads_insert_own on public.screenshot_reads;
create policy screenshot_reads_insert_own on public.screenshot_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- No update/delete policies: the log is append-only for API roles.
revoke all on public.screenshot_reads from anon, authenticated;
grant select on public.screenshot_reads to authenticated;
grant insert (user_id, model, input_tokens, output_tokens, cost_usd)
  on public.screenshot_reads to authenticated;

-- Site-wide totals for the AI budget bar, without exposing who read what.
create or replace function public.ai_read_totals()
returns table (read_count bigint, spent_usd numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*), coalesce(sum(cost_usd), 0) from public.screenshot_reads;
$$;

revoke execute on function public.ai_read_totals() from public, anon;
grant execute on function public.ai_read_totals() to authenticated;

notify pgrst, 'reload schema';
