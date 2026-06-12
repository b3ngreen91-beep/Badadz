require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../db');

const SAMPLE_LISTINGS = [
  {
    website_name: 'DarkStack News',
    website_url: 'https://darkstack.news',
    description: 'Independent tech & culture publication. Edgy audience that hates corporate ads.',
    category: 'Tech',
    monthly_price: 480,
    image_url: 'https://images.unsplash.com/photo-1648134859175-78b41b4db186?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
    traffic_stats: '180k monthly uniques · 65% US · Mostly devs & founders',
  },
  {
    website_name: 'CryptoUnderground',
    website_url: 'https://cryptoug.io',
    description: 'Daily crypto market commentary. High-engagement degenerate trader audience.',
    category: 'Finance',
    monthly_price: 1200,
    image_url: 'https://images.unsplash.com/photo-1648134859177-66e35b61e106?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
    traffic_stats: '420k monthly uniques · Global · 25-40 yrs',
  },
  {
    website_name: 'Gritlift Athletics',
    website_url: 'https://gritlift.co',
    description: 'Strength sports media — programs, gear reviews, community.',
    category: 'Sports',
    monthly_price: 320,
    image_url: 'https://images.unsplash.com/photo-1648134859186-a05fb609f41e?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
    traffic_stats: '90k monthly uniques · 70% male · Powerlifting niche',
  },
  {
    website_name: 'Brutalist UX',
    website_url: 'https://brutalistux.dev',
    description: 'Design weekly newsletter & blog. Brutalist UI showcases.',
    category: 'Design',
    monthly_price: 600,
    image_url: 'https://images.unsplash.com/photo-1624676313199-cf349897f716?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
    traffic_stats: '60k monthly uniques · Designers + frontend devs',
  },
  {
    website_name: 'NoSleep Gaming',
    website_url: 'https://nosleep.gg',
    description: 'PC gaming reviews, esports coverage. Teen/young adult audience.',
    category: 'Gaming',
    monthly_price: 750,
    image_url: 'https://images.unsplash.com/photo-1553675559-5046b59a5ca5?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
    traffic_stats: '320k monthly uniques · 15-28 yrs',
  },
];

(async () => {
  try {
    const ownerHash = await bcrypt.hash('owner123!', 10);
    const advHash = await bcrypt.hash('advertiser123!', 10);

    const { rows: ownerRows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1,$2,$3,'owner')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Demo Owner', 'owner@badadz.test', ownerHash]
    );
    const ownerId = ownerRows[0].id;

    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1,$2,$3,'advertiser')
       ON CONFLICT (email) DO NOTHING`,
      ['Demo Advertiser', 'advertiser@badadz.test', advHash]
    );

    for (const l of SAMPLE_LISTINGS) {
      await db.query(
        `INSERT INTO listings (user_id, website_name, website_url, description, category, monthly_price, image_url, traffic_stats)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING`,
        [ownerId, l.website_name, l.website_url, l.description, l.category, l.monthly_price, l.image_url, l.traffic_stats]
      );
    }

    console.log('[db:seed] done.');
    console.log('  owner@badadz.test / owner123!');
    console.log('  advertiser@badadz.test / advertiser123!');
    process.exit(0);
  } catch (err) {
    console.error('[db:seed] failed:', err);
    process.exit(1);
  }
})();
