const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const FOUNDING_LIMIT = 50;

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

async function ensureAdminColumns() {
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
    ADD COLUMN IF NOT EXISTS founding_member BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS promo_code_used TEXT,
    ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE
  `);

  await db.query(`
    ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS ad_code_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ad_code_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ad_code_last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ad_code_last_seen_url TEXT,
    ADD COLUMN IF NOT EXISTS ad_code_last_seen_domain TEXT
  `);
}

router.get('/stats', authRequired, adminRequired, async (_req, res) => {
  try {
    await ensureAdminColumns();

    const [users, listings, orders, revenue, recentOrders, recentUsers, installStatus, founderStatus, pendingReviews, activeCampaigns] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE role = 'owner')::int AS website_owners,
          COUNT(*) FILTER (WHERE role = 'advertiser')::int AS advertisers,
          COUNT(*) FILTER (WHERE founding_member = TRUE)::int AS founding_sellers,
          COUNT(*) FILTER (WHERE stripe_connect_onboarding_complete = TRUE)::int AS stripe_connected_owners
        FROM users
      `),
      db.query(`
        SELECT
          COUNT(*)::int AS total_listings,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_listings,
          COUNT(*) FILTER (WHERE status = 'sold')::int AS sold_listings,
          COUNT(*) FILTER (WHERE status = 'paused')::int AS paused_listings,
          COUNT(*) FILTER (WHERE ad_code_verified = TRUE)::int AS verified_listings,
          COUNT(*) FILTER (WHERE ad_code_last_seen_at IS NOT NULL)::int AS script_seen_listings
        FROM listings
      `),
      db.query(`
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_orders,
          COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS pending_payment_orders,
          COUNT(*) FILTER (WHERE approval_status IN ('pending', 'awaiting_approval') AND payment_status = 'paid')::int AS pending_approval_orders,
          COUNT(*) FILTER (WHERE payment_status = 'expired')::int AS expired_orders,
          COUNT(*) FILTER (WHERE payment_status = 'paid' AND approval_status = 'approved' AND (campaign_ends_at IS NULL OR campaign_ends_at > NOW()))::int AS active_campaigns
        FROM orders
      `),
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN price_paid ELSE 0 END), 0)::numeric AS gross_sales,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN platform_fee ELSE 0 END), 0)::numeric AS platform_revenue,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN seller_earnings ELSE 0 END), 0)::numeric AS seller_earnings,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN impression_count ELSE 0 END), 0)::int AS impressions,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN click_count ELSE 0 END), 0)::int AS clicks
        FROM orders
      `),
      db.query(`
        SELECT
          o.id,
          o.payment_status,
          o.approval_status,
          o.price_paid,
          o.platform_fee,
          o.seller_earnings,
          o.created_at,
          o.campaign_starts_at,
          o.campaign_ends_at,
          o.impression_count,
          o.click_count,
          l.website_name,
          l.website_url,
          advertiser.email AS advertiser_email,
          owner.email AS owner_email
        FROM orders o
        JOIN listings l ON l.id = o.listing_id
        JOIN users advertiser ON advertiser.id = o.advertiser_id
        JOIN users owner ON owner.id = l.user_id
        ORDER BY o.created_at DESC
        LIMIT 12
      `),
      db.query(`
        SELECT id, name, email, role, founding_member, commission_rate, stripe_connect_onboarding_complete, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 12
      `),
      db.query(`
        SELECT
          l.id,
          l.website_name,
          l.website_url,
          l.status,
          l.ad_code_verified,
          l.ad_code_verified_at,
          l.ad_code_last_seen_at,
          l.ad_code_last_seen_domain,
          l.ad_code_last_seen_url,
          owner.email AS owner_email
        FROM listings l
        JOIN users owner ON owner.id = l.user_id
        ORDER BY COALESCE(l.ad_code_last_seen_at, l.created_at) DESC
        LIMIT 20
      `),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE founding_member = TRUE)::int AS claimed,
          ${FOUNDING_LIMIT}::int AS limit,
          GREATEST(${FOUNDING_LIMIT} - COUNT(*) FILTER (WHERE founding_member = TRUE), 0)::int AS remaining
        FROM users
      `),
      db.query(`
        SELECT
          o.id,
          o.created_at,
          o.price_paid,
          o.destination_url,
          l.website_name,
          l.website_url,
          advertiser.name AS advertiser_name,
          advertiser.email AS advertiser_email,
          owner.email AS owner_email
        FROM orders o
        JOIN listings l ON l.id = o.listing_id
        JOIN users advertiser ON advertiser.id = o.advertiser_id
        JOIN users owner ON owner.id = l.user_id
        WHERE o.payment_status = 'paid'
          AND o.approval_status IN ('pending', 'awaiting_approval')
        ORDER BY o.created_at ASC
        LIMIT 20
      `),
      db.query(`
        SELECT
          o.id,
          o.created_at,
          o.campaign_starts_at,
          o.campaign_ends_at,
          o.impression_count,
          o.click_count,
          l.website_name,
          l.website_url,
          owner.email AS owner_email
        FROM orders o
        JOIN listings l ON l.id = o.listing_id
        JOIN users owner ON owner.id = l.user_id
        WHERE o.payment_status = 'paid'
          AND o.approval_status = 'approved'
          AND (o.campaign_ends_at IS NULL OR o.campaign_ends_at > NOW())
        ORDER BY o.approved_at DESC NULLS LAST, o.created_at DESC
        LIMIT 20
      `),
    ]);

    const stats = {
      ...users.rows[0],
      ...listings.rows[0],
      ...orders.rows[0],
      ...revenue.rows[0],
      founding_seller_limit: founderStatus.rows[0]?.limit || FOUNDING_LIMIT,
      founding_seller_spots_remaining: founderStatus.rows[0]?.remaining || 0,
    };

    res.json({
      stats,
      founder_status: founderStatus.rows[0],
      recent_orders: recentOrders.rows,
      recent_users: recentUsers.rows,
      install_status: installStatus.rows,
      pending_reviews: pendingReviews.rows,
      active_campaigns: activeCampaigns.rows,
    });
  } catch (err) {
    console.error('admin stats error', err);
    res.status(500).json({ error: 'Failed to load admin stats' });
  }
});

module.exports = router;
