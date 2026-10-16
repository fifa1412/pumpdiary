-- 0001_game_series.sql — main arcade (AC) versions of Pump It Up, oldest first.
-- Source: Andamiro's official PIU history (arcade releases up to Prime 2) and
-- Andamiro announcements for XX, Phoenix and Phoenix 2. PC/console ports and
-- spin-offs are intentionally left out.
-- score_rules marks the versions players can log scores for (see migration 0013).
-- Idempotent: re-running updates sort_order and score_rules by name.

insert into public.game_series (name, sort_order) values
  ('The 1st Dance Floor',          1),  -- 1999.08
  ('2nd Ultimate Remix',           2),  -- 1999.12
  ('3rd O.B.G',                    3),  -- 2000.05
  ('The O.B.G: Season Evolution',  4),  -- 2000.09
  ('The Collection',               5),  -- 2000.10
  ('The Perfect Collection',       6),  -- 2000.12
  ('Extra',                        7),  -- 2001.02
  ('The Premiere',                 8),  -- 2001.07
  ('The Prex',                     9),  -- 2001.10
  ('The Premiere 2',              10),  -- 2002.03
  ('The Rebirth',                 11),  -- 2002.03
  ('The Prex 2',                  12),  -- 2003.02
  ('The Premiere 3',              13),  -- 2003.03
  ('The Prex 3',                  14),  -- 2003.08
  ('Exceed',                      15),  -- 2004.04
  ('Exceed 2',                    16),  -- 2004.11
  ('Zero',                        17),  -- 2005.08
  ('NX (New Xenesis)',            18),  -- 2006.11
  ('NX2 (Next Xenesis)',          19),  -- 2007.12
  ('NX Absolute',                 20),  -- 2008.11
  ('Fiesta',                      21),  -- 2010.03
  ('Fiesta EX',                   22),  -- 2011.01
  ('Fiesta 2',                    23),  -- 2012.11
  ('Prime',                       24),  -- 2014.11
  ('Prime 2',                     25),  -- 2016.11
  ('XX',                          26),
  ('Phoenix',                     27),
  ('Phoenix 2',                   28)
on conflict (name) do update set sort_order = excluded.sort_order;

update public.game_series set score_rules = case
  when name in ('Phoenix 2', 'Phoenix') then 'phoenix'
  when name in ('XX', 'Prime') then 'classic'
end;
