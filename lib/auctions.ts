import { auctions as demoAuctions, type Auction } from '@/data/auctions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getAuctions() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { items: demoAuctions, isDemo: true };
  const { data, error } = await supabase.from('auctions').select('id,slug,title,category,current_price,bid_count,ends_at,latest_bid_at,image_url,condition,seller_id,description').eq('status','live').gt('ends_at',new Date().toISOString()).order('ends_at');
  if (error) return { items: [], isDemo: false };
  const items: Auction[] = (data || []).map((row) => ({
    id: row.slug, dbId: row.id, title: row.title, category: row.category,
    price: Number(row.current_price), bids: row.bid_count,
    ends: remaining(closeAt(row.ends_at, row.latest_bid_at)), endsAt: closeAt(row.ends_at, row.latest_bid_at), image: row.image_url || 'photo-1523170335258-f5ed11844a49',
    condition: row.condition, seller: 'BIDORA seller', description: row.description,
  }));
  return { items, isDemo: false };
}

export async function getAuctionBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return demoAuctions.find((item) => item.id === slug) || null;
  const { data } = await supabase.from('auctions').select('id,slug,title,category,current_price,bid_count,ends_at,latest_bid_at,image_url,condition,seller_id,description,status,auction_round').eq('slug',slug).maybeSingle();
  if (!data) return null;
  let award: { id: string; bidder_id: string; amount: number; status: string } | null = null;
  let isWinner = false;
  let winnerName: string | undefined;
  if (data.status === 'ended') {
    const [{ data: auth }, { data: result }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('auction_awards').select('id,bidder_id,amount,status').eq('auction_id', data.id).eq('auction_round', data.auction_round).maybeSingle(),
    ]);
    award = result;
    isWinner = Boolean(auth.user && award && auth.user.id === award.bidder_id && award.status !== 'expired');
    if (isWinner) {
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', award!.bidder_id).maybeSingle();
      winnerName = profile?.display_name || auth.user?.email?.split('@')[0] || 'BIDORA member';
    }
  }
  const endsAt = closeAt(data.ends_at, data.latest_bid_at);
  return { id:data.slug, dbId:data.id, title:data.title, category:data.category, price:Number(data.current_price), bids:data.bid_count, ends:remaining(endsAt), endsAt, auctionEnded:data.status === 'ended', isWinner, awardId:isWinner ? award?.id : undefined, winningAmount:isWinner ? Number(award?.amount) : undefined, winnerName, image:data.image_url || 'photo-1523170335258-f5ed11844a49', condition:data.condition, seller:'BIDORA seller', description:data.description } satisfies Auction;
}

function closeAt(end: string, latestBid: string | null) {
  const scheduledEnd = new Date(end).getTime();
  const quietEnd = latestBid ? new Date(latestBid).getTime() + 5 * 60 * 1000 : scheduledEnd;
  return new Date(Math.min(scheduledEnd, quietEnd)).toISOString();
}

function remaining(end: string) {
  const ms = Math.max(0, new Date(end).getTime() - Date.now());
  const hours = Math.floor(ms / 3600000);
  return hours > 24 ? `${Math.floor(hours/24)}d ${hours%24}h` : `${String(hours).padStart(2,'0')}h ${String(Math.floor(ms/60000)%60).padStart(2,'0')}m`;
}
