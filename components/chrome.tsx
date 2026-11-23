import Link from 'next/link';
import Image from 'next/image';
import { Search, Heart, UserRound } from 'lucide-react';
import { MobileNavigation } from '@/components/mobile-navigation';
import { PresenceTracker } from '@/components/presence-tracker';
import { BuyerNotificationBell } from '@/components/buyer-notification-bell';
import { getSupabaseAuthContext, getSupabaseProfile } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';

function Brand() {
  return <Link href="/" className="brand" aria-label="BIDORA — Discover, bid, win"><Image src="/bidora-logo.svg" alt="BIDORA — Discover, bid, win" width={164} height={40} priority className="brand-logo"/></Link>;
}

export async function SiteHeader() {
  const { user } = await getSupabaseAuthContext();
  const profile = user ? await getSupabaseProfile(user.id) : null;
  const isSeller = profile?.role === 'seller' || profile?.role === 'admin';
  const actionHref = user ? (isSeller ? '/sell' : '/auctions') : '/login?intent=sell&next=%2Fsell';
  const actionLabel = user && !isSeller ? 'Buy an item' : 'Sell an item';

  return <header className="header">
    {user && <PresenceTracker userId={user.id}/>}
    <div className="container header-inner">
      <Brand/>
      <nav className="nav desktop-nav">
        <Link href="/auctions">Auctions</Link><Link href="/#categories">Categories</Link><Link href={actionHref}>{actionLabel}</Link><Link href="/dashboard">Dashboard</Link>
        {profile?.role === 'admin' && <Link href="/admin">Admin</Link>}
      </nav>
      <div className="header-actions">
        {user && profile?.role === 'buyer' && <BuyerNotificationBell userId={user.id}/>}
        <Link className="icon-link" href="/auctions" aria-label="Search"><Search size={18}/></Link>
        <Link className="icon-link heart-link" href={user ? '/watchlist' : '/login?next=%2Fwatchlist'} aria-label="Wishlist"><Heart size={18}/></Link>
        {user ? <><Link className="btn btn-quiet header-login" href="/account">My account</Link><form action={signOut}><button className="btn btn-primary header-login">Sign out</button></form></> : <Link className="btn btn-primary header-login" href="/login"><UserRound size={15}/> Sign in</Link>}
      </div>
      <MobileNavigation actionHref={actionHref} actionLabel={actionLabel}/>
    </div>
  </header>;
}

export function SiteFooter() {
  return <footer className="footer"><div className="container footer-inner"><div><Brand/><p>Great finds deserve a little competition.</p></div><div className="footer-links"><Link href="/auctions">Explore auctions</Link><Link href="/sell">Become a seller</Link><Link href="/account">Your account</Link></div><span className="muted footer-copy">© 2026 BIDORA</span></div></footer>;
}
