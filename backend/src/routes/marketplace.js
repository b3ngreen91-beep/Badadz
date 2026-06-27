const express = require('express');
const db = require('../db');

const router = express.Router();

const FOUNDING_PROMO_LIMIT = 50;

async function ensureFounderColumns() {
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
    ADD COLUMN IF NOT EXISTS founding_member BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS promo_code_used TEXT
  `);
}

router.get('/stats', async (_req, res) => {
  try {
    await ensureFounderColumns();

    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM listings WHERE status = 'active') AS active_websites,
        (SELECT COUNT(*)::int FROM orders WHERE payment_status = 'paid' AND approval_status = 'approved' AND (campaign_ends_at IS NULL OR campaign_ends_at > NOW())) AS active_campaigns,
        COALESCE((SELECT SUM(impression_count)::int FROM orders WHERE payment_status = 'paid'), 0) AS total_impressions,
        COALESCE((SELECT SUM(click_count)::int FROM orders WHERE payment_status = 'paid'), 0) AS total_clicks,
        (SELECT COUNT(*)::int FROM users WHERE founding_member = TRUE AND promo_code_used = 'FOUNDING50') AS founding_sellers_claimed
    `);

    const stats = rows[0] || {
      active_websites: 0,
      active_campaigns: 0,
      total_impressions: 0,
      total_clicks: 0,
      founding_sellers_claimed: 0,
    };

    stats.founding_seller_limit = FOUNDING_PROMO_LIMIT;
    stats.founding_seller_spots_remaining = Math.max(FOUNDING_PROMO_LIMIT - Number(stats.founding_sellers_claimed || 0), 0);

    res.json({ stats });
  } catch (err) {
    console.error('marketplace stats error', err);
    res.status(500).json({ error: 'Failed to load marketplace stats' });
  }
});

module.exports = router;
