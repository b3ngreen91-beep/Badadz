import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { ExternalLink } from 'lucide-react';

function getCampaignStatus(order) {
  const payment = order.payment_status;
  const approval = order.approval_status;
  const now = new Date();
  const end = order.campaign_ends_at ? new Date(order.campaign_ends_at) : null;

  if (payment === 'refunded' || approval === 'denied') return { label: 'Refunded / Denied', tone: 'text-primary border-primary bg-primary/10', help: 'The website owner denied this ad request and the payment was refunded or marked for refund.', archiveable: true };
  if (payment === 'pending' || approval === 'awaiting_payment') return { label: 'Awaiting Payment', tone: 'text-gold border-gold bg-gold/10', help: 'Checkout has not been completed yet.', archiveable: true };
  if (payment === 'paid' && ['pending', 'awaiting_approval'].includes(approval)) return { label: 'Pending Owner Review', tone: 'text-gold border-gold bg-gold/10', help: 'Your payment went through. The website owner is reviewing your submitted ad creative.', archiveable: false };
  if (payment === 'paid' && approval === 'approved' && end && end <= now) return { label: 'Completed', tone: 'text-muted-foreground border-border bg-background', help: 'This campaign period has ended.', archiveable: true };
  if (payment === 'paid' && approval === 'approved') return { label: 'Approved / Live', tone: 'text-acid border-acid bg-acid/10', help: 'The website owner approved this ad. Your campaign is active or ready to run.', archiveable: false };
  return { label: `${payment || 'unknown'} / ${approval || 'unknown'}`, tone: 'text-muted-foreground border-border bg-background', help: 'Campaign status is updating.', archiveable: true };
}

function archiveStorageKey(userId) {
  return `badadz_archived_campaigns_${userId || 'guest'}`;
}

function ctr(order) {
  const views = Number(order.impression_count || 0);
  const clicks = Number(order.click_count || 0);
  return views > 0 ? `${((clicks / views) * 100).toFixed(2)}%` : '0.00%';
}

function totalCtr(orders) {
  const views = orders.reduce((sum, o) => sum + Number(o.impression_count || 0), 0);
  const clicks = orders.reduce((sum, o) => sum + Number(o.click_count || 0), 0);
  return views > 0 ? `${((clicks / views) * 100).toFixed(2)}%` : '0.00%';
}

export default function AdvertiserDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedIds, setArchivedIds] = useState([]);

  useEffect(() => {
    api.get('/orders/my').then(({ data }) => setOrders(data.orders || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(archiveStorageKey(user?.id));
      setArchivedIds(raw ? JSON.parse(raw) : []);
    } catch {
      setArchivedIds([]);
    }
  }, [user?.id]);

  const saveArchivedIds = (nextIds) => {
    setArchivedIds(nextIds);
    localStorage.setItem(archiveStorageKey(user?.id), JSON.stringify(nextIds));
  };

  const archiveCampaign = (orderId) => saveArchivedIds(Array.from(new Set([...archivedIds, orderId])));
  const restoreCampaign = (orderId) => saveArchivedIds(archivedIds.filter((id) => id !== orderId));
  const visibleOrders = showArchived ? orders : orders.filter((o) => !archivedIds.includes(o.id));
  const archivedCount = orders.filter((o) => archivedIds.includes(o.id)).length;
  const activeCount = visibleOrders.filter((o) => getCampaignStatus(o).label === 'Approved / Live').length;
  const pendingCount = visibleOrders.filter((o) => getCampaignStatus(o).label === 'Pending Owner Review').length;
  const paidOrders = visibleOrders.filter((o) => o.payment_status === 'paid' || o.payment_status === 'refunded');
  const totalSpend = paidOrders.reduce((s, o) => s + Number(o.price_paid || 0), 0);
  const totalViews = paidOrders.reduce((s, o) => s + Number(o.impression_count || 0), 0);
  const totalClicks = paidOrders.reduce((s, o) => s + Number(o.click_count || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="advertiser-dashboard">
      <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-2">[ Advertiser / Dashboard ]</div>
      <h1 className="font-display font-black uppercase text-3xl sm:text-4xl tracking-tight mb-8">Hey, {user?.name}.</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-4" data-testid="advertiser-stats">
        <Stat label="Visible Campaigns" value={visibleOrders.length} />
        <Stat label="Pending Review" value={pendingCount} />
        <Stat label="Active" value={activeCount} />
        <Stat label="Lifetime Spend" value={`$${totalSpend.toFixed(2)}`} highlight />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-8" data-testid="advertiser-analytics-stats">
        <Stat label="Views" value={totalViews.toLocaleString()} highlight />
        <Stat label="Clicks" value={totalClicks.toLocaleString()} />
        <Stat label="CTR" value={totalCtr(paidOrders)} />
        <Stat label="Archived" value={archivedCount} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-black uppercase text-xl tracking-tight">My Campaigns</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Views count when your approved banner loads. Clicks count when someone clicks your banner before BadAdz sends them to your destination URL.</p>
        </div>
        {archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="border border-border px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary" data-testid="toggle-archived-campaigns">
            {showArchived ? 'Hide Archived' : `Show Archived (${archivedCount})`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-12">Loading...</div>
      ) : visibleOrders.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">{orders.length > 0 ? 'No visible campaigns. Show archived campaigns to view hidden records.' : 'No campaigns yet.'}</p>
          <Link to="/" className="text-primary text-xs uppercase tracking-[0.3em]" data-testid="advertiser-browse-link">Browse the marketplace →</Link>
        </div>
      ) : (
        <div className="space-y-4" data-testid="advertiser-orders-list">
          {visibleOrders.map((o) => {
            const status = getCampaignStatus(o);
            const creatives = Array.isArray(o.creatives) ? o.creatives : [];
            const isArchived = archivedIds.includes(o.id);
            const views = Number(o.impression_count || 0);
            const clicks = Number(o.click_count || 0);

            return (
              <div key={o.id} className={`border bg-card p-5 ${isArchived ? 'border-primary/50 opacity-80' : 'border-border'}`}>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-border pb-4 mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{new Date(o.created_at).toLocaleDateString()} · {o.category || 'General'} {isArchived ? '· Archived' : ''}</div>
                    <h3 className="font-display font-black uppercase text-xl tracking-tight">{o.website_name}</h3>
                    <a href={o.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-acid mt-2">Visit website <ExternalLink size={12}/></a>
                  </div>

                  <div className="md:text-right">
                    <div className="font-mono text-lg">${Number(o.price_paid || 0).toFixed(2)}</div>
                    <span className={`inline-block mt-2 border px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-bold ${status.tone}`}>● {status.label}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-px bg-border border border-border mb-4" data-testid={`campaign-analytics-${o.id}`}>
                  <MiniStat label="Views" value={views.toLocaleString()} />
                  <MiniStat label="Clicks" value={clicks.toLocaleString()} />
                  <MiniStat label="CTR" value={ctr(o)} />
                </div>

                <div className="border border-border bg-black p-4 mb-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Status</div>
                  <p className="text-sm text-muted-foreground">{status.help}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-border bg-black p-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Campaign Period</div>
                    <div className="font-mono text-sm">{o.campaign_starts_at ? `${new Date(o.campaign_starts_at).toLocaleDateString()} → ${new Date(o.campaign_ends_at).toLocaleDateString()}` : 'Not started yet'}</div>
                  </div>

                  <div className="border border-primary/40 bg-primary/10 p-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Website Owner</div>
                    <div className="text-sm text-foreground mb-1">{o.owner_name || 'Website owner'}</div>
                    {o.owner_email ? <div className="font-mono text-sm text-primary break-all">{o.owner_email}</div> : <div className="text-sm text-muted-foreground">Owner contact unavailable.</div>}
                  </div>
                </div>

                {o.destination_url && (
                  <div className="mt-4 border border-border bg-black p-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Destination URL</div>
                    <div className="text-sm text-primary break-all">{o.destination_url}</div>
                  </div>
                )}

                {creatives.length > 0 && (
                  <div className="mt-4 border border-border bg-black p-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Submitted Creatives</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {creatives.map((creative) => (
                        <div key={creative.id} className="border border-border bg-background p-3">
                          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{creative.banner_size}</div>
                          <div className="bg-black border border-border p-2 overflow-auto"><img src={creative.image_url} alt={`${creative.banner_size} creative`} className="max-w-full h-auto" /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 border border-border bg-black p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Next Steps</div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    {status.label === 'Pending Owner Review' ? <><li>Wait for the website owner to approve or deny your ad.</li><li>If denied, your payment will be refunded automatically when possible.</li></> : status.label === 'Approved / Live' ? <><li>Your ad was approved and can now display wherever the owner installed their BadAdz ad code.</li><li>Watch views, clicks, and CTR here as your campaign runs.</li></> : status.label === 'Refunded / Denied' ? <li>This ad request was denied and refunded. You can browse the marketplace and submit a different ad.</li> : <li>Watch this campaign status for updates.</li>}
                  </ul>
                </div>

                {status.archiveable && (
                  <div className="mt-4 flex justify-end">
                    {isArchived ? <button type="button" onClick={() => restoreCampaign(o.id)} className="border border-acid text-acid px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:bg-acid hover:text-black" data-testid={`restore-campaign-${o.id}`}>Restore Campaign</button> : <button type="button" onClick={() => archiveCampaign(o.id)} className="border border-border px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:border-primary hover:text-primary" data-testid={`archive-campaign-${o.id}`}>Archive Campaign</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return <div className="bg-background p-3"><div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm uppercase">{value}</div></div>;
}

function Stat({ label, value, highlight }) {
  return <div className="bg-background p-5"><div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div><div className={`font-display font-black text-3xl mt-2 ${highlight ? 'text-acid' : 'text-foreground'}`}>{value}</div></div>;
}
