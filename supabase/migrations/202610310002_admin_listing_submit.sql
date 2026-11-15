-- Let admins submit their own listings into the same pending review queue.
-- They cannot publish them through this policy; approval remains an admin action.
drop policy if exists "admins create own pending listings" on public.auctions;

create policy "admins create own pending listings"
on public.auctions
for insert
to authenticated
with check (
  (select private.is_admin())
  and seller_id = (select auth.uid())
  and status = 'pending'
);
