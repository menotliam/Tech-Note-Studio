delete from public.note_folders nf
using public.note_folders newer
where nf.note_id = newer.note_id
  and (
    nf.created_at < newer.created_at
    or (nf.created_at = newer.created_at and nf.folder_id < newer.folder_id)
  );

create unique index note_folders_one_folder_per_note_idx on public.note_folders(note_id);
