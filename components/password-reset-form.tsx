'use client';

import { FormEvent, ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gavel } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

function waitFor<T>(request: Promise<T>, timeoutMs = 15000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs);
    request.then(
      (result) => { clearTimeout(timer); resolve(result); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function ResetCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="auth-wrap">
      <div className="auth-card surface">
        <div className="auth-emblem"><Gavel /></div>
        <div className="eyebrow">BIDORA ACCOUNT</div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not configured. Check the project URL and public key in .env.local.');
      setLoading(false);
      return;
    }
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/update-password`;
      const { error: resetError } = await waitFor(supabase.auth.resetPasswordForEmail(email, { redirectTo }));
      if (resetError) setError(resetError.message);
      else setSent(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'REQUEST_TIMEOUT'
        ? 'Supabase took too long to respond. Wait a moment and try again.'
        : 'Could not reach Supabase. Check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResetCard title="Reset your password" subtitle="We’ll email you a secure link to choose a new password.">
      {error && <div className="demo-note" role="alert">{error}</div>}
      {sent ? (
        <div className="form-stack">
          <div className="demo-note" role="status">If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.</div>
          <Link className="btn btn-primary auth-submit" href="/login">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="form-stack">
          <label className="form-label">Email address<input name="email" className="input" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>{loading ? 'Sending link…' : 'Send reset link'}</button>
        </form>
      )}
      {!sent && <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>}
    </ResetCard>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password') || '');
    const confirmation = String(values.get('confirmation') || '');
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      setLoading(false);
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      setLoading(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not configured. Check the project URL and public key in .env.local.');
      setLoading(false);
      return;
    }
    try {
      const { error: updateError } = await waitFor(supabase.auth.updateUser({ password }));
      if (updateError) {
        setError(updateError.message.toLowerCase().includes('session')
          ? 'This reset link may have expired or already been used. Request a new one.'
          : updateError.message);
        return;
      }
      await supabase.auth.signOut();
      router.replace('/login?message=password-updated');
      router.refresh();
    } catch {
      setError('Could not update the password. Request a fresh reset link and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResetCard title="Choose a new password" subtitle="Use at least 8 characters, then sign in with your new password.">
      {error && <div className="demo-note" role="alert">{error}</div>}
      <form onSubmit={submit} className="form-stack">
        <label className="form-label">New password<input name="password" className="input" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label className="form-label">Confirm new password<input name="confirmation" className="input" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>{loading ? 'Updating password…' : 'Update password'}</button>
      </form>
    </ResetCard>
  );
}
