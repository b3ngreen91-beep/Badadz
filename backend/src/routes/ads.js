const express = require('express');
const db = require('../db');

const router = express.Router();

function publicBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL || process.env.BACKEND_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function pickCreative(creatives, requestedSize) {
  if (!Array.isArray(creatives) || creatives.length === 0) return null;
  if (requestedSize) {
    const exact = creatives.find((creative) => creative.banner_size === requestedSize);
    if (exact) return exact;
  }
  return creatives[0];
}

async function ensureAdServingColumns() {
  await db.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS impression_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_impression_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_click_at TIMESTAMPTZ
  `);
}

async function getActiveCampaignForListing(listingId) {
  await ensureAdServingColumns();

  const { rows } = await db.query(
    `
    SELECT
      o.id,
      o.listing_id,
      o.destination_url,
      o.campaign_starts_at,
      o.campaign_ends_at,
      o.impression_count,
      o.click_count,
      l.website_name,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', c.id,
          'banner_size', c.banner_size,
          'image_url', c.image_url
        ) ORDER BY c.created_at ASC)
        FROM campaign_creatives c
        WHERE c.order_id = o.id
      ), '[]'::json) AS creatives
    FROM orders o
    JOIN listings l ON l.id = o.listing_id
    WHERE o.listing_id = $1
      AND o.payment_status = 'paid'
      AND o.approval_status = 'approved'
      AND o.completed_at IS NULL
      AND (o.campaign_starts_at IS NULL OR o.campaign_starts_at <= NOW())
      AND (o.campaign_ends_at IS NULL OR o.campaign_ends_at > NOW())
    ORDER BY o.approved_at DESC NULLS LAST, o.created_at DESC
    LIMIT 1
    `,
    [listingId]
  );

  return rows[0] || null;
}

function noAdScript() {
  return `
(function () {
  var script = document.currentScript;
  if (!script) return;
  var box = document.createElement('div');
  box.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:90px;border:1px dashed #d6d6d6;background:#fafafa;color:#777;font:12px Arial,sans-serif;text-align:center;box-sizing:border-box;padding:10px;';
  box.textContent = 'Ad space available on BadAdz';
  script.parentNode.insertBefore(box, script);
}());`;
}

function campaignScript({ campaign, creative, clickUrl }) {
  const imageUrl = JSON.stringify(creative.image_url);
  const href = JSON.stringify(clickUrl);
  const alt = JSON.stringify(`${campaign.website_name || 'Website'} ad`);
  const size = JSON.stringify(creative.banner_size || 'banner');

  return `
(function () {
  var script = document.currentScript;
  if (!script) return;
  var wrapper = document.createElement('div');
  wrapper.setAttribute('data-badadz-slot', ${JSON.stringify(campaign.listing_id)});
  wrapper.setAttribute('data-badadz-campaign', ${JSON.stringify(campaign.id)});
  wrapper.setAttribute('data-badadz-size', ${size});
  wrapper.style.cssText = 'display:inline-block;max-width:100%;line-height:0;';

  var link = document.createElement('a');
  link.href = ${href};
  link.target = '_blank';
  link.rel = 'noopener sponsored';
  link.style.cssText = 'display:inline-block;max-width:100%;';

  var img = document.createElement('img');
  img.src = ${imageUrl};
  img.alt = ${alt};
  img.style.cssText = 'display:block;max-width:100%;height:auto;border:0;';

  link.appendChild(img);
  wrapper.appendChild(link);
  script.parentNode.insertBefore(wrapper, script);
}());`;
}

router.get('/click/:orderId', async (req, res) => {
  try {
    await ensureAdServingColumns();

    const { rows } = await db.query(
      `UPDATE orders
       SET click_count = click_count + 1,
           last_click_at = NOW()
       WHERE id = $1
         AND payment_status = 'paid'
         AND approval_status = 'approved'
       RETURNING destination_url`,
      [req.params.orderId]
    );

    const destination = rows[0]?.destination_url;
    if (!destination) return res.redirect(302, process.env.FRONTEND_URL || 'https://badadz.net');
    return res.redirect(302, destination);
  } catch (err) {
    console.error('ad click error', err);
    return res.redirect(302, process.env.FRONTEND_URL || 'https://badadz.net');
  }
});

// Public ad JavaScript. Website owners paste this on their site:
// <script async src="https://your-api-domain.com/ads/LISTING_ID.js"></script>
router.get('/:listingId.js', async (req, res) => {
  res.type('application/javascript');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    const campaign = await getActiveCampaignForListing(req.params.listingId);
    if (!campaign) return res.send(noAdScript());

    const requestedSize = typeof req.query.size === 'string' ? req.query.size : '';
    const creative = pickCreative(campaign.creatives, requestedSize);
    if (!creative) return res.send(noAdScript());

    await db.query(
      `UPDATE orders
       SET impression_count = impression_count + 1,
           last_impression_at = NOW()
       WHERE id = $1`,
      [campaign.id]
    );

    const clickUrl = `${publicBaseUrl(req)}/ads/click/${campaign.id}`;
    return res.send(campaignScript({ campaign, creative, clickUrl }));
  } catch (err) {
    console.error('ad serve error', err);
    return res.status(200).send(noAdScript());
  }
});

module.exports = router;
