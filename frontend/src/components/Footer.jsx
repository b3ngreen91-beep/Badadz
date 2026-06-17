import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-black mt-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1">
          <div className="font-display font-black text-2xl uppercase tracking-tighter">
            Bad<span className="text-primary">Adz</span>
          </div>
          <p className="text-xs text-muted-foreground mt-3 max-w-xs leading-relaxed">
            A direct marketplace for buying and selling website banner ad placements with Stripe payments, owner approval, automatic ad serving, and campaign analytics.
          </p>
        </div>

        <FooterGroup title="Marketplace" links={[
          ['Browse placements', '/'],
          ['Sell ad space', '/listings/new'],
          ['How it works', '/how-it-works'],
        ]} />

        <FooterGroup title="Dashboards" links={[
          ['Owner dashboard', '/dashboard/owner'],
          ['Advertiser dashboard', '/dashboard/advertiser'],
          ['Contact support', '/contact'],
        ]} />

        <FooterGroup title="Legal" links={[
          ['Terms of Service', '/terms'],
          ['Privacy Policy', '/privacy'],
          ['Refund Policy', '/refund-policy'],
        ]} />
      </div>

      <div className="border-t border-border py-4 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        © {new Date().getFullYear()} BadAdz · Stripe payments · direct banner ad marketplace
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">{title}</div>
      <ul className="space-y-2 text-sm font-mono text-muted-foreground">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link className="hover:text-white" to={to}>{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
