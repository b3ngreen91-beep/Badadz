import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { Plus, Edit3, Pause, Play, CreditCard } from 'lucide-react';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [salesData, setSalesData] = useState({ orders: [], stats: { total_earnings: 0, paid_count: 0 } });
  const [connectStatus, setConnectStatus] = useState({ onboarding_complete: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [actionBusy, setActionBusy] = useState('');

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const [listingsResult, salesResult, connectResult] = await Promise.allSettled([
        api.get('/listings', { params: { owner_id: user.id, include_inactive: true } }),
        api.get('/orders/sales'),
        api.get('/connect/status'),
      ]);

      if (listingsResult.status === 'fulfilled') {
        setListings(listingsResult.value.data.listings || []);
      }

      if (salesResult.status === 'fulfilled') {
        setSalesData(salesResult.value.data || { orders: [], stats: { total_earnings: 0, paid_count: 0 } });
      }

      if (connectResult.status === 'fulfilled') {
        setConnectStatus(connectResult.value.data || { onboarding_complete: false });
      } else {
        console.error('connect status failed', connectResult.reason);
        setConnectStatus({ onboarding_complete: false, status_check_failed: true });
      }
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) load(); }, [user]);

  const startStripeConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.post('/connect/onboard');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Stripe onboarding link was not returned');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to start Stripe Connect');
    } finally {
      setConnecting(false);
    }
  };

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

  const approveOrder = async (order) => {
    setActionBusy(`approve-${order.id}`);
    try {
      await api.post(`/orders/${order.id}/approve`);
      toast.success('Ad purchase approved');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to approve order');
    } finally {
      setActionBusy('');
    }
  };

  const denyOrder = async (order) => {
    const confirmed = window.confirm('Deny this ad purchase and refund the advertiser?');
    if (!confirmed) return;

    setActionBusy(`deny-${order.id}`);
    try {
      await api.post(`/orders/${order.id}/deny`, { reason: 'Denied by website owner' });
      toast.success('Ad purchase denied and refund started');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to deny order');
    } finally {
      setActionBusy('');
    }
  };

  const approvedPaidOrders = salesData.orders.filter(o => o.payment_status === 'paid' && o.approval_status === 'approved');
  const pendingApprovalOrders = salesData.orders.filter(o => o.payment_status === 'paid' && o.approval_status === 'pending');
  const activeCount = listings.filter(l => l.status === 'active').length;
  const soldCount = listings.filter(l => l.status === 'sold').length;
  const pausedCount = listings.filter(l => l.status === 'paused').length;
  const totalSales = approvedPaidOrders.reduce((sum, o) => sum + Number(o.price_paid || 0), 0);
  const totalFees = approvedPaidOrders.reduce((sum, o) => sum + Number(o.platform_fee || 0), 0);
  const totalEarnings = approvedPaidOrders.reduce((sum, o) => sum + Number(o.seller_earnings || 0), 0);
  const activeCampaigns = approvedPaidOrders.filter(o => !o.campaign_ends_at || new Date(o.campaign_ends_at) > new Date()).length;
  const completedCampaigns = approvedPaidOrders.filter(o => o.campaign_ends_at && new Date(o.campaign_ends_at) <= new Date()).length;
  const stripeConnected = Boolean(connectStatus?.onboarding_complete);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12" data-testid="owner-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-2">[ Owner / Dashboard ]</div>
          <h1 className="font-display font-black uppercase text-3xl sm:text-4xl tracking-tight">Hey, {user?.name}.</h1>
        </div>
        {stripeConnected ? (
          <Link to="/listings/new" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors" data-testid="owner-new-listing-btn">
            <Plus size={14}/> New Listing
          </Link>
        ) : (
          <button onClick={startStripeConnect} disabled={connecting} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-60" data-testid="owner-connect-stripe-top-btn">
            <CreditCard size={14}/> {connecting ? 'Connecting...' : 'Connect Stripe'}
          </button>
        )}
      </div>

      <div className={`border p-5 sm:p-6 mb-8 ${stripeConnected ? 'border-acid bg-acid/5' : 'border-primary bg-primary/10'}`} data-testid="owner-stripe-connect-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className={`text-[10px] uppercase tracking-[0.3em] font-bold mb-2 ${stripeConnected ? 'text-acid' : 'text-primary'}`}>
              {stripeConnected ? 'Stripe payouts connected' : 'Action required'}
            </div>
            <h2 className="font-display font-black uppercase text-2xl tracking-tight">
              {stripeConnected ? 'You can receive seller payouts.' : 'Connect Stripe to receive payouts.'}
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              {stripeConnected
                ? 'Your seller payout account is connected. New listing sales can be routed through Stripe Connect.'
                : 'Website owners must connect Stripe before creating paid listings. This lets BadAdz send seller earnings automatically after a buyer purchases ad space.'}
            </p>
            {!stripeConnected && connectStatus?.status_check_failed && (
              <p className="text-xs text-primary mt-3">Stripe status check failed. Refresh the page or try connecting again.</p>
            )}
          </div>
          {!stripeConnected && (
            <button onClick={startStripeConnect} disabled={connecting} className="shrink-0 bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-60" data-testid="owner-connect-stripe-card-btn">
              {connecting ? 'Opening Stripe...' : 'Connect Stripe'}
            </button>
          )}
        </div>
      </div>

      {pendingApprovalOrders.length > 0 && (
        <div className="border border-gold bg-gold/10 p-5 sm:p-6 mb-8" data-testid="owner-pending-approval-card">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold font-bold mb-2">Owner approval needed</div>
          <h2 className="font-display font-black uppercase text-2xl tracking-tight">{pendingApprovalOrders.length} paid ad request{pendingApprovalOrders.length === 1 ? '' : 's'} waiting.</h2>
          <p className="text-sm text-muted-foreground mt-3">Review the advertiser and listing below. Approving starts the campaign. Denying attempts to refund the advertiser through Stripe.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-8" data-testid="owner-revenue-stats">
        <Stat label="Approved Sales" value={`$${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <Stat label="Platform Fees" value={`$${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <Stat label="Your Earnings" value={`$${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} highlight />
        <Stat label="Needs Approval" value={pendingApprovalOrders.length} />
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
          {stripeConnected ? (
            <Link to="/listings/new" className="inline-block mt-4 text-primary text-xs uppercase tracking-[0.3em]">Create your first listing →</Link>
          ) : (
            <button onClick={startStripeConnect} disabled={connecting} className="inline-block mt-4 text-primary text-xs uppercase tracking-[0.3em] disabled:opacity-60">
              Connect Stripe before listing →
            </button>
          )}
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
          <table className="w-full text-sm min-w-[900px]">
            <thead className="border-b border-border bg-secondary">
              <tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Listing</th>
                <th className="text-left p-3">Advertiser</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-right p-3">Fee</th>
                <th className="text-right p-3">You Earn</th>
                <th className="text-left p-3">Payment</th>
                <th className="text-left p-3">Approval</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesData.orders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-b-0">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="p-3">{o.website_name}</td>
                  <td className="p-3 text-muted-foreground">{o.advertiser_name}<br/><span className="text-xs">{o.advertiser_email}</span></td>
                  <td className="p-3 text-right font-mono">${Number(o.price_paid).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">${Number(o.platform_fee).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono text-acid">${Number(o.seller_earnings).toFixed(2)}</td>
                  <td className="p-3"><span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${o.payment_status==='paid'?'text-acid':o.payment_status==='refunded'?'text-primary':'text-gold'}`}>● {o.payment_status}</span></td>
                  <td className="p-3"><span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${o.approval_status==='approved'?'text-acid':o.approval_status==='denied'?'text-primary':o.approval_status==='pending'?'text-gold':'text-muted-foreground'}`}>● {o.approval_status || 'awaiting_payment'}</span></td>
                  <td className="p-3 text-right">
                    {o.payment_status === 'paid' && o.approval_status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => approveOrder(o)}
                          disabled={Boolean(actionBusy)}
                          className="border border-acid text-acid px-2 py-1 text-[10px] uppercase tracking-[0.2em] disabled:opacity-60"
                        >
                          {actionBusy === `approve-${o.id}` ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => denyOrder(o)}
                          disabled={Boolean(actionBusy)}
                          className="border border-primary text-primary px-2 py-1 text-[10px] uppercase tracking-[0.2em] disabled:opacity-60"
                        >
                          {actionBusy === `deny-${o.id}` ? 'Denying...' : 'Deny'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">—</span>
                    )}
                  </td>
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
