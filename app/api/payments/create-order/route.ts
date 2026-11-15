import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: 'Marketplace backend is unavailable.' }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in as the winning bidder to pay.' }, { status: 401 });
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return NextResponse.json({ error: 'Razorpay is not configured yet. Ask the BIDORA administrator to add the payment keys.' }, { status: 503 });

  let awardId = '';
  try { awardId = String((await request.json()).awardId || ''); } catch {}
  if (!awardId) return NextResponse.json({ error: 'Payment reservation not found.' }, { status: 400 });
  const { data: award } = await supabase.from('auction_awards')
    .select('id,listing_title,amount,currency,status,payment_deadline,razorpay_payment_link_id,razorpay_payment_url')
    .eq('id', awardId).eq('bidder_id', user.id).maybeSingle();
  if (!award) return NextResponse.json({ error: 'This payment reservation is not available to your account.' }, { status: 404 });
  if (award.status !== 'awaiting_payment' || new Date(award.payment_deadline).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'The two-hour payment window has ended.' }, { status: 410 });
  }
  if (award.razorpay_payment_link_id && award.razorpay_payment_url) return NextResponse.json({ paymentUrl: award.razorpay_payment_url });

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const origin = new URL(request.url).origin;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, '');
  const deadline = Math.floor(new Date(award.payment_deadline).getTime() / 1000);
  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(Number(award.amount) * 100), currency: 'INR', accept_partial: false, expire_by: deadline,
      reference_id: award.id, description: `BIDORA winning bid: ${award.listing_title}`.slice(0, 200),
      customer: { name: String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'BIDORA buyer').slice(0, 50), email: user.email },
      notify: { email: true, sms: false }, reminder_enable: false,
      callback_url: `${siteUrl}/payments/${award.id}?payment=return`, callback_method: 'get',
      notes: { bidora_award_id: award.id },
    }), cache: 'no-store',
  });
  const link = await response.json().catch(() => null);
  if (!response.ok || !link?.id || !link?.short_url) return NextResponse.json({ error: 'Razorpay could not create the expiring payment link. Try again shortly.' }, { status: 502 });
  const { error } = await supabase.rpc('set_razorpay_payment_link', { p_award_id: award.id, p_link_id: link.id, p_payment_url: link.short_url });
  if (error) return NextResponse.json({ error: 'The payment link could not be attached to this reservation. Refresh and try again.' }, { status: 409 });
  return NextResponse.json({ paymentUrl: link.short_url });
}
