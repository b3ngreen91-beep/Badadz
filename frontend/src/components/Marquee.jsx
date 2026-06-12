import React from 'react';

const items = [
  'BAD ADS',
  'GOOD TRAFFIC',
  'UNFILTERED REACH',
  '20% PLATFORM FEE · ZERO BULLSHIT',
  'OWNERS GET PAID',
  'ADVERTISERS GET SEEN',
];

export default function Marquee() {
  const repeated = [...items, ...items, ...items, ...items];
  return (
    <div className="border-y border-border bg-black overflow-hidden" data-testid="marquee">
      <div className="marquee-track py-4">
        {repeated.map((t, i) => (
          <span key={i} className="px-8 font-display font-black uppercase text-xl tracking-tighter whitespace-nowrap text-foreground">
            {t} <span className="text-primary mx-2">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}
