const express = require('express');
const Stripe = require('stripe');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function frontendUrl(path = '') {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

async function ensureConnectColumns() {
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE
  `);
}

router.post('/onboard', authRequired, requireRole('owner'), async (req, res) => {
  try {
    await ensureConnectColumns();

    const { rows } = await db.query(
      'SELECT id, email, stripe_connect_account_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    let accountId = rows[0].stripe_connect_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: rows[0].email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      await db.query(
        'UPDATE users SET stripe_connect_account_id = $1, stripe_connect_onboarding_complete = FALSE WHERE id = $2',
        [accountId, req.user.id]
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: frontendUrl('/dashboard/owner'),
      return_url: frontendUrl('/dashboard/owner'),
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('connect onboard error', err);
    res.status(500).json({ error: 'Failed to start Stripe Connect onboarding' });
  }
});

router.get('/status', authRequired, requireRole('owner'), async (req, res) => {
  try {
    await ensureConnectColumns();

    const { rows } = await db.query(
      'SELECT stripe_connect_account_id, stripe_connect_onboarding_complete FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const accountId = rows[0].stripe_connect_account_id;
    let complete = rows[0].stripe_connect_onboarding_complete === true;

    if (accountId) {
      const account = await stripe.accounts.retrieve(accountId);
      complete = Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled);

      await db.query(
        'UPDATE users SET stripe_connect_onboarding_complete = $1 WHERE id = $2',
        [complete, req.user.id]
      );
    }

    res.json({
      connected: Boolean(accountId),
      onboarding_complete: complete,
      account_id: accountId || null,
    });
  } catch (err) {
    console.error('connect status error', err);
    res.status(500).json({ error: 'Failed to check Stripe Connect status' });
  }
});

module.exports = router;
