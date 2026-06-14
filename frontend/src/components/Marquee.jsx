import React from 'react';

const items = [
  'BAD ADS',
  'GOOD TRAFFIC',
  'UNFILTERED REACH',
  '20% PLATFORM FEE',
  'OWNERS GET PAID',
  'ADVERTISERS GET SEEN',
];

export default function Marquee() {
  return (
    <div className="border-y border-border bg-black overflow-hidden" data-testid="marquee">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 py-4 md:gap-x-10 md:flex-nowrap md:justify-start">
        {items.map((t, i) => (
          <span
            key={i}
            className="font-display font-black uppercase text-base md:text-xl tracking-tighter whitespace-nowrap text-foreground"
          >
            {t} <span className="text-primary ml-2">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}
