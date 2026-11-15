-- Claim records let the scheduled agent create and email each Razorpay link once,
-- while allowing a failed/incomplete claim to be retried after five minutes.
alter table public.auction_awards
  add column if not exists payment_link_claimed_at timestamptz;

-- Edge Function uses the service role only; these explicit grants complement
-- service-role RLS bypass and keep browser roles unable to write award data.
grant select on public.auction_awards to service_role;
grant update (razorpay_payment_link_id, razorpay_payment_url, payment_link_claimed_at)
  on public.auction_awards to service_role;

create or replace function public.claim_auction_awards_for_agent(p_limit integer default 20)
returns table (
  id uuid,
  listing_title text,
  amount numeric,
  currency text,
  payment_deadline timestamptz,
  bidder_id uuid,
  bidder_name text,
  bidder_email text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required.'; end if;

  return query
  with candidates as (
    select aa.id
      from public.auction_awards aa
     where aa.status = 'awaiting_payment'
       and aa.payment_deadline > now()
       and aa.razorpay_payment_link_id is null
       and (aa.payment_link_claimed_at is null or aa.payment_link_claimed_at < now() - interval '5 minutes')
     order by aa.payment_deadline, aa.id
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 20), 50))
  ), claimed as (
    update public.auction_awards aa
       set payment_link_claimed_at = now()
      from candidates c
     where aa.id = c.id
    returning aa.id, aa.listing_title, aa.amount, aa.currency, aa.payment_deadline, aa.bidder_id
  )
  select c.id, c.listing_title, c.amount, c.currency, c.payment_deadline, c.bidder_id,
         coalesce(p.display_name, 'BIDORA buyer'), u.email::text
    from claimed c
    left join public.profiles p on p.id = c.bidder_id
    join auth.users u on u.id = c.bidder_id;
end;
$$;

revoke all on function public.claim_auction_awards_for_agent(integer) from public, anon, authenticated;
grant execute on function public.claim_auction_awards_for_agent(integer) to service_role;
