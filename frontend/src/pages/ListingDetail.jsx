import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { ExternalLink, ArrowLeft } from 'lucide-react';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(1);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(({ data }) => setListing(data.listing))
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  const buy = async () => {
    if (!user) { navigate('/login', { state: { from: `/listings/${id}` } }); return; }
    if (user.role !== 'advertiser') { toast.error('Only advertisers can buy. Create an advertiser account.'); return; }
    setBuying(true);
    try {
      const { data } = await api.post('/orders/create-checkout-session', { listing_id: id, months });
      window.location.href = data.url;
    } catch (e) {
      toast.error(e.response?.data?.error || 'Checkout failed');
      setBuying(false);
    }
  };

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-20 text-muted-foreground text-xs uppercase tracking-[0.3em]">Loading…</div>;
  if (!listing) return <div className="max-w-5xl mx-auto px-6 py-20" data-testid="listing-not-found">
    <div className="font-display font-black text-2xl uppercase">Listing not found.</div>
    <Link to="/" className="text-primary text-xs uppercase tracking-[0.3em] mt-4 inline-block">← Back to marketplace</Link>
  </div>;

  const total = Number(listing.monthly_price) * months;
  const isOwner = user && listing.user_id === user.id;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="listing-detail-page">
      <Link to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-primary mb-6" data-testid="listing-back-link">
        <ArrowLeft size={14}/> Back to marketplace
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8">
          <div className="aspect-video bg-card border border-border overflow-hidden">
            <img src={listing.image_url} alt={listing.website_name} className="w-full h-full object-cover" />
          </div>

          <div className="mt-6 border border-border bg-card p-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">{listing.category}</div>
            <h1 className="font-display font-black uppercase text-3xl sm:text-4xl tracking-tight" data-testid="listing-name">
              {listing.website_name}
            </h1>
            <a href={listing.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:text-acid mt-2" data-testid="listing-url">
              {listing.website_url} <ExternalLink size={14}/>
            </a>

            <h3 className="font-display font-bold uppercase text-sm tracking-[0.3em] text-muted-foreground mt-8 mb-2">Description</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="listing-description">{listing.description || 'No description provided.'}</p>

            {listing.traffic_stats && (
              <>
                <h3 className="font-display font-bold uppercase text-sm tracking-[0.3em] text-muted-foreground mt-6 mb-2">Traffic</h3>
                <p className="text-sm border-l-2 border-primary pl-3" data-testid="listing-traffic">{listing.traffic_stats}</p>
              </>
            )}

            <div className="mt-6 text-xs text-muted-foreground uppercase tracking-[0.25em]">
              Owner: <span className="text-foreground">{listing.owner_name}</span> · Status: <span className="text-foreground">{listing.status}</span>
            </div>
          </div>
        </div>

        <aside className="md:col-span-4">
          <div className="sticky top-24 border border-border bg-card p-6" data-testid="buy-card">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Monthly price</div>
            <div className="font-display font-black text-5xl text-acid leading-none mt-1" data-testid="detail-price">
              ${Number(listing.monthly_price).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">USD / month</div>

            <div className="mt-6">
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">Duration</label>
              <div className="flex border border-border">
                {[1, 3, 6, 12].map((m) => (
                  <button key={m} onClick={() => setMonths(m)}
                    className={`flex-1 py-2 text-xs uppercase tracking-[0.2em] font-bold transition-colors ${
                      months === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'
                    }`}
                    data-testid={`months-${m}-btn`}>
                    {m}mo
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4 space-y-2 text-sm font-mono">
              <Row label="Subtotal" value={`$${total.toFixed(2)}`} />
              <Row label="Platform fee (20%)" value={`–$${(total*0.2).toFixed(2)}`} muted />
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">You pay</span>
                <span className="font-display font-black text-lg" data-testid="detail-total">${total.toFixed(2)}</span>
              </div>
            </div>

            {isOwner ? (
              <Link to={`/listings/${id}/edit`} className="block mt-6 text-center border border-foreground py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-foreground hover:text-background transition-colors" data-testid="edit-listing-btn">
                Edit Listing →
              </Link>
            ) : (
              <button
                onClick={buy}
                disabled={buying || listing.status !== 'active'}
                className="w-full mt-6 bg-primary text-primary-foreground py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-50"
                data-testid="buy-now-btn">
                {listing.status !== 'active' ? 'Unavailable' : (buying ? 'Redirecting…' : 'Buy Ad Space →')}
              </button>
            )}

            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-3 text-center">
              Payment by Stripe. Secure checkout.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between">
      <span className={`text-xs uppercase tracking-[0.2em] ${muted ? 'text-muted-foreground' : ''}`}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
