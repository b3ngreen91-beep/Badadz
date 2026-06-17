import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import ListingCard from '../components/ListingCard';
import Marquee from '../components/Marquee';
import {
  Search,
  SlidersHorizontal,
  CreditCard,
  ShieldCheck,
  BarChart3,
  Code2,
  UploadCloud,
  CheckCircle2,
  MousePointerClick,
  Store,
  BadgeDollarSign,
  ArrowRight,
} from 'lucide-react';

const HERO_BG = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=srgb&fm=jpg&w=1920&q=80';
const FALLBACK_CATEGORIES = ['Technology', 'Business', 'Marketing', 'Finance', 'Gaming', 'News', 'Entertainment', 'Sports'];

export default function Home() {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    api.get('/listings/meta/categories')
      .then(({ data }) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;

    setLoading(true);
    const timer = setTimeout(() => {
      api.get('/listings', { params })
        .then(({ data }) => setListings(data.listings || []))
        .catch(() => setListings([]))
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [search, category, minPrice, maxPrice]);

  const stats = useMemo(() => {
    const activeListings = listings.length;
    const prices = listings.map((l) => Number(l.monthly_price || 0)).filter((n) => Number.isFinite(n));
    const avgPrice = prices.length ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : 0;
    const startingAt = prices.length ? Math.min(...prices) : 0;
    const categoryCount = categories.length || new Set(listings.map((l) => l.category).filter(Boolean)).size;

    return { activeListings, avgPrice, startingAt, categoryCount };
  }, [listings, categories]);

  const displayedCategories = useMemo(() => {
    const live = categories.map((c) => ({ name: c.category, count: c.count }));
    const fallback = FALLBACK_CATEGORIES.map((name) => ({ name, count: 0 }));
    const merged = [...live];
    fallback.forEach((item) => {
      if (!merged.some((c) => c.name?.toLowerCase() === item.name.toLowerCase())) merged.push(item);
    });
    return merged.slice(0, 8);
  }, [categories]);

  const featuredListings = listings.slice(0, 4);

  const selectCategory = (name) => {
    setCategory(name === category ? '' : name);
    setTimeout(() => document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div data-testid="home-page">
      <section
        className="relative border-b border-border overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.82), rgba(0,0,0,0.96)), url(${HERO_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        data-testid="hero"
      >
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 md:py-28 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 animate-fade-in-up">
            <div className="text-[10px] uppercase tracking-[0.35em] text-primary font-bold mb-4">
              Direct banner advertising marketplace
            </div>

            <h1 className="font-display font-black tracking-tighter uppercase text-4xl sm:text-6xl lg:text-7xl leading-[0.88] break-words">
              Buy & sell<br />website banner ads.
            </h1>

            <p className="mt-5 sm:mt-6 max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">
              BadAdz helps advertisers buy direct website placements and helps publishers earn from ad space. Upload creatives, approve campaigns, serve banners automatically, and track performance.
            </p>

            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
              <a href="#marketplace" className="bg-primary text-primary-foreground px-5 sm:px-6 py-3 text-center text-xs uppercase tracking-[0.28em] font-bold hover:bg-acid hover:text-black transition-colors" data-testid="hero-browse-btn">
                Browse Ad Placements →
              </a>
              <Link to="/listings/new" className="border border-foreground px-5 sm:px-6 py-3 text-center text-xs uppercase tracking-[0.28em] font-bold hover:bg-foreground hover:text-background transition-colors" data-testid="hero-sell-btn">
                Sell My Ad Space
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="border border-border bg-black/40 px-3 py-2">Stripe payments</span>
              <span className="border border-border bg-black/40 px-3 py-2">Owner approval</span>
              <span className="border border-border bg-black/40 px-3 py-2">Auto ad serving</span>
              <span className="border border-border bg-black/40 px-3 py-2">Views · clicks · CTR</span>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="border border-border bg-black/70 backdrop-blur p-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Marketplace Snapshot</div>
              <div className="grid grid-cols-2 gap-px bg-border border border-border" data-testid="hero-stats">
                <Stat label="Active Sites" value={stats.activeListings} />
                <Stat label="Categories" value={stats.categoryCount || displayedCategories.length} />
                <Stat label="Avg / Month" value={`$${stats.avgPrice}`} />
                <Stat label="Starting At" value={`$${stats.startingAt}`} />
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                Early beta marketplace. More listings and performance data will appear as campaigns run.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="hidden sm:block"><Marquee /></div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 border-b border-border" data-testid="categories-section">
        <SectionHeader eyebrow="[ Browse / Categories ]" title="Find the right audience faster." text="Browse placements by niche so advertisers can quickly find websites that match their offer." />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mt-6">
          {displayedCategories.map((c) => (
            <button key={c.name} onClick={() => selectCategory(c.name)} className={`bg-background p-4 text-left hover:bg-card transition-colors ${category === c.name ? 'text-primary' : 'text-foreground'}`}>
              <div className="font-display font-black uppercase text-lg tracking-tight">{c.name}</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">{c.count ? `${c.count} live` : 'coming soon'}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-border" data-testid="featured-section">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <SectionHeader eyebrow="[ Featured / Placements ]" title="Featured ad inventory." text="A quick look at live placements available to advertisers right now." compact />
          <a href="#marketplace" className="text-primary text-[10px] uppercase tracking-[0.25em] font-bold">View all →</a>
        </div>
        {featuredListings.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No featured placements yet. Be the first website owner to list ad inventory.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-border" data-testid="how-it-works-home">
        <SectionHeader eyebrow="[ Process / How It Works ]" title="Simple enough for first-time advertisers. Strong enough for real campaigns." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <WorkflowCard
            title="For Advertisers"
            steps={[
              ['Browse websites', 'Find a placement by category, price, or audience.'],
              ['Upload your ad', 'Use one image or exact banner sizes, then pay through Stripe.'],
              ['Go live after approval', 'The owner reviews your creative and BadAdz serves the approved ad automatically.'],
              ['Track performance', 'See views, clicks, CTR, and campaign status from your dashboard.'],
            ]}
          />
          <WorkflowCard
            title="For Website Owners"
            steps={[
              ['Create a listing', 'Add your website, price, category, and available ad space.'],
              ['Install ad code once', 'Choose a slot size and paste the script where the ad should appear.'],
              ['Approve campaigns', 'Review paid advertiser creatives before anything goes live.'],
              ['Earn and measure', 'Track earnings, views, clicks, CTR, and campaign history.'],
            ]}
          />
        </div>
      </section>

      <section id="marketplace" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 sm:mb-8">
          <SectionHeader eyebrow="[ 01 / Marketplace ]" title="Live ad placements." compact />
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.2em]">
            <SlidersHorizontal size={14} /> {listings.length} placements
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 mb-8 border border-border p-4 bg-card" data-testid="filters">
          <div className="sm:col-span-2 md:col-span-5 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, category, or description..." className="w-full bg-background border border-border pl-9 pr-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary" data-testid="filter-search" />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:col-span-2 md:col-span-3 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary" data-testid="filter-category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
          </select>
          <input type="number" placeholder="Min $" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="md:col-span-2 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary" data-testid="filter-min-price" />
          <input type="number" placeholder="Max $" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="md:col-span-2 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary" data-testid="filter-max-price" />
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-xs uppercase tracking-[0.3em]">Loading inventory...</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 border border-border" data-testid="empty-state">
            <div className="font-display font-black text-2xl uppercase">No active listings right now</div>
            <p className="text-muted-foreground text-sm mt-4">Be the first website owner to list banner inventory on BadAdz.</p>
            <Link to="/register" className="inline-block mt-6 bg-primary text-primary-foreground px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors">List Your Site →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="listings-grid">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 border-b border-border" data-testid="trust-section">
        <SectionHeader eyebrow="[ Trust / Why BadAdz ]" title="Built to make direct ad deals safer and clearer." text="BadAdz gives both sides a structured workflow instead of messy DMs, manual payments, and unclear campaign results." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border mt-8">
          <TrustCard icon={<CreditCard size={18} />} title="Secure payments" text="Stripe checkout collects payment before the owner reviews and approves the campaign." />
          <TrustCard icon={<ShieldCheck size={18} />} title="Owner approval" text="Website owners review the advertiser creative and URL before the ad goes live." />
          <TrustCard icon={<Code2 size={18} />} title="Automatic ad serving" text="Owners install a size-specific script once. Approved ads appear automatically in that slot." />
          <TrustCard icon={<BarChart3 size={18} />} title="Real analytics" text="Dashboards track views, clicks, CTR, earnings, and campaign status." />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16" data-testid="final-cta">
        <div className="border border-primary bg-primary/10 p-6 sm:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-primary mb-3">Ready for a direct ad deal?</div>
            <h2 className="font-display font-black uppercase text-3xl sm:text-5xl tracking-tight">Start with one listing or one campaign.</h2>
            <p className="text-sm text-muted-foreground mt-4 max-w-2xl">BadAdz is built for simple 30-day banner placements, transparent pricing, and measurable results.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            <a href="#marketplace" className="bg-primary text-primary-foreground px-5 py-3 text-center text-xs uppercase tracking-[0.25em] font-bold hover:bg-acid hover:text-black">Browse Ads</a>
            <Link to="/listings/new" className="border border-foreground px-5 py-3 text-center text-xs uppercase tracking-[0.25em] font-bold hover:bg-foreground hover:text-background">Sell Space</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ eyebrow, title, text, compact }) {
  return (
    <div className={compact ? '' : 'max-w-3xl'}>
      <div className="text-[10px] uppercase tracking-[0.32em] sm:tracking-[0.4em] text-muted-foreground mb-2">{eyebrow}</div>
      <h2 className="font-display font-black uppercase text-2xl sm:text-3xl lg:text-4xl tracking-tight">{title}</h2>
      {text && <p className="text-sm text-muted-foreground leading-relaxed mt-3">{text}</p>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-background p-4">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="font-display font-black text-xl sm:text-2xl mt-1 text-foreground">{value}</div>
    </div>
  );
}

function WorkflowCard({ title, steps }) {
  return (
    <div className="border border-border bg-card p-5 sm:p-6">
      <h3 className="font-display font-black uppercase text-2xl tracking-tight mb-5">{title}</h3>
      <div className="space-y-3">
        {steps.map(([stepTitle, text], index) => (
          <div key={stepTitle} className="grid grid-cols-[40px_1fr] gap-3 border border-border bg-background p-3">
            <div className="w-8 h-8 border border-primary text-primary flex items-center justify-center font-mono text-xs">{index + 1}</div>
            <div>
              <div className="font-bold uppercase text-sm">{stepTitle}</div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustCard({ icon, title, text }) {
  return (
    <div className="bg-background p-5">
      <div className="text-primary mb-3">{icon}</div>
      <h3 className="font-display font-black uppercase text-lg tracking-tight mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
