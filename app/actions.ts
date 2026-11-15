'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function configured(client: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  if (!client) redirect('/login?error=backend');
  return client;
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SUPABASE_REQUEST_TIMEOUT')), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function signIn(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  let error: { code?: string; message: string } | null = null;
  try {
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch {
    redirect('/login?error=connection');
  }
  if (error) {
    const message = error.message.toLowerCase();
    if (error.code === 'email_not_confirmed' || message.includes('email not confirmed')) redirect('/login?error=unconfirmed');
    if (message.includes('rate limit')) redirect('/login?error=rate');
    redirect('/login?error=credentials');
  }
  redirect('/dashboard');
}

export async function signUp(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const displayName = String(formData.get('displayName') || '').trim().slice(0, 80);
  if (password.length < 8) redirect('/register?error=password');
  let result: Awaited<ReturnType<typeof supabase.auth.signUp>>;
  try {
    const accountType = formData.get('accountType') === 'seller' ? 'seller' : 'buyer';
    result = await withTimeout(supabase.auth.signUp({ email, password, options: { data: { display_name: displayName, account_type: accountType } } }), 12000);
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'SUPABASE_REQUEST_TIMEOUT') redirect('/register?error=timeout');
    redirect('/register?error=connection');
  }
  const { error } = result;
  if (error) redirect(`/register?error=signup&detail=${encodeURIComponent(error.message.slice(0,180))}`);
  redirect('/login?message=verify');
}

export async function signOut() {
  const supabase = configured(await createSupabaseServerClient());
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function updateProfile(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const displayName = String(formData.get('displayName') || '').trim().slice(0, 80);
  if (displayName.length < 2) redirect('/account?error=name');
  const { error } = await supabase.from('profiles').update({ display_name: displayName, updated_at: new Date().toISOString() }).eq('id', user.id);
  if (error) redirect('/account?error=save');
  revalidatePath('/account');
  revalidatePath('/dashboard');
  redirect('/account?message=saved');
}

export async function placeBid(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const auctionId = String(formData.get('auctionId') || '');
  const amount = Number(formData.get('amount'));
  const slug = String(formData.get('slug') || '');
  if (!auctionId || !Number.isFinite(amount) || amount <= 0) redirect(`/auctions/${slug}?error=bid`);
  const { error } = await supabase.rpc('place_bid', { p_auction_id: auctionId, p_amount: amount });
  if (error) redirect(`/auctions/${slug}?error=${encodeURIComponent(error.message.slice(0, 140))}`);
  revalidatePath(`/auctions`);
  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath('/dashboard');
  redirect(`/auctions/${slug}?message=bid-placed`);
}

export async function toggleWatchlist(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?message=signin-to-save');
  const auctionId = String(formData.get('auctionId') || '');
  const slug = String(formData.get('slug') || '');
  const { data: saved } = await supabase.from('watchlist').select('auction_id').eq('user_id',user.id).eq('auction_id',auctionId).maybeSingle();
  if (saved) await supabase.from('watchlist').delete().eq('user_id',user.id).eq('auction_id',auctionId);
  else await supabase.from('watchlist').insert({user_id:user.id,auction_id:auctionId});
  revalidatePath('/dashboard');
  revalidatePath(`/auctions/${slug}`);
  redirect(`/auctions/${slug}?message=${saved?'watch-removed':'watch-added'}`);
}

export async function moderateListing(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/dashboard');
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  if (!['live','rejected'].includes(status)) redirect('/admin');
  let changed: { id: string; slug: string } | null = null;
  let error: { message: string } | null = null;
  if (status === 'live') {
    const startingPrice = Number(formData.get('startingPrice'));
    if (!Number.isFinite(startingPrice) || startingPrice < 1) redirect('/admin?error=moderate');
    const approvedAt = new Date();
    const result = await supabase.from('auctions').update({ status: 'live', starting_price: startingPrice, current_price: startingPrice, starts_at: approvedAt.toISOString(), ends_at: new Date(approvedAt.getTime() + 5 * 60 * 1000).toISOString(), auction_round: 1, latest_bid_at: null, bid_count: 0, currency: 'INR' }).eq('id', id).eq('status', 'pending').select('id,slug').maybeSingle();
    changed = result.data;
    error = result.error;
  } else {
    const result = await supabase.from('auctions').update({ status: 'rejected' }).eq('id', id).eq('status', 'pending').select('id,slug').maybeSingle();
    changed = result.data;
    error = result.error;
  }
  if (error || !changed) redirect('/admin?error=moderate');
  revalidatePath('/admin');
  revalidatePath('/auctions');
  revalidatePath('/auctions/[slug]', 'page');
  if (changed.slug) revalidatePath(`/auctions/${changed.slug}`);
  revalidatePath('/dashboard');
  redirect('/admin?message=moderated');
}

export async function deleteAdminListing(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/dashboard');
  const id = String(formData.get('id') || '');
  if (!id) redirect('/admin?error=delete');
  // Keep auction_awards and payment history intact; move the listing out of public live results.
  const { data: removed, error } = await supabase.from('auctions').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id).in('status', ['live', 'ended']).select('id').maybeSingle();
  if (error || !removed) redirect('/admin?error=delete');
  revalidatePath('/admin');
  revalidatePath('/auctions');
  revalidatePath('/dashboard');
  redirect('/admin?message=removed');
}

export async function submitAwardDelivery(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const awardId = String(formData.get('awardId') || '');
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const address = String(formData.get('address') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  if (!awardId || name.length < 2 || phone.length < 6 || address.length < 8) redirect(`/payments/${awardId}?error=delivery`);
  const { error } = await supabase.rpc('submit_award_delivery', { p_award_id: awardId, p_name: name, p_phone: phone, p_address: address, p_notes: notes });
  if (error) redirect(`/payments/${awardId}?error=delivery`);
  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath(`/payments/${awardId}`);
  redirect(`/payments/${awardId}?message=delivery`);
}

export async function createListing(formData: FormData) {
  const supabase = configured(await createSupabaseServerClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?message=signin-to-sell');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'seller' && profile?.role !== 'admin') redirect('/sell?error=role');
  const title = String(formData.get('title') || '').trim();
  const category = String(formData.get('category') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const startingPrice = Number(formData.get('startingPrice'));
  const condition = String(formData.get('condition') || 'Good').trim();
  if (title.length < 5 || !category || description.length < 20 || !Number.isFinite(startingPrice) || startingPrice < 1) redirect('/sell?error=validation');
  const image = formData.get('image');
  let imageUrl: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024 || !['image/jpeg','image/png','image/webp'].includes(image.type)) redirect('/sell?error=image');
    const ext = image.type === 'image/jpeg' ? 'jpg' : image.type.split('/')[1];
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, image, { contentType: image.type, upsert: false });
    if (uploadError) redirect('/sell?error=upload');
    imageUrl = supabase.storage.from('listing-images').getPublicUrl(path).data.publicUrl;
  }
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)}-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await supabase.from('auctions').insert({ seller_id: user.id, title, slug, category, description, condition, image_url: imageUrl, starting_price: startingPrice, current_price: startingPrice, status: 'pending', ends_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
  if (error) redirect('/sell?error=save');
  revalidatePath('/sell');
  revalidatePath('/dashboard');
  revalidatePath('/admin');
  redirect('/sell?message=submitted');
}
