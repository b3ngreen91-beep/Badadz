import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/admin/stats');
        if (mounted) setData(res.data);
      } catch (err) {
        const message = err.response?.data?.error || 'Unable to load admin stats';
        if (mounted) setError(message);
        toast.error(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStats();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-12">Loading admin dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="border border-border p-8 bg-card">
          <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-2">[ Admin / Access ]</div>
          <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-4">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mb-2">Signed in as {user?.email}</p>
          <p className="text-sm text-primary">{error}</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentOrders = data?.recentOrders || data?.recent_orders || [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="admin-dashboard">
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-2">[ Admin / Dashboard ]</div>
        <h1 className="font-display font-black uppercase text-3xl sm:text-4xl tracking-tight">BadAdz Control Center</h1>
        <p className="text-sm text-muted-foreground mt-2">Platform overview for {user?.email}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-12">
        <Stat label="Users" value={stats.total_users} />
        <Stat label="Listings" value={stats.total_listings} />
        <Stat label="Orders" value={stats.total_orders} />
        <Stat label="Platform Revenue" value={money(stats.platform_revenue)} highlight />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-12">
        <Stat label="Active Listings" value={stats.active_listings} />
        <Stat label="Sold Listings" value={stats.sold_listings} />
        <Stat label="Paid Orders" value={stats.paid_orders} />
        <Stat label="Seller Earnings" value={money(stats.seller_earnings)} />
      </div>

      <h2 className="font-display font-black uppercase text-xl tracking-tight mb-4">Recent Orders</h2>
      {recentOrders.length === 0 ? (
        <div className="border border-border p-12 text-center text-sm text-muted-foreground">No orders yet.</div>
      ) : (
        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary">
              <tr className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Listing</th>
                <th className="text-left p-3">Buyer</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-right p-3">Fee</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-b-0">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}</td>
                  <td className="p-3">{order.website_name || order.listing_name || '-'}</td>
                  <td className="p-3 text-muted-foreground">{order.buyer_email || order.advertiser_email || order.advertiser_name || '-'}</td>
                  <td className="p-3 text-right font-mono">{money(order.price_paid)}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">{money(order.platform_fee)}</td>
                  <td className="p-3">
                    <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${order.payment_status === 'paid' ? 'text-acid' : 'text-gold'}`}>● {order.payment_status || '-'}</span>
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
      <div className={`font-display font-black text-3xl mt-2 ${highlight ? 'text-acid' : 'text-foreground'}`}>{value ?? 0}</div>
    </div>
  );
}
