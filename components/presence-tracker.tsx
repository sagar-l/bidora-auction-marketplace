'use client';

import { useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function PresenceTracker({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let lastPing = 0;

    const ping = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastPing < 30000) return;
      lastPing = Date.now();
      void supabase.rpc('heartbeat_presence').then(({ error }) => {
        if (error) console.error('BIDORA presence heartbeat failed:', error.message);
      });
    };

    ping();
    const timer = window.setInterval(ping, 60000);
    document.addEventListener('visibilitychange', ping);
    window.addEventListener('focus', ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', ping);
      window.removeEventListener('focus', ping);
    };
  }, [userId]);

  return null;
}
