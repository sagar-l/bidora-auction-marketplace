-- BIDORA automated auction close, payment reservation, and delivery workflow.
-- The lifecycle worker is deterministic backend automation (not an LLM): it can
-- safely process many independent auctions in one scheduled invocation.

alter table public.auctions
  add column if not exists auction_round integer not null default 1 check (auction_round > 0),
  add column if not exists latest_bid_at timestamptz,
  add column if not exists currency text not null default 'INR' check (currency = 'INR');

alter table public.bids
  add column if not exists auction_round integer not null default 1 check (auction_round > 0);

create index if not exists bids_auction_round_amount_idx
  on public.bids(auction_id, auction_round, amount desc, created_at asc);

create table if not exists public.auction_awards (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete restrict,
  auction_round integer not null check (auction_round > 0),
  listing_title text not null,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  bidder_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 1),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','paid','delivery_submitted','expired')),
  payment_deadline timestamptz not null,
  razorpay_payment_link_id text unique,
  razorpay_payment_url text,
  razorpay_payment_id text unique,
  paid_at timestamptz,
  delivery_name text,
  delivery_phone text,
  delivery_address text,
  delivery_notes text,
  delivery_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (auction_id, auction_round)
);

create index if not exists auction_awards_winner_created_idx
  on public.auction_awards(bidder_id, created_at desc);
create index if not exists auction_awards_deadline_idx
  on public.auction_awards(status, payment_deadline);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.auction_awards(id) on delete cascade,
  notification_type text not null check (notification_type in ('sale_confirmed','delivery_submitted')),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_notifications_created_idx
  on public.admin_notifications(created_at desc);

create table if not exists public.razorpay_webhook_events (
  event_id text primary key,
  award_id uuid references public.auction_awards(id) on delete set null,
  received_at timestamptz not null default now()
);

alter table public.auction_awards enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.razorpay_webhook_events enable row level security;

revoke all on public.auction_awards from anon, authenticated;
revoke all on public.admin_notifications from anon, authenticated;
grant select on public.auction_awards to authenticated;
grant select on public.admin_notifications to authenticated;

drop policy if exists "winners and admins read awards" on public.auction_awards;
drop policy if exists "winners sellers and admins read awards" on public.auction_awards;
create policy "winners sellers and admins read awards" on public.auction_awards
  for select to authenticated
  using (
    bidder_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1 from public.auctions a
       where a.id = auction_id and a.seller_id = (select auth.uid())
    )
  );

drop policy if exists "winners submit delivery details" on public.auction_awards;

drop policy if exists "admins read sale notifications" on public.admin_notifications;
create policy "admins read sale notifications" on public.admin_notifications
  for select to authenticated using ((select private.is_admin()));

revoke all on public.razorpay_webhook_events from anon, authenticated;

create or replace function public.set_razorpay_payment_link(p_award_id uuid, p_link_id text, p_payment_url text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  update public.auction_awards
     set razorpay_payment_link_id = p_link_id, razorpay_payment_url = p_payment_url
   where id = p_award_id
     and bidder_id = auth.uid()
     and status = 'awaiting_payment'
     and payment_deadline > now()
     and (razorpay_payment_link_id is null or razorpay_payment_link_id = p_link_id);
  if not found then raise exception 'Payment reservation is no longer available.'; end if;
end;
$$;
revoke all on function public.set_razorpay_payment_link(uuid,text,text) from public, anon;
grant execute on function public.set_razorpay_payment_link(uuid,text,text) to authenticated;

create or replace function public.confirm_razorpay_payment(
  p_payment_link_id text,
  p_payment_id text,
  p_amount_paise bigint,
  p_currency text,
  p_event_id text,
  p_paid_at timestamptz
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_award public.auction_awards;
  v_user_name text;
  v_event_inserted integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required.'; end if;
  if p_currency <> 'INR' or p_amount_paise < 100 or nullif(p_event_id, '') is null or p_paid_at is null then
    raise exception 'Invalid verified payment details.';
  end if;

  select * into v_award from public.auction_awards
   where razorpay_payment_link_id = p_payment_link_id for update;
  if not found then raise exception 'Payment link not found.'; end if;
  if p_paid_at > v_award.payment_deadline then raise exception 'Payment was completed after the deadline.'; end if;
  if round(v_award.amount * 100)::bigint <> p_amount_paise or v_award.currency <> p_currency then
    raise exception 'Payment amount or currency does not match the award.';
  end if;

  insert into public.razorpay_webhook_events(event_id, award_id)
    values (p_event_id, v_award.id) on conflict (event_id) do nothing;
  get diagnostics v_event_inserted = row_count;
  if v_event_inserted = 0 then return v_award.id; end if;

  if v_award.status = 'paid' or v_award.status = 'delivery_submitted' then
    return v_award.id;
  end if;
  if v_award.status not in ('awaiting_payment','expired') then raise exception 'Award is not awaiting payment.'; end if;

  select display_name into v_user_name from public.profiles where id = v_award.bidder_id;
  update public.auction_awards
     set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = p_paid_at
   where id = v_award.id;
  insert into public.admin_notifications(award_id, notification_type, message)
    values (
      v_award.id,
      'sale_confirmed',
      format('Sold: %s | Buyer: %s (%s) | Amount: ₹%s',
        v_award.listing_title,
        coalesce(v_user_name, 'BIDORA buyer'),
        v_award.bidder_id::text,
        to_char(v_award.amount, 'FM999,999,999,990.00'))
    );
  -- If the payment webhook arrives just after the link deadline, undo a fresh
  -- empty relisted round. A relisted round with bids remains intact for audit.
  update public.auctions set status = 'ended', updated_at = now()
   where id = v_award.auction_id and status = 'live'
     and auction_round = v_award.auction_round + 1 and latest_bid_at is null;
  return v_award.id;
end;
$$;
revoke all on function public.confirm_razorpay_payment(text,text,bigint,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.confirm_razorpay_payment(text,text,bigint,text,text,timestamptz) to service_role;

create or replace function public.submit_award_delivery(
  p_award_id uuid,
  p_name text,
  p_phone text,
  p_address text,
  p_notes text default ''
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_award public.auction_awards;
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  select * into v_award from public.auction_awards
   where id = p_award_id and bidder_id = auth.uid() for update;
  if not found or v_award.status <> 'paid' then raise exception 'A confirmed payment is required first.'; end if;
  if char_length(trim(p_name)) < 2 or char_length(trim(p_phone)) < 6 or char_length(trim(p_address)) < 8 then
    raise exception 'Enter a valid name, phone number, and delivery address.';
  end if;
  update public.auction_awards
     set delivery_name = trim(p_name),
         delivery_phone = trim(p_phone),
         delivery_address = trim(p_address),
         delivery_notes = left(coalesce(p_notes, ''), 1000),
         delivery_submitted_at = now(),
         status = 'delivery_submitted'
   where id = p_award_id;
  insert into public.admin_notifications(award_id, notification_type, message)
    values (p_award_id, 'delivery_submitted', format('Delivery details submitted for: %s', v_award.listing_title));
end;
$$;
revoke all on function public.submit_award_delivery(uuid,text,text,text,text) from public, anon;
grant execute on function public.submit_award_delivery(uuid,text,text,text,text) to authenticated;

create or replace function private.process_auction_lifecycle()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_auction public.auctions;
  v_bid public.bids;
  v_award public.auction_awards;
begin
  -- A quiet auction closes five minutes after its last bid. A zero-bid auction
  -- remains open until its configured end time. Row locks isolate concurrent auctions.
  for v_auction in
    select * from public.auctions a
     where a.status = 'live'
       and (a.ends_at <= now() or (a.latest_bid_at is not null and a.latest_bid_at <= now() - interval '5 minutes'))
     order by coalesce(a.latest_bid_at, a.ends_at), a.id
     for update skip locked
  loop
    select * into v_bid from public.bids b
     where b.auction_id = v_auction.id and b.auction_round = v_auction.auction_round
     order by b.amount desc, b.created_at asc limit 1;

    update public.auctions set status = 'ended', updated_at = now() where id = v_auction.id;
    if found and v_bid.id is not null then
      insert into public.auction_awards(
        auction_id, auction_round, listing_title, seller_id, bidder_id, amount, currency, payment_deadline
      ) values (
        v_auction.id, v_auction.auction_round, v_auction.title, v_auction.seller_id,
        v_bid.bidder_id, v_bid.amount, v_auction.currency, now() + interval '2 hours'
      ) on conflict (auction_id, auction_round) do nothing;
    end if;
  end loop;

  -- A missed payment restarts a fresh seven-day round at the seller's original price.
  for v_award in
    select * from public.auction_awards aa
     where aa.status = 'awaiting_payment' and aa.payment_deadline <= now() - interval '2 minutes'
     order by aa.payment_deadline, aa.id
     for update skip locked
  loop
    update public.auction_awards set status = 'expired' where id = v_award.id and status = 'awaiting_payment';
    update public.auctions
       set status = 'live', auction_round = auction_round + 1,
           starts_at = now(), ends_at = now() + interval '7 days',
           current_price = starting_price, bid_count = 0, latest_bid_at = null, updated_at = now()
     where id = v_award.auction_id and status = 'ended' and auction_round = v_award.auction_round;
  end loop;
end;
$$;
revoke all on function private.process_auction_lifecycle() from public, anon, authenticated;

-- Supabase Cron runs independently of a visitor's browser and handles many auctions per pass.
create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bidora-auction-lifecycle-every-minute') then
    perform cron.unschedule('bidora-auction-lifecycle-every-minute');
  end if;
  perform cron.schedule(
    'bidora-auction-lifecycle-every-minute',
    '* * * * *',
    'select private.process_auction_lifecycle();'
  );
end;
$$;

-- A short quiet period is meaningful even if the original maximum duration is longer.
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
  if a.latest_bid_at is not null and a.latest_bid_at <= now() - interval '5 minutes' then raise exception 'Bidding has paused while this auction is being closed.'; end if;
  if a.seller_id = caller then raise exception 'You cannot bid on your own listing.'; end if;
  if p_amount < a.current_price + a.bid_increment then raise exception 'Bid must be at least %.', a.current_price + a.bid_increment; end if;
  insert into public.bids(auction_id, bidder_id, amount, auction_round)
    values (p_auction_id, caller, p_amount, a.auction_round) returning * into new_bid;
  update public.auctions
     set current_price = p_amount, bid_count = bid_count + 1, latest_bid_at = now(), updated_at = now()
   where id = p_auction_id;
  return new_bid;
end;
$$;
revoke all on function public.place_bid(uuid,numeric) from public, anon;
grant execute on function public.place_bid(uuid,numeric) to authenticated;

