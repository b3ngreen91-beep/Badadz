const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

const platformFeePercent = () => Number(process.env.PLATFORM_FEE_PERCENT || 20);
const FIXED_CAMPAIGN_MONTHS = 1;
const CREATIVE_SIZES = ['728x90', '300x250', '160x600', '320x50', '970x250'];
const CREATIVE_DIMENSIONS = {
  '728x90': { width: 728, height: 90 },
  '300x250': { width: 300, height: 250 },
  '160x600': { width: 160, height: 600 },
  '320x50': { width: 320, height: 50 },
  '970x250': { width: 970, height: 250 },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: CREATIVE_SIZES.length + 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
});

if (process.env.CLOUDINARY_URL) cloudinary.config({ secure: true });

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return require('stripe')(key);
}

async function ensureCreativeSchema() {
  await db.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'awaiting_payment',
    ADD COLUMN IF NOT EXISTS destination_url TEXT,
    ADD COLUMN IF NOT EXISTS advertiser_notes TEXT,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS impression_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0
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
}

async function uploadCreative(file, orderId, bannerSize, autoResize) {
  if (!process.env.CLOUDINARY_URL) throw new Error('Creative uploads are not configured');
  const dims = CREATIVE_DIMENSIONS[bannerSize];

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `badadz/campaigns/${orderId}`,
        resource_type: 'image',
        public_id: `${autoResize ? 'auto-fit' : 'manual'}-${bannerSize}-${Date.now()}`,
        ...(autoResize ? {
          transformation: [{
            width: dims.width,
            height: dims.height,
            crop: 'pad',
            background: 'black',
            gravity: 'center',
          }],
        } : {}),
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

router.post(
  '/create-checkout-session',
  authRequired,
  requireRole('advertiser'),
  upload.fields([
    { name: 'auto_creative', maxCount: 1 },
    ...CREATIVE_SIZES.map((size) => ({ name: `creative_${size}`, maxCount: 1 })),
  ]),
  [
    body('listing_id').isUUID(),
    body('destination_url').isURL({ require_protocol: true }),
    body('advertiser_notes').optional({ checkFalsy: true }).isString().isLength({ max: 1000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

    try {
      await ensureCreativeSchema();

      const { listing_id, destination_url, advertiser_notes = '' } = req.body;
      const months = FIXED_CAMPAIGN_MONTHS;
      const autoFile = req.files?.auto_creative?.[0] || null;
      const exactFiles = CREATIVE_SIZES
        .map((size) => ({ size, file: req.files?.[`creative_${size}`]?.[0], autoResize: false }))
        .filter((item) => item.file);

      let creativeJobs = [...exactFiles];
      if (autoFile) {
        const exactSizes = new Set(exactFiles.map((item) => item.size));
        creativeJobs = creativeJobs.concat(
          CREATIVE_SIZES
            .filter((size) => !exactSizes.has(size))
            .map((size) => ({ size, file: autoFile, autoResize: true }))
        );
      }

      if (creativeJobs.length === 0) return res.status(400).json({ error: 'Upload one image or at least one exact banner creative' });

      const { rows } = await db.query('SELECT * FROM listings WHERE id = $1', [listing_id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
      const listing = rows[0];
      if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is not available' });

      const total = Number(listing.monthly_price) * months;
      const fee = platformFeePercent() / 100;
      const platform_fee = +(total * fee).toFixed(2);
      const seller_earnings = +(total - platform_fee).toFixed(2);

      const orderInsert = await db.query(
        `INSERT INTO orders (
          listing_id, advertiser_id, price_paid, platform_fee, seller_earnings,
          payment_status, approval_status, destination_url, advertiser_notes
        ) VALUES ($1,$2,$3,$4,$5,'pending','awaiting_payment',$6,$7)
        RETURNING id`,
        [listing.id, req.user.id, total, platform_fee, seller_earnings, destination_url, advertiser_notes]
      );
      const orderId = orderInsert.rows[0].id;

      for (const item of creativeJobs) {
        const uploaded = await uploadCreative(item.file, orderId, item.size, item.autoResize);
        await db.query('INSERT INTO campaign_creatives (order_id, banner_size, image_url) VALUES ($1,$2,$3)', [orderId, item.size, uploaded.secure_url]);
      }

      const stripe = getStripe();
      const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          quantity: months,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(listing.monthly_price) * 100),
            product_data: {
              name: `Ad space — ${listing.website_name}`,
              description: '30-day banner placement on ' + listing.website_url,
              images: listing.image_url ? [listing.image_url] : undefined,
            },
          },
        }],
        success_url: `${frontend}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontend}/checkout/cancel?order_id=${orderId}`,
        metadata: { order_id: orderId, listing_id: listing.id, advertiser_id: req.user.id, months: String(months) },
      });

      await db.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);
      return res.json({ url: session.url, session_id: session.id, order_id: orderId });
    } catch (err) {
      console.error('auto creative checkout error', err);
      return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
    }
  }
);

module.exports = router;
