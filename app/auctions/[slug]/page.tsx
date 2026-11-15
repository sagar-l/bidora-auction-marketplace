import {notFound} from 'next/navigation';
import {getAuctionBySlug} from '@/lib/auctions';
import AuctionDetailClient from '@/components/auction-detail-client';

export default async function AuctionDetailPage({params,searchParams}:{params:{slug:string};searchParams:{error?:string;message?:string}}){const item=await getAuctionBySlug(params.slug);if(!item)notFound();return <AuctionDetailClient item={item} error={searchParams.error} message={searchParams.message}/>}
