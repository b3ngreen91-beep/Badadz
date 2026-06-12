const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

const platformFeePercent = () => Number(process.env.PLATFORM_FEE_PERCENT || 20);

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  // Lazy require so the server still boots if Stripe is misconfigured.
  // eslint-disable-next-line global-require
  return require('stripe')(key);
}

// Create Stripe Checkout session
router.post(
  '/create-checkout-session',
  authRequired,
  requireRole('advertiser'),
  [body('listing_id').isUUID(), body('months').optional().isInt({ min: 1, max: 12 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

    const { listing_id, months = 1 } = req.body;
    try {
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

      // Insert pending order first
      const orderInsert = await db.query(
        `INSERT INTO orders (listing_id, advertiser_id, price_paid, platform_fee, seller_earnings, payment_status)
         VALUES ($1,$2,$3,$4,$5,'pending')
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
              description: `${months} month(s) banner placement on ${listing.website_url}`,
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

// Verify a checkout session (called from success page)
router.get('/session/:sessionId', authRequired, async (req, res) => {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const { rows } = await db.query(
      `SELECT o.*, l.website_name, l.website_url, l.image_url
       FROM orders o JOIN listings l ON l.id = o.listing_id
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
    const { rows } = await db.query(
      `SELECT o.*, l.website_name, l.website_url, l.image_url, l.category
       FROM orders o JOIN listings l ON l.id = o.listing_id
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
         COALESCE(SUM(CASE WHEN o.payment_status='paid' THEN o.seller_earnings ELSE 0 END),0)::numeric AS total_earnings,
         COALESCE(SUM(CASE WHEN o.payment_status='paid' THEN 1 ELSE 0 END),0)::int AS paid_count
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
