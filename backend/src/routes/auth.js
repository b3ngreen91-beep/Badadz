const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').isString().trim().isLength({ min: 1, max: 80 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8, max: 128 }),
    body('role').isIn(['owner', 'advertiser']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

    const { name, email, password, role } = req.body;
    try {
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount > 0) return res.status(409).json({ error: 'Email already registered' });

      const password_hash = await bcrypt.hash(password, 10);
      const { rows } = await db.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1,$2,$3,$4)
         RETURNING id, name, email, role, created_at`,
        [name, email, password_hash, role]
      );
      const user = rows[0];
      const token = signToken(user);
      return res.status(201).json({ user, token });
    } catch (err) {
      console.error('register error', err);
      return res.status(500).json({ error: 'Registration failed' });
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
      const { rows } = await db.query(
        'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
        [email]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at };
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
    const { rows } = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
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
