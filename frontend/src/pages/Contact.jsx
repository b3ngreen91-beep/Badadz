import React from 'react';
import { Mail, ShieldAlert, CreditCard, Megaphone, HelpCircle } from 'lucide-react';

export default function Contact() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="border border-border bg-card p-8 md:p-10">
          <div className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 text-primary px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] mb-6">
            <HelpCircle className="h-4 w-4" />
            Support
          </div>

          <h1 className="font-display text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4">
            Contact Bad<span className="text-primary">Adz</span>
          </h1>

          <p className="text-muted-foreground max-w-3xl leading-relaxed mb-8">
            Need help with a listing, payment, ad placement, seller issue, buyer issue,
            or refund question? Contact BadAdz support and include as much detail as possible.
          </p>

          <div className="border border-border bg-black p-6 mb-8">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
              Support Email
            </div>
            <a
              href="mailto:badadz.support@gmail.com"
              className="text-xl md:text-2xl font-mono text-primary break-all hover:text-white"
            >
              badadz.support@gmail.com
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SupportCard
              icon={<CreditCard className="h-5 w-5" />}
              title="Payment Questions"
              text="Questions about Stripe checkout, payment status, campaign dates, or completed purchases."
            />
            <SupportCard
              icon={<Megaphone className="h-5 w-5" />}
              title="Ad Placement Help"
              text="Help when a buyer needs to send banner creative or when a seller needs to place the ad."
            />
            <SupportCard
              icon={<ShieldAlert className="h-5 w-5" />}
              title="Report a Listing"
              text="Report inaccurate listings, suspicious activity, or problems between buyers and sellers."
            />
            <SupportCard
              icon={<Mail className="h-5 w-5" />}
              title="General Support"
              text="Questions about your account, owner tools, advertiser tools, or how BadAdz works."
            />
          </div>

          <div className="mt-8 border-l-4 border-primary bg-primary/10 p-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              BadAdz currently handles marketplace listings, payments, campaign tracking,
              and email confirmations. Website owners are responsible for placing the buyer’s
              banner ad on their own website for the full 30-day campaign.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SupportCard({ icon, title, text }) {
  return (
    <div className="border border-border bg-black p-5">
      <div className="flex items-center gap-3 mb-3 text-primary">
        {icon}
        <h2 className="font-display font-black uppercase tracking-tight">
          {title}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {text}
      </p>
    </div>
  );
}
