import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Award = {
  id: string;
  listing_title: string;
  amount: number;
  currency: 'INR';
  payment_deadline: string;
  bidder_id: string;
  bidder_name: string;
  bidder_email: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'POST required.' }, 405);

  const agentSecret = Deno.env.get('BIDORA_AGENT_SECRET');
  const suppliedSecret = request.headers.get('x-bidora-agent-secret');
  if (!agentSecret || !suppliedSecret || suppliedSecret !== agentSecret) {
    return json({ error: 'Not authorized.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  const siteUrl = Deno.env.get('BIDORA_SITE_URL')?.replace(/\/$/, '');
  if (!supabaseUrl || !serviceRoleKey || !razorpayKeyId || !razorpayKeySecret) {
    return json({ error: 'Auction agent secrets are incomplete.' }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The database cron closes auctions. This worker issues an expiring payment link
  // as soon as the award is created, and Razorpay emails the winner automatically.
  const { data, error: claimError } = await supabase.rpc('claim_auction_awards_for_agent', { p_limit: 20 });
  if (claimError) return json({ error: 'Could not claim payment notices.' }, 500);

  const awards = (data || []) as Award[];
  const results: Array<{ awardId: string; result: string }> = [];
  const credentials = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

  for (const award of awards) {
    try {
      const deadline = Math.floor(new Date(award.payment_deadline).getTime() / 1000);
      if (!award.bidder_email || deadline <= Math.floor(Date.now() / 1000)) {
        await releaseClaim(supabase, award.id);
        results.push({ awardId: award.id, result: 'skipped-invalid-recipient-or-deadline' });
        continue;
      }

      const linkPayload: Record<string, unknown> = {
        amount: Math.round(Number(award.amount) * 100),
        currency: award.currency,
        accept_partial: false,
        expire_by: deadline,
        reference_id: award.id,
        description: `BIDORA winning bid: ${award.listing_title}`.slice(0, 200),
        customer: { name: award.bidder_name.slice(0, 50), email: award.bidder_email },
        notify: { email: true, sms: false },
        reminder_enable: false,
        notes: { bidora_award_id: award.id },
      };
      if (siteUrl) {
        linkPayload.callback_url = `${siteUrl}/payments/${award.id}?payment=return`;
        linkPayload.callback_method = 'get';
      }

      const paymentResponse = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/json' },
        body: JSON.stringify(linkPayload),
      });
      const paymentLink = await paymentResponse.json().catch(() => null);
      if (!paymentResponse.ok || !paymentLink?.id || !paymentLink?.short_url) {
        await releaseClaim(supabase, award.id);
        results.push({ awardId: award.id, result: 'razorpay-link-failed-retry-scheduled' });
        continue;
      }

      const { data: saved, error: saveError } = await supabase
        .from('auction_awards')
        .update({
          razorpay_payment_link_id: paymentLink.id,
          razorpay_payment_url: paymentLink.short_url,
          payment_link_claimed_at: null,
        })
        .eq('id', award.id)
        .eq('status', 'awaiting_payment')
        .is('razorpay_payment_link_id', null)
        .select('id')
        .maybeSingle();

      if (saveError || !saved) {
        results.push({ awardId: award.id, result: 'link-created-but-award-changed' });
        continue;
      }
      results.push({ awardId: award.id, result: 'payment-link-created-and-emailed' });
    } catch {
      await releaseClaim(supabase, award.id);
      results.push({ awardId: award.id, result: 'temporary-error-retry-scheduled' });
    }
  }

  return json({ processed: results.length, results });
});

async function releaseClaim(supabase: SupabaseClient, awardId: string) {
  await supabase.from('auction_awards')
    .update({ payment_link_claimed_at: null })
    .eq('id', awardId)
    .eq('status', 'awaiting_payment')
    .is('razorpay_payment_link_id', null);
}
