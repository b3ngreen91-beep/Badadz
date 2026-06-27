import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { BarChart3, Code2, CreditCard, Edit3, Pause, Play, Plus, ShieldCheck, Trophy } from 'lucide-react';
import AdInstallWizard from '../components/AdInstallWizard';

function isTestOrder(order) {
  return Number(order.price_paid || 0) <= 0;
}

function isLiveOrder(order) {
  return order.payment_status === 'paid' && order.approval_status === 'approved' && (!order.campaign_ends_at || new Date(order.campaign_ends_at) > new Date());
}

function ctrPercent(views, clicks) {
  const v = Number(views || 0);
  const c = Number(clicks || 0);
  return v ? `${((c / v) * 100).toFixed(2)}%` : '0.00%';
}

function hasLiveCampaign(listing, approvedOrders) {
  return approvedOrders.some((order) => order.listing_id === listing.id && isLiveOrder(order));
}

function canShowAdCode(listing, approvedOrders) {
  if (listing.status === 'active' || listing.status === 'paused') return true;
  return listing.status === 'sold' && hasLiveCampaign(listing, approvedOrders);
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [salesData, setSalesData] = useState({ orders: [], stats: {} });
  const [connectStatus, setConnectStatus] = useState({ onboarding_complete: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [openCodeListingId, setOpenCodeListingId] = useState('');
  const [showSoldListings, setShowSoldListings] = useState(true);

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
      if (salesResult.status === 'fulfilled') setSalesData(salesResult.value.data || { orders: [], stats: {} });
      if (connectResult.status === 'fulfilled') setConnectStatus(connectResult.value.data || { onboarding_complete: false });
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
  const launchOrders = allOrders.filter((o) => !isTestOrder(o));
  const approvedOrders = allOrders.filter((o) => o.payment_status === 'paid' && o.approval_status === 'approved');
  const approvedLaunchOrders = launchOrders.filter((o) => o.payment_status === 'paid' && o.approval_status === 'approved');
  const pendingOrders = allOrders.filter((o) => o.payment_status === 'paid' && ['pending', 'awaiting_approval'].includes(o.approval_status));
  const visibleListings = showSoldListings ? listings : listings.filter((l) => l.status !== 'sold');
  const soldCount = listings.filter((l) => l.status === 'sold').length;
  const activeCount = listings.filter((l) => l.status === 'active').length;
  const verifiedCount = listings.filter((l) => l.ad_code_verified).length;
  const needsInstallCount = listings.filter((l) => canShowAdCode(l, approvedOrders) && !l.ad_code_verified).length;

  const totalSales = approvedLaunchOrders.reduce((sum, o) => sum + Number(o.price_paid || 0), 0);
  const totalEarnings = approvedLaunchOrders.reduce((sum, o) => sum + Number(o.seller_earnings || 0), 0);
  const views = approvedLaunchOrders.reduce((sum, o) => sum + Number(o.impression_count || 0), 0);
  const clicks = approvedLaunchOrders.reduce((sum, o) => sum + Number(o.click_count || 0), 0);
  const activeCampaigns = approvedLaunchOrders.filter(isLiveOrder).length;
  const stripeConnected = Boolean(connectStatus?.onboarding_complete);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8" data-testid="owner-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.35em] text-primary mb-2">Owner Command Center</div>
          <h1 className="font-display font-black uppercase text-3xl sm:text-5xl tracking-tight">Hey, {user?.name}.</h1>
          <p className="text-sm text-muted-foreground mt-2">Manage listings, install ad slots, approve campaigns, and track earnings.</p>
        </div>
        {stripeConnected ? (
          <Link to="/listings/new" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors">
            <Plus size={14}/> New Listing
          </Link>
        ) : (
          <button onClick={startStripeConnect} disabled={connecting} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold disabled:opacity-60">
            <CreditCard size={14}/> {connecting ? 'Connecting...' : 'Connect Stripe'}
          </button>
        )}
      </div>

      {user?.founding_member && (
        <section className="border border-gold bg-gold/10 p-5 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4" data-testid="founder-dashboard-card">
          <div className="flex items-start gap-3">
            <Trophy className="text-gold shrink-0" size={28}/>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold font-bold">Founding Seller</div>
              <h2 className="font-display font-black uppercase text-2xl tracking-tight mt-1">15% lifetime platform fee locked in.</h2>
              <p className="text-sm text-muted-foreground mt-2">You keep 85% of every sale forever on BadAdz.</p>
            </div>
          </div>
          <div className="border border-gold px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your Rate</div>
            <div className="font-display font-black text-3xl text-gold">15%</div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-5">
        <Stat label="Your Earnings" value={`$${totalEarnings.toFixed(2)}`} highlight />
        <Stat label="Needs Review" value={pendingOrders.length} />
        <Stat label="Active Campaigns" value={activeCampaigns} />
        <Stat label="Approved Sales" value={`$${totalSales.toFixed(2)}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-8">
        <Stat label="Views" value={views.toLocaleString()} highlight />
        <Stat label="Clicks" value={clicks.toLocaleString()} />
        <Stat label="CTR" value={ctrPercent(views, clicks)} />
        <Stat label="Verified Slots" value={`${verifiedCount}/${listings.length || 0}`} />
      </div>

      <LaunchReadiness stripeConnected={stripeConnected} activeCount={activeCount} needsInstallCount={needsInstallCount} pendingOrders={pendingOrders.length} />

      <section className="mb-8">
        <div className={`border p-5 sm:p-6 mb-4 ${pendingOrders.length > 0 ? 'border-gold bg-gold/10' : 'border-border bg-card'}`}>
          <div className={`text-[10px] uppercase tracking-[0.3em] font-bold mb-2 ${pendingOrders.length > 0 ? 'text-gold' : 'text-muted-foreground'}`}>Ad requests</div>
          <h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight">
            {pendingOrders.length > 0 ? `${pendingOrders.length} ad request${pendingOrders.length === 1 ? '' : 's'} waiting for review.` : 'No ad requests waiting.'}
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            {pendingOrders.length > 0 ? 'Review the banner previews and destination URL. Approved ads automatically appear anywhere your matching ad slot code is installed.' : 'Paid ad requests appear here first with banner previews and approve/deny buttons.'}
          </p>
        </div>
        {pendingOrders.length > 0 && <div className="space-y-4">{pendingOrders.map((order) => <PendingReviewCard key={order.id} order={order} actionBusy={actionBusy} approveOrder={approveOrder} denyOrder={denyOrder} />)}</div>}
      </section>

      <section className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight">My Listings</h2>
            <p className="text-xs text-muted-foreground mt-2">Open the install wizard, copy your code, and verify that your website is ready to show ads.</p>
          </div>
          <div className="flex items-center gap-3">
            {soldCount > 0 && <button onClick={() => setShowSoldListings((v) => !v)} className="text-muted-foreground text-[10px] uppercase tracking-[0.25em] font-bold hover:text-primary">{showSoldListings ? 'Hide Sold' : `Show Sold (${soldCount})`}</button>}
            {stripeConnected && <Link to="/listings/new" className="text-primary text-[10px] uppercase tracking-[0.25em] font-bold">Add Listing →</Link>}
          </div>
        </div>
        {loading ? <div className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-8">Loading...</div> : <ListingsTable listings={visibleListings} approvedOrders={approvedOrders} openCodeListingId={openCodeListingId} setOpenCodeListingId={setOpenCodeListingId} toggleStatus={toggleStatus} />}
      </section>

      <CampaignAnalytics orders={approvedLaunchOrders} />
      <SalesHistory orders={allOrders} actionBusy={actionBusy} approveOrder={approveOrder} denyOrder={denyOrder} />
    </div>
  );
}

function LaunchReadiness({ stripeConnected, activeCount, needsInstallCount, pendingOrders }) {
  const items = [
    { label: 'Stripe connected', ok: stripeConnected, help: 'Needed before receiving payouts.' },
    { label: 'Active listings', ok: activeCount > 0, help: 'Create at least one listing.' },
    { label: 'Ad slots verified', ok: needsInstallCount === 0, help: needsInstallCount ? `${needsInstallCount} listing${needsInstallCount === 1 ? '' : 's'} need code installed.` : 'Ready for automatic ad serving.' },
    { label: 'Ad requests reviewed', ok: pendingOrders === 0, help: pendingOrders ? `${pendingOrders} waiting for approval.` : 'No pending requests.' },
  ];

  return (
    <section className="border border-border bg-card p-5 sm:p-6 mb-8" data-testid="launch-readiness">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-3"><ShieldCheck size={14}/> Launch Readiness</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border">
        {items.map((item) => <div key={item.label} className="bg-background p-4"><div className={`text-[10px] uppercase tracking-[0.22em] font-bold ${item.ok ? 'text-acid' : 'text-gold'}`}>● {item.ok ? 'Ready' : 'Action'}</div><div className="font-display font-black uppercase tracking-tight mt-2">{item.label}</div><p className="text-xs text-muted-foreground mt-2 leading-relaxed">{item.help}</p></div>)}
      </div>
    </section>
  );
}

function ListingsTable({ listings, approvedOrders, openCodeListingId, setOpenCodeListingId, toggleStatus }) {
  if (!listings.length) return <div className="border border-border p-8 sm:p-10 text-center text-muted-foreground text-sm">No visible listings.</div>;
  return <div className="space-y-4" data-testid="owner-listings-table">{listings.map((listing) => <OwnerListingCard key={listing.id} listing={listing} approvedOrders={approvedOrders} open={openCodeListingId === listing.id} setOpenCodeListingId={setOpenCodeListingId} toggleStatus={toggleStatus} />)}</div>;
}

function OwnerListingCard({ listing, approvedOrders, open, setOpenCodeListingId, toggleStatus }) {
  const showCode = canShowAdCode(listing, approvedOrders);
  const live = hasLiveCampaign(listing, approvedOrders);
  return (
    <div className="border border-border bg-card overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StatusBadge status={listing.status} live={live} />
            {listing.ad_code_verified ? <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-acid">● slot connected</span> : <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold">● needs install</span>}
            {listing.owner_founding_member && <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold">🏆 founding seller</span>}
          </div>
          <Link to={`/listings/${listing.id}`} className="block font-display font-black uppercase text-2xl tracking-tight hover:text-primary truncate">{listing.website_name}</Link>
          <div className="mt-2 text-xs text-muted-foreground uppercase tracking-[0.22em]">{listing.category || 'Uncategorized'} · ${Number(listing.monthly_price || 0).toLocaleString()}/month</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:min-w-[520px]">
          {showCode && <button onClick={() => setOpenCodeListingId(open ? '' : listing.id)} className="inline-flex items-center justify-center gap-2 border border-acid text-acid px-3 py-3 text-[10px] uppercase tracking-[0.25em] hover:bg-acid hover:text-black"><Code2 size={12}/> {open ? 'Close Wizard' : 'Install Wizard'}</button>}
          {listing.status !== 'sold' && <button onClick={() => toggleStatus(listing)} className="inline-flex items-center justify-center gap-2 border border-border px-3 py-3 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary">{listing.status === 'active' ? <><Pause size={12}/> Pause</> : <><Play size={12}/> Activate</>}</button>}
          <Link to={`/listings/${listing.id}/edit`} className="inline-flex items-center justify-center gap-2 border border-border px-3 py-3 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary"><Edit3 size={12}/> Edit</Link>
        </div>
      </div>
      {showCode && open && <div className="p-4 sm:p-5 border-t border-border bg-background"><AdInstallWizard listing={listing} /></div>}
    </div>
  );
}

function CampaignAnalytics({ orders }) {
  if (!orders.length) return null;
  const sorted = [...orders].sort((a, b) => Number(b.impression_count || 0) - Number(a.impression_count || 0));
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4"><BarChart3 size={18} className="text-primary"/><h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight">Campaign Analytics</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.slice(0, 4).map((order) => {
          const v = Number(order.impression_count || 0);
          const c = Number(order.click_count || 0);
          return <div key={order.id} className="border border-border bg-card p-5"><div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{order.website_name}</div><div className="grid grid-cols-3 gap-px bg-border border border-border"><MiniStat label="Views" value={v.toLocaleString()} /><MiniStat label="Clicks" value={c.toLocaleString()} /><MiniStat label="CTR" value={ctrPercent(v, c)} /></div><p className="text-xs text-muted-foreground mt-3">CTR means click-through rate: clicks divided by views.</p></div>;
        })}
      </div>
    </section>
  );
}

function PendingReviewCard({ order, actionBusy, approveOrder, denyOrder }) {
  const creatives = Array.isArray(order.creatives) ? order.creatives : [];
  return (
    <div className="border border-gold bg-card p-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-border pb-4 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Paid · awaiting your approval</div>
          <h3 className="font-display font-black uppercase text-2xl tracking-tight">{order.website_name}</h3>
          <p className="text-sm text-muted-foreground mt-2">Advertiser: <span className="text-foreground">{order.advertiser_name || 'Advertiser'}</span></p>
          <p className="text-sm text-muted-foreground break-all">Email: <span className="text-foreground">{order.advertiser_email}</span></p>
          {order.destination_url && <p className="text-sm text-muted-foreground break-all mt-2">Destination: <a href={order.destination_url} target="_blank" rel="noreferrer" className="text-primary hover:text-acid">{order.destination_url}</a></p>}
        </div>
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

function SalesHistory({ orders, actionBusy, approveOrder, denyOrder }) {
  if (!orders.length) return <div className="border border-border p-8 sm:p-12 text-center text-sm text-muted-foreground">No sales yet.</div>;
  return (
    <section>
      <h2 className="font-display font-black uppercase text-2xl sm:text-3xl tracking-tight mt-10 mb-4">Sales History</h2>
      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead className="border-b border-border bg-secondary"><tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground"><th className="text-left p-3">Date</th><th className="text-left p-3">Listing</th><th className="text-left p-3">Advertiser</th><th className="text-right p-3">Paid</th><th className="text-right p-3">You Earn</th><th className="text-right p-3">Views</th><th className="text-right p-3">Clicks</th><th className="text-left p-3">Payment</th><th className="text-left p-3">Approval</th><th className="text-right p-3">Actions</th></tr></thead>
          <tbody>{orders.map((order) => { const v = Number(order.impression_count || 0); const c = Number(order.click_count || 0); return <tr key={order.id} className="border-b border-border last:border-b-0"><td className="p-3 font-mono text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</td><td className="p-3">{order.website_name}{isTestOrder(order) && <span className="ml-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">test</span>}</td><td className="p-3 text-muted-foreground">{order.advertiser_name}<br/><span className="text-xs">{order.advertiser_email}</span></td><td className="p-3 text-right font-mono">${Number(order.price_paid || 0).toFixed(2)}</td><td className="p-3 text-right font-mono text-acid">${Number(order.seller_earnings || 0).toFixed(2)}</td><td className="p-3 text-right font-mono">{v.toLocaleString()}</td><td className="p-3 text-right font-mono">{c.toLocaleString()}</td><td className="p-3"><StatusText value={order.payment_status} /></td><td className="p-3"><StatusText value={order.approval_status || 'awaiting_payment'} /></td><td className="p-3 text-right">{order.payment_status === 'paid' && ['pending', 'awaiting_approval'].includes(order.approval_status) ? <div className="flex justify-end gap-2"><button onClick={() => approveOrder(order)} disabled={Boolean(actionBusy)} className="border border-acid text-acid px-2 py-1 text-[10px] uppercase tracking-[0.2em] disabled:opacity-60">Approve</button><button onClick={() => denyOrder(order)} disabled={Boolean(actionBusy)} className="border border-primary text-primary px-2 py-1 text-[10px] uppercase tracking-[0.2em] disabled:opacity-60">Deny</button></div> : <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">—</span>}</td></tr>; })}</tbody>
        </table>
      </div>
    </section>
  );
}

function StatusText({ value }) {
  const color = value === 'approved' || value === 'paid' ? 'text-acid' : value === 'denied' || value === 'refunded' ? 'text-primary' : value === 'pending' ? 'text-gold' : 'text-muted-foreground';
  return <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${color}`}>● {value}</span>;
}

function StatusBadge({ status, live }) {
  if (status === 'sold' && live) return <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] font-bold text-acid">● campaign live</span>;
  return <span className={`shrink-0 text-[10px] uppercase tracking-[0.2em] font-bold ${status === 'active' ? 'text-acid' : status === 'paused' ? 'text-gold' : 'text-muted-foreground'}`}>● {status}</span>;
}

function MiniStat({ label, value }) {
  return <div className="bg-background p-3"><div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm uppercase">{value}</div></div>;
}

function Stat({ label, value, highlight }) {
  return <div className="bg-background p-4 sm:p-5"><div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-muted-foreground">{label}</div><div className={`font-display font-black text-xl sm:text-3xl mt-2 ${highlight ? 'text-acid' : 'text-foreground'}`}>{value}</div></div>;
}
