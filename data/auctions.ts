export type Auction={id:string;dbId?:string;title:string;category:string;price:number;bids:number;ends:string;endsAt?:string;auctionEnded?:boolean;isWinner?:boolean;awardId?:string;winningAmount?:number;winnerName?:string;image:string;tag?:string;condition:string;seller:string;description:string};
export const auctions:Auction[]=[
{id:'heritage-watch',title:'Heritage Automatic Watch',category:'Watches',price:1840,bids:18,ends:'02h 14m',image:'photo-1523170335258-f5ed11844a49',tag:'FEATURED',condition:'Excellent · 2022',seller:'Northline Vintage',description:'A beautifully preserved automatic timepiece with a brushed steel case, clean dial and original presentation box. Recently serviced and ready for its next owner.'},
{id:'studio-headphones',title:'Studio Wireless Headphones',category:'Electronics',price:286,bids:12,ends:'04h 38m',image:'photo-1505740420928-5e560c06d30e',tag:'HOT BID',condition:'Like new',seller:'Sound Society',description:'Reference grade wireless listening with a warm, detailed sound signature. Includes case, charging cable and original packaging.'},
{id:'designer-tote',title:'Structured Leather Tote',category:'Fashion',price:420,bids:9,ends:'06h 02m',image:'photo-1548036328-c9fa89d128fa',condition:'Very good',seller:'Atelier Archive',description:'A refined everyday carryall in supple full grain leather. Carefully maintained with light patina and clean interior.'},
{id:'film-camera',title:'35mm Film Camera Set',category:'Collectibles',price:735,bids:21,ends:'01h 19m',image:'photo-1516035069371-29a1b244cc32',tag:'ENDING SOON',condition:'Tested · good',seller:'Silver Frame Co.',description:'Classic 35mm body paired with a sharp prime lens. Shutter speeds and meter have been checked; includes a protective strap.'},
{id:'minimal-chair',title:'Mid-century Lounge Chair',category:'Home',price:1120,bids:7,ends:'1d 03h',image:'photo-1503602642458-232111445657',condition:'Restored',seller:'Form & Found',description:'An elegant lounge chair with a sculpted wood frame and newly upholstered seat. Restored by a specialist workshop.'},
{id:'sneaker-01',title:'Limited Edition Runner',category:'Fashion',price:198,bids:14,ends:'08h 42m',image:'photo-1542291026-7eec264c27ff',condition:'Unworn · size 9',seller:'Lace Up Vault',description:'A sought-after colorway, unworn and complete with box and accessories. Authenticated by our marketplace team.'},
{id:'vinyl-player',title:'Belt-drive Record Player',category:'Electronics',price:510,bids:11,ends:'11h 26m',image:'photo-1461360228754-6e81c478b882',condition:'Excellent',seller:'Needle Drop',description:'A beautifully maintained belt-drive turntable with a low-noise motor and upgraded cartridge. Packed with care for shipping.'},
{id:'gold-ring',title:'Vintage Signet Ring',category:'Jewellery',price:960,bids:6,ends:'2d 01h',image:'photo-1605100804763-247f67b3557e',condition:'Vintage · 14k',seller:'Golden Hour',description:'A timeless vintage signet ring in solid 14k gold. Professionally cleaned and sized, with hallmark verified.'}
];
export const categories=[
  {name:'Watches',icon:'◷',count:'1.2k items',image:'/category-images/watches-classic.jpg'},
  {name:'Electronics',icon:'⌁',count:'840 items',image:'/category-images/electronics-samsung.jpg'},
  {name:'Fashion',icon:'◇',count:'2.1k items',image:'/category-images/fashion-menswear.jpg'},
  {name:'Collectibles',icon:'✳',count:'690 items',image:'/category-images/collectibles-figures.jpg'},
  {name:'Home',icon:'⌂',count:'520 items',image:'/category-images/home-decor.jpg'},
  {name:'Jewellery',icon:'✧',count:'430 items',image:'/category-images/jewellery-gold-set.jpg'}
];
