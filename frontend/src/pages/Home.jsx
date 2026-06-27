import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import ListingCard from '../components/ListingCard';
import Marquee from '../components/Marquee';
import { Search, SlidersHorizontal } from 'lucide-react';

const FALLBACK_CATEGORIES = ['Technology', 'Business', 'Marketing', 'Finance', 'Gaming', 'News', 'Entertainment', 'Sports'];

function compactNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString(undefined, { notation: number >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 });
}

export default function Home() {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [marketStats, setMarketStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    api.get('/listings/meta/categories').then(({ data }) => setCategories(data.categories || [])).catch(() => setCategories([]));
    api.get('/marketplace/stats').then(({ data }) => setMarketStats(data.stats || {})).catch(() => setMarketStats({}));
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

  const displayedCategories = useMemo(() => {
    const live = categories.map((c) => ({ name: c.category, count: c.count }));
    const merged = [...live];
    FALLBACK_CATEGORIES.forEach((name) => {
      if (!merged.some((c) => c.name?.toLowerCase() === name.toLowerCase())) merged.push({ name, count: 0 });
    });
    return merged.slice(0, 8);
  }, [categories]);

  const featuredListings = listings.slice(0, 4);
  const founderLimit = Number(marketStats.founding_seller_limit || 50);
  const founderClaimed = Number(marketStats.founding_sellers_claimed || 0);
  const founderRemaining = Math.max(Number(marketStats.founding_seller_spots_remaining ?? (founderLimit - founderClaimed)), 0);
  const founderFull = founderRemaining <= 0;
  const selectCategory = (name) => { setCategory(name === category ? '' : name); setTimeout(() => document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth' }), 50); };

  return (
    <div data-testid="home-page">
      <section className="relative border-b border-border overflow-hidden bg-black" data-testid="hero">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 md:py-28 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 animate-fade-in-up">
            <div className="text-[10px] uppercase tracking-[0.35em] text-primary font-bold mb-4">Direct banner advertising marketplace</div>
            <h1 className="font-display font-black tracking-tighter uppercase text-4xl sm:text-6xl lg:text-7xl leading-[0.88] break-words">Buy & sell<br />website banner ads.</h1>
            <p className="mt-5 sm:mt-6 max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">BadAdz helps advertisers buy direct website placements and helps publishers earn from ad space.</p>
            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
              <a href="#marketplace" className="bg-primary text-primary-foreground px-5 sm:px-6 py-3 text-center text-xs uppercase tracking-[0.28em] font-bold hover:bg-acid hover:text-black transition-colors" data-testid="hero-browse-btn">Browse Ad Placements →</a>
              <Link to="/listings/new" className="border border-foreground px-5 sm:px-6 py-3 text-center text-xs uppercase tracking-[0.28em] font-bold hover:bg-foreground hover:text-background transition-colors" data-testid="hero-sell-btn">Sell My Ad Space</Link>
              <Link to="/how-it-works" className="border border-border px-5 sm:px-6 py-3 text-center text-xs uppercase tracking-[0.28em] font-bold hover:border-primary hover:text-primary transition-colors">How It Works</Link>
            </div>
          </div>
          <div className="lg:col-span-4"><div className="border border-border bg-card p-4"><div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Marketplace Metrics</div><div className="grid grid-cols-2 gap-px bg-border border border-border" data-testid="hero-stats"><Stat label="Active Sites" value={compactNumber(marketStats.active_websites)} /><Stat label="Live Campaigns" value={compactNumber(marketStats.active_campaigns)} /><Stat label="Impressions" value={compactNumber(marketStats.total_impressions)} /><Stat label="Clicks" value={compactNumber(marketStats.total_clicks)} /></div></div></div>
        </div>
      </section>
      <section className="border-b border-primary bg-primary/10" data-testid="founding-seller-banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8">
            <div className="text-[10px] uppercase tracking-[0.35em] text-primary font-bold mb-3">🏆 Founding Seller Program</div>
            <h2 className="font-display font-black uppercase text-3xl sm:text-5xl tracking-tight">Lock in 15% for life.</h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-3xl">
              The first {founderLimit} website owners who join BadAdz with promo code <span className="text-foreground font-bold">FOUNDING50</span> get a 15% lifetime platform fee instead of 20%. Free to join. Free to list. Keep 85% of every sale.
            </p>
          </div>
          <div className="lg:col-span-4 border border-primary bg-background p-5 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{founderFull ? 'Program Status' : 'Founder Spots Remaining'}</div>
            <div className="font-display font-black text-5xl sm:text-6xl text-primary mt-2" data-testid="founding-spots-remaining">{founderFull ? 'Full' : founderRemaining}</div>
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-2">{founderFull ? `${founderLimit} of ${founderLimit} claimed` : `${founderClaimed} of ${founderLimit} claimed`}</div>
            <Link to="/register" className="block mt-5 bg-primary text-primary-foreground px-5 py-3 text-center text-xs uppercase tracking-[0.25em] font-bold hover:bg-acid hover:text-black transition-colors">
              {founderFull ? 'Join BadAdz' : 'Claim Your Spot →'}
            </Link>
          </div>
        </div>
      </section>
      <div className="hidden sm:block"><Marquee /></div>
      <section className="border-b border-border bg-black"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-border border-x border-border text-center">{['Secure Stripe payments', 'Owner-approved ads', 'Automatic ad serving', 'Views/clicks tracking'].map((item) => <div key={item} className="bg-background p-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{item}</div>)}</div></section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 border-b border-border" data-testid="categories-section"><SectionHeader eyebrow="[ Browse / Categories ]" title="Find the right audience faster." text="Browse placements by niche so advertisers can quickly find websites that match their offer." /><div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mt-6">{displayedCategories.map((c) => <button key={c.name} onClick={() => selectCategory(c.name)} className={`bg-background p-4 text-left hover:bg-card transition-colors ${category === c.name ? 'text-primary' : 'text-foreground'}`}><div className="font-display font-black uppercase text-lg tracking-tight">{c.name}</div><div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">{c.count ? `${c.count} live` : 'coming soon'}</div></button>)}</div></section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-border" data-testid="featured-section"><div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6"><SectionHeader eyebrow="[ Featured / Placements ]" title="Featured ad inventory." text="A quick look at live placements available to advertisers right now." compact /><a href="#marketplace" className="text-primary text-[10px] uppercase tracking-[0.25em] font-bold">View all →</a></div>{featuredListings.length === 0 ? <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">No featured placements yet. Be the first website owner to list ad inventory.</div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{featuredListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>}</section>
      <section id="marketplace" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-border"><div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 sm:mb-8"><SectionHeader eyebrow="[ 01 / Marketplace ]" title="Live ad placements." compact /><div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.2em]"><SlidersHorizontal size={14} /> {listings.length} placements</div></div><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 mb-8 border border-border p-4 bg-card" data-testid="filters"><div className="sm:col-span-2 md:col-span-5 relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, category, or description..." className="w-full bg-background border border-border pl-9 pr-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary" data-testid="filter-search" /></div><select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:col-span-2 md:col-span-3 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary" data-testid="filter-category"><option value="">All categories</option>{categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}</select><input type="number" placeholder="Min $" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="md:col-span-2 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary" data-testid="filter-min-price" /><input type="number" placeholder="Max $" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="md:col-span-2 bg-background border border-border px-3 py-3 md:py-2 text-sm focus:outline-none focus:border-primary" data-testid="filter-max-price" /></div>{loading ? <div className="text-center py-16 text-muted-foreground text-xs uppercase tracking-[0.3em]">Loading inventory...</div> : listings.length === 0 ? <div className="text-center py-16 border border-border" data-testid="empty-state"><div className="font-display font-black text-2xl uppercase">No active listings right now</div><p className="text-muted-foreground text-sm mt-4">Be the first website owner to list banner inventory on BadAdz.</p><Link to="/register" className="inline-block mt-6 bg-primary text-primary-foreground px-6 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors">List Your Site →</Link></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="listings-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>}</section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16" data-testid="final-cta"><div className="border border-primary bg-primary/10 p-6 sm:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"><div><div className="text-[10px] uppercase tracking-[0.35em] text-primary mb-3">Ready for a direct ad deal?</div><h2 className="font-display font-black uppercase text-3xl sm:text-5xl tracking-tight">Start with one listing or one campaign.</h2></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0"><a href="#marketplace" className="bg-primary text-primary-foreground px-5 py-3 text-center text-xs uppercase tracking-[0.25em] font-bold hover:bg-acid hover:text-black">Browse Ads</a><Link to="/listings/new" className="border border-foreground px-5 py-3 text-center text-xs uppercase tracking-[0.25em] font-bold hover:bg-foreground hover:text-background">Sell Space</Link></div></div></section>
    </div>
  );
}
function SectionHeader({ eyebrow, title, text, compact }) { return <div className={compact ? '' : 'max-w-3xl'}><div className="text-[10px] uppercase tracking-[0.32em] sm:tracking-[0.4em] text-muted-foreground mb-2">{eyebrow}</div><h2 className="font-display font-black uppercase text-2xl sm:text-3xl lg:text-4xl tracking-tight">{title}</h2>{text && <p className="text-sm text-muted-foreground leading-relaxed mt-3">{text}</p>}</div>; }
function Stat({ label, value }) { return <div className="bg-background p-4"><div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-muted-foreground">{label}</div><div className="font-display font-black text-xl sm:text-2xl mt-1 text-foreground">{value}</div></div>; }
