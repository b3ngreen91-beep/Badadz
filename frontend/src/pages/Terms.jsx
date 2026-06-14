import React from 'react';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">BadAdz Legal</p>
        <h1 className="font-display text-4xl md:text-6xl font-black uppercase mt-3">Terms of Service</h1>
        <p className="text-muted-foreground mt-4">Last updated: June 2026</p>
      </div>

      <div className="space-y-8 text-sm md:text-base leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">1. Overview</h2>
          <p>
            BadAdz is a marketplace where website owners can list 30-day banner advertising placements and advertisers can purchase those placements. By using BadAdz, you agree to these Terms of Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">2. Accounts</h2>
          <p>
            Users are responsible for providing accurate account information and keeping login credentials secure. BadAdz may remove accounts, listings, or campaigns that appear fraudulent, misleading, abusive, illegal, or harmful to the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">3. Listings and Campaigns</h2>
          <p>
            Each paid placement is a 30-day banner advertising campaign unless otherwise stated. Website owners are responsible for accurately describing their websites, traffic, placement details, and any requirements for advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">4. Payments and Platform Fee</h2>
          <p>
            Payments are processed through Stripe. BadAdz takes a 20% platform fee from completed sales. Sellers receive 80% of the placement price, subject to Stripe processing, payout timing, refunds, chargebacks, and any applicable platform review.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">5. User Responsibilities</h2>
          <p>
            Advertisers are responsible for submitting appropriate ad content. Website owners are responsible for placing purchased ads as agreed. Users may not use BadAdz for illegal content, scams, malware, hate content, impersonation, or deceptive advertising.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">6. No Guarantee</h2>
          <p>
            BadAdz does not guarantee traffic, clicks, conversions, sales, revenue, or performance from any advertisement. Buyers should review listings carefully before purchasing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">7. Changes</h2>
          <p>
            BadAdz may update these terms as the platform grows. Continued use of the service after updates means you accept the updated terms.
          </p>
        </section>
      </div>
    </div>
  );
}
