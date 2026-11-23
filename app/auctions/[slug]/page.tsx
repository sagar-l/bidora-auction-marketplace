import {notFound, redirect} from 'next/navigation';
import {getAuctionBySlug} from '@/lib/auctions';
import AuctionDetailClient from '@/components/auction-detail-client';
import {getSupabaseAuthContext} from '@/lib/supabase/server';

export default async function AuctionDetailPage({params,searchParams}:{params:{slug:string};searchParams:{error?:string;message?:string}}){
  const { supabase, user } = await getSupabaseAuthContext();
  if (supabase) {
    if (!user) redirect(`/login?intent=explore&next=${encodeURIComponent(`/auctions/${params.slug}`)}`);
  }
  const item=await getAuctionBySlug(params.slug);
  if(!item)notFound();
  return <AuctionDetailClient item={item} error={searchParams.error} message={searchParams.message}/>;
}
