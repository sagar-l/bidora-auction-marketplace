'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function AuctionDeadlineSettler({ auctionId, endsAt, ended }: { auctionId?: string; endsAt?: string; ended: boolean }) {
  const router = useRouter();

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
      void supabase.rpc('finalize_auction_if_due', { p_auction_id: auctionId }).then(({ error }) => {
        inFlight = false;
        if (!active) return;
        if (error && ++attempts < 3) {
          timer = window.setTimeout(checkDeadline, 1200);
          return;
        }
        router.refresh();
      }).catch(() => {
        inFlight = false;
        if (active && ++attempts < 3) timer = window.setTimeout(checkDeadline, 1200);
        else if (active) router.refresh();
      });
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

  return null;
}
