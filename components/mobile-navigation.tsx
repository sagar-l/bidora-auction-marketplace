'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

type MobileNavigationProps = { actionHref?: string; actionLabel?: string };

export function MobileNavigation({ actionHref = '/login?intent=sell&next=%2Fsell', actionLabel = 'Sell an item' }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  return <><button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X/> : <Menu/>}</button>{open && <nav className="mobile-nav"><Link onClick={() => setOpen(false)} href="/auctions">Auctions</Link><Link onClick={() => setOpen(false)} href="/#categories">Categories</Link><Link onClick={() => setOpen(false)} href="/watchlist">Wishlist</Link><Link onClick={() => setOpen(false)} href={actionHref}>{actionLabel}</Link><Link onClick={() => setOpen(false)} href="/dashboard">Dashboard</Link><Link onClick={() => setOpen(false)} href="/login">Sign in</Link></nav>}</>;
}
