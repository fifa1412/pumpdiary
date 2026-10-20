-- 0015_version_banners_storage.sql — public bucket for each game version's
-- title banner (the game logo): <version folder>.webp, e.g. phoenix.webp.
--
-- Anyone can read them through the public URL; there are no insert/update/
-- delete policies, so only the service role (the upload script) can write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('version-banners', 'version-banners', true, 524288, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
