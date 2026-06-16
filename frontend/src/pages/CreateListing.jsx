import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';

const CATEGORIES = ['Tech', 'Finance', 'Sports', 'Design', 'Gaming', 'News', 'Lifestyle', 'Crypto', 'Health', 'Other'];
const MAX_IMAGE_MB = 10;

export default function CreateListing() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    website_name: '',
    website_url: '',
    description: '',
    category: 'Tech',
    monthly_price: '',
    traffic_stats: '',
    status: 'active',
  });
  const [bannerImage, setBannerImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingStripe, setCheckingStripe] = useState(true);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    let active = true;

    const checkStripeConnect = async () => {
      try {
        const { data } = await api.get('/connect/status');
        if (!active) return;
        setStripeConnected(Boolean(data?.onboarding_complete));
      } catch (err) {
        if (!active) return;
        setStripeConnected(false);
      } finally {
        if (active) setCheckingStripe(false);
      }
    };

    checkStripeConnect();

    return () => {
      active = false;
    };
  }, []);

  const startStripeConnect = async () => {
    setConnectingStripe(true);
    setError('');
    try {
      const { data } = await api.post('/connect/onboard');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError('Stripe onboarding link was not returned');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start Stripe Connect');
    } finally {
      setConnectingStripe(false);
    }
  };

  const onImageChange = (e) => {
    const file = e.target.files?.[0];

    if (file && file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`Image must be ${MAX_IMAGE_MB}MB or smaller`);
      setBannerImage(null);
      setPreviewUrl('');
      e.target.value = '';
      return;
    }

    setError('');
    setBannerImage(file || null);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!stripeConnected) {
      setError('Connect Stripe before creating a listing.');
      return;
    }

    setBusy(true); setError('');
    try {
      if (!bannerImage) {
        setError('Please upload a banner image');
        setBusy(false);
        return;
      }

      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key !== 'monthly_price') payload.append(key, value);
      });
      payload.append('monthly_price', String(Number(form.monthly_price)));
      payload.append('banner_image', bannerImage);

      const { data } = await api.post('/listings', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Listing created');
      navigate(`/listings/${data.listing.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create listing');
    } finally {
      setBusy(false);
    }
  };

  if (checkingStripe) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12" data-testid="create-listing-page">
        <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-4">[ Owner / New Listing ]</div>
        <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-2">Checking Stripe payouts…</h1>
        <p className="text-sm text-muted-foreground">Please wait while BadAdz verifies your seller payout setup.</p>
      </div>
    );
  }

  if (!stripeConnected) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12" data-testid="create-listing-page">
        <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-4">[ Owner / New Listing ]</div>
        <div className="border border-primary bg-primary/10 p-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-3">Action required</div>
          <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-3">Connect Stripe before listing.</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Website owners must connect Stripe before creating paid listings. This lets BadAdz track seller payouts and prepare automatic 80/20 payment splitting.
          </p>
          {error && <div className="text-xs text-primary border border-primary px-3 py-2 mb-4" data-testid="create-error">{error}</div>}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={startStripeConnect}
              disabled={connectingStripe}
              className="bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-60"
              data-testid="create-connect-stripe-btn"
            >
              {connectingStripe ? 'Opening Stripe…' : 'Connect Stripe'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/owner')}
              className="border border-border px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:border-primary hover:text-primary"
              data-testid="create-back-dashboard-btn"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid="create-listing-page">
      <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-4">[ Owner / New Listing ]</div>
      <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-2">List ad inventory</h1>
      <p className="text-sm text-muted-foreground mb-8">Be honest about your traffic. Bad listings get unlisted.</p>

      <form onSubmit={submit} className="space-y-5 border border-border p-6 bg-card">
        <Field label="Website name *">
          <input required value={form.website_name} onChange={set('website_name')} className={inputClass} data-testid="create-name-input"/>
        </Field>
        <Field label="Website URL *">
          <input required type="url" placeholder="https://example.com" value={form.website_url} onChange={set('website_url')} className={inputClass} data-testid="create-url-input"/>
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Category *">
            <select value={form.category} onChange={set('category')} className={inputClass} data-testid="create-category-select">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Monthly price (USD) *">
            <input required type="number" min="0" step="1" value={form.monthly_price} onChange={set('monthly_price')} className={inputClass} data-testid="create-price-input"/>
          </Field>
        </div>
        <Field label={`Upload banner image * (${MAX_IMAGE_MB}MB max)`}>
          <input required type="file" accept="image/*" onChange={onImageChange} className={inputClass} data-testid="create-image-input"/>
        </Field>
        {previewUrl && (
          <div className="aspect-video border border-border bg-background overflow-hidden">
            <img src={previewUrl} alt="Banner preview" className="w-full h-full object-cover"/>
          </div>
        )}
        <Field label="Description">
          <textarea rows={4} value={form.description} onChange={set('description')} className={inputClass} data-testid="create-description-input"/>
        </Field>
        <Field label="Traffic stats (optional)">
          <input value={form.traffic_stats} onChange={set('traffic_stats')} placeholder="e.g. 120k monthly uniques · US 60%"
            className={inputClass} data-testid="create-traffic-input"/>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={set('status')} className={inputClass} data-testid="create-status-select">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </Field>

        {error && <div className="text-xs text-primary border border-primary px-3 py-2" data-testid="create-error">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={busy}
            className="flex-1 bg-primary text-primary-foreground py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-60"
            data-testid="create-submit-btn">
            {busy ? 'Creating…' : 'Create Listing →'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="border border-border px-6 text-xs uppercase tracking-[0.3em] font-bold hover:border-primary hover:text-primary" data-testid="create-cancel-btn">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass = 'w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">{label}</span>
      {children}
    </label>
  );
}
