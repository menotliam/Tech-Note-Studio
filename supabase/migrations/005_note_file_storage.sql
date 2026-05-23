insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-files',
  'note-files',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'note_files_select_own_path'
  ) then
    create policy "note_files_select_own_path"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'note-files'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'note_files_insert_own_path'
  ) then
    create policy "note_files_insert_own_path"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'note-files'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'note_files_delete_own_path'
  ) then
    create policy "note_files_delete_own_path"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'note-files'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;
