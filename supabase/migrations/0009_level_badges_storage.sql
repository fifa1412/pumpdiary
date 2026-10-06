-- 0009_level_badges_storage.sql — public bucket for the Single/Double level
-- badge images, one per step type and level: single/01.webp ... double/28.webp.
--
-- Anyone can read them through the public URL; there are no insert/update/
-- delete policies, so only the service role (the upload script) can write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('level-badges', 'level-badges', true, 262144, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
