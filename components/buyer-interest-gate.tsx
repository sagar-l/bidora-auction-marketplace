'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { categories } from '@/data/auctions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function BuyerInterestGate() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const checkBuyer = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setOpen(false);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role,buyer_interests,buyer_interests_prompted_at')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role === 'buyer' && !profile.buyer_interests_prompted_at) {
      setSelected(profile.buyer_interests || []);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void checkBuyer();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setOpen(false);
        return;
      }
      window.setTimeout(() => { void checkBuyer(); }, 0);
    });
    return () => subscription.unsubscribe();
  }, [checkBuyer]);

  function toggle(category: string) {
    setSelected((current) => current.includes(category)
      ? current.filter((entry) => entry !== category)
      : [...current, category]);
  }

  async function saveInterests(values: string[]) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || saving) return;
    setSaving(true);
    setError('');
    try {
      const { error: saveError } = await supabase.rpc('save_buyer_interests', { p_categories: values });
      if (saveError) throw saveError;
      setOpen(false);
    } catch {
      setError('We could not save your choices. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return <div className="interest-modal-backdrop">
    <section className="interest-modal" role="dialog" aria-modal="true" aria-labelledby="interest-title">
      <div className="interest-modal-top"><span className="interest-sparkle"><Sparkles size={18}/></span><span className="eyebrow">YOUR BIDORA PICKS</span><span className="interest-step">ONE-TIME SETUP</span></div>
      <h2 id="interest-title">What do you love to find?</h2>
      <p className="interest-intro">Choose all the categories you’re interested in. We’ll let you know when a matching auction goes live.</p>
      <div className="interest-category-grid">
        {categories.map((category, index) => {
          const active = selected.includes(category.name);
          return <button
            key={category.name}
            type="button"
            className={`interest-category${active ? ' selected' : ''}`}
            onClick={() => toggle(category.name)}
            aria-pressed={active}
            style={{ '--interest-index': index } as React.CSSProperties}
          >
            <span className="interest-category-image" style={{ backgroundImage: `url("${category.image}")` }}/>
            <span className="interest-category-shade"/>
            <span className="interest-category-name">{category.name}</span>
            <span className="interest-check">{active && <Check size={15}/>}</span>
          </button>;
        })}
      </div>
      {error && <p className="interest-error" role="alert">{error}</p>}
      <div className="interest-modal-actions">
        <button type="button" className="interest-skip" onClick={() => void saveInterests([])} disabled={saving}>
          <X size={15}/> Maybe later
        </button>
        <button type="button" className="btn btn-primary interest-save" onClick={() => void saveInterests(selected)} disabled={saving || selected.length === 0}>
          {saving ? 'Saving…' : `Save ${selected.length ? `${selected.length} interest${selected.length === 1 ? '' : 's'}` : 'interests'}`}
        </button>
      </div>
      <p className="interest-privacy">You can select multiple categories. This prompt appears once.</p>
    </section>
  </div>;
}
