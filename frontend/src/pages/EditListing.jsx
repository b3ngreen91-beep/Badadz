import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';

const CATEGORIES = ['Tech', 'Finance', 'Sports', 'Design', 'Gaming', 'News', 'Lifestyle', 'Crypto', 'Health', 'Other'];

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(({ data }) => setForm(data.listing))
      .catch(() => toast.error('Listing not found'));
  }, [id]);

  if (!form) return <div className="max-w-3xl mx-auto px-6 py-20 text-muted-foreground text-xs uppercase tracking-[0.3em]">Loading…</div>;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = {
        website_name: form.website_name,
        website_url: form.website_url,
        description: form.description,
        category: form.category,
        monthly_price: Number(form.monthly_price),
        image_url: form.image_url,
        traffic_stats: form.traffic_stats || '',
        status: form.status,
      };
      await api.put(`/listings/${id}`, payload);
      toast.success('Listing updated');
      navigate(`/listings/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return;
    try {
      await api.delete(`/listings/${id}`);
      toast.success('Listing deleted');
      navigate('/dashboard/owner');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid="edit-listing-page">
      <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-4">[ Owner / Edit ]</div>
      <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-8">Edit listing</h1>

      <form onSubmit={submit} className="space-y-5 border border-border p-6 bg-card">
        <Field label="Website name"><input required value={form.website_name} onChange={set('website_name')} className={inputClass} data-testid="edit-name-input"/></Field>
        <Field label="Website URL"><input required type="url" value={form.website_url} onChange={set('website_url')} className={inputClass} data-testid="edit-url-input"/></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Category">
            <select value={form.category} onChange={set('category')} className={inputClass} data-testid="edit-category-select">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Monthly price"><input required type="number" min="0" value={form.monthly_price} onChange={set('monthly_price')} className={inputClass} data-testid="edit-price-input"/></Field>
        </div>
        <Field label="Banner image URL"><input required type="url" value={form.image_url} onChange={set('image_url')} className={inputClass} data-testid="edit-image-input"/></Field>
        {form.image_url && (
          <div className="aspect-video border border-border bg-background overflow-hidden">
            <img src={form.image_url} alt="" className="w-full h-full object-cover" onError={(e)=>{e.currentTarget.style.opacity=0.2;}}/>
          </div>
        )}
        <Field label="Description"><textarea rows={4} value={form.description||''} onChange={set('description')} className={inputClass} data-testid="edit-description-input"/></Field>
        <Field label="Traffic stats"><input value={form.traffic_stats||''} onChange={set('traffic_stats')} className={inputClass} data-testid="edit-traffic-input"/></Field>
        <Field label="Status">
          <select value={form.status} onChange={set('status')} className={inputClass} data-testid="edit-status-select" disabled={form.status==='sold'}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            {form.status === 'sold' && <option value="sold">Sold</option>}
          </select>
        </Field>

        {error && <div className="text-xs text-primary border border-primary px-3 py-2" data-testid="edit-error">{error}</div>}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy}
            className="flex-1 min-w-[180px] bg-primary text-primary-foreground py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-60"
            data-testid="edit-submit-btn">
            {busy ? 'Saving…' : 'Save Changes →'}
          </button>
          <button type="button" onClick={remove} className="border border-primary text-primary px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-primary hover:text-primary-foreground" data-testid="edit-delete-btn">
            Delete
          </button>
          <button type="button" onClick={() => navigate(-1)} className="border border-border px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:border-primary hover:text-primary" data-testid="edit-cancel-btn">
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
