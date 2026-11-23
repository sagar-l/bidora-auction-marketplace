-- Repair any live rows left with the old seven-day expiry and preserve the
-- five-minute window on all future payment-expiry restarts.
update public.auctions
   set ends_at = least(
     ends_at,
     coalesce(latest_bid_at, starts_at) + interval '5 minutes'
   ),
       updated_at = pg_catalog.now()
 where status = 'live'
   and ends_at > coalesce(latest_bid_at, starts_at) + interval '5 minutes';

create or replace function private.process_auction_lifecycle()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auction public.auctions;
  v_bid public.bids;
  v_award public.auction_awards;
begin
  for v_auction in
    select * from public.auctions a
     where a.status = 'live'
       and (a.ends_at <= pg_catalog.now()
         or (a.latest_bid_at is not null and a.latest_bid_at <= pg_catalog.now() - interval '5 minutes'))
     order by coalesce(a.latest_bid_at, a.ends_at), a.id
     for update skip locked
  loop
    select * into v_bid from public.bids b
     where b.auction_id = v_auction.id
       and b.auction_round = v_auction.auction_round
     order by b.amount desc, b.created_at asc
     limit 1;

    update public.auctions
       set status = 'ended', updated_at = pg_catalog.now()
     where id = v_auction.id;

    if found and v_bid.id is not null then
      insert into public.auction_awards(
        auction_id, auction_round, listing_title, seller_id, bidder_id,
        amount, currency, payment_deadline
      ) values (
        v_auction.id, v_auction.auction_round, v_auction.title, v_auction.seller_id,
        v_bid.bidder_id, v_bid.amount, v_auction.currency,
        pg_catalog.now() + interval '2 hours'
      ) on conflict (auction_id, auction_round) do nothing;
    end if;
  end loop;

  for v_award in
    select * from public.auction_awards aa
     where aa.status = 'awaiting_payment'
       and aa.payment_deadline <= pg_catalog.now() - interval '2 minutes'
     order by aa.payment_deadline, aa.id
     for update skip locked
  loop
    update public.auction_awards
       set status = 'expired'
     where id = v_award.id and status = 'awaiting_payment';

    update public.auctions
       set status = 'live',
           auction_round = auction_round + 1,
           starts_at = pg_catalog.now(),
           ends_at = pg_catalog.now() + interval '5 minutes',
           current_price = starting_price,
           bid_count = 0,
           latest_bid_at = null,
           updated_at = pg_catalog.now()
     where id = v_award.auction_id
       and status = 'ended'
       and auction_round = v_award.auction_round;
  end loop;
end;
$$;
revoke all on function private.process_auction_lifecycle() from public, anon, authenticated;

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

-- The seller or any signed-in bidder in this round may request a close, but
-- the database remains authoritative for the deadline and winning bid.
create or replace function public.finalize_auction_if_due(p_auction_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auction public.auctions;
  v_bid public.bids;
begin
  select * into v_auction
    from public.auctions
   where id = p_auction_id
   for update;

  if not found or v_auction.status <> 'live' then
    return false;
  end if;

  if v_auction.ends_at > pg_catalog.now()
     and (v_auction.latest_bid_at is null
       or v_auction.latest_bid_at > pg_catalog.now() - interval '5 minutes') then
    return false;
  end if;

  select * into v_bid
    from public.bids b
   where b.auction_id = v_auction.id
     and b.auction_round = v_auction.auction_round
   order by b.amount desc, b.created_at asc
   limit 1;

  if auth.uid() is distinct from v_auction.seller_id
     and not exists (
       select 1 from public.bids b
        where b.auction_id = v_auction.id
          and b.auction_round = v_auction.auction_round
          and b.bidder_id = auth.uid()
     ) then
    return false;
  end if;

  update public.auctions
     set status = 'ended', updated_at = pg_catalog.now()
   where id = v_auction.id and status = 'live';

  if not found then
    return false;
  end if;

  if v_bid.id is not null then
    insert into public.auction_awards(
      auction_id, auction_round, listing_title, seller_id, bidder_id,
      amount, currency, payment_deadline
    ) values (
      v_auction.id, v_auction.auction_round, v_auction.title, v_auction.seller_id,
      v_bid.bidder_id, v_bid.amount, v_auction.currency,
      pg_catalog.now() + interval '2 hours'
    ) on conflict (auction_id, auction_round) do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.finalize_auction_if_due(uuid) from public, anon, authenticated;
grant execute on function public.finalize_auction_if_due(uuid) to authenticated;
