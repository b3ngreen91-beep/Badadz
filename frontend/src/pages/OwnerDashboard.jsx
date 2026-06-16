import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { Plus, Edit3, Pause, Play } from 'lucide-react';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [salesData, setSalesData] = useState({ orders: [], stats: { total_earnings: 0, paid_count: 0 } });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: ld }, { data: sd }] = await Promise.all([
        api.get('/listings', { params: { owner_id: user.id, include_inactive: true } }),
        api.get('/orders/sales'),
      ]);
      setListings(ld.listings || []);
      setSalesData(sd);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) load(); }, [user]);

  const toggleStatus = async (l) => {
    const next = l.status === 'active' ? 'paused' : 'active';
    try {
      await api.put(`/listings/${l.id}`, { status: next });
      toast.success(`Listing ${next}`);
      load();
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const paidOrders = salesData.orders.filter(o => o.payment_status === 'paid');
  const activeCount = listings.filter(l => l.status === 'active').length;
  const soldCount = listings.filter(l => l.status === 'sold').length;
  const pausedCount = listings.filter(l => l.status === 'paused').length;
  const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.price_paid || 0), 0);
  const totalFees = paidOrders.reduce((sum, o) => sum + Number(o.platform_fee || 0), 0);
  const totalEarnings = paidOrders.reduce((sum, o) => sum + Number(o.seller_earnings || 0), 0);
  const activeCampaigns = paidOrders.filter(o => !o.campaign_ends_at || new Date(o.campaign_ends_at) > new Date()).length;
  const completedCampaigns = paidOrders.filter(o => o.campaign_ends_at && new Date(o.campaign_ends_at) <= new Date()).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12" data-testid="owner-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-2">[ Owner / Dashboard ]</div>
          <h1 className="font-display font-black uppercase text-3xl sm:text-4xl tracking-tight">Hey, {user?.name}.</h1>
        </div>
        <Link to="/listings/new" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors" data-testid="owner-new-listing-btn">
          <Plus size={14}/> New Listing
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-8" data-testid="owner-revenue-stats">
        <Stat label="Total Sales" value={`$${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <Stat label="Platform Fees" value={`$${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <Stat label="Your Earnings" value={`$${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} highlight />
        <Stat label="Paid Orders" value={paidOrders.length} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border border-border mb-12" data-testid="owner-listing-stats">
        <Stat label="Active Listings" value={activeCount} />
        <Stat label="Sold Listings" value={soldCount} />
        <Stat label="Paused Listings" value={pausedCount} />
        <Stat label="Active Campaigns" value={activeCampaigns} highlight />
        <Stat label="Completed" value={completedCampaigns} />
      </div>

      <h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight mb-4">My Listings</h2>
      {loading ? (
        <div className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-12">Loading...</div>
      ) : listings.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">No listings yet.</p>
          <Link to="/listings/new" className="inline-block mt-4 text-primary text-xs uppercase tracking-[0.3em]">Create your first listing →</Link>
        </div>
      ) : (
        <div data-testid="owner-listings-table">
          <div className="md:hidden space-y-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} toggleStatus={toggleStatus} />
            ))}
          </div>

          <div className="hidden md:block border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary">
                <tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  <th className="text-left p-3">Website</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-right p-3">Price</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-b-0">
                    <td className="p-3"><Link to={`/listings/${l.id}`} className="hover:text-primary">{l.website_name}</Link></td>
                    <td className="p-3 text-muted-foreground">{l.category}</td>
                    <td className="p-3 text-right font-mono">${Number(l.monthly_price).toLocaleString()}</td>
                    <td className="p-3"><StatusBadge status={l.status} /></td>
                    <td className="p-3 text-right space-x-2">
                      {l.status !== 'sold' && (
                        <button onClick={() => toggleStatus(l)} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[10px] uppercase tracking-[0.2em] hover:border-primary hover:text-primary" data-testid={`toggle-status-${l.id}`}>
                          {l.status === 'active' ? <><Pause size={10}/> Pause</> : <><Play size={10}/> Activate</>}
                        </button>
                      )}
                      <Link to={`/listings/${l.id}/edit`} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[10px] uppercase tracking-[0.2em] hover:border-primary hover:text-primary" data-testid={`edit-${l.id}`}>
                        <Edit3 size={10}/> Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight mt-12 mb-4">Sales History</h2>
      {salesData.orders.length === 0 ? (
        <div className="border border-border p-8 sm:p-12 text-center text-sm text-muted-foreground" data-testid="owner-no-sales">No sales yet.</div>
      ) : (
        <div className="border border-border bg-card overflow-x-auto" data-testid="owner-sales-table">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="border-b border-border bg-secondary">
              <tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Listing</th>
                <th className="text-left p-3">Advertiser</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-right p-3">Fee</th>
                <th className="text-right p-3">You Earn</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {salesData.orders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-b-0">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="p-3">{o.website_name}</td>
                  <td className="p-3 text-muted-foreground">{o.advertiser_name}</td>
                  <td className="p-3 text-right font-mono">${Number(o.price_paid).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">${Number(o.platform_fee).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono text-acid">${Number(o.seller_earnings).toFixed(2)}</td>
                  <td className="p-3"><span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${o.payment_status==='paid'?'text-acid':'text-gold'}`}>● {o.payment_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing: l, toggleStatus }) {
  return (
    <div className="border border-border bg-card p-4" data-testid={`owner-listing-card-${l.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/listings/${l.id}`} className="block font-display font-black uppercase text-xl tracking-tight hover:text-primary truncate">
            {l.website_name}
          </Link>
          <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {l.category || 'Uncategorized'}
          </div>
        </div>
        <StatusBadge status={l.status} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px bg-border border border-border">
        <MiniStat label="Price" value={`$${Number(l.monthly_price || 0).toLocaleString()}`} />
        <MiniStat label="Status" value={l.status} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {l.status !== 'sold' && (
          <button onClick={() => toggleStatus(l)} className="w-full inline-flex items-center justify-center gap-2 border border-border px-3 py-3 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary" data-testid={`toggle-status-${l.id}`}>
            {l.status === 'active' ? <><Pause size={12}/> Pause Listing</> : <><Play size={12}/> Activate Listing</>}
          </button>
        )}
        <Link to={`/listings/${l.id}/edit`} className="w-full inline-flex items-center justify-center gap-2 border border-border px-3 py-3 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary" data-testid={`edit-${l.id}`}>
          <Edit3 size={12}/> Edit Listing
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`shrink-0 text-[10px] uppercase tracking-[0.2em] font-bold ${status === 'active' ? 'text-acid' : status === 'paused' ? 'text-gold' : 'text-muted-foreground'}`}>
      ● {status}
    </span>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-background p-3">
      <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm uppercase">{value}</div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="bg-background p-4 sm:p-5">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`font-display font-black text-xl sm:text-3xl mt-2 ${highlight ? 'text-acid' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
