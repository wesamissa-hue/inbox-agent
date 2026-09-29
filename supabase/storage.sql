-- ============================================================
-- Image storage: a public bucket the inbox uploads pictures to.
-- Run this AFTER schema.sql.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('inbox-images', 'inbox-images', true)
on conflict (id) do nothing;

-- Anyone can VIEW an image (public bucket). Uploads are allowed for the
-- demo; tighten to authenticated-only for production.
drop policy if exists "inbox images read" on storage.objects;
create policy "inbox images read" on storage.objects
  for select using (bucket_id = 'inbox-images');

drop policy if exists "inbox images upload" on storage.objects;
create policy "inbox images upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'inbox-images');
