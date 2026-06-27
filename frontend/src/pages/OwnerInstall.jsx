import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import InstallWizard from '../components/InstallWizard';

export default function OwnerInstall() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get('/listings', { params: { owner_id: user.id, include_inactive: true } });
      setListings(data.listings || []);
    } catch (_err) {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8" data-testid="owner-install-page">
      <div className="border border-primary bg-primary/10 p-6 sm:p-8 mb-8">
        <div className="text-[10px] uppercase tracking-[0.35em] text-primary font-bold mb-3">Owner Setup</div>
        <h1 className="font-display font-black uppercase text-3xl sm:text-5xl tracking-tight">Install your BadAdz ad slot.</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mt-4 max-w-3xl">
          Copy your slot code, paste it where the banner should appear, then verify installation. Once approved campaigns start, BadAdz updates that space automatically.
        </p>
        {user?.founding_member && (
          <div className="mt-5 inline-flex items-center border border-acid bg-acid/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-acid font-bold">
            Founding Seller · 15% lifetime fee · Keep 85%
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-xs uppercase tracking-[0.3em]">Loading your listings...</div>
      ) : listings.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center">
          <h2 className="font-display font-black uppercase text-2xl tracking-tight">Create your first listing first.</h2>
          <p className="text-sm text-muted-foreground mt-3">The install wizard appears after you create a website listing.</p>
          <Link to="/listings/new" className="inline-block mt-6 bg-primary text-primary-foreground px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black">Create Listing</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {listings.map((listing) => <InstallWizard key={listing.id} listing={listing} onVerified={load} />)}
        </div>
      )}
    </div>
  );
}
