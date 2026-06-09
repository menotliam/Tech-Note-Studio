create table if not exists public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member',
  disabled_at timestamptz null,
  disabled_reason text null,
  disabled_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_access_role_check check (role in ('owner', 'admin', 'member')),
  constraint user_access_disabled_reason_length check (
    disabled_reason is null or char_length(disabled_reason) <= 240
  )
);

create table if not exists public.allowed_email_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allowed_email_domains_exact_domain_check check (
    domain = lower(domain)
    and domain !~ '[*@]'
    and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  )
);

create index if not exists user_access_role_idx on public.user_access(role);
create index if not exists user_access_disabled_at_idx on public.user_access(disabled_at);
create index if not exists allowed_email_domains_active_idx on public.allowed_email_domains(is_active, domain);

drop trigger if exists user_access_set_updated_at on public.user_access;
create trigger user_access_set_updated_at
before update on public.user_access
for each row execute function public.set_updated_at();

drop trigger if exists allowed_email_domains_set_updated_at on public.allowed_email_domains;
create trigger allowed_email_domains_set_updated_at
before update on public.allowed_email_domains
for each row execute function public.set_updated_at();

alter table public.user_access enable row level security;
alter table public.allowed_email_domains enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_access'
      and policyname = 'user_access_select_own'
  ) then
    create policy "user_access_select_own"
    on public.user_access
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_access'
      and policyname = 'user_access_insert_own_member'
  ) then
    create policy "user_access_insert_own_member"
    on public.user_access
    for insert
    to authenticated
    with check (
      user_id = auth.uid()
      and role = 'member'
      and disabled_at is null
      and disabled_reason is null
      and disabled_by is null
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'allowed_email_domains'
      and policyname = 'allowed_email_domains_select_active'
  ) then
    create policy "allowed_email_domains_select_active"
    on public.allowed_email_domains
    for select
    to authenticated
    using (is_active = true);
  end if;
end $$;

-- Owner bootstrap is intentionally manual for v0.5.
-- After creating the maintainer account in Supabase Auth, run:
--
-- insert into public.user_access (user_id, role)
-- values ('00000000-0000-0000-0000-000000000000', 'owner')
-- on conflict (user_id) do update
-- set role = 'owner', disabled_at = null, disabled_reason = null, disabled_by = null;
