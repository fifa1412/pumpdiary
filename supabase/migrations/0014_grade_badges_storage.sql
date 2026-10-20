-- 0014_grade_badges_storage.sql — public bucket for the grade images of each
-- game version: <version folder>/<grade>.webp, e.g. phoenix2/sss-plus.webp.
--
-- Anyone can read them through the public URL; there are no insert/update/
-- delete policies, so only the service role (the upload script) can write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('grade-badges', 'grade-badges', true, 262144, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
