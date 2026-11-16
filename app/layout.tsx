import type { Metadata } from 'next';
import './globals.css';
import './theme.css';
import './bidi-chat.css';
import './home-feature-carousel.css';
import './category-photo-grid.css';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { BidiChat } from '@/components/bidi-chat';
export const metadata: Metadata = { title: 'BIDORA — Discover. Bid. Win.', description: 'A premium multi-category auction marketplace.', icons: { icon: '/bidora-symbol.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><div className="site-shell"><SiteHeader/>{!isSupabaseConfigured&&<div className="backend-banner">Demo preview · Connect Supabase to enable accounts, listings and live bidding.</div>}<main>{children}</main><SiteFooter/></div><BidiChat/></body></html>; }
