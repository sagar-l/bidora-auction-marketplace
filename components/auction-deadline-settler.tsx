'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function AuctionDeadlineSettler({ auctionId, endsAt, ended }: { auctionId?: string; endsAt?: string; ended: boolean }) {
  const router = useRouter();
  const [finalizingFor, setFinalizingFor] = useState('');

  useEffect(() => {
    if (!auctionId || !endsAt || ended) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const endTime = new Date(endsAt).getTime();
    let active = true;
    let inFlight = false;
    let attempts = 0;
    let timer: number | undefined;

    const checkDeadline = () => {
      if (!active) return;
      const remaining = endTime - Date.now();
      if (remaining > 0 || document.visibilityState !== 'visible') {
        timer = window.setTimeout(checkDeadline, Math.min(Math.max(remaining, 250), 1000));
        return;
      }
      if (inFlight) return;
      inFlight = true;
      setFinalizingFor(endsAt);
      void (async () => {
        let failed = false;
        try {
          const { error } = await supabase.rpc('finalize_auction_if_due', { p_auction_id: auctionId });
          failed = Boolean(error);
        } catch {
          failed = true;
        }
        inFlight = false;
        if (!active) return;
        if (failed && ++attempts < 3) {
          timer = window.setTimeout(checkDeadline, 1200);
          return;
        }
        router.refresh();
      })();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (timer !== undefined) window.clearTimeout(timer);
        checkDeadline();
      }
    };

    checkDeadline();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [auctionId, endsAt, ended, router]);

  if (!endsAt || finalizingFor !== endsAt || ended) return null;
  return <div className="auction-finalizing-overlay" role="status" aria-live="polite" aria-busy="true">
    <div className="auction-finalizing-card">
      <span className="auction-finalizing-spinner" aria-hidden="true" />
      <span><strong>Auction time is up.</strong> Confirming the winning bid and preparing the payment step…</span>
    </div>
  </div>;
}
