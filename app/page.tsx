import Link from 'next/link';
import {ArrowRight,ShieldCheck,RefreshCw,PackageCheck,ArrowUpRight} from 'lucide-react';
import {categories} from '@/data/auctions';
import {getAuctions} from '@/lib/auctions';
import {AuctionCard,ProductImage,SectionHeading} from '@/components/auction-card';
import {HomeFeatureCarousel} from '@/components/home-feature-carousel';
import {getSupabaseAuthContext,getSupabaseProfile} from '@/lib/supabase/server';

export default async function Home(){
  const [{items},{user}]=await Promise.all([getAuctions(),getSupabaseAuthContext()]);
  const profile=user?await getSupabaseProfile(user.id):null;
  const isSeller=profile?.role==='seller'||profile?.role==='admin';
  const actionHref=user?(isSeller?'/sell':'/auctions'):'/login?intent=sell&next=%2Fsell';
  const actionLabel=user&&!isSeller?'Buy an item':'Start selling';
  const featured=items.slice(0,4);
  const lead=items[0];
  const leadPrice=lead?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(lead.price):'BIDORA';
  return <>
    <section className="hero"><div className="hero-glow"/><div className="container hero-grid">
      <div className="hero-copy"><div className="eyebrow hero-kicker"><span className="live-dot"/>THE MARKETPLACE FOR GREAT FINDS</div><h1>Discover.<br/><em>Bid.</em> Own.</h1><p>One-of-a-kind finds. A little friendly competition. Your next great story starts here.</p><div className="hero-actions"><Link href="/auctions" className="btn btn-primary">Explore auctions <ArrowRight size={16}/></Link><Link href={actionHref} className="btn btn-quiet">{actionLabel}</Link></div><div className="hero-proof"><span><strong>{items.length}</strong> active auctions</span><i/><span><strong>Open</strong> marketplace</span></div></div>
      <div className="hero-visual"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-main-image"><HomeFeatureCarousel/></div><div className="floating-card floating-top"><span className="live-dot"/> BIDORA <strong>New finds daily</strong></div><div className="floating-card floating-bottom"><span className="small-label">DISCOVER · BID · WIN</span><strong>{leadPrice}</strong><span className="muted">{lead?.title||'Find your next favorite'}</span></div><div className="hero-spark">✦</div></div>
    </div><div className="hero-bottom container"><span>CURATED FINDS. REAL PEOPLE.</span><span>THE THRILL OF THE FINAL BID <ArrowRight size={14}/></span></div></section>
    <section className="trust-strip"><div className="container trust-inner"><span><ShieldCheck/>Secure accounts</span><span><RefreshCw/>Reviewed listings</span><span><PackageCheck/>Live bidding</span><span>✦&nbsp; Curated finds</span></div></section>
    <section className="section" id="categories"><div className="container"><SectionHeading kicker="Find your next favorite" title="Browse by category" link="All categories"/><div className="category-grid category-photo-grid">{categories.map(c=><Link href={`/auctions?category=${encodeURIComponent(c.name)}`} key={c.name} className="category-photo-tile"><ProductImage image={c.image} /><span className="category-photo-shade"/><span className="category-photo-copy"><strong>{c.name}</strong><small>{c.count}</small></span><ArrowUpRight className="category-photo-arrow" size={18}/></Link>)}</div></div></section>
    <section className="section featured-section"><div className="container"><SectionHeading kicker="The good stuff goes quickly" title="Auctions worth a look" link="View all auctions"/>{featured.length?<div className="grid-cards">{featured.map((a,i)=><AuctionCard item={a} index={i} key={a.id}/>)}</div>:<div className="empty-state">No live auctions at the moment. Check back soon or <Link href={actionHref}>{user&&!isSeller?'browse auctions':'submit a listing'}</Link>.</div>}</div></section>
    <section className="sell-banner container"><div><div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div><h2>Something special<br/>deserves a new home.</h2><p>{user&&!isSeller?'Find an item you love and make it yours.':'List your first item and let the right buyer find it.'}</p><Link href={actionHref} className="btn btn-primary">{actionLabel} <ArrowRight size={16}/></Link></div><div className="sell-art"><ProductImage image="photo-1548036328-c9fa89d128fa"/><span>GOOD THINGS<br/>FIND NEW OWNERS</span></div></section>
  </>;
}
