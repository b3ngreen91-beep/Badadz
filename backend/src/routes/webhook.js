const express = require('express');
const db = require('../db');

const router = express.Router();

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
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      const listingId = session.metadata?.listing_id;
      const months = Number(session.metadata?.months || 1);

      if (orderId) {
        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + months);

        await db.query(
          `UPDATE orders
             SET payment_status='paid',
                 campaign_starts_at=$1,
                 campaign_ends_at=$2
           WHERE id=$3`,
          [now, end, orderId]
        );
        if (listingId) {
          await db.query(`UPDATE listings SET status='sold' WHERE id=$1`, [listingId]);
        }
        console.log(`[stripe] order ${orderId} marked paid`);
      }
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await db.query(`UPDATE orders SET payment_status='failed' WHERE id=$1 AND payment_status='pending'`, [orderId]);
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler error' });
  }

  res.json({ received: true });
});

module.exports = router;
