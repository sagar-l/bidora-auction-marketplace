import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = request.headers.get('x-razorpay-signature') || '';
  const eventId = request.headers.get('x-razorpay-event-id') || '';
  if (!secret || !eventId || !signature) return NextResponse.json({ error: 'Webhook is not configured or signed.' }, { status: 400 });
  const rawBody = await request.text();
  const expectedBuffer = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid event payload.' }, { status: 400 }); }
  if (payload?.event !== 'payment_link.paid') return NextResponse.json({ received: true });
  const eventLink = payload?.payload?.payment_link?.entity;
  const eventPayment = payload?.payload?.payment?.entity;
  if (!eventLink?.id || eventLink.status !== 'paid') return NextResponse.json({ error: 'Paid payment-link details are incomplete.' }, { status: 400 });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const admin = createSupabaseAdminClient();
  if (!keyId || !keySecret || !admin) return NextResponse.json({ error: 'Payment verification is not configured.' }, { status: 503 });
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(eventLink.id)}`, { headers: { Authorization: `Basic ${auth}` }, cache: 'no-store' });
  const link = await response.json().catch(() => null);
  if (!response.ok || link?.status !== 'paid' || Number(link?.amount_paid) !== Number(link?.amount) || link?.currency !== 'INR') return NextResponse.json({ error: 'Razorpay has not confirmed full payment for this link.' }, { status: 409 });
  const paymentId = String(eventPayment?.id || link.payment_id || link.payments?.[0]?.payment_id || link.payments?.[0]?.id || '');
  if (!paymentId || !Number.isFinite(Number(link.paid_at)) || Number(link.paid_at) <= 0) return NextResponse.json({ error: 'Razorpay payment details are not ready yet.' }, { status: 409 });
  const { error } = await admin.rpc('confirm_razorpay_payment', {
    p_payment_link_id: String(link.id), p_payment_id: paymentId, p_amount_paise: Number(link.amount_paid),
    p_currency: String(link.currency), p_event_id: eventId, p_paid_at: new Date(Number(link.paid_at) * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ error: 'Could not record this payment event.' }, { status: 500 });
  return NextResponse.json({ received: true });
}
