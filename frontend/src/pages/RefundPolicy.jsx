import React from 'react';

export default function RefundPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">BadAdz Legal</p>
        <h1 className="font-display text-4xl md:text-6xl font-black uppercase mt-3">Refund Policy</h1>
        <p className="text-muted-foreground mt-4">Last updated: June 2026</p>
      </div>

      <div className="space-y-8 text-sm md:text-base leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">1. General Policy</h2>
          <p>
            BadAdz purchases are for 30-day banner advertising placements. Because advertising inventory is time-based, refunds are not automatic after a campaign begins.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">2. When Refunds May Be Considered</h2>
          <p>
            A refund may be considered if a seller cannot provide the purchased placement, the listing was materially misleading, duplicate payment occurred, or there is a verified platform or payment error.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">3. Non-Refundable Situations</h2>
          <p>
            BadAdz does not guarantee clicks, conversions, sales, revenue, traffic quality, or campaign performance. Low performance alone does not qualify for a refund.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">4. Disputes</h2>
          <p>
            Buyers and sellers should first try to resolve fulfillment issues directly. BadAdz may review disputes and may remove users or listings that violate platform rules.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">5. Stripe and Chargebacks</h2>
          <p>
            Payments are processed by Stripe. Refunds and chargebacks may be subject to Stripe processing rules, payment network rules, and any fees that apply.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">6. Contact</h2>
          <p>
            To request help with a payment or campaign issue, contact BadAdz with the order details, listing name, buyer email, and a clear explanation of the problem.
          </p>
        </section>
      </div>
    </div>
  );
}
