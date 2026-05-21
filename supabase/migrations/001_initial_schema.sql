create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 80)
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_length check (char_length(name) between 1 and 120)
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,
  content_json jsonb not null,
  schema_version int not null default 1,
  is_system_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint templates_name_length check (char_length(name) between 1 and 120),
  constraint templates_content_json_is_object check (jsonb_typeof(content_json) = 'object'),
  constraint templates_owner_or_system_check check (
    (is_system_template = true and owner_id is null)
    or
    (is_system_template = false and owner_id is not null)
  )
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  content_json jsonb not null,
  content_text text,
  schema_version int not null default 1,
  template_id uuid null references public.templates(id) on delete set null,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint notes_title_length check (char_length(title) between 1 and 200),
  constraint notes_schema_version_positive check (schema_version >= 1),
  constraint notes_content_json_is_object check (jsonb_typeof(content_json) = 'object')
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid null references public.folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_name_length check (char_length(name) between 1 and 120)
);

create table public.note_folders (
  note_id uuid not null references public.notes(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, folder_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_length check (char_length(name) between 1 and 60),
  constraint tags_color_length check (color is null or char_length(color) <= 30)
);

create table public.note_tags (
  note_id uuid not null references public.notes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, tag_id)
);

create table public.editor_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  auto_detection_enabled boolean not null default true,
  editor_width text not null default 'comfortable',
  font_size text not null default 'medium',
  code_theme text not null default 'default-dark-aware',
  default_line_numbers boolean not null default true,
  default_word_wrap boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editor_preferences_editor_width_check check (editor_width in ('compact', 'comfortable', 'wide')),
  constraint editor_preferences_font_size_check check (font_size in ('small', 'medium', 'large'))
);

create table public.note_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint note_files_mime_type_check check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint note_files_size_positive check (size_bytes > 0),
  constraint note_files_size_limit check (size_bytes <= 10485760)
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'pending',
  format text not null,
  note_ids uuid[] not null,
  file_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint export_jobs_status_check check (status in ('pending', 'processing', 'completed', 'failed')),
  constraint export_jobs_format_check check (format in ('pdf', 'docx')),
  constraint export_jobs_note_ids_not_empty check (array_length(note_ids, 1) >= 1)
);

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint security_events_severity_check check (severity in ('info', 'warning', 'critical')),
  constraint security_events_event_type_length check (char_length(event_type) between 1 and 80)
);

create unique index workspaces_one_default_per_owner_idx on public.workspaces(owner_id) where is_default = true;
create index workspaces_owner_id_idx on public.workspaces(owner_id);
create index templates_owner_id_idx on public.templates(owner_id);
create index templates_system_idx on public.templates(is_system_template);
create index templates_category_idx on public.templates(category);
create index notes_owner_id_idx on public.notes(owner_id);
create index notes_workspace_id_idx on public.notes(workspace_id);
create index notes_owner_updated_idx on public.notes(owner_id, updated_at desc);
create index notes_owner_archived_idx on public.notes(owner_id, is_archived);
create index notes_owner_deleted_idx on public.notes(owner_id, deleted_at);
create index notes_title_idx on public.notes using gin (to_tsvector('simple', title));
create index notes_content_text_idx on public.notes using gin (to_tsvector('simple', coalesce(content_text, '')));
create index folders_owner_id_idx on public.folders(owner_id);
create index folders_workspace_id_idx on public.folders(workspace_id);
create index folders_parent_id_idx on public.folders(parent_id);
create index note_folders_owner_id_idx on public.note_folders(owner_id);
create index note_folders_folder_id_idx on public.note_folders(folder_id);
create unique index tags_unique_name_per_workspace_idx on public.tags(owner_id, workspace_id, lower(name));
create index tags_owner_id_idx on public.tags(owner_id);
create index tags_workspace_id_idx on public.tags(workspace_id);
create index note_tags_owner_id_idx on public.note_tags(owner_id);
create index note_tags_tag_id_idx on public.note_tags(tag_id);
create index note_files_owner_id_idx on public.note_files(owner_id);
create index note_files_note_id_idx on public.note_files(note_id);
create unique index note_files_storage_path_idx on public.note_files(storage_path);
create index export_jobs_owner_id_idx on public.export_jobs(owner_id);
create index export_jobs_workspace_id_idx on public.export_jobs(workspace_id);
create index export_jobs_status_idx on public.export_jobs(status);
create index export_jobs_created_at_idx on public.export_jobs(created_at desc);
create index security_events_user_id_idx on public.security_events(user_id);
create index security_events_event_type_idx on public.security_events(event_type);
create index security_events_created_at_idx on public.security_events(created_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger templates_set_updated_at before update on public.templates for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();
create trigger folders_set_updated_at before update on public.folders for each row execute function public.set_updated_at();
create trigger tags_set_updated_at before update on public.tags for each row execute function public.set_updated_at();
create trigger editor_preferences_set_updated_at before update on public.editor_preferences for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.templates enable row level security;
alter table public.notes enable row level security;
alter table public.folders enable row level security;
alter table public.note_folders enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;
alter table public.editor_preferences enable row level security;
alter table public.note_files enable row level security;
alter table public.export_jobs enable row level security;
alter table public.security_events enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "workspaces_select_own" on public.workspaces for select to authenticated using (owner_id = auth.uid());
create policy "workspaces_insert_own" on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy "workspaces_update_own" on public.workspaces for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "workspaces_delete_own" on public.workspaces for delete to authenticated using (owner_id = auth.uid());

create policy "templates_select_system_or_own" on public.templates for select to authenticated using (is_system_template = true or owner_id = auth.uid());
create policy "templates_insert_own_custom" on public.templates for insert to authenticated with check (owner_id = auth.uid() and is_system_template = false);
create policy "templates_update_own_custom" on public.templates for update to authenticated using (owner_id = auth.uid() and is_system_template = false) with check (owner_id = auth.uid() and is_system_template = false);
create policy "templates_delete_own_custom" on public.templates for delete to authenticated using (owner_id = auth.uid() and is_system_template = false);

create policy "notes_select_own_not_deleted" on public.notes for select to authenticated using (owner_id = auth.uid() and deleted_at is null);
create policy "notes_insert_own" on public.notes for insert to authenticated with check (owner_id = auth.uid());
create policy "notes_update_own" on public.notes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "notes_delete_own" on public.notes for delete to authenticated using (owner_id = auth.uid());

create policy "folders_select_own" on public.folders for select to authenticated using (owner_id = auth.uid());
create policy "folders_insert_own" on public.folders for insert to authenticated with check (owner_id = auth.uid());
create policy "folders_update_own" on public.folders for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "folders_delete_own" on public.folders for delete to authenticated using (owner_id = auth.uid());

create policy "note_folders_select_own" on public.note_folders for select to authenticated using (owner_id = auth.uid());
create policy "note_folders_insert_own" on public.note_folders for insert to authenticated with check (owner_id = auth.uid());
create policy "note_folders_delete_own" on public.note_folders for delete to authenticated using (owner_id = auth.uid());

create policy "tags_select_own" on public.tags for select to authenticated using (owner_id = auth.uid());
create policy "tags_insert_own" on public.tags for insert to authenticated with check (owner_id = auth.uid());
create policy "tags_update_own" on public.tags for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "tags_delete_own" on public.tags for delete to authenticated using (owner_id = auth.uid());

create policy "note_tags_select_own" on public.note_tags for select to authenticated using (owner_id = auth.uid());
create policy "note_tags_insert_own" on public.note_tags for insert to authenticated with check (owner_id = auth.uid());
create policy "note_tags_delete_own" on public.note_tags for delete to authenticated using (owner_id = auth.uid());

create policy "editor_preferences_select_own" on public.editor_preferences for select to authenticated using (owner_id = auth.uid());
create policy "editor_preferences_insert_own" on public.editor_preferences for insert to authenticated with check (owner_id = auth.uid());
create policy "editor_preferences_update_own" on public.editor_preferences for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "editor_preferences_delete_own" on public.editor_preferences for delete to authenticated using (owner_id = auth.uid());

create policy "note_files_select_own" on public.note_files for select to authenticated using (owner_id = auth.uid());
create policy "note_files_insert_own" on public.note_files for insert to authenticated with check (owner_id = auth.uid());
create policy "note_files_delete_own" on public.note_files for delete to authenticated using (owner_id = auth.uid());

create policy "export_jobs_select_own" on public.export_jobs for select to authenticated using (owner_id = auth.uid());
create policy "export_jobs_insert_own" on public.export_jobs for insert to authenticated with check (owner_id = auth.uid());
create policy "export_jobs_update_own" on public.export_jobs for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "export_jobs_delete_own" on public.export_jobs for delete to authenticated using (owner_id = auth.uid());

create policy "security_events_select_own" on public.security_events for select to authenticated using (user_id = auth.uid());
