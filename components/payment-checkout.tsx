'use client';

import { useEffect, useState } from 'react';

function money(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

export function PaymentCheckout({ awardId, title, amount, deadline, returned = false }: { awardId: string; title: string; amount: number; deadline: string; returned?: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState('');
  const [checking, setChecking] = useState(returned);

  useEffect(() => {
    const update = () => {
      const milliseconds = Math.max(0, new Date(deadline).getTime() - Date.now());
      const hours = Math.floor(milliseconds / 3600000);
      const minutes = Math.floor((milliseconds % 3600000) / 60000);
      const seconds = Math.floor((milliseconds % 60000) / 1000);
      setRemaining(`${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (!returned) return;
    let active = true;
    let attempts = 0;
    setChecking(true);
    const poll = async () => {
      try {
        const response = await fetch(`/api/payments/status?awardId=${encodeURIComponent(awardId)}`, { cache: 'no-store' });
        const result = await response.json();
        if (active && ['paid', 'delivery_submitted'].includes(result.status)) {
          window.location.replace(`/payments/${awardId}`);
          return;
        }
      } catch {}
      attempts += 1;
      if (active && attempts < 100) window.setTimeout(poll, 3000);
      else if (active) setChecking(false);
    };
    void poll();
    return () => { active = false; };
  }, [awardId, returned]);

  async function startPayment() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/payments/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ awardId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not prepare payment.');
      if (!result.paymentUrl) throw new Error('Razorpay did not return a payment link.');
      window.location.assign(result.paymentUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start payment.');
      setBusy(false);
    }
  }

  return <>
    <div className="payment-summary surface"><span>Winning bid</span><strong>{money(amount)}</strong><span>Payment window remaining</span><strong>{remaining || '…'}</strong></div>
    <p className="payment-copy">Pay the winning amount within two hours to secure this item. The payment link expires at the deadline; if unpaid, BIDORA will restart the auction.</p>
    {returned && <p className="payment-pending" role="status">{checking ? 'Checking with Razorpay for the confirmed payment…' : 'Payment is not confirmed yet. If you completed it, keep this page open while Razorpay sends its confirmation.'}</p>}
    <button className="btn btn-primary payment-button" onClick={startPayment} disabled={busy || checking || remaining.startsWith('0h 00m 00s')}>{busy ? 'Opening Razorpay…' : `Continue to secure payment · ${money(amount)}`}</button>
    {error && <p className="payment-error" role="alert">{error}</p>}
    <p className="payment-footnote">BIDORA confirms payment only after its signed Razorpay notification and payment record match this award.</p>
  </>;
}
