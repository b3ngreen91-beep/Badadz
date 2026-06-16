import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import ListingCard from '../components/ListingCard';
import Marquee from '../components/Marquee';
import { Search, SlidersHorizontal, CreditCard, Mail, CalendarDays, Percent } from 'lucide-react';

const HERO_BG = 'https://images.unsplash.com/photo-1553675559-5046b59a5ca5?crop=entropy&cs=srgb&fm=jpg&w=1920&q=80';

export default function Home() {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    api.get('/listings/meta/categories').then(({ data }) => setCategories(data.categories || []));
  }, []);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    setLoading(true);
    const t = setTimeout(() => {
      api.get('/listings', { params })
        .then(({ data }) => setListings(data.listings || []))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [search, category, minPrice, maxPrice]);

  const stats = useMemo(() => {
    const total = listings.length;
    const avg = total ? Math.round(listings.reduce((s, l) => s + Number(l.monthly_price), 0) / total) : 0;
    const max = listings.reduce((m, l) => Math.max(m, Number(l.monthly_price)), 0);
    return { total, avg, max };
  }, [listings]);

  return (
    <div data-testid="home-page">
      <section
        className="relative border-b border-border"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${HERO_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        data-testid="hero"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-32 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8 animate-fade-in-up">
            <div className="text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.4em] text-primary font-bold mb-4">
              [ MARKETPLACE / V.1 ]
            </div>
            <div className="mb-5 inline-block border border-primary bg-primary/10 px-4 py-3 text-xs text-muted-foreground leading-relaxed max-w-xl">
              <span className="block font-bold uppercase tracking-[0.25em] text-primary mb-1">BadAdz is live in beta.</span>
              We are currently accepting early website owners and advertisers while we improve the platform.
            </div>
            <h1 className="font-display font-black tracking-tighter uppercase text-4xl sm:text-5xl lg:text-6xl leading-[0.9] break-words">
              Sell ad space.<br />
              Buy ad space.<br />
              <span className="text-primary">Skip the agency.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm md:text-base text-muted-foreground leading-relaxed">
              BadAdz is the no-nonsense marketplace where independent website owners list banner inventory and advertisers buy it directly. 20% platform fee. Stripe payments. Direct owner contact after purchase.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
              <a href="#marketplace" className="bg-primary text-primary-foreground px-5 sm:px-6 py-3 text-center text-xs uppercase tracking-[0.24em] sm:tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors" data-testid="hero-browse-btn">
                Browse Inventory →
              </a>
              <a href="/register" className="border border-foreground px-5 sm:px-6 py-3 text-center text-xs uppercase tracking-[0.24em] sm:tracking-[0.3em] font-bold hover:bg-foreground hover:text-background transition-colors" data-testid="hero-list-btn">
                List Your Site
              </a>
            </div>
          </div>
          <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 gap-px bg-border border border-border" data-testid="hero-stats">
            <Stat label="Listings" value={stats.total} />
            <Stat label="Avg $/mo" value={`$${stats.avg}`} />
            <Stat label="Top $/mo" value={`$${stats.max}`} />
          </div>
        </div>
      </section>

      <Marquee />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 border-b border-border" data-testid="trust-section">
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.32em] sm:tracking-[0.4em] text-muted-foreground mb-2">[ Trust / Why BadAdz ]</div>
          <h2 className="font-display font-black uppercase text-2xl sm:text-3xl lg:text-4xl tracking-tight">
            Built for simple ad deals.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          <TrustCard icon={<CreditCard size={18} />} title="Stripe Payments" text="Checkout runs through Stripe so payments are tracked before campaigns start." />
          <TrustCard icon={<Mail size={18} />} title="Owner Contact" text="Advertisers get the website owner's contact info after purchase." />
          <TrustCard icon={<CalendarDays size={18} />} title="30-Day Campaigns" text="Each placement is tracked as a fixed 30-day banner campaign." />
          <TrustCard icon={<Percent size={18} />} title="Transparent Fee" text="BadAdz takes 20%. Sellers keep 80%. No hidden platform math." />
        </div>
      </section>

      <section id="marketplace" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] sm:tracking-[0.4em] text-muted-foreground mb-2">[ 01 / Inventory ]</div>
            <h2 className="font-display font-black uppercase text-2xl sm:text-3xl lg:text-4xl tracking-tight">
              Live Marketplace
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.2em]">
            <SlidersHorizontal size={14}/> {listings.length} placements
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 mb-8 border border-border p-4 bg-card" data-testid="filters">
          <div className="sm:col-span-2 md:col-span-5 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or category..."
              className="w-full bg-background border border-border pl-9 pr-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary"
              data-testid="filter-search"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="sm:col-span-2 md:col-span-3 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="filter-category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Min $"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="md:col-span-2 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="filter-min-price"
          />
          <input
            type="number"
            placeholder="Max $"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="md:col-span-2 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="filter-max-price"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-xs uppercase tracking-[0.3em]">Loading inventory...</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 border border-border" data-testid="empty-state">
            <div className="font-display font-black text-2xl uppercase">No Active Listings Right Now</div>
            <p className="text-muted-foreground text-sm mt-4">Be the first website owner to list banner inventory on BadAdz.</p>
            <a
              href="/register"
              className="inline-block mt-6 bg-primary text-primary-foreground px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors"
            >
              List Your Site →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="listings-grid">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-background p-4">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="font-display font-black text-2xl mt-1 text-foreground">{value}</div>
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
