import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { ExternalLink, ArrowLeft } from 'lucide-react';

const CREATIVE_SIZES = ['728x90', '300x250', '160x600', '320x50', '970x250'];
const CREATIVE_DIMENSIONS = {
  '728x90': { width: 728, height: 90 },
  '300x250': { width: 300, height: 250 },
  '160x600': { width: 160, height: 600 },
  '320x50': { width: 320, height: 50 },
  '970x250': { width: 970, height: 250 },
};

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image dimensions'));
    };
    img.src = objectUrl;
  });
}

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(1);
  const [buying, setBuying] = useState(false);
  const [destinationUrl, setDestinationUrl] = useState('');
  const [advertiserNotes, setAdvertiserNotes] = useState('');
  const [showAdvancedUploads, setShowAdvancedUploads] = useState(false);
  const [autoCreativeFile, setAutoCreativeFile] = useState(null);
  const [autoCreativePreview, setAutoCreativePreview] = useState('');
  const [autoCreativeMeta, setAutoCreativeMeta] = useState(null);
  const [creativeFiles, setCreativeFiles] = useState({});
  const [creativePreviews, setCreativePreviews] = useState({});
  const [creativeErrors, setCreativeErrors] = useState({});
  const [creativeMeta, setCreativeMeta] = useState({});

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(({ data }) => setListing(data.listing))
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  const onAutoCreativeChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAutoCreativeFile(null);
      setAutoCreativePreview('');
      setAutoCreativeMeta(null);
      return;
    }

    try {
      const meta = await readImageDimensions(file);
      setAutoCreativeFile(file);
      setAutoCreativePreview(meta.objectUrl);
      setAutoCreativeMeta({ width: meta.width, height: meta.height });
      toast.success('Image ready');
    } catch (_err) {
      e.target.value = '';
      setAutoCreativeFile(null);
      setAutoCreativePreview('');
      setAutoCreativeMeta(null);
      toast.error('Could not read this image. Try another file.');
    }
  };

  const onCreativeChange = (size) => async (e) => {
    const file = e.target.files?.[0];
    const expected = CREATIVE_DIMENSIONS[size];
    if (!file) {
      setCreativeFiles((prev) => ({ ...prev, [size]: null }));
      setCreativePreviews((prev) => ({ ...prev, [size]: '' }));
      setCreativeErrors((prev) => ({ ...prev, [size]: '' }));
      setCreativeMeta((prev) => ({ ...prev, [size]: null }));
      return;
    }

    try {
      const { width, height, objectUrl } = await readImageDimensions(file);
      if (width !== expected.width || height !== expected.height) {
        URL.revokeObjectURL(objectUrl);
        e.target.value = '';
        setCreativeFiles((prev) => ({ ...prev, [size]: null }));
        setCreativePreviews((prev) => ({ ...prev, [size]: '' }));
        setCreativeMeta((prev) => ({ ...prev, [size]: { width, height } }));
        setCreativeErrors((prev) => ({ ...prev, [size]: `Wrong size. ${size} requires ${expected.width}×${expected.height}px. Your image is ${width}×${height}px.` }));
        toast.error(`${size} must be exactly ${expected.width}×${expected.height}px`);
        return;
      }
      setCreativeFiles((prev) => ({ ...prev, [size]: file }));
      setCreativePreviews((prev) => ({ ...prev, [size]: objectUrl }));
      setCreativeMeta((prev) => ({ ...prev, [size]: { width, height } }));
      setCreativeErrors((prev) => ({ ...prev, [size]: '' }));
    } catch (_err) {
      e.target.value = '';
      setCreativeFiles((prev) => ({ ...prev, [size]: null }));
      setCreativePreviews((prev) => ({ ...prev, [size]: '' }));
      setCreativeMeta((prev) => ({ ...prev, [size]: null }));
      setCreativeErrors((prev) => ({ ...prev, [size]: 'Could not validate this image. Try another file.' }));
    }
  };

  const buy = async () => {
    if (!user) { navigate('/login', { state: { from: `/listings/${id}` } }); return; }
    if (user.role !== 'advertiser') { toast.error('Only advertisers can buy. Create an advertiser account.'); return; }
    if (!destinationUrl.trim()) { toast.error('Enter the destination URL for your ad.'); return; }
    if (Object.values(creativeErrors).some(Boolean)) { toast.error('Fix banner size errors before paying.'); return; }
    if (!autoCreativeFile && !Object.values(creativeFiles).some(Boolean)) { toast.error('Upload one image, or upload exact banner sizes.'); return; }

    setBuying(true);
    try {
      const payload = new FormData();
      payload.append('listing_id', id);
      payload.append('months', String(months));
      payload.append('destination_url', destinationUrl.trim());
      payload.append('advertiser_notes', advertiserNotes.trim());
      if (autoCreativeFile) payload.append('auto_creative', autoCreativeFile);
      CREATIVE_SIZES.forEach((size) => { if (creativeFiles[size]) payload.append(`creative_${size}`, creativeFiles[size]); });

      const { data } = await api.post('/orders/create-checkout-session', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      window.location.href = data.url;
    } catch (e) {
      toast.error(e.response?.data?.error || 'Checkout failed');
      setBuying(false);
    }
  };

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-20 text-muted-foreground text-xs uppercase tracking-[0.3em]">Loading…</div>;
  if (!listing) return <div className="max-w-5xl mx-auto px-6 py-20" data-testid="listing-not-found"><div className="font-display font-black text-2xl uppercase">Listing not found.</div><Link to="/" className="text-primary text-xs uppercase tracking-[0.3em] mt-4 inline-block">← Back to marketplace</Link></div>;

  const total = Number(listing.monthly_price) * months;
  const isOwner = user && listing.user_id === user.id;
  const exactUploadCount = Object.values(creativeFiles).filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="listing-detail-page">
      <Link to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-primary mb-6" data-testid="listing-back-link"><ArrowLeft size={14}/> Back to marketplace</Link>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8">
          <div className="aspect-video bg-card border border-border overflow-hidden"><img src={listing.image_url} alt={listing.website_name} className="w-full h-full object-cover" /></div>
          <div className="mt-6 border border-border bg-card p-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">{listing.category}</div>
            <h1 className="font-display font-black uppercase text-3xl sm:text-4xl tracking-tight" data-testid="listing-name">{listing.website_name}</h1>
            <a href={listing.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:text-acid mt-2" data-testid="listing-url">{listing.website_url} <ExternalLink size={14}/></a>
            <h3 className="font-display font-bold uppercase text-sm tracking-[0.3em] text-muted-foreground mt-8 mb-2">Description</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="listing-description">{listing.description || 'No description provided.'}</p>
            {listing.traffic_stats && <><h3 className="font-display font-bold uppercase text-sm tracking-[0.3em] text-muted-foreground mt-6 mb-2">Traffic</h3><p className="text-sm border-l-2 border-primary pl-3" data-testid="listing-traffic">{listing.traffic_stats}</p></>}
            <div className="mt-6 text-xs text-muted-foreground uppercase tracking-[0.25em]">Owner: <span className="text-foreground">{listing.owner_name}</span> · Status: <span className="text-foreground">{listing.status}</span></div>
          </div>
        </div>

        <aside className="md:col-span-4">
          <div className="sticky top-24 border border-border bg-card p-6" data-testid="buy-card">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Monthly price</div>
            <div className="font-display font-black text-5xl text-acid leading-none mt-1" data-testid="detail-price">${Number(listing.monthly_price).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">USD / month</div>

            <div className="mt-6">
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">Duration</label>
              <div className="flex border border-border">{[1, 3, 6, 12].map((m) => <button key={m} onClick={() => setMonths(m)} className={`flex-1 py-2 text-xs uppercase tracking-[0.2em] font-bold transition-colors ${months === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'}`} data-testid={`months-${m}-btn`}>{m}mo</button>)}</div>
            </div>

            {!isOwner && (
              <div className="mt-6 border-t border-border pt-5 space-y-4">
                <div><label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">Ad destination URL *</label><input type="url" placeholder="https://your-site.com/offer" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary" data-testid="ad-destination-input" /></div>
                <div><label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">Advertiser notes</label><textarea rows={3} placeholder="Tell the site owner what this campaign is promoting." value={advertiserNotes} onChange={(e) => setAdvertiserNotes(e.target.value)} className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary" data-testid="ad-notes-input" /></div>

                <div className="border border-acid bg-acid/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-acid font-bold mb-2">Upload your ad</div>
                  <h3 className="font-display font-black uppercase text-xl tracking-tight mb-2">Start with one image</h3>
                  <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">Upload a clean ad image or logo. BadAdz will fit the full design onto standard banner canvases without cutting it off. For best results, use a wide banner-style image.</p>
                  <input type="file" accept="image/*" onChange={onAutoCreativeChange} className="w-full text-xs" data-testid="auto-creative-input" />
                  {autoCreativeMeta && <div className="mt-2 text-[11px] text-acid">Ready: {autoCreativeMeta.width}×{autoCreativeMeta.height}px. Auto-generated banners will use black padding when needed.</div>}
                  {autoCreativePreview && <div className="mt-3 border border-border bg-black p-2 overflow-hidden"><img src={autoCreativePreview} alt="Auto creative preview" className="max-w-full h-auto" /></div>}
                </div>

                <div className="border border-border p-3">
                  <button type="button" onClick={() => setShowAdvancedUploads((v) => !v)} className="w-full text-left text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-primary">
                    {showAdvancedUploads ? 'Hide exact-size uploads' : 'Optional: upload exact-size banners'} {exactUploadCount > 0 ? `(${exactUploadCount} added)` : ''}
                  </button>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Exact-size files override the auto-generated version for that size. Use this if you already have professional banner files.</p>

                  {showAdvancedUploads && <div className="space-y-3 mt-3">
                    {CREATIVE_SIZES.map((size) => {
                      const expected = CREATIVE_DIMENSIONS[size];
                      const meta = creativeMeta[size];
                      return <div key={size} className={`border p-3 ${creativeErrors[size] ? 'border-primary' : creativeFiles[size] ? 'border-acid' : 'border-border'}`}>
                        <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">{size} · exact {expected.width}×{expected.height}px</label>
                        <input type="file" accept="image/*" onChange={onCreativeChange(size)} className="w-full text-xs" data-testid={`creative-${size}-input`} />
                        {creativeErrors[size] && <div className="mt-2 text-[11px] text-primary leading-relaxed">{creativeErrors[size]}</div>}
                        {!creativeErrors[size] && meta && <div className="mt-2 text-[11px] text-acid">Valid: {meta.width}×{meta.height}px</div>}
                        {creativePreviews[size] && <div className="mt-3 border border-border bg-black p-2 overflow-hidden"><img src={creativePreviews[size]} alt={`${size} preview`} className="max-w-full h-auto" /></div>}
                      </div>;
                    })}
                  </div>}
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-border pt-4 space-y-2 text-sm font-mono"><Row label="Subtotal" value={`$${total.toFixed(2)}`} /><Row label="Platform fee (20%)" value={`–$${(total*0.2).toFixed(2)}`} muted /><div className="border-t border-border pt-2 flex justify-between"><span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">You pay</span><span className="font-display font-black text-lg" data-testid="detail-total">${total.toFixed(2)}</span></div></div>
            {isOwner ? <Link to={`/listings/${id}/edit`} className="block mt-6 text-center border border-foreground py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-foreground hover:text-background transition-colors" data-testid="edit-listing-btn">Edit Listing →</Link> : <button onClick={buy} disabled={buying || listing.status !== 'active'} className="w-full mt-6 bg-primary text-primary-foreground py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-50" data-testid="buy-now-btn">{listing.status !== 'active' ? 'Unavailable' : (buying ? 'Redirecting…' : 'Submit Ad + Pay →')}</button>}
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-3 text-center">Payment by Stripe. Owner approval required before campaign goes live.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, muted }) {
  return <div className="flex justify-between"><span className={`text-xs uppercase tracking-[0.2em] ${muted ? 'text-muted-foreground' : ''}`}>{label}</span><span>{value}</span></div>;
}
