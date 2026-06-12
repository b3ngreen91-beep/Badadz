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
        <div className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-12">Loading…</div>
      ) : orders.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">No campaigns yet.</p>
          <Link to="/" className="text-primary text-xs uppercase tracking-[0.3em]" data-testid="advertiser-browse-link">Browse the marketplace →</Link>
        </div>
      ) : (
        <div className="border border-border bg-card overflow-x-auto" data-testid="advertiser-orders-table">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary">
              <tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Site</th>
                <th className="text-left p-3">Category</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-left p-3">Period</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-b-0">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="p-3">{o.website_name}</td>
                  <td className="p-3 text-muted-foreground">{o.category}</td>
                  <td className="p-3 text-right font-mono">${Number(o.price_paid).toFixed(2)}</td>
                  <td className="p-3 font-mono text-xs">
                    {o.campaign_starts_at ? `${new Date(o.campaign_starts_at).toLocaleDateString()} → ${new Date(o.campaign_ends_at).toLocaleDateString()}` : '—'}
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${o.payment_status==='paid'?'text-acid':o.payment_status==='pending'?'text-gold':'text-muted-foreground'}`}>● {o.payment_status}</span>
                  </td>
                  <td className="p-3 text-right">
                    <a href={o.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-acid">
                      Visit <ExternalLink size={12}/>
                    </a>
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

function Stat({ label, value, highlight }) {
  return (
    <div className="bg-background p-5">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`font-display font-black text-3xl mt-2 ${highlight ? 'text-acid' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
