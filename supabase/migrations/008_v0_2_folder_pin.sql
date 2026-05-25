alter table public.folders
add column if not exists is_pinned boolean not null default false;

create index if not exists folders_owner_pinned_idx on public.folders(owner_id, is_pinned);
