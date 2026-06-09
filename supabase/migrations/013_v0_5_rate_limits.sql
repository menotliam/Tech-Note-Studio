create table if not exists public.rate_limit_counters (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  key_hash text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_limit_counters_action_length check (char_length(action) between 1 and 80),
  constraint rate_limit_counters_key_hash_length check (char_length(key_hash) = 64),
  constraint rate_limit_counters_window_seconds_positive check (window_seconds > 0),
  constraint rate_limit_counters_count_positive check (count > 0)
);

create unique index if not exists rate_limit_counters_unique_window_idx
on public.rate_limit_counters(action, key_hash, window_start);

create index if not exists rate_limit_counters_updated_at_idx
on public.rate_limit_counters(updated_at);

drop trigger if exists rate_limit_counters_set_updated_at on public.rate_limit_counters;
create trigger rate_limit_counters_set_updated_at
before update on public.rate_limit_counters
for each row execute function public.set_updated_at();

alter table public.rate_limit_counters enable row level security;

create or replace function public.consume_rate_limit(
  p_action text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, current_count integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_key_hash text;
  v_count integer;
  v_retry_after integer;
begin
  if p_action is null
    or char_length(p_action) < 1
    or char_length(p_action) > 80
    or p_key is null
    or char_length(p_key) < 1
    or p_limit < 1
    or p_window_seconds < 1
  then
    return query select false, 0, greatest(coalesce(p_window_seconds, 60), 1);
    return;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_key_hash := encode(digest(p_key, 'sha256'), 'hex');

  insert into public.rate_limit_counters (
    action,
    key_hash,
    window_start,
    window_seconds,
    count
  )
  values (
    p_action,
    v_key_hash,
    v_window_start,
    p_window_seconds,
    1
  )
  on conflict (action, key_hash, window_start)
  do update set count = public.rate_limit_counters.count + 1
  returning count into v_count;

  v_retry_after := greatest(
    1,
    ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer
  );

  return query select v_count <= p_limit, v_count, v_retry_after;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to anon, authenticated;

-- Optional cleanup for a future maintenance phase:
-- delete from public.rate_limit_counters where updated_at < now() - interval '7 days';
