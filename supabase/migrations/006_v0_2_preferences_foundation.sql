create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  appearance jsonb not null default '{}'::jsonb,
  dashboard jsonb not null default '{}'::jsonb,
  editor jsonb not null default '{}'::jsonb,
  export jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces
add column if not exists icon text,
add column if not exists accent text,
add column if not exists cover text,
add column if not exists default_layout text not null default 'folder';

alter table public.notes
add column if not exists icon text,
add column if not exists accent text,
add column if not exists cover text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_appearance_is_object'
  ) then
    alter table public.user_preferences
    add constraint user_preferences_appearance_is_object
    check (jsonb_typeof(appearance) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_dashboard_is_object'
  ) then
    alter table public.user_preferences
    add constraint user_preferences_dashboard_is_object
    check (jsonb_typeof(dashboard) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_editor_is_object'
  ) then
    alter table public.user_preferences
    add constraint user_preferences_editor_is_object
    check (jsonb_typeof(editor) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_export_is_object'
  ) then
    alter table public.user_preferences
    add constraint user_preferences_export_is_object
    check (jsonb_typeof(export) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_icon_length'
  ) then
    alter table public.workspaces
    add constraint workspaces_icon_length
    check (icon is null or char_length(icon) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_accent_length'
  ) then
    alter table public.workspaces
    add constraint workspaces_accent_length
    check (accent is null or char_length(accent) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_cover_length'
  ) then
    alter table public.workspaces
    add constraint workspaces_cover_length
    check (cover is null or char_length(cover) <= 160);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_default_layout_check'
  ) then
    alter table public.workspaces
    add constraint workspaces_default_layout_check
    check (default_layout in ('folder', 'recent', 'pinned', 'all'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'notes_icon_length'
  ) then
    alter table public.notes
    add constraint notes_icon_length
    check (icon is null or char_length(icon) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'notes_accent_length'
  ) then
    alter table public.notes
    add constraint notes_accent_length
    check (accent is null or char_length(accent) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'notes_cover_length'
  ) then
    alter table public.notes
    add constraint notes_cover_length
    check (cover is null or char_length(cover) <= 160);
  end if;
end $$;

create index if not exists user_preferences_owner_id_idx on public.user_preferences(owner_id);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
drop policy if exists "user_preferences_insert_own" on public.user_preferences;
drop policy if exists "user_preferences_update_own" on public.user_preferences;
drop policy if exists "user_preferences_delete_own" on public.user_preferences;

create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using (owner_id = auth.uid());

create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "user_preferences_delete_own"
on public.user_preferences
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "notes_select_own_not_deleted" on public.notes;
drop policy if exists "notes_select_own" on public.notes;

create policy "notes_select_own"
on public.notes
for select
to authenticated
using (owner_id = auth.uid());

insert into public.user_preferences (owner_id, appearance, dashboard, editor, export)
select
  users.id,
  jsonb_build_object(
    'theme', 'system',
    'accentPreset', 'cyan',
    'gradientPreset', 'cyan-purple'
  ),
  jsonb_build_object(
    'density', 'comfortable',
    'sidebarCollapsed', false,
    'focusModeEnabled', false,
    'defaultView', 'folder',
    'noteListStyle', 'row',
    'sortDefault', 'updated_desc'
  ),
  jsonb_build_object(
    'width', coalesce(editor_preferences.editor_width, 'comfortable'),
    'fontSize', coalesce(editor_preferences.font_size, 'medium'),
    'fontFamily', 'system',
    'lineHeight', 'comfortable',
    'codeTheme', coalesce(editor_preferences.code_theme, 'default-dark-aware'),
    'defaultLineNumbers', coalesce(editor_preferences.default_line_numbers, true),
    'defaultWordWrap', coalesce(editor_preferences.default_word_wrap, false),
    'autoDetectionEnabled', coalesce(editor_preferences.auto_detection_enabled, true),
    'markdownShortcutsEnabled', true,
    'clipboardImagePasteEnabled', true
  ),
  jsonb_build_object(
    'includeImageCaptions', true
  )
from auth.users users
left join public.editor_preferences
  on editor_preferences.owner_id = users.id
on conflict (owner_id) do nothing;
