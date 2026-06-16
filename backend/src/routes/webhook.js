const express = require('express');
const db = require('../db');

const router = express.Router();

async function ensureOrderApprovalColumns() {
  await db.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'awaiting_payment',
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS denial_reason TEXT
  `);
}

// IMPORTANT: this route requires the raw body to verify the Stripe signature.
// It is mounted with express.raw() in server.js BEFORE express.json().
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  // eslint-disable-next-line global-require
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await ensureOrderApprovalColumns();

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;

      if (orderId) {
        await db.query(
          `UPDATE orders
             SET payment_status='paid',
                 approval_status='pending',
                 stripe_payment_intent_id=$1
           WHERE id=$2`,
          [session.payment_intent || null, orderId]
        );

        console.log(`[stripe] order ${orderId} marked paid and pending owner approval`);
      }
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await db.query(
          `UPDATE orders
             SET payment_status='failed', approval_status='failed'
           WHERE id=$1 AND payment_status='pending'`,
          [orderId]
        );
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler error' });
  }

  res.json({ received: true });
});

module.exports = router;
