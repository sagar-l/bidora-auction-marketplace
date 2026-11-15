import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: 'Backend unavailable.' }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const awardId = new URL(request.url).searchParams.get('awardId') || '';
  const { data, error } = await supabase.from('auction_awards').select('status').eq('id', awardId).eq('bidder_id', user.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Award not found.' }, { status: 404 });
  return NextResponse.json({ status: data.status });
}
