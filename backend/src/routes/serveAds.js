const express = require('express');
const db = require('../db');

const router = express.Router();

async function ensureAdServingSchema() {
  await db.query(`
    ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS ad_slot_id TEXT
  `);

  await db.query(`
    UPDATE listings
    SET ad_slot_id = gen_random_uuid()::text
    WHERE ad_slot_id IS NULL OR ad_slot_id = ''
  `);

  await db.query(`
    DO $$ BEGIN
      ALTER TABLE listings ADD CONSTRAINT listings_ad_slot_id_unique UNIQUE (ad_slot_id);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS impression_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0
  `);
}

function jsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/<\//g, '<\\/');
}

function getApiOrigin(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function getFrontendOrigin() {
  return (process.env.FRONTEND_URL || 'https://badadz.net').split(',')[0].trim();
}

function renderScript({ imageUrl, destinationUrl, clickUrl, width, height, altText, placeholderUrl }) {
  const safeWidth = Number(width) || 728;
  const safeHeight = Number(height) || 90;

  if (!imageUrl) {
    return `
(function () {
  var script = document.currentScript;
  if (!script) return;
  var wrap = document.createElement('a');
  wrap.href = \`${jsEscape(placeholderUrl)}\`;
  wrap.target = '_blank';
  wrap.rel = 'noopener sponsored';
  wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;width:${safeWidth}px;max-width:100%;height:${safeHeight}px;border:2px dashed #FF3333;background:#111;color:#fff;font-family:Arial,sans-serif;font-size:14px;text-decoration:none;box-sizing:border-box;';
  wrap.textContent = 'Ad space available on BadAdz';
  script.parentNode.insertBefore(wrap, script);
})();`;
  }

  return `
(function () {
  var script = document.currentScript;
  if (!script) return;
  var link = document.createElement('a');
  link.href = \`${jsEscape(clickUrl || destinationUrl)}\`;
  link.target = '_blank';
  link.rel = 'noopener sponsored';
  link.style.cssText = 'display:inline-block;max-width:100%;line-height:0;text-decoration:none;';

  var img = document.createElement('img');
  img.src = \`${jsEscape(imageUrl)}\`;
  img.alt = \`${jsEscape(altText || 'Sponsored ad')}\`;
  img.width = ${safeWidth};
  img.height = ${safeHeight};
  img.loading = 'lazy';
  img.style.cssText = 'display:block;width:100%;max-width:${safeWidth}px;height:auto;border:0;';

  link.appendChild(img);
  script.parentNode.insertBefore(link, script);
})();`;
}

function parseBannerSize(size) {
  const match = String(size || '').match(/^(\d+)x(\d+)$/);
  if (!match) return { width: 728, height: 90 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

// Public embed script. Website owners paste this on their site once:
// <script async src="https://YOUR_API/api/serve/YOUR_AD_SLOT_ID.js"></script>
router.get('/:slotId.js', async (req, res) => {
  try {
    await ensureAdServingSchema();

    const requestedSize = req.query.size ? String(req.query.size) : null;
    const { rows } = await db.query(
      `
      SELECT
        l.id AS listing_id,
        l.ad_slot_id,
        l.website_name,
        o.id AS order_id,
        o.destination_url,
        c.image_url,
        c.banner_size
      FROM listings l
      LEFT JOIN LATERAL (
        SELECT *
        FROM orders o
        WHERE o.listing_id = l.id
          AND o.payment_status = 'paid'
          AND o.approval_status = 'approved'
          AND COALESCE(o.completed_at, 'infinity'::timestamptz) > NOW()
          AND (o.campaign_starts_at IS NULL OR o.campaign_starts_at <= NOW())
          AND (o.campaign_ends_at IS NULL OR o.campaign_ends_at > NOW())
        ORDER BY o.approved_at DESC NULLS LAST, o.created_at DESC
        LIMIT 1
      ) o ON TRUE
      LEFT JOIN LATERAL (
        SELECT *
        FROM campaign_creatives c
        WHERE c.order_id = o.id
        ORDER BY
          CASE WHEN $2::text IS NOT NULL AND c.banner_size = $2::text THEN 0 ELSE 1 END,
          CASE c.banner_size
            WHEN '728x90' THEN 1
            WHEN '300x250' THEN 2
            WHEN '320x50' THEN 3
            WHEN '160x600' THEN 4
            WHEN '970x250' THEN 5
            ELSE 6
          END,
          c.created_at ASC
        LIMIT 1
      ) c ON TRUE
      WHERE l.ad_slot_id = $1 OR l.id::text = $1
      LIMIT 1
      `,
      [req.params.slotId, requestedSize]
    );

    const slot = rows[0];
    const frontend = getFrontendOrigin();

    res.type('application/javascript');
    res.set('Cache-Control', 'no-store, max-age=0');

    if (!slot) {
      return res.send(renderScript({
        placeholderUrl: frontend,
        width: 728,
        height: 90,
      }));
    }

    if (!slot.order_id || !slot.image_url) {
      return res.send(renderScript({
        placeholderUrl: `${frontend}/listings/${slot.listing_id}`,
        width: 728,
        height: 90,
      }));
    }

    await db.query(
      `UPDATE orders SET impression_count = impression_count + 1 WHERE id = $1`,
      [slot.order_id]
    );

    const { width, height } = parseBannerSize(slot.banner_size);
    const clickUrl = `${getApiOrigin(req)}/api/serve/click/${slot.order_id}`;

    return res.send(renderScript({
      imageUrl: slot.image_url,
      destinationUrl: slot.destination_url,
      clickUrl,
      width,
      height,
      altText: `Sponsored ad on ${slot.website_name || 'BadAdz'}`,
    }));
  } catch (err) {
    console.error('[ad serve error]', err);
    res.type('application/javascript');
    return res.status(200).send('console.error("BadAdz ad failed to load");');
  }
});

router.get('/click/:orderId', async (req, res) => {
  try {
    await ensureAdServingSchema();

    const { rows } = await db.query(
      `
      UPDATE orders
      SET click_count = click_count + 1
      WHERE id = $1
        AND payment_status = 'paid'
        AND approval_status = 'approved'
      RETURNING destination_url
      `,
      [req.params.orderId]
    );

    const destinationUrl = rows[0]?.destination_url || getFrontendOrigin();
    return res.redirect(destinationUrl);
  } catch (err) {
    console.error('[ad click error]', err);
    return res.redirect(getFrontendOrigin());
  }
});

module.exports = router;
