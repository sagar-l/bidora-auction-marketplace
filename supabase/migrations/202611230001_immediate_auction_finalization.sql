-- Let the winning bidder finalize their due auction immediately instead of
-- waiting for the once-per-minute cron worker. Row locking makes this safe
-- against bids and concurrent finalization attempts.
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

  -- Only a participant can initiate finalization; the database still selects
  -- the winner by the authoritative amount/time ordering above.
  if v_bid.id is null then
    if auth.uid() is distinct from v_auction.seller_id then
      return false;
    end if;
  elsif auth.uid() is distinct from v_bid.bidder_id
    and auth.uid() is distinct from v_auction.seller_id then
    return false;
  end if;

  update public.auctions
     set status = 'ended', updated_at = pg_catalog.now()
   where id = v_auction.id
     and status = 'live';

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
