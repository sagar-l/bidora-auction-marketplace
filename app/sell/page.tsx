import Link from 'next/link';
import { ImagePlus, Upload } from 'lucide-react';
import { createListing } from '@/app/actions';
import { SubmitListingButton } from '@/components/submit-listing-button';
import { getSupabaseAuthContext } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const errors: Record<string, string> = {
  backend: 'Supabase is not connected. Check the project settings first.',
  validation: 'Check the title, category, description and starting price.',
  image: 'Choose a JPG, PNG or WebP image under 5 MB.',
  upload: 'Image upload failed. Please try another image.',
  save: 'We could not save this listing. If you are using an admin account, run the new listing permission SQL migration, then try again.',
  role: 'Only seller accounts can submit listings. Sign in with a seller account to continue.',
};

export default async function Sell({ searchParams }: { searchParams: { error?: string; message?: string } }) {
  const { user } = await getSupabaseAuthContext();
  if (!user) redirect('/login?intent=sell&next=%2Fsell');

  const submitted = searchParams.message === 'submitted';

  return <section className="section page-section"><div className="container narrow">
    <div className="page-intro"><div className="eyebrow">SELL ON BIDORA</div><h1>Give a great find<br/>a new beginning.</h1><p className="muted">Create a listing for the community to discover.</p></div>
    {submitted && <div className="listing-submitted" role="status"><strong>Listing submitted — waiting for admin approval.</strong><span>Your item is in the review queue. It will appear in the marketplace after an administrator approves it.</span><Link href="/dashboard">View your dashboard →</Link></div>}
    {searchParams.error && <div className="listing-error" role="alert">{errors[searchParams.error] || 'Something went wrong. Please check the details and try again.'}</div>}
    <form action={createListing} className="surface sell-form">
      <label className="form-label">Listing title<input name="title" className="input" placeholder="What are you selling?" minLength={5} maxLength={120} required/></label>
      <div className="form-two"><label className="form-label">Category<select name="category" className="input" required><option value="">Choose a category</option>{['Watches','Electronics','Fashion','Collectibles','Home','Jewellery'].map(category=><option key={category}>{category}</option>)}</select></label><label className="form-label">Starting bid (₹ INR)<input name="startingPrice" className="input" type="number" min="1" step="1" placeholder="0" required/></label></div>
      <label className="form-label">Condition<input name="condition" className="input" maxLength={60} placeholder="e.g. Excellent · 2023"/></label>
      <label className="form-label">Description<textarea name="description" className="input textarea" placeholder="Share what makes this item special…" rows={4} minLength={20} maxLength={5000} required/></label>
      <label className="upload-zone"><ImagePlus/><strong>Add a cover photo</strong><span>JPG, PNG or WebP · max 5 MB</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label>
      <SubmitListingButton/>
      <div className="demo-note">Your listing stays private until an admin reviews and approves it.</div>
    </form>
  </div></section>;
}
