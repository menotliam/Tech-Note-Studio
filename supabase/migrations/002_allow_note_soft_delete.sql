drop policy if exists "notes_select_own_not_deleted" on public.notes;
drop policy if exists "notes_update_own" on public.notes;

create policy "notes_select_own"
on public.notes
for select
to authenticated
using (owner_id = auth.uid());

create policy "notes_update_own"
on public.notes
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
