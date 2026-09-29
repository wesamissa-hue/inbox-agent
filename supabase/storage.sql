-- ============================================================
-- Image storage: a public bucket the inbox uploads pictures to.
-- Run this AFTER schema.sql.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('inbox-images', 'inbox-images', false)
on conflict (id) do update set public = false;

alter table storage.objects enable row level security;

-- Images are scoped to the conversation UUID in the first object path segment.
drop policy if exists "inbox images read" on storage.objects;
drop policy if exists "inbox images upload" on storage.objects;
drop policy if exists "inbox images select owner" on storage.objects;
drop policy if exists "inbox images insert owner" on storage.objects;

create policy "inbox images select owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inbox-images'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = (select auth.uid())
    )
  );

create policy "inbox images insert owner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inbox-images'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = (select auth.uid())
    )
  );
