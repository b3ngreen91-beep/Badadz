const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

async function ensureInstallColumns() {
  await db.query(`
    ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS ad_code_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ad_code_verified_at TIMESTAMPTZ
  `);
}

router.post(
  '/verify',
  authRequired,
  requireRole('owner'),
  [body('listing_id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

    try {
      await ensureInstallColumns();

      const { rows } = await db.query(
        'SELECT id, website_url FROM listings WHERE id = $1 AND user_id = $2',
        [req.body.listing_id, req.user.id]
      );

      if (rows.length === 0) return res.status(404).json({ error: 'Listing not found' });

      const listing = rows[0];
      const response = await fetch(listing.website_url, {
        redirect: 'follow',
        headers: { 'user-agent': 'BadAdz Install Verifier' },
      });
      const html = await response.text();
      const verified = html.includes(`/ads/${listing.id}.js`) || html.includes(`/ads/${listing.id}.js?`);

      if (verified) {
        await db.query(
          `UPDATE listings
           SET ad_code_verified = TRUE,
               ad_code_verified_at = NOW(),
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [listing.id, req.user.id]
        );
      }

      return res.json({
        verified,
        message: verified
          ? 'Installation verified. Your website is ready to receive approved ads.'
          : 'Could not detect the BadAdz script yet. Paste the code on the public page, save it, and try again.',
      });
    } catch (err) {
      console.error('install verification error', err);
      return res.status(500).json({ error: 'Could not verify installation right now' });
    }
  }
);

module.exports = router;
