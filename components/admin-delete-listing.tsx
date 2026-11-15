'use client';

import { deleteAdminListing } from '@/app/actions';

export function AdminDeleteListing({ id, title }: { id: string; title: string }) {
  return <form action={deleteAdminListing} onSubmit={(event) => {
    if (!window.confirm(`Remove “${title}” from public auctions? Its auction and sale history will be kept.`)) event.preventDefault();
  }}>
    <input type="hidden" name="id" value={id}/>
    <button className="admin-delete-button" type="submit">Remove listing</button>
  </form>;
}
