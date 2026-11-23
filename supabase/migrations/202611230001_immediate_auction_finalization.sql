-- Let the seller or a bidder in the current round finalize a due auction
-- immediately instead of waiting for the once-per-minute cron worker. The
-- database still selects the winner from all round bids under a row lock.
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

  -- Limit the state change to this auction's seller or a participant.
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
