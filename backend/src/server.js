require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth');
const listingsRouter = require('./routes/listings');
const ordersRouter = require('./routes/orders');
const webhookRouter = require('./routes/webhook');

const app = express();

// CORS
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: frontendOrigin === '*' ? true : frontendOrigin.split(',').map((s) => s.trim()),
  credentials: true,
}));

// Stripe webhook needs the raw body — mount BEFORE json parser.
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }), webhookRouter);

// Standard middleware
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Rate limit auth endpoints
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }));

// Health
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'badadz-api' }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/orders', ordersRouter);

// 404
app.use('/api/*', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT || 8001);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BadAdz API listening on :${PORT}`);
});

module.exports = app;
