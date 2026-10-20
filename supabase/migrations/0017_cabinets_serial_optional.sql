-- 0017_cabinets_serial_optional.sql — the serial number of a cabinet is often
-- unknown, so it may be left out. A serial that is given must still be
-- non-blank and unique; NULLs never clash under the unique constraint.

alter table public.cabinets alter column serial_number drop not null;

notify pgrst, 'reload schema';
