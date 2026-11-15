'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function DashboardRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase?.channel('bidora-auction-admin-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => router.refresh())
      .subscribe();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 60000);
    return () => {
      window.clearInterval(timer);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
