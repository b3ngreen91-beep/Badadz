import React from 'react';

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">BadAdz Legal</p>
        <h1 className="font-display text-4xl md:text-6xl font-black uppercase mt-3">Privacy Policy</h1>
        <p className="text-muted-foreground mt-4">Last updated: June 2026</p>
      </div>

      <div className="space-y-8 text-sm md:text-base leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">1. Information We Collect</h2>
          <p>
            BadAdz may collect account information such as name, email address, role, listing details, order information, and basic activity needed to operate the marketplace.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">2. Payments</h2>
          <p>
            Payments are handled by Stripe. BadAdz does not store full credit card numbers. Stripe may collect and process payment information according to its own policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">3. How We Use Information</h2>
          <p>
            We use information to create accounts, display listings, process orders, send purchase and seller notifications, prevent abuse, provide support, and improve the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">4. Email Notifications</h2>
          <p>
            BadAdz may send transactional emails such as payment confirmations, campaign updates, seller notifications, and account-related messages.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">5. Sharing</h2>
          <p>
            We may share necessary order and contact details between buyers and sellers so a purchased advertising campaign can be fulfilled. We do not sell personal information to advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">6. Security</h2>
          <p>
            We use reasonable safeguards, but no online service is completely secure. Users should use strong passwords and keep account access private.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white uppercase mb-3">7. Contact</h2>
          <p>
            For privacy questions or data requests, contact the BadAdz team through the email address provided on the platform.
          </p>
        </section>
      </div>
    </div>
  );
}
