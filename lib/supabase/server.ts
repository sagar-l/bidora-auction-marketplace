import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';

const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
};

const createServerClientForRequest = async () => {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createServerClient(url, key, {
    global: { fetch: fetchWithTimeout },
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set(name: string, value: string, options: Record<string, unknown>) {
        try { cookieStore.set({ name, value, ...(options as object) }); } catch {}
      },
      remove(name: string, options: Record<string, unknown>) {
        try { cookieStore.set({ name, value: '', ...(options as object) }); } catch {}
      },
    },
  });
};

// Reuse the cookie-bound client and auth lookup during a single server render.
export const createSupabaseServerClient = cache(createServerClientForRequest);

export const getSupabaseAuthContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null };

  const hasSessionCookie = cookies().getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));
  if (!hasSessionCookie) return { supabase, user: null };

  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});

export const getSupabaseProfile = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from('profiles').select('display_name,role').eq('id', userId).maybeSingle();
  return data;
});
