import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function ListingCard({ listing }) {
  const status = listing.status;
  const statusClass =
    status === 'active' ? 'text-acid' : status === 'paused' ? 'text-gold' : 'text-muted-foreground';

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group bg-card border border-border hover:border-primary transition-colors duration-150 flex flex-col overflow-hidden"
      data-testid={`listing-card-${listing.id}`}
    >
      <div className="aspect-video bg-black overflow-hidden border-b border-border relative">
        <img
          src={listing.image_url}
          alt={listing.website_name}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.opacity = 0.2; }}
        />
        <div className="absolute top-2 left-2 flex flex-wrap gap-2">
          {listing.owner_founding_member && <span className="bg-black/85 border border-gold text-gold px-2 py-1 text-[9px] uppercase tracking-[0.18em] font-bold">Founder</span>}
          {listing.ad_code_verified && <span className="bg-black/85 border border-acid text-acid px-2 py-1 text-[9px] uppercase tracking-[0.18em] font-bold">Verified Slot</span>}
        </div>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">{listing.category}</div>
            <h3 className="font-display font-black text-lg uppercase tracking-tight truncate">{listing.website_name}</h3>
          </div>
          <ArrowUpRight size={20} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"/>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{listing.description}</p>
        {listing.traffic_stats && (
          <div className="text-[11px] text-foreground/70 border-l-2 border-primary pl-2 line-clamp-1">
            {listing.traffic_stats}
          </div>
        )}
        <div className="flex items-end justify-between mt-auto pt-3 border-t border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Per month</div>
            <div className="font-display font-black text-2xl text-acid" data-testid={`listing-price-${listing.id}`}>
              ${Number(listing.monthly_price).toLocaleString()}
            </div>
          </div>
          <span className={`text-[10px] uppercase tracking-[0.25em] font-bold ${statusClass}`}>● {status}</span>
        </div>
      </div>
    </Link>
  );
}
