-- Keep ended auction pages readable so their winner announcement can render.
-- Award/payment details remain protected by the separate auction_awards policy.
drop policy if exists "public can browse live auctions" on public.auctions;
drop policy if exists "public can browse live and ended auctions" on public.auctions;

create policy "public can browse live and ended auctions"
  on public.auctions
  for select
  to anon, authenticated
  using (
    status in ('live', 'ended')
    or seller_id = (select auth.uid())
    or (select private.is_admin())
  );
