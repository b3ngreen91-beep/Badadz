require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth');
const listingsRouter = require('./routes/listings');
const orderPayoutsRouter = require('./routes/orderPayouts');
const ordersRouter = require('./routes/orders');
const orderAutoCreativesRouter = require('./routes/orderAutoCreatives');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const connectRouter = require('./routes/connect');
const adsRouter = require('./routes/ads');
const { expireEndedCampaigns } = require('./services/expireCampaigns');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // honor X-Forwarded-* on Render's proxy

// ---- CORS ----
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: frontendOrigin === '*' ? true : frontendOrigin.split(',').map((s) => s.trim()),
  credentials: true,
}));

// ---- Stripe webhook (raw body) MUST be mounted before express.json() ----
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }), webhookRouter);

// ---- Standard middleware ----
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));

// ---- Rate limits on auth ----
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));

// ---- Diagnostics / health (Render port detection probes "/") ----
app.get('/', (_req, res) => res.json({
  service: 'badadz-api',
  status: 'ok',
  version: '1.0.0',
  docs: '/api',
}));
app.get('/api', (_req, res) => res.json({
  service: 'badadz-api',
  endpoints: [
    'GET  /api/health',
    'POST /api/auth/register',
    'POST /api/auth/login',
    'GET  /api/auth/me',
    'POST /api/auth/logout',
    'POST /api/connect/onboard',
    'GET  /api/connect/status',
    'GET  /api/listings',
    'GET  /api/listings/meta/categories',
    'GET  /api/listings/:id',
    'POST /api/listings',
    'PUT  /api/listings/:id',
    'DELETE /api/listings/:id',
    'POST /api/orders/create-checkout-session',
    'GET  /api/orders/session/:sessionId',
    'GET  /api/orders/my',
    'GET  /api/orders/sales',
    'POST /api/orders/webhook',
    'GET  /ads/:listingId.js',
    'GET  /ads/click/:orderId',
    'GET  /api/admin/stats',
  ],
}));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'badadz-api' }));

// ---- Mounted routers ----
app.use('/api/auth', authRouter);
app.use('/api/connect', connectRouter);
app.use('/api/listings', listingsRouter);
// Public ad serving routes are intentionally outside /api so publishers can paste clean script tags.
app.use('/ads', adsRouter);
// Auto creative checkout route is mounted before legacy order routes so one-upload resizing works.
app.use('/api/orders', orderAutoCreativesRouter);
// Mount payout-first order routes before the legacy orders router.
// This lets approval require a real seller transfer and lets /orders/sales retry unpaid seller transfers.
app.use('/api/orders', orderPayoutsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);

// ---- 404 (path-less so it works in Express 4 AND 5) ----
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.originalUrl }));

// ---- Error handler ----
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Process-level safety nets (don't crash on errors — log them) ----
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// ---- Startup log (visible in Render logs for verification) ----
function printRoutes(application) {
  const lines = [];
  const collect = (stack, prefix = '') => {
    stack.forEach((layer) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase()).join(',');
        lines.push(`  ${methods.padEnd(8)} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
        const mountPath = layer.regexp?.source
          ?.replace('^\\', '')
          ?.replace('\\/?(?=\\/|$)', '')
          ?.replace(/\\\//g, '/') || '';
        collect(layer.handle.stack, prefix + mountPath);
      }
    });
  };
  collect(application._router.stack);
  return lines;
}

const PORT = Number(process.env.PORT) || 8001;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  BadAdz API · listening on 0.0.0.0:${String(PORT).padEnd(26)}║`);
  console.log(`║  NODE_ENV = ${String(process.env.NODE_ENV || 'development').padEnd(50)}║`);
  console.log(`║  CORS origin = ${String(frontendOrigin).slice(0, 47).padEnd(47)}║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log('Registered routes:');
  printRoutes(app).forEach((l) => console.log(l));

  expireEndedCampaigns().catch((err) => {
    console.error('[campaigns] Startup expiration check failed:', err);
  });
});

// Graceful shutdown — important on Render redeploys
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    console.log(`[${sig}] shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
});

module.exports = app;
