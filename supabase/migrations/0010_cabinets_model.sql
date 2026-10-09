-- 0010_cabinets_model.sql — cabinet hardware model (LX, TX, CX, FX).
--
-- Nullable because cabinets added before this column have no model yet;
-- the app asks for one whenever a cabinet is added or edited.

alter table public.cabinets
  add column if not exists model text
  check (model in ('LX', 'TX', 'CX', 'FX'));

comment on column public.cabinets.model is 'Cabinet hardware model: LX, TX, CX, or FX.';

grant insert (model) on public.cabinets to authenticated;
grant update (model) on public.cabinets to authenticated;

notify pgrst, 'reload schema';
