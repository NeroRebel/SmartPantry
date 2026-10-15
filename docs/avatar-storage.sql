begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists smartpantry_avatars_select on storage.objects;
create policy smartpantry_avatars_select on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists smartpantry_avatars_insert on storage.objects;
create policy smartpantry_avatars_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists smartpantry_avatars_update on storage.objects;
create policy smartpantry_avatars_update on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists smartpantry_avatars_delete on storage.objects;
create policy smartpantry_avatars_delete on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Permissive policies combine with OR. Keep the folder boundary even if broader
-- policies already exist; unrelated buckets retain their existing permissions.
drop policy if exists smartpantry_avatars_owner_boundary on storage.objects;
create policy smartpantry_avatars_owner_boundary on storage.objects as restrictive
for all to public
using (bucket_id <> 'avatars' or (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id <> 'avatars' or (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
