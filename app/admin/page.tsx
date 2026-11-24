import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Activity, ArrowUpRight, Flag, Gavel, PackageCheck, Store, Users, RefreshCw } from 'lucide-react';
import { getSupabaseAuthContext, getSupabaseProfile } from '@/lib/supabase/server';
import { moderateListing } from '@/app/actions';
import { DashboardRefresh } from '@/components/dashboard-refresh';
import { AdminDeleteListing } from '@/components/admin-delete-listing';

type AdminPageProps = { searchParams: { message?: string; error?: string } };

export const dynamic = 'force-dynamic';

export default async function Admin({ searchParams }: AdminPageProps) {
  const { supabase, user } = await getSupabaseAuthContext();
  if (!supabase) return <SetupNotice/>;
  if (!user) redirect('/login');
  const profile = await getSupabaseProfile(user.id);
  if (profile?.role !== 'admin') redirect('/dashboard');

  const onlineSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const [{ count: buyers }, { count: sellers }, { count: onlineBuyers }, { count: onlineSellers }, { data: all }, { count: pending }, { data: notifications }, { data: awards }, { data: bidEvents }, { count: totalBidCount }, { count: listingsCount }, { count: liveAuctionCount }, { count: bidAuctionCount }, { count: paidAwardCount }, { count: awaitingPaymentCount }, { count: expiredAwardCount }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer').gte('last_seen_at', onlineSince),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller').gte('last_seen_at', onlineSince),
    supabase.from('auctions').select('id,title,category,image_url,starting_price,current_price,status,slug,seller_id,created_at,starts_at,ends_at,auction_round,bid_count,currency').order('created_at', { ascending: false }).limit(100),
    supabase.from('auctions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('admin_notifications').select('id,message,notification_type,created_at').order('created_at', { ascending: false }).limit(12),
    supabase.from('auction_awards').select('id,auction_id,auction_round,listing_title,bidder_id,amount,currency,status,payment_deadline,paid_at,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('bids').select('id,auction_id,bidder_id,amount,created_at,auction_round').order('created_at', { ascending: false }).limit(20),
    supabase.from('bids').select('id', { count: 'exact', head: true }),
    supabase.from('auctions').select('id', { count: 'exact', head: true }),
    supabase.from('auctions').select('id', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('auctions').select('id', { count: 'exact', head: true }).gt('bid_count', 0),
    supabase.from('auction_awards').select('id', { count: 'exact', head: true }).in('status', ['paid', 'delivery_submitted']),
    supabase.from('auction_awards').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_payment'),
    supabase.from('auction_awards').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
  ]);
  const live = liveAuctionCount || 0;
  const rows = all || [];
  const memberCount = (buyers || 0) + (sellers || 0);
  const confirmedAwards = (awards || []).filter((award) => ['paid', 'delivery_submitted'].includes(award.status));
  const recentConfirmedSales = confirmedAwards.reduce((total, award) => total + Number(award.amount || 0), 0);
  const auctionIds = rows.map((auction) => auction.id);
  const { data: leaderBids } = auctionIds.length
    ? await supabase.from('bids').select('auction_id,bidder_id,amount,created_at,auction_round').in('auction_id', auctionIds).order('amount', { ascending: false }).order('created_at', { ascending: true }).limit(5000)
    : { data: [] as { auction_id: string; bidder_id: string; amount: number; created_at: string; auction_round: number }[] };
  const leaderByRound = new Map<string, NonNullable<typeof leaderBids>[number]>();
  for (const bid of leaderBids || []) {
    const key = `${bid.auction_id}:${bid.auction_round}`;
    if (!leaderByRound.has(key)) leaderByRound.set(key, bid);
  }
  const awardByRound = new Map<string, NonNullable<typeof awards>[number]>();
  const latestAwardByAuction = new Map<string, NonNullable<typeof awards>[number]>();
  for (const award of awards || []) {
    const key = `${award.auction_id}:${award.auction_round}`;
    if (!awardByRound.has(key)) awardByRound.set(key, award);
    if (!latestAwardByAuction.has(award.auction_id)) latestAwardByAuction.set(award.auction_id, award);
  }
  const participants = Array.from(new Set([
    ...rows.map((auction) => auction.seller_id),
    ...(awards || []).map((award) => award.bidder_id),
    ...(bidEvents || []).map((bid) => bid.bidder_id),
    ...Array.from(leaderByRound.values()).map((bid) => bid.bidder_id),
  ]));
  const { data: participantProfiles } = participants.length
    ? await supabase.from('profiles').select('id,display_name').in('id', participants)
    : { data: [] as { id: string; display_name: string | null }[] };
  const displayNames = new Map((participantProfiles || []).map((profile) => [profile.id, profile.display_name || `Member ${profile.id.slice(0, 8)}`]));
  const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
  const message = searchParams.message === 'moderated' ? 'Listing review saved.' : searchParams.message === 'removed' ? 'Listing removed from public auctions. Auction and sale history was kept.' : '';
  const error = searchParams.error === 'moderate' ? 'Could not update that listing. Refresh and check its status.' : searchParams.error === 'delete' ? 'Could not remove the listing. Refresh and check its status.' : '';

  return (
    <section className="section page-section">
      <div className="container">
        <div className="dashboard-welcome">
          <div><div className="eyebrow">BIDORA CONTROL ROOM</div><h1>Marketplace overview</h1><p className="muted">Review listings and see the BIDORA community at a glance.</p></div>
          <span className="admin-badge">ADMIN</span>
        </div>

        <div className="community-heading"><div className="eyebrow">MEMBER ACTIVITY</div><small>Online means active on BIDORA in the last 2 minutes.</small></div>
        <div className="stat-grid community-grid">
          <AdminStat icon={<Users/>} label="Buyers" value={String(buyers || 0)} delta="Registered buyer accounts"/>
          <AdminStat icon={<Store/>} label="Sellers" value={String(sellers || 0)} delta="Registered seller accounts"/>
          <AdminStat icon={<Activity/>} label="Buyers online" value={String(onlineBuyers || 0)} delta="Active in the last 2 minutes"/>
          <AdminStat icon={<Activity/>} label="Sellers online" value={String(onlineSellers || 0)} delta="Active in the last 2 minutes"/>
        </div>
        <div className="stat-grid admin-summary-grid">
          <AdminStat icon={<Users/>} label="Buyers + sellers" value={String(memberCount)} delta="Member accounts by role"/>
          <AdminStat icon={<Gavel/>} label="Live auctions" value={String(live)} delta="Currently published"/>
          <AdminStat icon={<PackageCheck/>} label="Confirmed sales" value={String(paidAwardCount || 0)} delta="Payment confirmed; delivery may follow"/>
          <AdminStat icon={<Flag/>} label="Needs review" value={String(pending || 0)} delta="Pending approval"/>
        </div>

        <div className="surface admin-report">
          <div className="table-header"><div><div className="eyebrow">LIVE AUCTION OPERATIONS</div><h2>Auction activity</h2><p className="muted">Which items opened for bidding, when each round started, bid volume, leading bidder, and current state. New auction activity refreshes the report immediately, with a one-minute safety refresh.</p></div><span className="admin-refresh-label"><RefreshCw size={14}/> Live updates · 60 sec fallback</span></div>
          <DashboardRefresh />
          <div className="table-scroll">
            <table className="admin-review-table admin-activity-table">
              <thead><tr><th>Item / category</th><th>Seller</th><th>Round</th><th>Submitted</th><th>Bidding opened</th><th>Auction ends</th><th>Bids</th><th>Current bid</th><th>Leader / winner</th><th>Status</th></tr></thead>
              <tbody>{rows.map((auction) => <tr key={`activity-${auction.id}`}>
                <td>{auction.status === 'live' ? <Link href={`/auctions/${auction.slug}`}>{auction.title}</Link> : auction.title}<small className="admin-subcell">{auction.category}</small></td>
                <td>{displayNames.get(auction.seller_id) || `Member ${auction.seller_id.slice(0, 8)}`}<small className="admin-subcell">{auction.seller_id}</small></td>
                <td>{auction.auction_round ?? 1}</td>
                <td>{formatDate(auction.created_at)}</td>
                <td>{formatDate(auction.starts_at)}</td>
                <td>{formatDate(auction.ends_at)}</td>
                <td>{auction.bid_count ?? 0}</td>
                <td>{formatMoney(Number(auction.current_price || 0))}</td>
                <td>{(() => {
                  const key = `${auction.id}:${auction.auction_round ?? 1}`;
                  const roundAward = awardByRound.get(key);
                  const roundLeader = leaderByRound.get(key);
                  const previousAward = latestAwardByAuction.get(auction.id);
                  const result = auction.status === 'live'
                    ? roundLeader ? { bidderId: roundLeader.bidder_id, detail: `Leading · Round ${roundLeader.auction_round}` } : null
                    : roundAward ? { bidderId: roundAward.bidder_id, detail: `Winner · Round ${roundAward.auction_round}` }
                      : roundLeader ? { bidderId: roundLeader.bidder_id, detail: `Highest bid · Round ${roundLeader.auction_round}` }
                        : previousAward ? { bidderId: previousAward.bidder_id, detail: `Previous winner · Round ${previousAward.auction_round} · ${previousAward.status.replaceAll('_', ' ')}` }
                          : null;
                  return result
                    ? <><strong>{displayNames.get(result.bidderId) || `Member ${result.bidderId.slice(0, 8)}`}</strong><small className="admin-subcell">{result.detail}</small></>
                    : auction.status === 'live' ? 'No bids yet' : 'No winner recorded';
                })()}</td>
                <td><span className={`status-pill ${auction.status === 'live' ? 'status-live' : auction.status === 'pending' ? 'status-review' : 'status-rejected'}`}>{auction.status}</span></td>
              </tr>)}</tbody>
            </table>
            {!rows.length && <div className="empty-review">Auction activity will appear here when listings are submitted.</div>}
          </div>
          <div className="admin-foot">Showing the latest {rows.length} listings. Totals above use exact database counts. The auction lifecycle processes simultaneous auctions independently; this report reflects saved database state.</div>
        </div>

        <div className="surface admin-report admin-winners">
          <div className="table-header"><div><div className="eyebrow">WINNERS &amp; SALES</div><h2>Winner and payment history</h2><p className="muted">The report identifies the winning buyer and amount. A confirmed sale is counted only after payment is confirmed.</p></div></div>
          <div className="table-scroll"><table className="admin-review-table"><thead><tr><th>Item</th><th>Round</th><th>Winning buyer</th><th>Buyer ID</th><th>Winning amount</th><th>Payment deadline</th><th>Paid at</th><th>Sale status</th></tr></thead>
            <tbody>{(awards || []).map((award) => <tr key={award.id}><td>{award.listing_title}</td><td>{award.auction_round}</td><td>{displayNames.get(award.bidder_id) || `Member ${award.bidder_id.slice(0, 8)}`}</td><td><code className="admin-buyer-id">{award.bidder_id}</code></td><td>{formatMoney(Number(award.amount))}</td><td>{formatDate(award.payment_deadline)}</td><td>{formatDate(award.paid_at)}</td><td><span className={`status-pill ${['paid','delivery_submitted'].includes(award.status) ? 'status-live' : award.status === 'awaiting_payment' ? 'status-review' : 'status-rejected'}`}>{award.status.replaceAll('_', ' ')}</span></td></tr>)}</tbody>
          </table>{!awards?.length && <div className="empty-review">Winners will be listed here when auctions close.</div>}</div>
          <div className="admin-foot">Showing the latest {(awards || []).length} winner records. Confirmed-sale count is exact; the value below is summed from these displayed records only.</div>
        </div>

        <div className="surface admin-report admin-bid-events">
          <div className="table-header"><div><div className="eyebrow">RECENT BIDS</div><h2>Latest bid activity</h2></div><span className="admin-total-bids">{(totalBidCount || 0).toLocaleString('en-IN')} bids recorded</span></div>
          <div className="admin-bid-list">{(bidEvents || []).map((bid) => <div className="admin-bid-row" key={bid.id}><Gavel size={16}/><span><strong>{displayNames.get(bid.bidder_id) || `Member ${bid.bidder_id.slice(0, 8)}`}</strong> bid on <strong>{rows.find((auction) => auction.id === bid.auction_id)?.title || 'Auction item'}</strong><small>Round {bid.auction_round} · {formatDate(bid.created_at)}</small></span><b>{formatMoney(Number(bid.amount))}</b></div>)}{!bidEvents?.length && <p className="muted notification-empty">No bids have been placed yet.</p>}</div>
        </div>

        <div className="admin-end-summary"><div className="eyebrow">END OF REPORT SUMMARY · LIVE COUNTS</div><div className="admin-end-summary-grid"><span><strong>{(listingsCount || 0).toLocaleString('en-IN')}</strong> total items listed</span><span><strong>{live.toLocaleString('en-IN')}</strong> auctions open now</span><span><strong>{(bidAuctionCount || 0).toLocaleString('en-IN')}</strong> items with bids in the current round</span><span><strong>{(totalBidCount || 0).toLocaleString('en-IN')}</strong> total bids recorded</span><span><strong>{(paidAwardCount || 0).toLocaleString('en-IN')}</strong> confirmed sales</span><span><strong>{(awaitingPaymentCount || 0).toLocaleString('en-IN')}</strong> awaiting payment</span><span><strong>{(expiredAwardCount || 0).toLocaleString('en-IN')}</strong> expired awards</span><span><strong>{formatMoney(recentConfirmedSales)}</strong> confirmed value in latest {confirmedAwards.length} award records</span></div><small className="admin-summary-updated">Report generated {formatDate(new Date().toISOString())} · updates on auction activity with a 60-second safety refresh</small></div>

        <div className="surface admin-notifications"><div className="table-header"><div><div className="eyebrow">PAYMENT &amp; DELIVERY UPDATES</div><h2>Marketplace notifications</h2><p className="muted">Verified sale messages include the buyer ID and confirmed amount.</p></div></div>{notifications?.length ? <div className="notification-list">{notifications.map((note) => <div className="notification-row" key={note.id}><span className={`notification-dot ${note.notification_type === 'sale_confirmed' ? 'sold' : ''}`}/><div><strong>{note.message}</strong><small>{note.notification_type === 'sale_confirmed' ? 'Payment confirmed' : 'Delivery details received'} · {new Date(note.created_at).toLocaleString()}</small></div></div>)}</div> : <p className="muted notification-empty">No payment or delivery updates yet.</p>}</div>

        {error && <div className="demo-note admin-notice" role="alert">{error}</div>}
        {message && <div className="demo-note admin-notice" role="status">{message}</div>}
        <div className="surface admin-table-wrap">
          <div className="table-header"><div><div className="eyebrow">MARKETPLACE ACTIVITY</div><h2>Listings for review</h2><p className="muted">Preview each seller’s photo, set the opening price, then approve, reject, or remove a published listing.</p></div><Link href="/auctions" className="text-link">View marketplace <ArrowUpRight size={14}/></Link></div>
          <div className="table-scroll">
            <table className="admin-review-table">
              <thead><tr><th>Product</th><th>Seller ID</th><th>Category</th><th>Status</th><th>Price / admin action</th></tr></thead>
              <tbody>{rows.map((auction, index) => {
                const isPending = auction.status === 'pending';
                const approveFormId = `approve-${auction.id}`;
                return <tr key={auction.id}>
                  <td><div className="admin-listing-cell">{auction.image_url ? <a href={auction.image_url} target="_blank" rel="noreferrer" aria-label={`View full photo of ${auction.title}`}><Image src={auction.image_url} alt={auction.title} width={64} height={64} unoptimized className="admin-listing-thumb"/></a> : <div className="admin-listing-thumb admin-listing-placeholder">No photo</div>}<span className="admin-listing-title"><span className="row-dot">{String(index + 1).padStart(2, '0')}</span>{auction.status === 'live' ? <Link href={`/auctions/${auction.slug}`}>{auction.title}</Link> : <span>{auction.title}</span>}</span></div></td>
                  <td>{auction.seller_id.slice(0, 8)}…</td>
                  <td>{auction.category}</td>
                  <td><span className={`status-pill ${auction.status === 'live' ? 'status-live' : isPending ? 'status-review' : 'status-rejected'}`}>{auction.status}</span></td>
                  <td>{isPending ? <div className="admin-review-actions">
                    <form id={approveFormId} action={moderateListing} className="approve-form"><input type="hidden" name="id" value={auction.id}/><input type="hidden" name="status" value="live"/><label className="admin-price-label">Opening price (₹ INR)<input name="startingPrice" type="number" min="1" step="1" defaultValue={Number(auction.starting_price).toFixed(0)} required form={approveFormId}/></label><button className="status-pill status-live" type="submit">Approve &amp; publish</button></form>
                    <form action={moderateListing}><input type="hidden" name="id" value={auction.id}/><input type="hidden" name="status" value="rejected"/><button className="status-pill status-review" type="submit">Reject</button></form>
                  </div> : <div className="admin-published-actions"><span>{formatMoney(Number(auction.current_price))}</span>{['live', 'ended'].includes(auction.status) && <AdminDeleteListing id={auction.id} title={auction.title}/>}</div>}</td>
                </tr>;
              })}</tbody>
            </table>
            {!rows.length && <div className="empty-review">No listings yet. Seller submissions will appear here for review.</div>}
          </div>
          <div className="admin-foot">Admin actions are checked against your account role and Supabase row level security.</div>
        </div>
      </div>
    </section>
  );
}

function AdminStat({ icon, label, value, delta }: { icon: React.ReactNode; label: string; value: string; delta: string }) {
  return <div className="surface stat-card admin-stat"><div className="stat-top">{icon}<span>{label}</span></div><strong>{value}</strong><small>{delta}</small></div>;
}

function SetupNotice() {
  return <section className="section page-section"><div className="container"><h1>Admin dashboard</h1><div className="demo-note">Backend setup required. Configure Supabase and promote your account to admin before opening this dashboard.</div></div></section>;
}
