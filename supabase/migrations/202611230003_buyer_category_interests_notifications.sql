alter table public.profiles
  add column if not exists buyer_interests text[] not null default '{}',
  add column if not exists buyer_interests_prompted_at timestamptz;

create table if not exists public.buyer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  auction_round integer not null default 1,
  title text not null,
  message text not null,
  href text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, auction_id, auction_round)
);

create index if not exists buyer_notifications_user_created_idx
  on public.buyer_notifications(user_id, created_at desc);

alter table public.buyer_notifications enable row level security;
revoke all on public.buyer_notifications from anon, authenticated;
grant select on public.buyer_notifications to authenticated;
grant update (read_at) on public.buyer_notifications to authenticated;

drop policy if exists "buyers read their own notifications" on public.buyer_notifications;
create policy "buyers read their own notifications"
  on public.buyer_notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "buyers mark their own notifications read" on public.buyer_notifications;
create policy "buyers mark their own notifications read"
  on public.buyer_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.save_buyer_interests(p_categories text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_prompted_at timestamptz;
  v_categories text[];
  v_allowed constant text[] := array['Watches','Electronics','Fashion','Collectibles','Home','Jewellery'];
begin
  if v_user_id is null then
    raise exception 'Sign in to save your interests.';
  end if;

  select role, buyer_interests_prompted_at
    into v_role, v_prompted_at
    from public.profiles
   where id = v_user_id;

  if v_role is distinct from 'buyer'::public.user_role then
    raise exception 'Only buyer accounts can save buyer interests.';
  end if;

  if v_prompted_at is not null then
    return;
  end if;

  select coalesce(array_agg(distinct selected.category order by selected.category), '{}'::text[])
    into v_categories
    from unnest(coalesce(p_categories, '{}'::text[])) as selected(category)
   where selected.category = any(v_allowed);

  update public.profiles
     set buyer_interests = v_categories,
         buyer_interests_prompted_at = pg_catalog.now(),
         updated_at = pg_catalog.now()
   where id = v_user_id;
end;
$$;
revoke all on function public.save_buyer_interests(text[]) from public, anon, authenticated;
grant execute on function public.save_buyer_interests(text[]) to authenticated;

create or replace function private.notify_buyers_about_live_auction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'live' and old.status is distinct from new.status then
    insert into public.buyer_notifications(user_id, auction_id, auction_round, title, message, href)
    select p.id,
           new.id,
           new.auction_round,
           'A category you follow is live',
           pg_catalog.format('%s is now live in %s.', new.title, new.category),
           '/auctions/' || new.slug
      from public.profiles p
     where p.role = 'buyer'
       and new.category = any(p.buyer_interests)
       and p.buyer_interests_prompted_at is not null
    on conflict (user_id, auction_id, auction_round) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.notify_buyers_about_live_auction() from public, anon, authenticated;

drop trigger if exists notify_buyers_when_auction_goes_live on public.auctions;
create trigger notify_buyers_when_auction_goes_live
  after update of status on public.auctions
  for each row
  when (old.status is distinct from new.status and new.status = 'live')
  execute function private.notify_buyers_about_live_auction();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'buyer_notifications'
  ) then
    alter publication supabase_realtime add table public.buyer_notifications;
  end if;
end;
$$;
