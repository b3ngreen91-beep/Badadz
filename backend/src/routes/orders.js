const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { sendCampaignPurchaseEmails } = require('../services/email');

const router = express.Router();

const platformFeePercent = () => Number(process.env.PLATFORM_FEE_PERCENT || 20);
const FIXED_CAMPAIGN_MONTHS = 1;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  // Lazy require so the server still boots if Stripe is misconfigured.
  // eslint-disable-next-line global-require
  return require('stripe')(key);
}

async function ensureOrderApprovalColumns() {
  await db.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'awaiting_payment',
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS denial_reason TEXT
  `);

  await db.query(`
    UPDATE orders
    SET approval_status = CASE
      WHEN approval_status IS NULL AND payment_status = 'paid' THEN 'approved'
      WHEN approval_status IS NULL THEN 'awaiting_payment'
      ELSE approval_status
    END
  `);
}

async function getOwnerOrder(orderId, ownerId) {
  await ensureOrderApprovalColumns();

  const { rows } = await db.query(
    `SELECT
       o.*,
       l.website_name,
       l.website_url,
       l.user_id AS seller_id,
       seller.name AS seller_name,
       seller.email AS seller_email,
       advertiser.name AS advertiser_name,
       advertiser.email AS advertiser_email
     FROM orders o
     JOIN listings l ON l.id = o.listing_id
     JOIN users seller ON seller.id = l.user_id
     JOIN users advertiser ON advertiser.id = o.advertiser_id
     WHERE o.id = $1 AND l.user_id = $2`,
    [orderId, ownerId]
  );

  return rows[0] || null;
}

// Create Stripe Checkout session
router.post(
  '/create-checkout-session',
  authRequired,
  requireRole('advertiser'),
  [body('listing_id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

    const { listing_id } = req.body;
    const months = FIXED_CAMPAIGN_MONTHS;

    try {
      await ensureOrderApprovalColumns();

      const { rows } = await db.query('SELECT * FROM listings WHERE id = $1', [listing_id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
      const listing = rows[0];
      if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is not available' });

      const unitAmount = Math.round(Number(listing.monthly_price) * 100); // cents
      const stripe = getStripe();
      const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';

      const fee = (platformFeePercent() / 100);
      const total = Number(listing.monthly_price) * months;
      const platform_fee = +(total * fee).toFixed(2);
      const seller_earnings = +(total - platform_fee).toFixed(2);

      // Insert pending order first. The webhook marks it paid after Stripe confirms payment.
      // Owner approval happens after payment, before the campaign is activated.
      const orderInsert = await db.query(
        `INSERT INTO orders (listing_id, advertiser_id, price_paid, platform_fee, seller_earnings, payment_status, approval_status)
         VALUES ($1,$2,$3,$4,$5,'pending','awaiting_payment')
         RETURNING id`,
        [listing.id, req.user.id, total, platform_fee, seller_earnings]
      );
      const orderId = orderInsert.rows[0].id;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          quantity: months,
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: {
              name: `Ad space — ${listing.website_name}`,
              description: '30-day banner placement on ' + listing.website_url,
              images: listing.image_url ? [listing.image_url] : undefined,
            },
          },
        }],
        success_url: `${frontend}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontend}/checkout/cancel?order_id=${orderId}`,
        metadata: {
          order_id: orderId,
          listing_id: listing.id,
          advertiser_id: req.user.id,
          months: String(months),
        },
      });

      await db.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);
      res.json({ url: session.url, session_id: session.id, order_id: orderId });
    } catch (err) {
      console.error('checkout session error', err);
      res.status(500).json({ error: err.message || 'Failed to create checkout session' });
    }
  }
);

// Owner: approve paid ad request
router.post('/:orderId/approve', authRequired, requireRole('owner'), async (req, res) => {
  try {
    const order = await getOwnerOrder(req.params.orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_status !== 'paid') return res.status(400).json({ error: 'Order must be paid before approval' });
    if (order.approval_status === 'denied') return res.status(400).json({ error: 'Denied orders cannot be approved' });

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + FIXED_CAMPAIGN_MONTHS);

    const { rows } = await db.query(
      `UPDATE orders
       SET approval_status = 'approved',
           approved_at = NOW(),
           campaign_starts_at = $1,
           campaign_ends_at = $2
       WHERE id = $3
       RETURNING *`,
      [now, end, order.id]
    );

    await db.query(`UPDATE listings SET status='sold' WHERE id=$1`, [order.listing_id]);

    const approvedOrder = { ...order, ...rows[0], campaign_starts_at: now, campaign_ends_at: end };
    await sendCampaignPurchaseEmails(approvedOrder);

    res.json({ order: rows[0] });
  } catch (err) {
    console.error('approve order error', err);
    res.status(500).json({ error: 'Failed to approve order' });
  }
});

// Owner: deny paid ad request and refund buyer
router.post(
  '/:orderId/deny',
  authRequired,
  requireRole('owner'),
  [body('reason').optional().isString().isLength({ max: 1000 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

    try {
      const order = await getOwnerOrder(req.params.orderId, req.user.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (order.approval_status === 'approved') return res.status(400).json({ error: 'Approved orders cannot be denied' });
      if (order.payment_status !== 'paid') return res.status(400).json({ error: 'Only paid orders can be denied and refunded' });
      if (!order.stripe_payment_intent_id) return res.status(400).json({ error: 'Payment intent missing; refund must be handled manually in Stripe' });

      const stripe = getStripe();
      await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });

      const { rows } = await db.query(
        `UPDATE orders
         SET approval_status = 'denied',
             payment_status = 'refunded',
             denied_at = NOW(),
             denial_reason = $1
         WHERE id = $2
         RETURNING *`,
        [req.body.reason || null, order.id]
      );

      await db.query(`UPDATE listings SET status='active' WHERE id=$1 AND status <> 'sold'`, [order.listing_id]);

      res.json({ order: rows[0] });
    } catch (err) {
      console.error('deny order error', err);
      res.status(500).json({ error: err.message || 'Failed to deny and refund order' });
    }
  }
);

// Verify a checkout session (called from success page)
router.get('/session/:sessionId', authRequired, async (req, res) => {
  try {
    await ensureOrderApprovalColumns();
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const { rows } = await db.query(
      `SELECT
         o.*,
         l.website_name,
         l.website_url,
         l.image_url,
         owner.name AS owner_name,
         owner.email AS owner_email
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       JOIN users owner ON owner.id = l.user_id
       WHERE o.stripe_session_id = $1`,
      [session.id]
    );
    res.json({ session: { id: session.id, payment_status: session.payment_status }, order: rows[0] || null });
  } catch (err) {
    res.status(400).json({ error: 'Could not retrieve session' });
  }
});

// Advertiser: my campaigns
router.get('/my', authRequired, requireRole('advertiser'), async (req, res) => {
  try {
    await ensureOrderApprovalColumns();
    const { rows } = await db.query(
      `SELECT
         o.*,
         l.website_name,
         l.website_url,
         l.image_url,
         l.category,
         owner.name AS owner_name,
         owner.email AS owner_email
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       JOIN users owner ON owner.id = l.user_id
       WHERE o.advertiser_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json({ orders: rows });
  } catch (err) {
    console.error('my orders error', err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

// Owner: sales / earnings
router.get('/sales', authRequired, requireRole('owner'), async (req, res) => {
  try {
    await ensureOrderApprovalColumns();
    const { rows } = await db.query(
      `SELECT o.*, l.website_name, u.name AS advertiser_name, u.email AS advertiser_email
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       JOIN users u ON u.id = o.advertiser_id
       WHERE l.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    const stats = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN o.payment_status='paid' AND o.approval_status='approved' THEN o.seller_earnings ELSE 0 END),0)::numeric AS total_earnings,
         COALESCE(SUM(CASE WHEN o.payment_status='paid' AND o.approval_status='approved' THEN 1 ELSE 0 END),0)::int AS paid_count
       FROM orders o JOIN listings l ON l.id = o.listing_id
       WHERE l.user_id = $1`,
      [req.user.id]
    );
    res.json({ orders: rows, stats: stats.rows[0] });
  } catch (err) {
    console.error('sales error', err);
    res.status(500).json({ error: 'Failed to load sales' });
  }
});

module.exports = router;
