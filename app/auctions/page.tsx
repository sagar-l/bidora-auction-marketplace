import AuctionCatalog from '@/components/auction-catalog';
import {getAuctions} from '@/lib/auctions';

export default async function AuctionsPage({searchParams}:{searchParams:{category?:string;error?:string;message?:string}}){const {items,isDemo}=await getAuctions();return <AuctionCatalog items={items} isDemo={isDemo} category={searchParams.category||'All'} error={searchParams.error} message={searchParams.message}/>}
