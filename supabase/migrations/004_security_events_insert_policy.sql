do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'security_events'
      and policyname = 'security_events_insert_own_limited'
  ) then
    create policy "security_events_insert_own_limited"
    on public.security_events
    for insert
    to authenticated
    with check (
      user_id = auth.uid()
      and severity in ('info', 'warning')
      and char_length(event_type) between 1 and 80
    );
  end if;
end $$;
