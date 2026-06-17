const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { sendCampaignPurchaseEmails } = require('../services/email');

const router = express.Router();

const platformFeePercent = () => Number(process.env.PLATFORM_FEE_PERCENT || 20);
const FIXED_CAMPAIGN_MONTHS = 1;
const CREATIVE_SIZES = ['728x90', '300x250', '160x600', '320x50', '970x250'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: CREATIVE_SIZES.length },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  // Lazy require so the server still boots if Stripe is misconfigured.
  // eslint-disable-next-line global-require
  return require('stripe')(key);
}

function cents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

async function uploadToCloudinary(file, orderId, bannerSize) {
  if (!process.env.CLOUDINARY_URL) throw new Error('Creative uploads are not configured');

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `badadz/campaigns/${orderId}`,
        resource_type: 'image',
        public_id: `${bannerSize}-${Date.now()}`,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

async function ensureOrderApprovalColumns() {
  await db.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'awaiting_payment',
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS denial_reason TEXT,
    ADD COLUMN IF NOT EXISTS destination_url TEXT,
    ADD COLUMN IF NOT EXISTS advertiser_notes TEXT,
    ADD COLUMN IF NOT EXISTS seller_payout_status TEXT NOT NULL DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
    ADD COLUMN IF NOT EXISTS seller_payout_error TEXT,
    ADD COLUMN IF NOT EXISTS seller_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS campaign_creatives (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      banner_size TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_campaign_creatives_order_id ON campaign_creatives(order_id)`);

  await db.query(`
    UPDATE orders
    SET approval_status = CASE
      WHEN approval_status IS NULL AND payment_status = 'paid' THEN 'approved'
      WHEN approval_status IS NULL THEN 'awaiting_payment'
      ELSE approval_status
    END
  `);
}

async function expireCompletedCampaigns() {
  await ensureOrderApprovalColumns();

  const { rows: expiredOrders } = await db.query(`
    UPDATE orders
    SET completed_at = NOW()
    WHERE payment_status = 'paid'
      AND approval_status = 'approved'
      AND campaign_ends_at IS NOT NULL
      AND campaign_ends_at <= NOW()
      AND completed_at IS NULL
    RETURNING id, listing_id
  `);

  for (const order of expiredOrders) {
    await db.query(
      `
      UPDATE listings
      SET status = 'active', updated_at = NOW()
      WHERE id = $1
        AND status = 'sold'
        AND NOT EXISTS (
          SELECT 1
          FROM orders active_order
          WHERE active_order.listing_id = $1
            AND active_order.payment_status = 'paid'
            AND active_order.approval_status = 'approved'
            AND active_order.completed_at IS NULL
            AND active_order.campaign_ends_at IS NOT NULL
            AND active_order.campaign_ends_at > NOW()
        )
      `,
      [order.listing_id]
    );
  }

  return expiredOrders.length;
}

function creativesJsonSelect() {
  return `COALESCE((
    SELECT json_agg(json_build_object(
      'id', c.id,
      'banner_size', c.banner_size,
      'image_url', c.image_url,
      'created_at', c.created_at
    ) ORDER BY c.created_at ASC)
    FROM campaign_creatives c
    WHERE c.order_id = o.id
  ), '[]'::json) AS creatives`;
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
       seller.stripe_connect_account_id AS seller_stripe_connect_account_id,
       seller.stripe_connect_onboarding_complete AS seller_stripe_connect_onboarding_complete,
       advertiser.name AS advertiser_name,
       advertiser.email AS advertiser_email,
       ${creativesJsonSelect()}
     FROM orders o
     JOIN listings l ON l.id = o.listing_id
     JOIN users seller ON seller.id = l.user_id
     JOIN users advertiser ON advertiser.id = o.advertiser_id
     WHERE o.id = $1 AND l.user_id = $2`,
    [orderId, ownerId]
  );

  return rows[0] || null;
}

async function getPaymentIntentForOrder(order, stripe) {
  if (order.stripe_payment_intent_id) return order.stripe_payment_intent_id;

  if (!order.stripe_session_id) {
    throw new Error('Stripe session missing; refund must be handled manually in Stripe');
  }

  const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error('Payment intent missing from Stripe session; refund must be handled manually in Stripe');
  }

  await db.query(
    'UPDATE orders SET stripe_payment_intent_id = $1 WHERE id = $2',
    [paymentIntentId, order.id]
  );

  return paymentIntentId;
}

async function getLatestChargeForOrder(order, stripe) {
  const paymentIntentId = await getPaymentIntentForOrder(order, stripe);
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });

  const chargeId = typeof paymentIntent.latest_charge === 'string'
    ? paymentIntent.latest_charge
    : paymentIntent.latest_charge?.id;

  return chargeId || null;
}

async function transferSellerEarnings(order) {
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

  if (order.stripe_transfer_id) {
    return { skipped: true, reason: 'Seller payout already created', transfer_id: order.stripe_transfer_id };
  }

  if (!order.seller_stripe_connect_account_id || !order.seller_stripe_connect_onboarding_complete) {
    throw new Error('Seller Stripe Connect account is not ready for payouts');
  }

  const stripe = getStripe();
  const chargeId = await getLatestChargeForOrder(order, stripe);

  const transfer = await stripe.transfers.create({
    amount: sellerEarningsCents,
    currency: 'usd',
    destination: order.seller_stripe_connect_account_id,
    transfer_group: `ORDER_${order.id}`,
    ...(chargeId ? { source_transaction: chargeId } : {}),
    metadata: {
      order_id: order.id,
      listing_id: order.listing_id,
      seller_id: order.seller_id,
      platform_fee: String(order.platform_fee || 0),
      seller_earnings: String(order.seller_earnings || 0),
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

async function markOrderDenied(order, reason, paymentStatus = 'refunded', paymentIntentId = null) {
  const { rows } = await db.query(
    `UPDATE orders
     SET approval_status = 'denied',
         payment_status = $1,
         stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
         denied_at = NOW(),
         denial_reason = $3
     WHERE id = $4
     RETURNING *`,
    [paymentStatus, paymentIntentId, reason || null, order.id]
  );

  return rows[0];
}

// Create Stripe Checkout session with advertiser creative uploads
router.post(
  '/create-checkout-session',
  authRequired,
  requireRole('advertiser'),
  upload.fields(CREATIVE_SIZES.map((size) => ({ name: `creative_${size}`, maxCount: 1 }))),
  [
    body('listing_id').isUUID(),
    body('destination_url').isURL({ require_protocol: true }),
    body('advertiser_notes').optional({ checkFalsy: true }).isString().isLength({ max: 1000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

    const { listing_id, destination_url, advertiser_notes = '' } = req.body;
    const months = FIXED_CAMPAIGN_MONTHS;

    try {
      await expireCompletedCampaigns();

      const uploadedFiles = CREATIVE_SIZES
        .map((size) => ({ size, file: req.files?.[`creative_${size}`]?.[0] }))
        .filter((item) => item.file);

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'Upload at least one banner creative' });
      }

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

      const orderInsert = await db.query(
        `INSERT INTO orders (
           listing_id, advertiser_id, price_paid, platform_fee, seller_earnings,
           payment_status, approval_status, destination_url, advertiser_notes
         )
         VALUES ($1,$2,$3,$4,$5,'pending','awaiting_payment',$6,$7)
         RETURNING id`,
        [listing.id, req.user.id, total, platform_fee, seller_earnings, destination_url, advertiser_notes]
      );
      const orderId = orderInsert.rows[0].id;

      for (const item of uploadedFiles) {
        const uploaded = await uploadToCloudinary(item.file, orderId, item.size);
        await db.query(
          `INSERT INTO campaign_creatives (order_id, banner_size, image_url) VALUES ($1,$2,$3)`,
          [orderId, item.size, uploaded.secure_url]
        );
      }

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

// Owner: approve paid ad request, start campaign, and transfer seller earnings.
router.post('/:orderId/approve', authRequired, requireRole('owner'), async (req, res) => {
  try {
    await expireCompletedCampaigns();

    const order = await getOwnerOrder(req.params.orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_status !== 'paid') return res.status(400).json({ error: 'Order must be paid before approval' });
    if (order.approval_status === 'denied') return res.status(400).json({ error: 'Denied orders cannot be approved' });
    if (order.approval_status === 'approved') return res.status(400).json({ error: 'Order already approved' });

    let payoutResult;
    try {
      payoutResult = await transferSellerEarnings(order);
    } catch (payoutErr) {
      await db.query(
        `UPDATE orders
         SET seller_payout_status = 'failed', seller_payout_error = $1
         WHERE id = $2`,
        [payoutErr.message || 'Seller payout failed', order.id]
      );
      throw payoutErr;
    }

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + FIXED_CAMPAIGN_MONTHS);

    const { rows } = await db.query(
      `UPDATE orders
       SET approval_status = 'approved',
           approved_at = NOW(),
           completed_at = NULL,
           campaign_starts_at = $1,
           campaign_ends_at = $2
       WHERE id = $3
       RETURNING *`,
      [now, end, order.id]
    );

    await db.query(`UPDATE listings SET status='sold' WHERE id=$1`, [order.listing_id]);

    const approvedOrder = { ...order, ...rows[0], campaign_starts_at: now, campaign_ends_at: end };
    await sendCampaignPurchaseEmails(approvedOrder);

    res.json({ order: rows[0], payout: payoutResult });
  } catch (err) {
    console.error('approve order error', err);
    res.status(500).json({ error: err.message || 'Failed to approve order and transfer seller payout' });
  }
});

// Owner: deny paid ad request and automatically refund buyer when money was charged.
router.post(
  '/:orderId/deny',
  authRequired,
  requireRole('owner'),
  [body('reason').optional().isString().isLength({ max: 1000 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

    try {
      await expireCompletedCampaigns();

      const order = await getOwnerOrder(req.params.orderId, req.user.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (order.approval_status === 'approved') return res.status(400).json({ error: 'Approved orders cannot be denied' });
      if (order.payment_status !== 'paid') return res.status(400).json({ error: 'Only paid orders can be denied' });

      const pricePaid = Number(order.price_paid || 0);

      if (!Number.isFinite(pricePaid) || pricePaid <= 0) {
        const deniedOrder = await markOrderDenied(order, req.body.reason || 'Denied by website owner', 'refunded', null);
        return res.json({ order: deniedOrder, refund_skipped: true, reason: 'No Stripe refund needed for a $0 order' });
      }

      const stripe = getStripe();
      const paymentIntentId = await getPaymentIntentForOrder(order, stripe);
      await stripe.refunds.create({ payment_intent: paymentIntentId });

      const deniedOrder = await markOrderDenied(order, req.body.reason || 'Denied by website owner', 'refunded', paymentIntentId);
      return res.json({ order: deniedOrder, refund_skipped: false });
    } catch (err) {
      console.error('deny order error', err);
      res.status(500).json({ error: err.message || 'Failed to deny and refund order' });
    }
  }
);

// Verify a checkout session (called from success page)
router.get('/session/:sessionId', authRequired, async (req, res) => {
  try {
    await expireCompletedCampaigns();

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

    if (paymentIntentId) {
      await db.query(
        'UPDATE orders SET stripe_payment_intent_id = $1 WHERE stripe_session_id = $2 AND stripe_payment_intent_id IS NULL',
        [paymentIntentId, session.id]
      );
    }

    const { rows } = await db.query(
      `SELECT
         o.*,
         l.website_name,
         l.website_url,
         l.image_url,
         owner.name AS owner_name,
         owner.email AS owner_email,
         ${creativesJsonSelect()}
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
    await expireCompletedCampaigns();

    const { rows } = await db.query(
      `SELECT
         o.*,
         l.website_name,
         l.website_url,
         l.image_url,
         l.category,
         owner.name AS owner_name,
         owner.email AS owner_email,
         ${creativesJsonSelect()}
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
    await expireCompletedCampaigns();

    const { rows } = await db.query(
      `SELECT o.*, l.website_name, u.name AS advertiser_name, u.email AS advertiser_email, ${creativesJsonSelect()}
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
