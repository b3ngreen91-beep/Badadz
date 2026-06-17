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
          BadAdz helps website owners sell ad slots and helps advertisers buy simple 30-day banner placements.
          Payments, creative uploads, owner approvals, ad serving, views, clicks, and CTR tracking are handled through BadAdz.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="border border-border bg-card p-6">
          <h2 className="font-display text-2xl font-black uppercase mb-4">For website owners</h2>
          <ol className="space-y-3 text-sm text-muted-foreground leading-relaxed list-decimal pl-5">
            <li>Create a listing for the website where you want to sell banner ad space.</li>
            <li>Copy a BadAdz ad slot code from your Owner Dashboard.</li>
            <li>Choose the size you want: 728x90, 300x250, 160x600, 320x50, or 970x250.</li>
            <li>Paste that code exactly where you want the ad to appear on your website.</li>
            <li>When an advertiser buys, review their uploaded banner previews and destination URL.</li>
            <li>Approve the ad to make it automatically appear in that installed ad slot.</li>
            <li>Track views, clicks, earnings, and campaign status from your dashboard.</li>
          </ol>
        </div>

        <div className="border border-border bg-card p-6">
          <h2 className="font-display text-2xl font-black uppercase mb-4">For advertisers</h2>
          <ol className="space-y-3 text-sm text-muted-foreground leading-relaxed list-decimal pl-5">
            <li>Browse available banner placements in the marketplace.</li>
            <li>Choose a website and enter your destination URL.</li>
            <li>Upload one ad image for BadAdz to fit into standard banner sizes.</li>
            <li>Optionally upload exact-size banners if you already have professional files.</li>
            <li>Complete Stripe checkout.</li>
            <li>The website owner reviews your creative. Once approved, your campaign goes live automatically.</li>
            <li>Track views, clicks, CTR, and campaign status from My Campaigns.</li>
          </ol>
        </div>
      </section>

      <section className="border border-border bg-black p-6 md:p-8 mt-8">
        <h2 className="font-display text-3xl font-black uppercase mb-4">Ad slot sizes</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Website owners choose which size code to install. BadAdz serves the matching creative for that slot.
          If an advertiser uses the one-image upload, BadAdz fits the full design onto each standard size using black padding when needed.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border border-border">
          {['728x90', '300x250', '160x600', '320x50', '970x250'].map((size) => (
            <div key={size} className="bg-background p-4 text-center font-mono text-sm">{size}</div>
          ))}
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-3xl font-black uppercase">FAQ</h2>

        <div className="border border-border bg-card p-5">
          <h3 className="font-bold uppercase">How long does each placement last?</h3>
          <p className="text-sm text-muted-foreground mt-2">Each paid placement runs for 30 days after the website owner approves the ad.</p>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="font-bold uppercase">What does BadAdz charge?</h3>
          <p className="text-sm text-muted-foreground mt-2">BadAdz takes a 20% platform fee. The seller keeps 80%.</p>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="font-bold uppercase">How does the ad get added to the website?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Website owners copy a size-specific script from their dashboard and paste it into their website once.
            After they approve a buyer's ad, BadAdz automatically serves the approved banner in that slot.
          </p>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="font-bold uppercase">Which banner image is shown?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            The installed slot size controls which creative is shown. A 728x90 slot serves the 728x90 creative.
            A 300x250 slot serves the 300x250 creative. Exact-size uploads override auto-generated versions for that size.
          </p>
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
