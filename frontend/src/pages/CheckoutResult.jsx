import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function CheckoutResult({ kind }) {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(kind === 'success' && !!sessionId);

  useEffect(() => {
    if (kind === 'success' && sessionId) {
      api.get(`/orders/session/${sessionId}`)
        .then(({ data }) => setOrder(data.order))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [kind, sessionId]);

  if (kind === 'cancel') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center" data-testid="checkout-cancel-page">
        <XCircle size={48} className="mx-auto text-primary mb-6" />
        <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-3">[ Checkout / Cancelled ]</div>
        <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-4">Payment cancelled.</h1>
        <p className="text-sm text-muted-foreground mb-8">No charge was made. You can try again any time.</p>
        <Link to="/" className="inline-block bg-primary text-primary-foreground px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors" data-testid="back-to-marketplace-btn">
          Back to marketplace →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center" data-testid="checkout-success-page">
      <CheckCircle2 size={48} className="mx-auto text-acid mb-6" />
      <div className="text-[10px] uppercase tracking-[0.4em] text-acid mb-3">[ Checkout / Success ]</div>
      <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-4">Payment received.</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {loading
          ? 'Confirming your order…'
          : order
            ? `Your campaign on ${order.website_name} is live for ${order.campaign_ends_at ? Math.round((new Date(order.campaign_ends_at) - new Date(order.campaign_starts_at)) / (1000*60*60*24)) : 30} days.`
            : 'Your order is being processed. Stripe webhook will confirm shortly.'}
      </p>
      <Link to="/dashboard/advertiser" className="inline-block bg-primary text-primary-foreground px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors" data-testid="view-campaigns-btn">
        View my campaigns →
      </Link>
    </div>
  );
}
