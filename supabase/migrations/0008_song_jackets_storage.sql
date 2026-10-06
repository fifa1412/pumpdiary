-- 0008_song_jackets_storage.sql — public bucket for song jacket images.
--
-- songs.jacket_path (0003) holds the object path inside this bucket. Anyone
-- can read the images through the public URL; there are no insert/update/
-- delete policies, so only the service role (the import script) can write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('song-jackets', 'song-jackets', true, 524288, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
