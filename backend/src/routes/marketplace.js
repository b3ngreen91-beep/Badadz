const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/stats', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM listings WHERE status = 'active') AS active_websites,
        (SELECT COUNT(*)::int FROM orders WHERE payment_status = 'paid' AND approval_status = 'approved' AND (campaign_ends_at IS NULL OR campaign_ends_at > NOW())) AS active_campaigns,
        COALESCE((SELECT SUM(impression_count)::int FROM orders WHERE payment_status = 'paid'), 0) AS total_impressions,
        COALESCE((SELECT SUM(click_count)::int FROM orders WHERE payment_status = 'paid'), 0) AS total_clicks
    `);

    res.json({ stats: rows[0] || { active_websites: 0, active_campaigns: 0, total_impressions: 0, total_clicks: 0 } });
  } catch (err) {
    console.error('marketplace stats error', err);
    res.status(500).json({ error: 'Failed to load marketplace stats' });
  }
});

module.exports = router;
