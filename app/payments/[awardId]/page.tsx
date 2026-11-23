import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { CheckCircle2, Clock3, PackageCheck } from 'lucide-react';
import { getSupabaseAuthContext } from '@/lib/supabase/server';
import { PaymentCheckout } from '@/components/payment-checkout';
import { submitAwardDelivery } from '@/app/actions';

const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export default async function AwardPaymentPage({ params, searchParams }: { params: { awardId: string }; searchParams: { message?: string; error?: string; payment?: string } }) {
  const { supabase, user } = await getSupabaseAuthContext();
  if (!supabase) return <section className="section page-section"><div className="container narrow"><h1>Payment setup required</h1><p className="muted">Connect the BIDORA backend to view this award.</p></div></section>;
  if (!user) redirect('/login');
  const { data: award } = await supabase.from('auction_awards').select('id,listing_title,amount,currency,status,payment_deadline,created_at,delivery_name,delivery_phone,delivery_address,delivery_notes,paid_at').eq('id', params.awardId).maybeSingle();
  if (!award) notFound();

  const error = searchParams.error === 'delivery' ? 'Please enter a valid name, phone number, and full delivery address.' : '';
  return <section className="section page-section"><div className="container narrow award-page">
    <Link className="back-link" href="/dashboard">← Your dashboard</Link>
    <div className="eyebrow">BIDORA AUCTION RESULT</div>
    <h1>{award.status === 'awaiting_payment' ? 'You won the auction.' : award.status === 'expired' ? 'Payment window ended' : 'Payment confirmed'}</h1>
    <p className="muted">{award.listing_title}</p>
    {award.status === 'awaiting_payment' && <div className="surface award-card"><div className="award-icon"><Clock3/></div><h2>Complete payment to secure your item</h2><PaymentCheckout awardId={award.id} title={award.listing_title} amount={Number(award.amount)} deadline={award.payment_deadline} returned={searchParams.payment === 'return'}/></div>}
    {award.status === 'paid' && <div className="surface award-card"><div className="award-icon success"><CheckCircle2/></div><h2>Payment received and verified</h2><p className="muted">BIDORA confirmed {formatMoney(Number(award.amount))}. Add your delivery details so the seller can arrange shipment.</p>
      {searchParams.message === 'delivery' && <div className="listing-submitted" role="status"><strong>Delivery details submitted.</strong><span>The BIDORA admin has been notified.</span></div>}
      {error && <div className="listing-error" role="alert">{error}</div>}
      <form action={submitAwardDelivery} className="delivery-form"><input type="hidden" name="awardId" value={award.id}/><label className="form-label">Recipient name<input className="input" name="name" minLength={2} required/></label><label className="form-label">Phone number<input className="input" name="phone" type="tel" minLength={6} required/></label><label className="form-label">Delivery address<textarea className="input textarea" name="address" rows={3} minLength={8} required/></label><label className="form-label">Delivery notes (optional)<textarea className="input textarea" name="notes" rows={2} maxLength={1000}/></label><button className="btn btn-primary payment-button">Submit delivery details</button></form>
    </div>}
    {award.status === 'delivery_submitted' && <div className="surface award-card"><div className="award-icon success"><PackageCheck/></div><h2>Delivery details received</h2><p className="muted">Your payment is confirmed. BIDORA will coordinate the next delivery step with the seller.</p><div className="delivery-summary"><strong>{award.delivery_name}</strong><span>{award.delivery_phone}</span><span>{award.delivery_address}</span>{award.delivery_notes && <span>{award.delivery_notes}</span>}</div></div>}
    {award.status === 'expired' && <div className="demo-note">The two-hour payment period ended. The auction has been scheduled to restart; you can return to the marketplace to follow the new round.</div>}
  </div></section>;
}
