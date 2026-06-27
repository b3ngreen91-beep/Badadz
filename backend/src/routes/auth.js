const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

const FOUNDING_PROMO_CODE = 'FOUNDING50';
const FOUNDING_PROMO_LIMIT = 50;
const DEFAULT_COMMISSION_RATE = 20;
const FOUNDING_COMMISSION_RATE = 15;

async function ensureFounderColumns(client = db) {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
    ADD COLUMN IF NOT EXISTS founding_member BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS promo_code_used TEXT
  `);
}

function cleanPromoCode(value) {
  return String(value || '').trim().toUpperCase();
}

router.post(
  '/register',
  [
    body('name').isString().trim().isLength({ min: 1, max: 80 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8, max: 128 }),
    body('role').isIn(['owner', 'advertiser']),
    body('promoCode').optional({ checkFalsy: true }).isString().trim().isLength({ max: 40 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

    const { name, email, password, role } = req.body;
    const promoCode = cleanPromoCode(req.body.promoCode);
    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      await ensureFounderColumns(client);

      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Email already registered' });
      }

      let commissionRate = DEFAULT_COMMISSION_RATE;
      let foundingMember = false;
      let promoCodeUsed = null;

      if (promoCode) {
        if (promoCode !== FOUNDING_PROMO_CODE) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid promo code' });
        }

        if (role !== 'owner') {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'FOUNDING50 is only for website owners' });
        }

        // Prevent two people from claiming the final founder slot at the same time.
        await client.query("SELECT pg_advisory_xact_lock(hashtext('badadz_founding50_promo'))");

        const founderCount = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM users
           WHERE founding_member = TRUE AND promo_code_used = $1`,
          [FOUNDING_PROMO_CODE]
        );

        if (founderCount.rows[0].count >= FOUNDING_PROMO_LIMIT) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'FOUNDING50 has already been claimed by the first 50 website owners' });
        }

        commissionRate = FOUNDING_COMMISSION_RATE;
        foundingMember = true;
        promoCodeUsed = FOUNDING_PROMO_CODE;
      }

      const password_hash = await bcrypt.hash(password, 10);
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, commission_rate, founding_member, promo_code_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, name, email, role, commission_rate, founding_member, promo_code_used, created_at`,
        [name, email, password_hash, role, commissionRate, foundingMember, promoCodeUsed]
      );

      await client.query('COMMIT');

      const user = rows[0];
      const token = signToken(user);
      return res.status(201).json({ user, token });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('register error', err);
      return res.status(500).json({ error: 'Registration failed' });
    } finally {
      client.release();
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

    const { email, password } = req.body;
    try {
      await ensureFounderColumns();
      const { rows } = await db.query(
        'SELECT id, name, email, password_hash, role, commission_rate, founding_member, promo_code_used, created_at FROM users WHERE email = $1',
        [email]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        commission_rate: user.commission_rate,
        founding_member: user.founding_member,
        promo_code_used: user.promo_code_used,
        created_at: user.created_at,
      };
      const token = signToken(safeUser);
      return res.json({ user: safeUser, token });
    } catch (err) {
      console.error('login error', err);
      return res.status(500).json({ error: 'Login failed' });
    }
  }
);

router.get('/me', authRequired, async (req, res) => {
  try {
    await ensureFounderColumns();
    const { rows } = await db.query(
      'SELECT id, name, email, role, commission_rate, founding_member, promo_code_used, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('me error', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  return res.json({ ok: true });
});

module.exports = router;
