-- Make each published auction a five-minute window. Every valid bid renews it.
-- Existing live auctions get a five-minute window when this migration is applied.
update public.auctions
   set ends_at = now() + interval '5 minutes', updated_at = now()
 where status = 'live'
   and (latest_bid_at is null or latest_bid_at > now() - interval '5 minutes');

create or replace function private.process_auction_lifecycle()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_auction public.auctions;
  v_bid public.bids;
  v_award public.auction_awards;
begin
  -- A quiet auction closes five minutes after its last bid. A zero-bid auction
  -- closes when its five-minute end time arrives. Row locks isolate auctions.
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

  -- A missed payment restarts a fresh five-minute round at the seller's price.
  for v_award in
    select * from public.auction_awards aa
     where aa.status = 'awaiting_payment' and aa.payment_deadline <= now() - interval '2 minutes'
     order by aa.payment_deadline, aa.id
     for update skip locked
  loop
    update public.auction_awards set status = 'expired' where id = v_award.id and status = 'awaiting_payment';
    update public.auctions
       set status = 'live', auction_round = auction_round + 1,
           starts_at = now(), ends_at = now() + interval '5 minutes',
           current_price = starting_price, bid_count = 0, latest_bid_at = null, updated_at = now()
     where id = v_award.auction_id and status = 'ended' and auction_round = v_award.auction_round;
  end loop;
end;
$$;
revoke all on function private.process_auction_lifecycle() from public, anon, authenticated;

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
     set current_price = p_amount, bid_count = bid_count + 1,
         latest_bid_at = now(), ends_at = now() + interval '5 minutes', updated_at = now()
   where id = p_auction_id;
  return new_bid;
end;
$$;
revoke all on function public.place_bid(uuid,numeric) from public, anon;
grant execute on function public.place_bid(uuid,numeric) to authenticated;
