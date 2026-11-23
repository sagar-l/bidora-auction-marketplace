import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, Heart } from 'lucide-react';
import { AuctionCard } from '@/components/auction-card';
import { getSupabaseAuthContext } from '@/lib/supabase/server';
import { getAuctions } from '@/lib/auctions';

export default async function WatchlistPage({ searchParams }: { searchParams: { error?: string; message?: string } }) {
  const { supabase, user } = await getSupabaseAuthContext();
  if (supabase && !user) redirect('/login?intent=explore&next=%2Fwatchlist');
  if (!supabase) return <section className="section page-section"><div className="container"><div className="page-intro"><div className="eyebrow">YOUR BIDORA</div><h1>Your wishlist</h1><p className="muted">Sign in to save auctions for later.</p></div><Link href="/login?next=%2Fwatchlist" className="btn btn-primary">Sign in</Link></div></section>;

  const [{ data: saved, error: savedError }, { items }] = await Promise.all([
    supabase.from('watchlist').select('auction_id,created_at').eq('user_id', user!.id).order('created_at', { ascending: false }),
    getAuctions(),
  ]);
  const savedIds = (saved || []).map((row) => row.auction_id);
  const auctionsById = new Map(items.filter((item) => item.dbId).map((item) => [item.dbId!, item]));
  const savedAuctions = savedIds.map((id) => auctionsById.get(id)).filter((item): item is NonNullable<typeof item> => !!item);

  return <section className="section page-section"><div className="container"><div className="page-intro"><div className="eyebrow">YOUR BIDORA</div><h1>Your wishlist</h1><p className="muted">Live auctions you saved to come back to.</p></div>{savedError && <div className="demo-note">We couldn’t load your wishlist. Refresh the page and try again.</div>}{searchParams.error === 'watchlist' && <div className="demo-note">We couldn’t update your wishlist. Please try again.</div>}{searchParams.message === 'watch-added' && <div className="demo-note">Auction saved to your wishlist.</div>}{searchParams.message === 'watch-removed' && <div className="demo-note">Auction removed from your wishlist.</div>}<div className="section-head"><div><div className="eyebrow">SAVED AUCTIONS</div><h2>{savedAuctions.length} {savedAuctions.length === 1 ? 'item' : 'items'}</h2></div><Link href="/auctions" className="btn btn-quiet">Explore auctions <ArrowUpRight size={15}/></Link></div>{savedAuctions.length ? <div className="grid-cards">{savedAuctions.map((item, index) => <AuctionCard key={item.id} item={item} index={index} isSaved returnTo="/watchlist"/>)}</div> : <div className="surface wishlist-empty"><span className="wishlist-empty-icon"><Heart size={23}/></span><h2>Your wishlist is ready</h2><p className="muted">Tap the heart on any live auction to keep it here.</p><Link className="btn btn-primary" href="/auctions">Browse auctions <ArrowUpRight size={15}/></Link></div>}</div></section>;
}
