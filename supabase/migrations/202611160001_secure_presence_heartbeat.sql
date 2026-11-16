-- Record activity for the signed-in member without exposing profile updates.
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_role_last_seen_idx
  on public.profiles (role, last_seen_at desc);

create or replace function public.heartbeat_presence()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set last_seen_at = statement_timestamp()
  where id = (select auth.uid());
$$;

revoke all on function public.heartbeat_presence() from public, anon;
grant execute on function public.heartbeat_presence() to authenticated;
