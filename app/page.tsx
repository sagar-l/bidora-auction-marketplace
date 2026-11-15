import Link from 'next/link';
import {ArrowRight,ShieldCheck,RefreshCw,PackageCheck,ArrowUpRight} from 'lucide-react';
import {categories} from '@/data/auctions';
import {getAuctions} from '@/lib/auctions';
import {AuctionCard,ProductImage,SectionHeading} from '@/components/auction-card';

export default async function Home(){
  const {items}=await getAuctions();
  const featured=items.slice(0,4);
  const lead=items[0];
  const leadPrice=lead?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(lead.price):'BIDORA';
  return <>
    <section className="hero"><div className="hero-glow"/><div className="container hero-grid">
      <div className="hero-copy"><div className="eyebrow hero-kicker"><span className="live-dot"/>THE MARKETPLACE FOR GREAT FINDS</div><h1>Discover.<br/><em>Bid.</em> Own.</h1><p>One-of-a-kind finds. A little friendly competition. Your next great story starts here.</p><div className="hero-actions"><Link href="/auctions" className="btn btn-primary">Explore auctions <ArrowRight size={16}/></Link><Link href="/login?intent=sell&amp;next=%2Fsell" className="btn btn-quiet">Start selling</Link></div><div className="hero-proof"><span><strong>{items.length}</strong> active auctions</span><i/><span><strong>Open</strong> marketplace</span></div></div>
      <div className="hero-visual"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-main-image"><ProductImage image={lead?.image||'photo-1523170335258-f5ed11844a49'}/></div><div className="floating-card floating-top"><span className="live-dot"/> {lead?'LIVE AUCTION':'BIDORA'} <strong>{lead?`${lead.bids} bids`:'New finds daily'}</strong></div><div className="floating-card floating-bottom"><span className="small-label">{lead?'CURRENT BID':'DISCOVER · BID · WIN'}</span><strong>{leadPrice}</strong><span className="muted">{lead?.title||'Find your next favorite'}</span></div><div className="hero-spark">✦</div></div>
    </div><div className="hero-bottom container"><span>CURATED FINDS. REAL PEOPLE.</span><span>THE THRILL OF THE FINAL BID <ArrowRight size={14}/></span></div></section>
    <section className="trust-strip"><div className="container trust-inner"><span><ShieldCheck/>Secure accounts</span><span><RefreshCw/>Reviewed listings</span><span><PackageCheck/>Live bidding</span><span>✦&nbsp; Curated finds</span></div></section>
    <section className="section" id="categories"><div className="container"><SectionHeading kicker="Find your next favorite" title="Browse by category" link="All categories"/><div className="category-grid">{categories.map(c=><Link href={`/auctions?category=${encodeURIComponent(c.name)}`} key={c.name} className="category-tile"><span className="category-icon">{c.icon}</span><span><strong>{c.name}</strong><small>{c.count}</small></span><ArrowUpRight className="category-arrow" size={15}/></Link>)}</div></div></section>
    <section className="section featured-section"><div className="container"><SectionHeading kicker="The good stuff goes quickly" title="Auctions worth a look" link="View all auctions"/>{featured.length?<div className="grid-cards">{featured.map((a,i)=><AuctionCard item={a} index={i} key={a.id}/>)}</div>:<div className="empty-state">No live auctions at the moment. Check back soon or <Link href="/login?intent=sell&amp;next=%2Fsell">submit a listing</Link>.</div>}</div></section>
    <section className="sell-banner container"><div><div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div><h2>Something special<br/>deserves a new home.</h2><p>List your first item and let the right buyer find it.</p><Link href="/login?intent=sell&amp;next=%2Fsell" className="btn btn-primary">Start selling <ArrowRight size={16}/></Link></div><div className="sell-art"><ProductImage image="photo-1548036328-c9fa89d128fa"/><span>GOOD THINGS<br/>FIND NEW OWNERS</span></div></section>
  </>;
}
