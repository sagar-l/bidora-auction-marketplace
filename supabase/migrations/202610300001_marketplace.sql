create extension if not exists pgcrypto;

create type public.user_role as enum ('buyer', 'seller', 'admin');
create type public.auction_status as enum ('draft', 'pending', 'live', 'ended', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'BIDORA member',
  role public.user_role not null default 'buyer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 5 and 120),
  slug text not null unique,
  category text not null,
  description text not null check (char_length(description) between 20 and 5000),
  condition text not null default 'Good',
  image_url text,
  starting_price numeric(12,2) not null check (starting_price >= 1),
  current_price numeric(12,2) not null check (current_price >= starting_price),
  bid_increment numeric(12,2) not null default 1 check (bid_increment > 0),
  bid_count integer not null default 0 check (bid_count >= 0),
  status public.auction_status not null default 'pending',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (auction_id, bidder_id, amount)
);

create table public.watchlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, auction_id)
);

create index auctions_status_ends_idx on public.auctions(status, ends_at);
create index auctions_seller_created_idx on public.auctions(seller_id, created_at desc);
create index bids_auction_created_idx on public.bids(auction_id, created_at desc);

create schema if not exists private;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin') $$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_profile();

create or replace function public.place_bid(p_auction_id uuid, p_amount numeric)
returns public.bids language plpgsql security definer set search_path = ''
as $$
declare
  a public.auctions;
  new_bid public.bids;
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Sign in to place a bid.'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  if a.status <> 'live' or a.starts_at > now() or a.ends_at <= now() then raise exception 'This auction is not live.'; end if;
  if a.seller_id = caller then raise exception 'You cannot bid on your own listing.'; end if;
  if p_amount < a.current_price + a.bid_increment then raise exception 'Bid must be at least %.', a.current_price + a.bid_increment; end if;

  insert into public.bids(auction_id, bidder_id, amount) values (p_auction_id, caller, p_amount) returning * into new_bid;
  update public.auctions set current_price = p_amount, bid_count = bid_count + 1, updated_at = now() where id = p_auction_id;
  return new_bid;
end;
$$;
revoke all on function public.place_bid(uuid,numeric) from public, anon;
grant execute on function public.place_bid(uuid,numeric) to authenticated;

alter table public.profiles enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.watchlist enable row level security;

grant select on public.profiles to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;
grant select on public.auctions to anon, authenticated;
grant insert, update, delete on public.auctions to authenticated;
grant select on public.bids to anon, authenticated;
grant insert, delete on public.bids to authenticated;
grant select, insert, delete on public.watchlist to authenticated;

create policy "profiles are readable by signed-in members" on public.profiles for select to authenticated using (true);
create policy "members update own display name" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id and role = (select p.role from public.profiles p where p.id = (select auth.uid())));

create policy "public can browse live auctions" on public.auctions for select to anon, authenticated using (status = 'live' or seller_id = (select auth.uid()) or (select private.is_admin()));
create policy "sellers create own listings" on public.auctions for insert to authenticated with check (seller_id = (select auth.uid()) and status in ('draft','pending'));
create policy "sellers edit own non-live listings" on public.auctions for update to authenticated using (seller_id = (select auth.uid()) and status in ('draft','pending','rejected')) with check (seller_id = (select auth.uid()) and status in ('draft','pending','rejected'));
create policy "admins moderate listings" on public.auctions for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins remove listings" on public.auctions for delete to authenticated using ((select private.is_admin()));

create policy "bids visible with live auction" on public.bids for select to anon, authenticated using (exists (select 1 from public.auctions a where a.id = auction_id and (a.status = 'live' or a.seller_id = (select auth.uid()) or (select private.is_admin()))));
create policy "no direct bid writes" on public.bids for insert to authenticated with check (false);
create policy "admins remove bids" on public.bids for delete to authenticated using ((select private.is_admin()));

create policy "members read own watchlist" on public.watchlist for select to authenticated using (user_id = (select auth.uid()));
create policy "members add own watchlist items" on public.watchlist for insert to authenticated with check (user_id = (select auth.uid()));
create policy "members remove own watchlist items" on public.watchlist for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('listing-images','listing-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "listing images public read" on storage.objects for select using (bucket_id = 'listing-images');
create policy "members upload under their own folder" on storage.objects for insert to authenticated with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "members update own listing images" on storage.objects for update to authenticated using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "members delete own listing images" on storage.objects for delete to authenticated using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter publication supabase_realtime add table public.auctions;
