import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center" data-testid="not-found-page">
      <div className="font-display font-black text-7xl text-primary">404</div>
      <h1 className="font-display font-black uppercase text-2xl tracking-tight mt-4">Lost in the marketplace.</h1>
      <p className="text-sm text-muted-foreground mt-2">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/" className="mt-6 inline-block bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors">
        Back home →
      </Link>
    </div>
  );
}
