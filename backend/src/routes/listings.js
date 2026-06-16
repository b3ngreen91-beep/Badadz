const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { body, query, validationResult } = require('express-validator');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'badadz/listings',
        resource_type: 'image',
        transformation: [{ width: 1600, height: 900, crop: 'limit' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

/**
 * PUBLIC: Browse listings
 */
router.get(
  '/',
  [
    query('search').optional().isString(),
    query('category').optional().isString(),
    query('min_price').optional().isFloat({ min: 0 }),
    query('max_price').optional().isFloat({ min: 0 }),
    query('owner_id').optional().isInt(),
    query('include_inactive').optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    const { search, category, min_price, max_price, owner_id, include_inactive } = req.query;

    const where = [];
    const params = [];

    if (!include_inactive) {
      where.push(`l.status = 'active'`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(l.website_name ILIKE $${params.length} OR l.description ILIKE $${params.length} OR l.category ILIKE $${params.length})`
      );
    }

    if (category) {
      params.push(category);
      where.push(`l.category = $${params.length}`);
    }

    if (min_price !== undefined) {
      params.push(min_price);
      where.push(`l.monthly_price >= $${params.length}`);
    }

    if (max_price !== undefined) {
      params.push(max_price);
      where.push(`l.monthly_price <= $${params.length}`);
    }

    if (owner_id) {
      params.push(owner_id);
      where.push(`l.user_id = $${params.length}`);
    }

    const sql = `
      SELECT l.*, u.name AS owner_name
      FROM listings l
      JOIN users u ON u.id = l.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY l.created_at DESC
      LIMIT 200
    `;

    try {
      const { rows } = await db.query(sql, params);
      res.json({ listings: rows });
    } catch (err) {
      console.error('list listings error', err);
      res.status(500).json({ error: 'Failed to list listings' });
    }
  }
);

/**
 * PUBLIC: Categories
 */
router.get('/meta/categories', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT category, COUNT(*)::int AS count
      FROM listings
      WHERE status = 'active'
      GROUP BY category
      ORDER BY count DESC
    `);

    res.json({ categories: rows });
  } catch (err) {
    console.error('categories error', err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

/**
 * PUBLIC: Single listing
 */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT l.*, u.name AS owner_name
      FROM listings l
      JOIN users u ON u.id = l.user_id
      WHERE l.id = $1
      `,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ listing: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Invalid id' });
  }
});

/**
 * CREATE listing
 */
router.post(
  '/',
  authRequired,
  requireRole('owner'),
  upload.single('banner_image'),
  [
    body('website_name').isString().trim().isLength({ min: 1, max: 120 }),
    body('website_url').isURL({ require_protocol: true }),
    body('description').optional().isString().isLength({ max: 5000 }),
    body('category').isString().trim().isLength({ min: 1, max: 60 }),
    body('monthly_price').isFloat({ min: 0 }),
    body('image_url').optional({ checkFalsy: true }).isURL({ require_protocol: true }),
    body('traffic_stats').optional().isString().isLength({ max: 500 }),
    body('status').optional().isIn(['active', 'paused']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const {
      website_name,
      website_url,
      description = '',
      category,
      monthly_price,
      image_url,
      traffic_stats,
      status = 'active',
    } = req.body;

    try {
      let finalImageUrl = image_url || '';

      if (req.file) {
        if (!process.env.CLOUDINARY_URL) {
          return res.status(500).json({ error: 'Image uploads are not configured' });
        }

        const uploaded = await uploadToCloudinary(req.file);
        finalImageUrl = uploaded.secure_url;
      }

      if (!finalImageUrl) {
        return res.status(400).json({ error: 'Banner image is required' });
      }

      const { rows } = await db.query(
        `
        INSERT INTO listings (
          user_id,
          website_name,
          website_url,
          description,
          category,
          monthly_price,
          image_url,
          traffic_stats,
          status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,
        [
          req.user.id,
          website_name,
          website_url,
          description,
          category,
          monthly_price,
          finalImageUrl,
          traffic_stats,
          status,
        ]
      );

      res.status(201).json({ listing: rows[0] });
    } catch (err) {
      console.error('create listing error', err);
      res.status(500).json({ error: 'Failed to create listing' });
    }
  }
);

/**
 * UPDATE listing
 */
router.put(
  '/:id',
  authRequired,
  requireRole('owner'),
  [
    body('website_name').optional().isString().trim().isLength({ min: 1, max: 120 }),
    body('website_url').optional().isURL({ require_protocol: true }),
    body('description').optional().isString().isLength({ max: 5000 }),
    body('category').optional().isString().trim().isLength({ min: 1, max: 60 }),
    body('monthly_price').optional().isFloat({ min: 0 }),
    body('image_url').optional().isURL({ require_protocol: true }),
    body('traffic_stats').optional().isString().isLength({ max: 500 }),
    body('status').optional().isIn(['active', 'paused']),
  ],
  async (req, res) => {
    res.status(501).json({ error: 'Update route not available in this shortened file update' });
  }
);

module.exports = router;
