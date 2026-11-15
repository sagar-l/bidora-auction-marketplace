'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gavel } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type AuthFormProps = { register?: boolean; error?: string; message?: string; detail?: string; intent?: string; next?: string };

function destinationFor(role: string | undefined, intent: string | undefined, next: string | undefined) {
  const requestedPath = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  if (intent === 'sell' || requestedPath === '/sell') {
    return role === 'seller' || role === 'admin' ? '/sell' : '/dashboard';
  }
  return requestedPath;
}

function authLink(path: '/login' | '/register', intent?: string, next?: string) {
  const params = new URLSearchParams();
  if (intent) params.set('intent', intent);
  if (next) params.set('next', next);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function friendlyAuthError(message: string, code?: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('email rate limit') || code === 'over_email_send_rate_limit') {
    return 'Supabase has temporarily limited signup emails. Wait for the limit to reset, then try again.';
  }
  if (normalized.includes('email not confirmed') || code === 'email_not_confirmed') {
    return 'Confirm your email using the link Supabase sent, then sign in again.';
  }
  if (normalized.includes('already registered') || normalized.includes('already been registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Email or password was not accepted. Check both and try again.';
  }
  return message || 'We could not complete that request. Please try again.';
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('BIDORA_AUTH_TIMEOUT')), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export function AuthForm({ register = false, error, message, detail, intent, next }: AuthFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const initialError = error === 'recovery'
    ? 'That password reset link could not be verified. Request a fresh link and try again.'
    : error ? (detail ? friendlyAuthError(detail) : error) : '';
  const [formError, setFormError] = useState(initialError);
  const [notice, setNotice] = useState(message === 'verify'
    ? 'Account request received. Check your email for the confirmation link, then sign in.'
    : message === 'password-updated' ? 'Your password was updated. Sign in with your new password.' : '');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError('');
    setNotice('');

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const displayName = String(formData.get('displayName') || '').trim().slice(0, 80);
    const accountType = formData.get('accountType') === 'seller' ? 'seller' : 'buyer';
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setFormError('Supabase is not configured. Check the project URL and public key in .env.local, then restart the site.');
      setSubmitting(false);
      return;
    }

    try {
      if (register) {
        const { data, error: authError } = await withTimeout(
          supabase.auth.signUp({ email, password, options: { data: { display_name: displayName, account_type: accountType } } }),
          15000,
        );
        if (authError) {
          setFormError(friendlyAuthError(authError.message, authError.code));
          return;
        }
        if (data.session) {
          router.replace(destinationFor(accountType, intent, next));
          router.refresh();
          return;
        }
        setNotice('Account request received. Check your email for the confirmation link, then sign in.');
        const verificationPath = authLink('/login', intent, next);
        router.replace(`${verificationPath}${verificationPath.includes('?') ? '&' : '?'}message=verify`);
        router.refresh();
        return;
      }

      const { data, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        15000,
      );
      if (authError) {
        setFormError(friendlyAuthError(authError.message, authError.code));
        return;
      }
      const { data: profile } = data.user
        ? await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
        : { data: null };
      router.replace(destinationFor(profile?.role, intent, next));
      router.refresh();
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'BIDORA_AUTH_TIMEOUT') {
        setFormError('Supabase did not respond within 15 seconds. Check Supabase → Authentication → Users before retrying, in case the account was created.');
      } else {
        setFormError('Could not reach Supabase. Check your internet connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-wrap">
      <div className="auth-card surface">
        <div className="auth-emblem"><Gavel /></div>
        <div className="eyebrow">WELCOME TO BIDORA</div>
        <h1>{register ? 'Create your account' : 'Good to see you again'}</h1>
        <p className="muted">{intent === 'sell' ? 'Sign in or create an account to start selling. Choose buyer or seller when you sign up.' : intent === 'explore' ? 'Sign in or create an account to explore auctions and place bids.' : register ? 'Join the marketplace for extraordinary finds.' : 'Sign in to follow auctions and discover more.'}</p>
        {formError && <div className="demo-note" role="alert">{formError}</div>}
        {notice && <div className="demo-note" role="status">{notice}</div>}
        <form onSubmit={handleSubmit} className="form-stack">
          {register && <label className="form-label">Full name<input name="displayName" className="input" placeholder="Your name" autoComplete="name" required /></label>}
          {register && <fieldset className="account-type-fieldset"><legend>I want to join as</legend><div className="account-type-options"><label className="account-type-option"><input type="radio" name="accountType" value="buyer" defaultChecked={intent !== 'sell'}/><span><strong>Buyer</strong><small>Discover and bid on items</small></span></label><label className="account-type-option"><input type="radio" name="accountType" value="seller" defaultChecked={intent === 'sell'}/><span><strong>Seller</strong><small>List items for auction</small></span></label></div></fieldset>}
          <label className="form-label">Email address<input name="email" className="input" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
          <label className="form-label">Password<input name="password" className="input" type="password" placeholder="At least 8 characters" minLength={8} autoComplete={register ? 'new-password' : 'current-password'} required /></label>
          {!register && <div className="auth-forgot"><Link href="/forgot-password">Forgot password?</Link></div>}
          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting} aria-live="polite">
            {submitting ? (register ? 'Creating account…' : 'Signing in…') : (register ? 'Create account' : 'Sign in')}
          </button>
        </form>
        <div className="auth-switch">{register ? 'Already have an account?' : 'New to BIDORA?'} <Link href={authLink(register ? '/login' : '/register', intent, next)}>{register ? 'Sign in' : 'Create an account'}</Link></div>
      </div>
    </section>
  );
}
