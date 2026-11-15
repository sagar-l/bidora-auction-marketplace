'use client';

import { useFormStatus } from 'react-dom';
import { Upload } from 'lucide-react';

export function SubmitListingButton() {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary form-submit" type="submit" disabled={pending} aria-live="polite">
    <Upload size={16}/>{pending ? 'Submitting listing…' : 'Submit listing for review'}
  </button>;
}
