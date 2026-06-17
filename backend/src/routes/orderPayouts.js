const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { sendCampaignPurchaseEmails } = require('../services/email');

const router = express.Router();
const FIXED_CAMPAIGN_MONTHS = 1;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  // eslint-disable-next-line global-require
  return require('stripe')(key);
}

function cents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

async function ensurePayoutColumns() {
  await db.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'awaiting_payment',
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS seller_payout_status TEXT NOT NULL DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
    ADD COLUMN IF NOT EXISTS seller_payout_error TEXT,
    ADD COLUMN IF NOT EXISTS seller_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS campaign_starts_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS campaign_ends_at TIMESTAMPTZ
  `);
}

async function getOwnerOrder(orderId, ownerId) {
  await ensurePayoutColumns();

  const { rows } = await db.query(
    `SELECT
       o.*,
       l.website_name,
       l.website_url,
       l.user_id AS seller_id,
       seller.name AS seller_name,
       seller.email AS seller_email,
       seller.stripe_connect_account_id AS seller_stripe_connect_account_id,
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

async function getStripePaymentIntentId(order, stripe) {
  if (order.stripe_payment_intent_id) return order.stripe_payment_intent_id;

  if (!order.stripe_session_id) {
    throw new Error('Stripe session missing; seller payout cannot be created');
  }

  const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error('Payment intent missing from Stripe checkout session');
  }

  await db.query(
    'UPDATE orders SET stripe_payment_intent_id = $1 WHERE id = $2',
    [paymentIntentId, order.id]
  );

  return paymentIntentId;
}

async function getLatestChargeId(order, stripe) {
  const paymentIntentId = await getStripePaymentIntentId(order, stripe);
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });

  const chargeId = typeof paymentIntent.latest_charge === 'string'
    ? paymentIntent.latest_charge
    : paymentIntent.latest_charge?.id;

  if (!chargeId) throw new Error('Latest Stripe charge missing; seller payout cannot be created');
  return chargeId;
}

async function validateConnectedSellerAccount(order, stripe) {
  if (!order.seller_stripe_connect_account_id) {
    throw new Error('Seller has no Stripe Connect account connected');
  }

  const account = await stripe.accounts.retrieve(order.seller_stripe_connect_account_id);

  if (!account.details_submitted) {
    throw new Error('Seller Stripe onboarding is incomplete');
  }

  if (!account.charges_enabled || !account.payouts_enabled) {
    const reason = account.requirements?.disabled_reason || 'Stripe account is not fully enabled';
    throw new Error(`Seller Stripe account is not payout-ready: ${reason}`);
  }

  return account;
}

async function transferSellerEarnings(order) {
  await ensurePayoutColumns();

  const sellerEarningsCents = cents(order.seller_earnings);

  if (sellerEarningsCents <= 0) {
    await db.query(
      `UPDATE orders
       SET seller_payout_status = 'skipped', seller_payout_error = NULL
       WHERE id = $1`,
      [order.id]
    );
    return { skipped: true, reason: 'No seller payout needed for $0 earnings' };
  }

  if (order.stripe_transfer_id || order.seller_payout_status === 'paid') {
    return { skipped: true, reason: 'Seller payout already created', transfer_id: order.stripe_transfer_id };
  }

  const stripe = getStripe();
  await validateConnectedSellerAccount(order, stripe);
  const chargeId = await getLatestChargeId(order, stripe);

  const transfer = await stripe.transfers.create({
    amount: sellerEarningsCents,
    currency: 'usd',
    destination: order.seller_stripe_connect_account_id,
    source_transaction: chargeId,
    transfer_group: `ORDER_${order.id}`,
    metadata: {
      order_id: order.id,
      listing_id: order.listing_id,
      seller_id: order.seller_id,
      seller_earnings: String(order.seller_earnings || 0),
      platform_fee: String(order.platform_fee || 0),
    },
  }, {
    idempotencyKey: `badadz_seller_payout_${order.id}`,
  });

  await db.query(
    `UPDATE orders
     SET seller_payout_status = 'paid',
         stripe_transfer_id = $1,
         seller_paid_at = NOW(),
         seller_payout_error = NULL
     WHERE id = $2`,
    [transfer.id, order.id]
  );

  return { transfer_id: transfer.id };
}

async function markPayoutFailed(orderId, err) {
  await db.query(
    `UPDATE orders
     SET seller_payout_status = 'failed', seller_payout_error = $1
     WHERE id = $2`,
    [err.message || 'Seller payout failed', orderId]
  );
}

async function retryOwnerPayouts(ownerId) {
  await ensurePayoutColumns();

  const { rows } = await db.query(
    `SELECT
       o.*,
       l.user_id AS seller_id,
       seller.stripe_connect_account_id AS seller_stripe_connect_account_id
     FROM orders o
     JOIN listings l ON l.id = o.listing_id
     JOIN users seller ON seller.id = l.user_id
     WHERE l.user_id = $1
       AND o.payment_status = 'paid'
       AND o.approval_status = 'approved'
       AND COALESCE(o.seller_earnings, 0) > 0
       AND (o.seller_payout_status IS NULL OR o.seller_payout_status IN ('not_started', 'failed', 'processing'))
       AND o.stripe_transfer_id IS NULL
     ORDER BY o.created_at DESC
     LIMIT 5`,
    [ownerId]
  );

  for (const order of rows) {
    try {
      await transferSellerEarnings(order);
    } catch (err) {
      console.error('[seller payout retry failed]', order.id, err.message);
      await markPayoutFailed(order.id, err);
    }
  }
}

// Run before the normal /orders/sales route so existing approved paid orders can get payout retried.
router.get('/sales', authRequired, requireRole('owner'), async (req, _res, next) => {
  try {
    await retryOwnerPayouts(req.user.id);
  } catch (err) {
    console.error('[seller payout sales precheck failed]', err);
  }
  next();
});

// Override approve route with payout-first logic.
router.post('/:orderId/approve', authRequired, requireRole('owner'), async (req, res) => {
  try {
    const order = await getOwnerOrder(req.params.orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_status !== 'paid') return res.status(400).json({ error: 'Order must be paid before approval' });
    if (order.approval_status === 'denied') return res.status(400).json({ error: 'Denied orders cannot be approved' });

    let payoutResult = null;
    try {
      payoutResult = await transferSellerEarnings(order);
    } catch (err) {
      await markPayoutFailed(order.id, err);
      return res.status(400).json({ error: err.message || 'Seller payout failed' });
    }

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + FIXED_CAMPAIGN_MONTHS);

    const shouldStartCampaign = order.approval_status !== 'approved';

    const { rows } = await db.query(
      `UPDATE orders
       SET approval_status = 'approved',
           approved_at = COALESCE(approved_at, NOW()),
           campaign_starts_at = COALESCE(campaign_starts_at, $1),
           campaign_ends_at = COALESCE(campaign_ends_at, $2)
       WHERE id = $3
       RETURNING *`,
      [now, end, order.id]
    );

    await db.query(`UPDATE listings SET status='sold' WHERE id=$1`, [order.listing_id]);

    if (shouldStartCampaign) {
      const approvedOrder = { ...order, ...rows[0], campaign_starts_at: now, campaign_ends_at: end };
      await sendCampaignPurchaseEmails(approvedOrder);
    }

    return res.json({ order: rows[0], payout: payoutResult });
  } catch (err) {
    console.error('[approve with payout error]', err);
    return res.status(500).json({ error: err.message || 'Failed to approve and transfer seller payout' });
  }
});

module.exports = router;
