const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function adminRequired(req, res, next) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const userEmail = (req.user?.email || '').toLowerCase();

  if (!adminEmails.includes(userEmail)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

router.get('/stats', authRequired, adminRequired, async (_req, res) => {
  try {
    const [users, listings, orders, revenue, recentOrders] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total_users FROM users`),
      db.query(`
        SELECT
          COUNT(*)::int AS total_listings,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_listings,
          COUNT(*) FILTER (WHERE status = 'sold')::int AS sold_listings,
          COUNT(*) FILTER (WHERE status = 'paused')::int AS paused_listings
        FROM listings
      `),
      db.query(`
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_orders,
          COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS pending_orders,
          COUNT(*) FILTER (WHERE payment_status = 'expired')::int AS expired_orders
        FROM orders
      `),
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN price_paid ELSE 0 END), 0)::numeric AS gross_sales,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN platform_fee ELSE 0 END), 0)::numeric AS platform_revenue,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN seller_earnings ELSE 0 END), 0)::numeric AS seller_earnings
        FROM orders
      `),
      db.query(`
        SELECT
          o.id,
          o.payment_status,
          o.price_paid,
          o.platform_fee,
          o.seller_earnings,
          o.created_at,
          o.campaign_starts_at,
          o.campaign_ends_at,
          l.website_name,
          l.website_url,
          advertiser.email AS advertiser_email,
          owner.email AS owner_email
        FROM orders o
        JOIN listings l ON l.id = o.listing_id
        JOIN users advertiser ON advertiser.id = o.advertiser_id
        JOIN users owner ON owner.id = l.user_id
        ORDER BY o.created_at DESC
        LIMIT 10
      `),
    ]);

    res.json({
      stats: {
        ...users.rows[0],
        ...listings.rows[0],
        ...orders.rows[0],
        ...revenue.rows[0],
      },
      recent_orders: recentOrders.rows,
    });
  } catch (err) {
    console.error('admin stats error', err);
    res.status(500).json({ error: 'Failed to load admin stats' });
  }
});

module.exports = router;
