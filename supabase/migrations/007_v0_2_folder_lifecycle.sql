alter table public.folders
add column if not exists is_archived boolean not null default false,
add column if not exists deleted_at timestamptz null;

create index if not exists folders_owner_archived_idx on public.folders(owner_id, is_archived);
create index if not exists folders_owner_deleted_idx on public.folders(owner_id, deleted_at);
