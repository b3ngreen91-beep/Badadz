import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-black mt-24" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="font-display font-black text-2xl uppercase tracking-tighter">
            Bad<span className="text-primary">Adz</span>
          </div>
          <p className="text-xs text-muted-foreground mt-3 max-w-xs leading-relaxed">
            The brutalist marketplace for honest banner advertising. Owners list. Advertisers buy. We take 20%. End of story.
          </p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Platform</div>
          <ul className="space-y-2 text-sm">
            <li>Marketplace</li>
            <li>Owner Tools</li>
            <li>Advertiser Tools</li>
            <li>Stripe Payments</li>
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">System</div>
          <ul className="space-y-2 text-sm font-mono text-muted-foreground">
            <li>v1.0 · {new Date().getFullYear()}</li>
            <li>node + express + pg</li>
            <li>react + stripe</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        © {new Date().getFullYear()} BadAdz · All bad ads reserved
      </div>
    </footer>
  );
}
