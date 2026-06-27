import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { Activity, BadgeDollarSign, CheckCircle2, Clock, Globe2, Megaphone, RefreshCw, ShieldAlert, Trophy, Users } from 'lucide-react';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function number(value) {
  return Number(value || 0).toLocaleString();
}

function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function ctr(views, clicks) {
  const v = Number(views || 0);
  const c = Number(clicks || 0);
  return v ? `${((c / v) * 100).toFixed(2)}%` : '0.00%';
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadStats = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/stats');
      setData(res.data);
      if (silent) toast.success('Admin dashboard refreshed');
    } catch (err) {
      const message = err.response?.data?.error || 'Unable to load admin stats';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const stats = data?.stats || {};
  const recentOrders = data?.recent_orders || [];
  const recentUsers = data?.recent_users || [];
  const installStatus = data?.install_status || [];
  const pendingReviews = data?.pending_reviews || [];
  const activeCampaigns = data?.active_campaigns || [];
  const founderStatus = data?.founder_status || {};

  const softLaunchScore = useMemo(() => {
    const checks = [
      Number(stats.website_owners || 0) >= 5,
      Number(stats.active_listings || 0) >= 5,
      Number(stats.verified_listings || 0) >= 1,
      Number(stats.advertisers || 0) >= 1,
      Number(stats.pending_approval_orders || 0) === 0,
      Number(stats.stripe_connected_owners || 0) >= 1,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [stats]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-6 py-12"><div className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-12">Loading admin dashboard…</div></div>;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="border border-border p-8 bg-card">
          <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-2">[ Admin / Access ]</div>
          <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-4">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mb-2">Signed in as {user?.email}</p>
          <p className="text-sm text-primary">{error}</p>
          <p className="text-xs text-muted-foreground mt-4">Make sure your backend Render env has ADMIN_EMAILS set to your email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12" data-testid="admin-dashboard">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-2">[ Admin / Soft Launch ]</div>
          <h1 className="font-display font-black uppercase text-3xl sm:text-5xl tracking-tight">BadAdz Control Center</h1>
          <p className="text-sm text-muted-foreground mt-2">Platform overview for {user?.email}</p>
        </div>
        <button onClick={() => loadStats({ silent: true })} disabled={refreshing} className="inline-flex items-center justify-center gap-2 border border-primary text-primary px-5 py-3 text-xs uppercase tracking-[0.28em] font-bold hover:bg-primary hover:text-primary-foreground disabled:opacity-60">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/> Refresh
        </button>
      </div>

      <section className="border border-primary bg-primary/10 p-5 sm:p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-primary font-bold mb-2"><Megaphone size={14}/> Soft Launch Command Status</div>
            <h2 className="font-display font-black uppercase text-3xl tracking-tight">{softLaunchScore}% launch-ready.</h2>
            <p className="text-sm text-muted-foreground mt-2">Target: 25 website owners, 10 advertisers, verified ad slots, first paid campaigns, and smooth approvals.</p>
          </div>
          <div className="border border-border bg-background p-4 text-center min-w-[190px]"><div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Founder Spots</div><div className="font-display font-black text-5xl text-primary mt-1">{founderStatus.remaining ?? stats.founding_seller_spots_remaining ?? 0}</div><div className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1">remaining</div></div>
        </div>
        <div className="h-3 border border-border bg-background overflow-hidden"><div className="h-full bg-primary" style={{ width: `${softLaunchScore}%` }} /></div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-8">
        <Stat icon={Users} label="Users" value={number(stats.total_users)} />
        <Stat icon={Globe2} label="Owners" value={number(stats.website_owners)} />
        <Stat icon={Activity} label="Advertisers" value={number(stats.advertisers)} />
        <Stat icon={Trophy} label="Founders" value={`${number(stats.founding_sellers)}/50`} highlight />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-8">
        <Stat icon={Globe2} label="Listings" value={number(stats.total_listings)} />
        <Stat icon={CheckCircle2} label="Verified Slots" value={number(stats.verified_listings)} highlight />
        <Stat icon={ShieldAlert} label="Pending Reviews" value={number(stats.pending_approval_orders)} />
        <Stat icon={Activity} label="Active Campaigns" value={number(stats.active_campaigns)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-10">
        <Stat icon={BadgeDollarSign} label="Gross Sales" value={money(stats.gross_sales)} />
        <Stat icon={BadgeDollarSign} label="Platform Revenue" value={money(stats.platform_revenue)} highlight />
        <Stat icon={BadgeDollarSign} label="Seller Earnings" value={money(stats.seller_earnings)} />
        <Stat icon={Activity} label="CTR" value={ctr(stats.impressions, stats.clicks)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
        <Panel title="Pending Ad Reviews" subtitle="Paid campaigns waiting on website-owner approval.">
          {pendingReviews.length === 0 ? <Empty text="No pending ad approvals." /> : <SimpleList items={pendingReviews.map((item) => ({ title: item.website_name, meta: `${money(item.price_paid)} · ${item.advertiser_email}`, detail: item.destination_url || item.website_url }))} />}
        </Panel>
        <Panel title="Active Campaigns" subtitle="Approved campaigns currently running.">
          {activeCampaigns.length === 0 ? <Empty text="No active campaigns yet." /> : <SimpleList items={activeCampaigns.map((item) => ({ title: item.website_name, meta: `${number(item.impression_count)} views · ${number(item.click_count)} clicks · ${ctr(item.impression_count, item.click_count)} CTR`, detail: `${dateTime(item.campaign_starts_at)} → ${dateTime(item.campaign_ends_at)}` }))} />}
        </Panel>
      </div>

      <Panel title="Installation Verification" subtitle="Shows whether owner ad scripts have loaded from their websites.">
        {installStatus.length === 0 ? <Empty text="No listings yet." /> : (
          <div className="border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="border-b border-border bg-secondary"><tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground"><th className="text-left p-3">Website</th><th className="text-left p-3">Owner</th><th className="text-left p-3">Verified</th><th className="text-left p-3">Last Seen</th><th className="text-left p-3">Domain</th><th className="text-left p-3">Page</th></tr></thead>
              <tbody>{installStatus.map((item) => <tr key={item.id} className="border-b border-border last:border-b-0"><td className="p-3"><a href={item.website_url} target="_blank" rel="noreferrer" className="hover:text-primary">{item.website_name}</a></td><td className="p-3 text-muted-foreground">{item.owner_email}</td><td className="p-3"><Status good={item.ad_code_verified} yes="Verified" no="Not verified" /></td><td className="p-3 font-mono text-xs text-muted-foreground">{dateTime(item.ad_code_last_seen_at)}</td><td className="p-3 text-muted-foreground">{item.ad_code_last_seen_domain || '—'}</td><td className="p-3 text-muted-foreground truncate max-w-[260px]">{item.ad_code_last_seen_url || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-10">
        <Panel title="Recent Users" subtitle="Newest signups.">
          {recentUsers.length === 0 ? <Empty text="No users yet." /> : <SimpleList items={recentUsers.map((item) => ({ title: `${item.name || 'User'} · ${item.role}`, meta: item.email, detail: `${item.founding_member ? 'Founder · ' : ''}${item.commission_rate || 20}% fee · ${item.stripe_connect_onboarding_complete ? 'Stripe connected' : 'Stripe not connected'} · ${dateTime(item.created_at)}` }))} />}
        </Panel>
        <Panel title="Recent Orders" subtitle="Newest checkout/order activity.">
          {recentOrders.length === 0 ? <Empty text="No orders yet." /> : <SimpleList items={recentOrders.map((item) => ({ title: item.website_name, meta: `${money(item.price_paid)} · ${item.payment_status}/${item.approval_status || 'awaiting'}`, detail: `${item.advertiser_email} → ${item.owner_email}` }))} />}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return <section><div className="mb-4"><h2 className="font-display font-black uppercase text-2xl tracking-tight">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}</div>{children}</section>;
}

function Empty({ text }) {
  return <div className="border border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function SimpleList({ items }) {
  return <div className="border border-border bg-card divide-y divide-border">{items.map((item, index) => <div key={`${item.title}-${index}`} className="p-4"><div className="font-display font-black uppercase tracking-tight">{item.title}</div><div className="text-xs text-muted-foreground mt-1 break-all">{item.meta}</div>{item.detail && <div className="text-xs text-muted-foreground mt-2 break-all">{item.detail}</div>}</div>)}</div>;
}

function Status({ good, yes, no }) {
  return <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${good ? 'text-acid' : 'text-gold'}`}>● {good ? yes : no}</span>;
}

function Stat({ icon: Icon, label, value, highlight }) {
  return (
    <div className="bg-background p-5">
      <div className="flex items-center justify-between gap-3"><div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>{Icon && <Icon size={16} className={highlight ? 'text-primary' : 'text-muted-foreground'} />}</div>
      <div className={`font-display font-black text-2xl sm:text-3xl mt-2 ${highlight ? 'text-acid' : 'text-foreground'}`}>{value ?? 0}</div>
    </div>
  );
}
