import { redirect } from 'next/navigation';
import AuctionCatalog from '@/components/auction-catalog';
import {getAuctions} from '@/lib/auctions';
import { getSupabaseAuthContext } from '@/lib/supabase/server';

export default async function AuctionsPage({searchParams}:{searchParams:{category?:string;error?:string;message?:string}}){
  const { supabase, user } = await getSupabaseAuthContext();
  if (supabase) {
    if (!user) {
      const destination = searchParams.category
        ? `/auctions?category=${encodeURIComponent(searchParams.category)}`
        : '/auctions';
      redirect(`/login?intent=explore&next=${encodeURIComponent(destination)}`);
    }
  }
  const {items,isDemo}=await getAuctions();
  return <AuctionCatalog items={items} isDemo={isDemo} category={searchParams.category||'All'} error={searchParams.error} message={searchParams.message}/>;
}
