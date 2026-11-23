import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowUpRight, Clock3, Gavel, Heart, Package, Store, Users, Wallet } from 'lucide-react';
import { getSupabaseAuthContext, getSupabaseProfile } from '@/lib/supabase/server';
import { auctions as demo } from '@/data/auctions';
import { AuctionCard } from '@/components/auction-card';
import { DashboardRefresh } from '@/components/dashboard-refresh';
import { getAuctions } from '@/lib/auctions';

const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export default async function Dashboard() {
  const { supabase, user } = await getSupabaseAuthContext();
  if (!supabase) return <DemoDashboard/>;
  if (!user) redirect('/login');

  const profile = await getSupabaseProfile(user.id);
  const isSeller = profile?.role === 'seller' || profile?.role === 'admin';
  const primaryActionHref = isSeller ? '/sell' : '/auctions';
  const primaryActionLabel = isSeller ? 'List an item' : 'Buy an item';
  const onlineSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const [{ data: listings }, { data: bids }, { data: saved }, { count: buyers }, { count: sellers }, { count: onlineBuyers }, { count: onlineSellers }, { data: awards }, { items: liveAuctions }] = await Promise.all([
    supabase.from('auctions').select('id,slug,title,status,current_price,ends_at,category,condition,description,image_url,bid_count').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(6),
    supabase.from('bids').select('id,amount,auction_id,created_at').eq('bidder_id', user.id).order('created_at', { ascending: false }).limit(8),
    supabase.from('watchlist').select('auction_id').eq('user_id', user.id),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer').gte('last_seen_at', onlineSince),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller').gte('last_seen_at', onlineSince),
    supabase.from('auction_awards').select('id,listing_title,amount,status,payment_deadline').eq('bidder_id', user.id).order('created_at', { ascending: false }).limit(8),
    getAuctions(),
  ]);

  const liveBids = (bids || []).filter((bid) => bid.auction_id);
  const savedIds = (saved || []).map((row) => row.auction_id);
  const savedAuctions = liveAuctions.filter((auction) => !!auction.dbId && savedIds.includes(auction.dbId));
  const ownItems = (listings || []).map((auction) => ({
    id: auction.slug,
    title: auction.title,
    category: 'Your listing',
    price: Number(auction.current_price),
    bids: auction.bid_count,
    ends: auction.status === 'pending' ? 'In review' : 'Live',
    image: auction.image_url || demo[0].image,
    condition: auction.condition,
    seller: profile?.display_name || 'You',
    description: auction.description,
    dbId: auction.id,
  }));

  return (
    <section className="section page-section">
      <div className="container">
        <DashboardRefresh/>
        <div className="dashboard-welcome"><div><div className="eyebrow">YOUR BIDORA</div><h1>Welcome, {profile?.display_name || user.email?.split('@')[0]}</h1><p className="muted">Your account, bids and listings in one place.</p></div><Link href={primaryActionHref} className="btn btn-primary">{primaryActionLabel} <ArrowUpRight size={15}/></Link></div>
        <div className="stat-grid"><Stat icon={<Gavel/>} label="Your bids" value={String(liveBids.length).padStart(2, '0')} hint="Recent bid activity"/><Link href="/watchlist" className="stat-card-link"><Stat icon={<Heart/>} label="Wishlist" value={String(savedAuctions.length).padStart(2, '0')} hint="View saved auctions"/></Link><Stat icon={<Package/>} label="Your listings" value={String(listings?.length || 0).padStart(2, '0')} hint="Including review queue"/><Stat icon={<Wallet/>} label="Account" value={profile?.role || 'buyer'} hint={user.email || ''}/></div>

        <section className="dashboard-wishlist"><div className="section-head compact"><div><div className="eyebrow">SAVED FOR LATER</div><h2>Your wishlist</h2></div><Link href="/watchlist" className="text-link">View wishlist <ArrowUpRight size={14}/></Link></div>{savedAuctions.length ? <div className="grid-cards dashboard-cards">{savedAuctions.slice(0, 4).map((auction, index) => <AuctionCard item={auction} key={auction.id} index={index} isSaved returnTo="/dashboard"/>)}</div> : <div className="surface activity-panel">No saved auctions yet. <Link className="text-link" href="/auctions">Browse auctions and tap the heart to save one.</Link></div>}</section>

        <section className="community-panel surface" aria-label="BIDORA buyer and seller counts">
          <div className="community-panel-heading"><div><div className="eyebrow">BIDORA COMMUNITY</div><h2>Members on the marketplace</h2></div><span className="online-key"><i/> Online now</span></div>
          <p className="community-caption">Online counts reflect signed-in members active within the last 2 minutes. Counts refresh every minute.</p>
          <div className="community-grid"><CommunityStat icon={<Users/>} label="Buyers" value={buyers || 0} online={onlineBuyers || 0}/><CommunityStat icon={<Store/>} label="Sellers" value={sellers || 0} online={onlineSellers || 0}/></div>
        </section>

        {!!awards?.length && <section className="award-list surface"><div className="eyebrow">AUCTION RESULTS</div><h2>Items won</h2>{awards.map((award) => <div className="award-list-row" key={award.id}><div><strong>{award.listing_title}</strong><small>{formatMoney(Number(award.amount))} · {award.status === 'awaiting_payment' ? `Pay by ${new Date(award.payment_deadline).toLocaleString()}` : award.status === 'expired' ? 'Payment window ended; auction restarted' : award.status === 'delivery_submitted' ? 'Delivery details submitted' : 'Payment confirmed'}</small></div>{award.status === 'awaiting_payment' && <Link className="btn btn-primary" href={`/payments/${award.id}`}>Pay now</Link>}{award.status === 'paid' && <Link className="btn btn-primary" href={`/payments/${award.id}`}>Add delivery details</Link>}</div>)}</section>}

        <div className="dashboard-columns"><div><div className="section-head compact"><div><div className="eyebrow">YOUR ITEMS</div><h2>Recent listings</h2></div><Link href="/sell" className="text-link">Create listing <ArrowUpRight size={14}/></Link></div>{ownItems.length ? <div className="grid-cards dashboard-cards">{ownItems.slice(0, 4).map((auction, index) => <AuctionCard item={auction} key={auction.id} index={index}/>)}</div> : <div className="surface activity-panel">You have no listings yet. <Link className="text-link" href="/sell">List your first item</Link></div>}</div><aside className="surface activity-panel"><div className="eyebrow">RECENT BIDS</div><h3>Your bidding activity</h3>{liveBids.length ? liveBids.slice(0, 5).map((bid) => <div className="activity-item" key={bid.id}><Clock3/><span><strong>Bid {formatMoney(Number(bid.amount))}</strong><small>{new Date(bid.created_at).toLocaleString()}</small></span></div>) : <p className="muted">No bids yet. <Link href="/auctions">Explore live auctions</Link></p>}</aside></div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className="surface stat-card"><div className="stat-top">{icon}<span>{label}</span></div><strong>{value}</strong><small>{hint}</small></div>;
}

function CommunityStat({ icon, label, value, online }: { icon: React.ReactNode; label: string; value: number; online: number }) {
  return <div className="community-stat"><div className="community-stat-title">{icon}<span>{label}</span></div><div className="community-stat-numbers"><strong>{value}</strong><span><i/> {online} online</span></div></div>;
}

function DemoDashboard() {
  return <section className="section page-section"><div className="container"><div className="dashboard-welcome"><div><div className="eyebrow">YOUR BIDORA</div><h1>Your dashboard</h1><p className="muted">Connect Supabase to create an account and view your listings and bids.</p></div><Link href="/login" className="btn btn-primary">Sign in</Link></div><div className="demo-note">Backend setup required · Add your Supabase project URL and public anon key in `.env.local`, then apply the SQL migration.</div></div></section>;
}
