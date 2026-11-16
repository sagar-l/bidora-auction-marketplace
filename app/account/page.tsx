import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Mail, ShoppingBag, Tag, UserRound } from 'lucide-react';
import { updateProfile } from '@/app/actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AccountPageProps = { searchParams: { message?: string; error?: string } };
type Award = {
  id: string;
  auction_id: string;
  listing_title: string;
  seller_id: string;
  bidder_id: string;
  amount: number | string;
  currency: string;
  status: 'awaiting_payment' | 'paid' | 'delivery_submitted' | 'expired';
  created_at: string;
};
type PublicProfile = { id: string; display_name: string };

const completedStatuses = new Set(['paid', 'delivery_submitted']);

function money(value: number | string, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function statusLabel(status: Award['status']) {
  return ({
    awaiting_payment: 'Won · payment due',
    paid: 'Paid',
    delivery_submitted: 'Delivery details sent',
    expired: 'Payment window expired',
  })[status];
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <section className="section page-section"><div className="container narrow"><div className="eyebrow">YOUR BIDORA</div><h1>My account</h1><p className="muted">Connect Supabase to view your profile.</p><Link className="btn btn-primary" href="/login">Sign in</Link></div></section>;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('display_name,role').eq('id', user.id).maybeSingle();
  const displayName = profile?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'BIDORA member';
  const role = profile?.role || 'buyer';
  const isSeller = role === 'seller';
  const roleLabel = isSeller ? 'Seller' : 'Buyer';
  const roleSummary = isSeller ? 'Your sales and auction awards' : 'Your wins and purchase history';
  const { data: awards } = await supabase
    .from('auction_awards')
    .select('id,auction_id,listing_title,seller_id,bidder_id,amount,currency,status,created_at')
    .eq(isSeller ? 'seller_id' : 'bidder_id', user.id)
    .order('created_at', { ascending: false });
  const history = (awards || []) as Award[];
  const counterpartIds = [...new Set(history.map((award) => isSeller ? award.bidder_id : award.seller_id))];
  const { data: counterparts } = counterpartIds.length
    ? await supabase.from('profiles').select('id,display_name').in('id', counterpartIds)
    : { data: [] as PublicProfile[] };
  const names = new Map((counterparts || []).map((member: PublicProfile) => [member.id, member.display_name] as const));
  const completed = history.filter((award) => completedStatuses.has(award.status));
  const completedTotal = completed.reduce((sum, award) => sum + Number(award.amount || 0), 0);
  const awaiting = history.filter((award) => award.status === 'awaiting_payment').length;
  const notice = searchParams.message === 'saved' ? 'Your profile name has been updated.' : '';
  const error = searchParams.error === 'name'
    ? 'Please enter a name with at least 2 characters.'
    : searchParams.error === 'save' ? 'We could not save your profile. Please try again.' : '';

  return (
    <section className="section page-section account-page">
      <div className="container narrow">
        <Link href="/dashboard" className="account-back"><ArrowLeft size={15}/> Back to dashboard</Link>
        <div className="account-heading"><div className="eyebrow">YOUR BIDORA PROFILE</div><h1>My account</h1><p className="muted">Manage your profile and review your BIDORA {isSeller ? 'sales' : 'purchases'}.</p></div>
        <div className="surface profile-card">
          <div className="profile-avatar"><UserRound size={27}/></div>
          <div className="profile-identity"><strong>{displayName}</strong><span><BadgeCheck size={14}/> {roleLabel}</span></div>
          <div className="profile-divider"/>
          {error && <div className="demo-note" role="alert">{error}</div>}
          {notice && <div className="demo-note" role="status">{notice}</div>}
          <div className="profile-email"><Mail size={16}/><div><small>Email address</small><strong>{user.email}</strong></div></div>
          <form action={updateProfile} className="form-stack profile-form">
            <label className="form-label">Display name<input className="input" name="displayName" defaultValue={displayName} maxLength={80} minLength={2} required/></label>
            <p className="profile-help">Your email is managed by Supabase authentication and is read-only here.</p>
            <button className="btn btn-primary" type="submit">Save profile</button>
          </form>
        </div>

        <section className="profile-history" aria-labelledby="history-heading">
          <div className="profile-history-heading"><div><div className="eyebrow">{isSeller ? 'SELLER ACTIVITY' : 'BUYER ACTIVITY'}</div><h2 id="history-heading">{roleSummary}</h2></div></div>
          <div className="profile-stats">
            <article className="surface profile-stat"><small>{isSeller ? 'Completed sales' : 'Items purchased'}</small><strong>{completed.length}</strong><span>{isSeller ? 'Paid awards' : 'Paid wins'}</span></article>
            <article className="surface profile-stat"><small>{isSeller ? 'Completed sales total' : 'Total spent'}</small><strong>{money(completedTotal)}</strong><span>Paid and confirmed</span></article>
            <article className="surface profile-stat"><small>{isSeller ? 'Awaiting buyer payment' : 'Won · payment due'}</small><strong>{awaiting}</strong><span>Payment still pending</span></article>
          </div>
          <div className="surface profile-history-list">
            {!history.length ? (
              <div className="profile-history-empty"><div className="profile-empty-icon">{isSeller ? <Tag size={19}/> : <ShoppingBag size={19}/>}</div><strong>No {isSeller ? 'sales' : 'purchases'} yet</strong><p>{isSeller ? 'When a buyer wins one of your auctions, the item and final bid will appear here.' : 'When you win an auction, the item and winning price will appear here.'}</p><Link className="btn btn-secondary" href={isSeller ? '/sell' : '/auctions'}>{isSeller ? 'List an item' : 'Explore auctions'}</Link></div>
            ) : (
              <div className="profile-history-rows">
                {history.map((award) => {
                  const counterpartId = isSeller ? award.bidder_id : award.seller_id;
                  const counterpartName = names.get(counterpartId) || (isSeller ? 'BIDORA buyer' : 'BIDORA seller');
                  return (
                    <article className="profile-history-row" key={award.id}>
                      <div className="profile-history-item-icon">{isSeller ? <Tag size={18}/> : <ShoppingBag size={18}/>}</div>
                      <div className="profile-history-item-main"><strong>{award.listing_title}</strong><span>{isSeller ? 'Buyer' : 'Seller'}: {counterpartName}</span><small>{new Date(award.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</small></div>
                      <div className="profile-history-price"><strong>{money(award.amount, award.currency)}</strong><span className={`award-status award-status-${award.status}`}>{statusLabel(award.status)}</span></div>
                      {!isSeller && award.status !== 'expired' && <Link className="profile-award-link" href={`/payments/${award.id}`} aria-label={`View payment and delivery for ${award.listing_title}`}>View</Link>}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

