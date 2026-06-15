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

  const campaignDays = order?.campaign_ends_at && order?.campaign_starts_at
    ? Math.round((new Date(order.campaign_ends_at) - new Date(order.campaign_starts_at)) / (1000 * 60 * 60 * 24))
    : 30;

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
    <div className="max-w-3xl mx-auto px-6 py-24" data-testid="checkout-success-page">
      <div className="text-center mb-8">
        <CheckCircle2 size={48} className="mx-auto text-acid mb-6" />
        <div className="text-[10px] uppercase tracking-[0.4em] text-acid mb-3">[ Checkout / Success ]</div>
        <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-4">Payment received.</h1>
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Confirming your order...'
            : order
              ? `Your campaign on ${order.website_name} is confirmed for ${campaignDays} days.`
              : 'Your order is being processed. Stripe webhook will confirm shortly.'}
        </p>
      </div>

      <div className="border border-border bg-card p-6 md:p-8 mb-8">
        <h2 className="font-display font-black uppercase text-2xl tracking-tight mb-4">
          Next steps for your ad
        </h2>

        {order?.owner_email && (
          <div className="border border-primary/40 bg-primary/10 p-4 mb-5">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
              Website owner contact
            </div>
            <div className="text-primary font-mono break-all">
              {order.owner_email}
            </div>
            {order.owner_name && (
              <div className="text-xs text-muted-foreground mt-1">
                {order.owner_name}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 text-sm text-muted-foreground">
          <Step text="Contact the website owner and let them know you purchased the placement." />
          <Step text="Send your banner image or ad creative to the website owner." />
          <Step text="Send the destination URL where people should go when they click your ad." />
          <Step text="Keep a record of your 30-day campaign dates and confirm when the ad goes live." />
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mt-6 border-t border-border pt-5">
          BadAdz handles the marketplace, payment, campaign tracking, and seller notification.
          The website owner is responsible for placing your banner ad on their website for the full 30-day campaign.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/dashboard/advertiser" className="inline-block text-center bg-primary text-primary-foreground px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors" data-testid="view-campaigns-btn">
          View my campaigns →
        </Link>
        <Link to="/how-it-works" className="inline-block text-center border border-border px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:border-primary hover:text-primary transition-colors">
          How it works
        </Link>
      </div>
    </div>
  );
}

function Step({ text }) {
  return (
    <div className="border border-border bg-black p-4 leading-relaxed">
      {text}
    </div>
  );
}
