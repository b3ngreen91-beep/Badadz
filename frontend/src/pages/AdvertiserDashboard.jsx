import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { ExternalLink } from 'lucide-react';

export default function AdvertiserDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders/my')
      .then(({ data }) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = orders.filter(o => o.payment_status === 'paid' && (!o.campaign_ends_at || new Date(o.campaign_ends_at) > new Date())).length;
  const totalSpend = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + Number(o.price_paid), 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="advertiser-dashboard">
      <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-2">[ Advertiser / Dashboard ]</div>
      <h1 className="font-display font-black uppercase text-3xl sm:text-4xl tracking-tight mb-8">Hey, {user?.name}.</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border border border-border mb-12" data-testid="advertiser-stats">
        <Stat label="Total Campaigns" value={orders.length} />
        <Stat label="Active" value={activeCount} />
        <Stat label="Lifetime Spend" value={`$${totalSpend.toFixed(2)}`} highlight />
      </div>

      <h2 className="font-display font-black uppercase text-xl tracking-tight mb-4">My Campaigns</h2>

      {loading ? (
        <div className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-12">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">No campaigns yet.</p>
          <Link to="/" className="text-primary text-xs uppercase tracking-[0.3em]" data-testid="advertiser-browse-link">Browse the marketplace →</Link>
        </div>
      ) : (
        <div className="space-y-4" data-testid="advertiser-orders-list">
          {orders.map((o) => (
            <div key={o.id} className="border border-border bg-card p-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-border pb-4 mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
                    {new Date(o.created_at).toLocaleDateString()} · {o.category || 'General'}
                  </div>
                  <h3 className="font-display font-black uppercase text-xl tracking-tight">
                    {o.website_name}
                  </h3>
                  <a href={o.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-acid mt-2">
                    Visit website <ExternalLink size={12}/>
                  </a>
                </div>

                <div className="md:text-right">
                  <div className="font-mono text-lg">${Number(o.price_paid).toFixed(2)}</div>
                  <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${o.payment_status==='paid'?'text-acid':o.payment_status==='pending'?'text-gold':'text-muted-foreground'}`}>
                    ● {o.payment_status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border bg-black p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Campaign Period</div>
                  <div className="font-mono text-sm">
                    {o.campaign_starts_at ? `${new Date(o.campaign_starts_at).toLocaleDateString()} → ${new Date(o.campaign_ends_at).toLocaleDateString()}` : 'Not started yet'}
                  </div>
                </div>

                <div className="border border-primary/40 bg-primary/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Website Owner</div>
                  <div className="text-sm text-foreground mb-1">{o.owner_name || 'Website owner'}</div>
                  {o.owner_email ? (
                    <>
                      <div className="font-mono text-sm text-primary break-all mb-3">{o.owner_email}</div>
                      <a href={`mailto:${o.owner_email}`} className="inline-block bg-primary text-primary-foreground px-4 py-2 text-[10px] uppercase tracking-[0.25em] font-bold hover:bg-acid hover:text-black transition-colors">
                        Contact Owner
                      </a>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Owner contact unavailable.</div>
                  )}
                </div>
              </div>

              <div className="mt-4 border border-border bg-black p-4">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Next Steps</div>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                  <li>Send your banner image or ad creative to the website owner.</li>
                  <li>Send the destination URL for your ad click.</li>
                  <li>Confirm when the ad goes live and keep it running for the 30-day campaign.</li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="bg-background p-5">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`font-display font-black text-3xl mt-2 ${highlight ? 'text-acid' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
