'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type BuyerNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

function timeLabel(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function BuyerNotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<BuyerNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    void supabase.from('buyer_notifications')
      .select('id,title,message,href,created_at,read_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => { if (active) setItems((data || []) as BuyerNotification[]); });

    const channel = supabase.channel(`buyer-notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buyer_notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const incoming = payload.new as BuyerNotification;
        setItems((current) => [incoming, ...current.filter((entry) => entry.id !== incoming.id)].slice(0, 12));
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const unread = items.filter((item) => !item.read_at).length;

  async function markRead(item: BuyerNotification) {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.from('buyer_notifications').update({ read_at: readAt }).eq('id', item.id).eq('user_id', userId);
  }

  return <div className="buyer-notification-wrap">
    <button type="button" className="icon-link buyer-notification-button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell size={18}/>{unread > 0 && <span className="buyer-notification-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section className="buyer-notification-panel" aria-label="Your notifications">
      <div className="buyer-notification-heading"><div><span className="eyebrow">FOR YOU</span><h2>Notifications</h2></div><span>{unread ? `${unread} new` : 'Up to date'}</span></div>
      {items.length ? <div className="buyer-notification-list">{items.map((item) => <Link key={item.id} href={item.href} className={`buyer-notification-item${item.read_at ? '' : ' unread'}`} onClick={() => { void markRead(item); setOpen(false); }}>
        <span className="buyer-notification-dot"/>
        <span className="buyer-notification-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{timeLabel(item.created_at)}</small></span>
      </Link>)}</div> : <div className="buyer-notification-empty"><CheckCheck size={20}/><span>When an auction goes live in a category you follow, you’ll see it here.</span></div>}
    </section>}
  </div>;
}
