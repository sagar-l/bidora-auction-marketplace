import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Mail, UserRound } from 'lucide-react';
import { updateProfile } from '@/app/actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AccountPageProps = { searchParams: { message?: string; error?: string } };

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <section className="section page-section"><div className="container narrow"><div className="eyebrow">YOUR BIDORA</div><h1>My account</h1><p className="muted">Connect Supabase to view your profile.</p><Link className="btn btn-primary" href="/login">Sign in</Link></div></section>;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('display_name,role').eq('id', user.id).maybeSingle();
  const displayName = profile?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'BIDORA member';
  const role = profile?.role || 'buyer';
  const notice = searchParams.message === 'saved' ? 'Your profile name has been updated.' : '';
  const error = searchParams.error === 'name'
    ? 'Please enter a name with at least 2 characters.'
    : searchParams.error === 'save' ? 'We could not save your profile. Please try again.' : '';

  return (
    <section className="section page-section account-page">
      <div className="container narrow">
        <Link href="/dashboard" className="account-back"><ArrowLeft size={15}/> Back to dashboard</Link>
        <div className="account-heading"><div className="eyebrow">YOUR BIDORA PROFILE</div><h1>My account</h1><p className="muted">Manage the profile details connected to your BIDORA account.</p></div>
        <div className="surface profile-card">
          <div className="profile-avatar"><UserRound size={27}/></div>
          <div className="profile-identity"><strong>{displayName}</strong><span><BadgeCheck size={14}/> {role}</span></div>
          <div className="profile-divider"/>
          {error && <div className="demo-note" role="alert">{error}</div>}
          {notice && <div className="demo-note" role="status">{notice}</div>}
          <div className="profile-email"><Mail size={16}/><div><small>Email address</small><strong>{user.email}</strong></div></div>
          <form action={updateProfile} className="form-stack profile-form">
            <label className="form-label">Display name<input className="input" name="displayName" defaultValue={displayName} maxLength={80} minLength={2} required/></label>
            <p className="profile-help">Your email is managed by Supabase authentication and is read-only here.</p>
            <button className="btn btn-primary" type="submit">Save profile</button>
          </form>
        </div>
      </div>
    </section>
  );
}
