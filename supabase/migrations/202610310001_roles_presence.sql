-- Allow a new member to choose buyer or seller, and track recent activity.
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_role_last_seen_idx
  on public.profiles(role, last_seen_at desc);

grant update (last_seen_at) on public.profiles to authenticated;

create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  requested_role public.user_role;
begin
  requested_role := case
    when new.raw_user_meta_data->>'account_type' = 'seller' then 'seller'::public.user_role
    else 'buyer'::public.user_role
  end;

  insert into public.profiles(id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)),
    requested_role
  );
  return new;
end;
$$;
