import React from 'react';
import { Link } from 'react-router-dom';

export default function HowItWorks() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="border border-border bg-card p-6 md:p-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono mb-3">How BadAdz Works</p>
        <h1 className="font-display text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4">
          Buy and sell 30-day banner ad placements.
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          BadAdz helps website owners sell banner ad space and helps advertisers buy simple 30-day placements.
          Payments, campaign dates, platform fees, and email confirmations are handled through BadAdz.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="border border-border bg-card p-6">
          <h2 className="font-display text-2xl font-black uppercase mb-4">For website owners</h2>
          <ol className="space-y-3 text-sm text-muted-foreground leading-relaxed list-decimal pl-5">
            <li>Create a listing for your available banner ad space.</li>
            <li>Set your monthly price for a 30-day placement.</li>
            <li>When an advertiser buys it, you get an email with buyer details.</li>
            <li>Ask the advertiser for their banner image, destination link, and instructions.</li>
            <li>Add the banner ad to your website and keep it live for the full 30-day campaign.</li>
            <li>After 30 days, the placement becomes available again on BadAdz.</li>
          </ol>
        </div>

        <div className="border border-border bg-card p-6">
          <h2 className="font-display text-2xl font-black uppercase mb-4">For advertisers</h2>
          <ol className="space-y-3 text-sm text-muted-foreground leading-relaxed list-decimal pl-5">
            <li>Browse available banner placements in the marketplace.</li>
            <li>Choose a website and complete Stripe checkout.</li>
            <li>After payment, you receive campaign confirmation and seller contact details.</li>
            <li>Send the seller your banner image, destination URL, and any instructions.</li>
            <li>The seller places your ad on their website for the 30-day campaign.</li>
          </ol>
        </div>
      </section>

      <section className="border border-border bg-black p-6 md:p-8 mt-8">
        <h2 className="font-display text-3xl font-black uppercase mb-4">Important launch note</h2>
        <p className="text-muted-foreground leading-relaxed">
          BadAdz does not automatically install ads on a seller's website yet. BadAdz handles payment,
          campaign tracking, emails, and marketplace listing status. The website owner is responsible for
          placing the advertiser's banner/link on their own website after payment.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-3xl font-black uppercase">FAQ</h2>

        <div className="border border-border bg-card p-5">
          <h3 className="font-bold uppercase">How long does each placement last?</h3>
          <p className="text-sm text-muted-foreground mt-2">Each paid placement runs for 30 days.</p>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="font-bold uppercase">What does BadAdz charge?</h3>
          <p className="text-sm text-muted-foreground mt-2">BadAdz takes a 20% platform fee. The seller keeps 80%.</p>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="font-bold uppercase">How does the ad get added to the website?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            After payment, the seller and advertiser receive email confirmation. The advertiser sends the banner image,
            destination link, and instructions to the seller. The seller then places the ad on their website.
          </p>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="font-bold uppercase">Are payments automatic?</h3>
          <p className="text-sm text-muted-foreground mt-2">Yes. Checkout is handled through Stripe. Campaigns only activate after successful payment.</p>
        </div>
      </section>

      <div className="mt-10 flex flex-col sm:flex-row gap-3">
        <Link to="/" className="border border-primary bg-primary text-primary-foreground px-5 py-3 text-sm font-bold uppercase text-center">
          Browse marketplace
        </Link>
        <Link to="/listings/new" className="border border-border px-5 py-3 text-sm font-bold uppercase text-center hover:bg-card">
          Create listing
        </Link>
      </div>
    </div>
  );
}
