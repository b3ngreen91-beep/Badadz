import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { Plus, Edit3, Pause, Play, CreditCard, Copy, Code2 } from 'lucide-react';

const AD_SIZES = ['728x90', '300x250', '160x600', '320x50', '970x250'];

function getBackendBase() {
  return API_BASE.replace(/\/api\/?$/, '') || window.location.origin;
}

function getEmbedCode(listing, size = '728x90') {
  const slotId = listing.ad_slot_id || listing.id;
  return `<script async src="${getBackendBase()}/ads/${slotId}.js?size=${encodeURIComponent(size)}"></script>`;
}

function isTestOrder(order) {
  return Number(order.price_paid || 0) <= 0;
}

function ctrPercent(views, clicks) {
  const v = Number(views || 0);
  const c = Number(clicks || 0);
  if (!v) return '0.00%';
  return `${((c / v) * 100).toFixed(2)}%`;
}

async function copyText(text, message = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch (_err) {
    toast.error('Could not copy');
  }
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [salesData, setSalesData] = useState({ orders: [], stats: { total_earnings: 0, paid_count: 0 } });
  const [connectStatus, setConnectStatus] = useState({ onboarding_complete: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [openCodeListingId, setOpenCodeListingId] = useState('');
  const [showSoldListings, setShowSoldListings] = useState(false);
  const [showTestRecords, setShowTestRecords] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [listingsResult, salesResult, connectResult] = await Promise.allSettled([
        api.get('/listings', { params: { owner_id: user.id, include_inactive: true } }),
        api.get('/orders/sales'),
        api.get('/connect/status'),
      ]);

      if (listingsResult.status === 'fulfilled') setListings(listingsResult.value.data.listings || []);
      if (salesResult.status === 'fulfilled') setSalesData(salesResult.value.data || { orders: [], stats: { total_earnings: 0, paid_count: 0 } });
      if (connectResult.status === 'fulfilled') setConnectStatus(connectResult.value.data || { onboarding_complete: false });
      else setConnectStatus({ onboarding_complete: false, status_check_failed: true });
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
      if (data?.url) window.location.href = data.url;
      else toast.error('Stripe onboarding link was not returned');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to start Stripe Connect');
    } finally {
      setConnecting(false);
    }
  };

  const toggleStatus = async (listing) => {
    const next = listing.status === 'active' ? 'paused' : 'active';
    try {
      await api.put(`/listings/${listing.id}`, { status: next });
      toast.success(`Listing ${next}`);
      load();
    } catch (_e) {
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
    if (!window.confirm('Deny this ad purchase and refund the advertiser?')) return;
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

  const allOrders = salesData.orders || [];
  const visibleOrders = showTestRecords ? allOrders : allOrders.filter((o) => !isTestOrder(o));
  const approvedPaidOrders = visibleOrders.filter((o) => o.payment_status === 'paid' && o.approval_status === 'approved');
  const pendingApprovalOrders = allOrders.filter((o) => o.payment_status === 'paid' && ['pending', 'awaiting_approval'].includes(o.approval_status));
  const visibleListings = showSoldListings ? listings : listings.filter((l) => l.status !== 'sold');
  const activeCount = listings.filter((l) => l.status === 'active').length;
  const soldCount = listings.filter((l) => l.status === 'sold').length;
  const hiddenTestCount = allOrders.filter(isTestOrder).length;

  const totalSales = approvedPaidOrders.reduce((sum, o) => sum + Number(o.price_paid || 0), 0);
  const totalEarnings = approvedPaidOrders.reduce((sum, o) => sum + Number(o.seller_earnings || 0), 0);
  const totalImpressions = approvedPaidOrders.reduce((sum, o) => sum + Number(o.impression_count || 0), 0);
  const totalClicks = approvedPaidOrders.reduce((sum, o) => sum + Number(o.click_count || 0), 0);
  const activeCampaigns = approvedPaidOrders.filter((o) => !o.campaign_ends_at || new Date(o.campaign_ends_at) > new Date()).length;
  const stripeConnected = Boolean(connectStatus?.onboarding_complete);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8" data-testid="owner-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.35em] text-primary mb-2">Owner Dashboard</div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-5" data-testid="owner-core-stats">
        <Stat label="Your Earnings" value={`$${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} highlight />
        <Stat label="Needs Review" value={pendingApprovalOrders.length} />
        <Stat label="Active Campaigns" value={activeCampaigns} />
        <Stat label="Approved Sales" value={`$${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-8" data-testid="owner-analytics-stats">
        <Stat label="Views" value={totalImpressions.toLocaleString()} highlight />
        <Stat label="Clicks" value={totalClicks.toLocaleString()} />
        <Stat label="CTR" value={ctrPercent(totalImpressions, totalClicks)} />
        <Stat label="Active Listings" value={activeCount} />
      </div>

      {hiddenTestCount > 0 && (
        <div className="border border-border bg-card p-4 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {showTestRecords ? 'Showing $0 test records in analytics and sales history.' : `${hiddenTestCount} $0 test record${hiddenTestCount === 1 ? '' : 's'} hidden from launch analytics.`}
          </p>
          <button onClick={() => setShowTestRecords((v) => !v)} className="border border-border px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary">
            {showTestRecords ? 'Hide Test Records' : 'Show Test Records'}
          </button>
        </div>
      )}

      <section className="mb-8" data-testid="owner-ad-requests-section">
        <div className={`border p-5 sm:p-6 mb-4 ${pendingApprovalOrders.length > 0 ? 'border-gold bg-gold/10' : 'border-border bg-card'}`}>
          <div className={`text-[10px] uppercase tracking-[0.3em] font-bold mb-2 ${pendingApprovalOrders.length > 0 ? 'text-gold' : 'text-muted-foreground'}`}>Ad requests</div>
          <h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight">
            {pendingApprovalOrders.length > 0 ? `${pendingApprovalOrders.length} ad request${pendingApprovalOrders.length === 1 ? '' : 's'} waiting for review.` : 'No ad requests waiting.'}
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            {pendingApprovalOrders.length > 0
              ? 'Review the banner previews and destination URL. Approved ads automatically appear anywhere your matching ad slot code is installed.'
              : 'Paid ad requests appear here first with banner previews and approve/deny buttons.'}
          </p>
        </div>

        {pendingApprovalOrders.length > 0 && (
          <div className="space-y-4">
            {pendingApprovalOrders.map((order) => <PendingReviewCard key={order.id} order={order} actionBusy={actionBusy} approveOrder={approveOrder} denyOrder={denyOrder} />)}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight">My Listings</h2>
            <p className="text-xs text-muted-foreground mt-2">Open Ad Code on an active or paused listing, choose a slot size, then paste that code where that size should appear on your website.</p>
          </div>
          <div className="flex items-center gap-3">
            {soldCount > 0 && <button onClick={() => setShowSoldListings((v) => !v)} className="text-muted-foreground text-[10px] uppercase tracking-[0.25em] font-bold hover:text-primary">{showSoldListings ? 'Hide Sold' : `Show Sold (${soldCount})`}</button>}
            {stripeConnected && <Link to="/listings/new" className="text-primary text-[10px] uppercase tracking-[0.25em] font-bold">Add Listing →</Link>}
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-8">Loading...</div>
        ) : visibleListings.length === 0 ? (
          <div className="border border-border p-8 sm:p-10 text-center">
            <p className="text-muted-foreground text-sm">No visible listings.</p>
            {stripeConnected && <Link to="/listings/new" className="inline-block mt-4 text-primary text-xs uppercase tracking-[0.3em]">Create your first listing →</Link>}
          </div>
        ) : (
          <div className="border border-border bg-card overflow-hidden" data-testid="owner-listings-table">
            <div className="hidden md:block overflow-x-auto">
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
                  {visibleListings.map((listing) => (
                    <React.Fragment key={listing.id}>
                      <tr className="border-b border-border last:border-b-0">
                        <td className="p-3"><Link to={`/listings/${listing.id}`} className="hover:text-primary">{listing.website_name}</Link></td>
                        <td className="p-3 text-muted-foreground">{listing.category}</td>
                        <td className="p-3 text-right font-mono">${Number(listing.monthly_price || 0).toLocaleString()}</td>
                        <td className="p-3"><StatusBadge status={listing.status} /></td>
                        <td className="p-3 text-right space-x-2">
                          {listing.status !== 'sold' && <button onClick={() => setOpenCodeListingId(openCodeListingId === listing.id ? '' : listing.id)} className="inline-flex items-center gap-1 border border-acid text-acid px-2 py-1 text-[10px] uppercase tracking-[0.2em] hover:bg-acid hover:text-black" data-testid={`open-ad-code-${listing.id}`}><Code2 size={10}/> Ad Code</button>}
                          {listing.status !== 'sold' && <button onClick={() => toggleStatus(listing)} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[10px] uppercase tracking-[0.2em] hover:border-primary hover:text-primary" data-testid={`toggle-status-${listing.id}`}>{listing.status === 'active' ? <><Pause size={10}/> Pause</> : <><Play size={10}/> Activate</>}</button>}
                          <Link to={`/listings/${listing.id}/edit`} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[10px] uppercase tracking-[0.2em] hover:border-primary hover:text-primary" data-testid={`edit-${listing.id}`}><Edit3 size={10}/> Edit</Link>
                        </td>
                      </tr>
                      {listing.status !== 'sold' && openCodeListingId === listing.id && (
                        <tr className="border-b border-border"><td colSpan="5" className="p-4 bg-background"><AdCodePanel listing={listing} /></td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-border">
              {visibleListings.map((listing) => <ListingCard key={listing.id} listing={listing} toggleStatus={toggleStatus} openCodeListingId={openCodeListingId} setOpenCodeListingId={setOpenCodeListingId} />)}
            </div>
          </div>
        )}
      </section>

      <CampaignAnalytics orders={approvedPaidOrders} />
      <SalesHistory orders={visibleOrders} actionBusy={actionBusy} approveOrder={approveOrder} denyOrder={denyOrder} />
    </div>
  );
}

function AdCodePanel({ listing }) {
  return (
    <div className="border border-acid bg-acid/5 p-4" data-testid={`ad-code-panel-${listing.id}`}>
      <div className="text-[10px] uppercase tracking-[0.25em] text-acid font-bold mb-2">Choose slot size</div>
      <h3 className="font-display font-black uppercase text-xl tracking-tight mb-2">{listing.website_name}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">Choose the ad size you want on your website. Copy that code and paste it exactly where that size should appear. You only install each slot once.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {AD_SIZES.map((size) => {
          const code = getEmbedCode(listing, size);
          return <div key={size} className="border border-border bg-black p-3"><div className="flex items-center justify-between gap-3 mb-2"><div className="font-mono text-sm text-acid">{size}</div><button onClick={() => copyText(code, `${size} ad code copied`)} className="inline-flex items-center gap-1 border border-acid text-acid px-2 py-1 text-[10px] uppercase tracking-[0.2em] hover:bg-acid hover:text-black" data-testid={`copy-ad-code-${listing.id}-${size}`}><Copy size={10}/> Copy</button></div><code className="block text-[10px] leading-relaxed font-mono text-muted-foreground break-all">{code}</code></div>;
        })}
      </div>
    </div>
  );
}

function CampaignAnalytics({ orders }) {
  if (orders.length === 0) return null;
  const sorted = [...orders].sort((a, b) => Number(b.impression_count || 0) - Number(a.impression_count || 0));
  return (
    <section className="mb-8" data-testid="campaign-analytics-section">
      <h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight mb-4">Campaign Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.slice(0, 4).map((order) => {
          const views = Number(order.impression_count || 0);
          const clicks = Number(order.click_count || 0);
          return (
            <div key={order.id} className="border border-border bg-card p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{order.website_name}</div>
              <div className="grid grid-cols-3 gap-px bg-border border border-border">
                <MiniStat label="Views" value={views.toLocaleString()} />
                <MiniStat label="Clicks" value={clicks.toLocaleString()} />
                <MiniStat label="CTR" value={ctrPercent(views, clicks)} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">CTR means click-through rate: clicks divided by views.</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PendingReviewCard({ order, actionBusy, approveOrder, denyOrder }) {
  const creatives = Array.isArray(order.creatives) ? order.creatives : [];
  return (
    <div className="border border-gold bg-card p-5" data-testid={`pending-review-${order.id}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-border pb-4 mb-4">
        <div><div className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Paid · awaiting your approval</div><h3 className="font-display font-black uppercase text-2xl tracking-tight">{order.website_name}</h3><p className="text-sm text-muted-foreground mt-2">Advertiser: <span className="text-foreground">{order.advertiser_name || 'Advertiser'}</span></p><p className="text-sm text-muted-foreground break-all">Email: <span className="text-foreground">{order.advertiser_email}</span></p>{order.destination_url && <p className="text-sm text-muted-foreground break-all mt-2">Destination: <a href={order.destination_url} target="_blank" rel="noreferrer" className="text-primary hover:text-acid">{order.destination_url}</a></p>}</div>
        <div className="lg:text-right"><div className="font-mono text-xl">${Number(order.price_paid || 0).toFixed(2)}</div><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Seller earns ${Number(order.seller_earnings || 0).toFixed(2)}</div></div>
      </div>
      {order.advertiser_notes && <div className="border border-border bg-background p-4 mb-4"><div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Advertiser notes</div><p className="text-sm whitespace-pre-wrap">{order.advertiser_notes}</p></div>}
      <div className="mb-4"><div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Submitted banner previews</div>{creatives.length === 0 ? <div className="border border-primary text-primary p-4 text-sm">No creative previews found for this order.</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{creatives.map((creative) => <CreativePreview key={creative.id} creative={creative} />)}</div>}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><button onClick={() => approveOrder(order)} disabled={Boolean(actionBusy)} className="border border-acid text-acid py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black disabled:opacity-60">{actionBusy === `approve-${order.id}` ? 'Approving...' : 'Approve Ad'}</button><button onClick={() => denyOrder(order)} disabled={Boolean(actionBusy)} className="border border-primary text-primary py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-primary hover:text-primary-foreground disabled:opacity-60">{actionBusy === `deny-${order.id}` ? 'Denying...' : 'Deny + Refund'}</button></div>
    </div>
  );
}

function CreativePreview({ creative }) {
  return <div className="border border-border bg-background p-3"><div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{creative.banner_size}</div><div className="bg-black border border-border p-2 overflow-auto"><img src={creative.image_url} alt={`${creative.banner_size} ad creative`} className="max-w-full h-auto" /></div></div>;
}

function ListingCard({ listing, toggleStatus, openCodeListingId, setOpenCodeListingId }) {
  const open = openCodeListingId === listing.id;
  return (
    <div className="bg-card p-4" data-testid={`owner-listing-card-${listing.id}`}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link to={`/listings/${listing.id}`} className="block font-display font-black uppercase text-xl tracking-tight hover:text-primary truncate">{listing.website_name}</Link><div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{listing.category || 'Uncategorized'}</div></div><StatusBadge status={listing.status} /></div>
      <div className="mt-5 grid grid-cols-2 gap-px bg-border border border-border"><MiniStat label="Price" value={`$${Number(listing.monthly_price || 0).toLocaleString()}`} /><MiniStat label="Status" value={listing.status} /></div>
      <div className="mt-4 grid grid-cols-1 gap-2">{listing.status !== 'sold' && <button onClick={() => setOpenCodeListingId(open ? '' : listing.id)} className="w-full inline-flex items-center justify-center gap-2 border border-acid text-acid px-3 py-3 text-[10px] uppercase tracking-[0.25em] hover:bg-acid hover:text-black"><Code2 size={12}/> Ad Code</button>}{listing.status !== 'sold' && <button onClick={() => toggleStatus(listing)} className="w-full inline-flex items-center justify-center gap-2 border border-border px-3 py-3 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary">{listing.status === 'active' ? <><Pause size={12}/> Pause Listing</> : <><Play size={12}/> Activate Listing</>}</button>}<Link to={`/listings/${listing.id}/edit`} className="w-full inline-flex items-center justify-center gap-2 border border-border px-3 py-3 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary"><Edit3 size={12}/> Edit Listing</Link></div>
      {listing.status !== 'sold' && open && <div className="mt-4"><AdCodePanel listing={listing} /></div>}
    </div>
  );
}

function SalesHistory({ orders, actionBusy, approveOrder, denyOrder }) {
  if (orders.length === 0) return null;
  return (
    <section><h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight mt-10 mb-4">Sales History</h2><div className="border border-border bg-card overflow-x-auto" data-testid="owner-sales-table"><table className="w-full text-sm min-w-[1100px]"><thead className="border-b border-border bg-secondary"><tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground"><th className="text-left p-3">Date</th><th className="text-left p-3">Listing</th><th className="text-left p-3">Advertiser</th><th className="text-right p-3">Paid</th><th className="text-right p-3">You Earn</th><th className="text-right p-3">Views</th><th className="text-right p-3">Clicks</th><th className="text-right p-3">CTR</th><th className="text-left p-3">Payment</th><th className="text-left p-3">Approval</th><th className="text-left p-3">Payout</th><th className="text-right p-3">Actions</th></tr></thead><tbody>{orders.map((order) => { const views = Number(order.impression_count || 0); const clicks = Number(order.click_count || 0); return <tr key={order.id} className="border-b border-border last:border-b-0"><td className="p-3 font-mono text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</td><td className="p-3">{order.website_name}</td><td className="p-3 text-muted-foreground">{order.advertiser_name}<br/><span className="text-xs">{order.advertiser_email}</span></td><td className="p-3 text-right font-mono">${Number(order.price_paid || 0).toFixed(2)}</td><td className="p-3 text-right font-mono text-acid">${Number(order.seller_earnings || 0).toFixed(2)}</td><td className="p-3 text-right font-mono">{views.toLocaleString()}</td><td className="p-3 text-right font-mono">{clicks.toLocaleString()}</td><td className="p-3 text-right font-mono">{ctrPercent(views, clicks)}</td><td className="p-3"><StatusText value={order.payment_status} /></td><td className="p-3"><StatusText value={order.approval_status || 'awaiting_payment'} /></td><td className="p-3"><PayoutStatus order={order} /></td><td className="p-3 text-right">{order.payment_status === 'paid' && ['pending', 'awaiting_approval'].includes(order.approval_status) ? <div className="flex justify-end gap-2"><button onClick={() => approveOrder(order)} disabled={Boolean(actionBusy)} className="border border-acid text-acid px-2 py-1 text-[10px] uppercase tracking-[0.2em] disabled:opacity-60">Approve</button><button onClick={() => denyOrder(order)} disabled={Boolean(actionBusy)} className="border border-primary text-primary px-2 py-1 text-[10px] uppercase tracking-[0.2em] disabled:opacity-60">Deny</button></div> : <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">—</span>}</td></tr>; })}</tbody></table></div></section>
  );
}

function PayoutStatus({ order }) {
  const status = order.seller_payout_status || 'not_started';
  const earnings = Number(order.seller_earnings || 0);
  if (order.payment_status !== 'paid' || order.approval_status !== 'approved') return <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">● Not due</span>;
  if (status === 'paid') return <span className="text-[10px] uppercase tracking-[0.2em] text-acid font-bold">● Seller paid</span>;
  if (status === 'failed') return <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">● Failed</span>;
  if (status === 'skipped' || earnings <= 0) return <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">● Skipped $0</span>;
  return <span className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold">● Processing</span>;
}

function StatusText({ value }) {
  const color = value === 'approved' || value === 'paid' ? 'text-acid' : value === 'denied' || value === 'refunded' ? 'text-primary' : value === 'pending' ? 'text-gold' : 'text-muted-foreground';
  return <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${color}`}>● {value}</span>;
}

function StatusBadge({ status }) {
  return <span className={`shrink-0 text-[10px] uppercase tracking-[0.2em] font-bold ${status === 'active' ? 'text-acid' : status === 'paused' ? 'text-gold' : 'text-muted-foreground'}`}>● {status}</span>;
}

function MiniStat({ label, value }) {
  return <div className="bg-background p-3"><div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm uppercase">{value}</div></div>;
}

function Stat({ label, value, highlight }) {
  return <div className="bg-background p-4 sm:p-5"><div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-muted-foreground">{label}</div><div className={`font-display font-black text-xl sm:text-3xl mt-2 ${highlight ? 'text-acid' : 'text-foreground'}`}>{value}</div></div>;
}
