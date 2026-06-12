# BadAdz — Advertising Marketplace · PRD

## Original Problem Statement
Production-ready full-stack two-sided advertising marketplace where website owners list banner ad space and advertisers buy placements. 20% platform fee. Required stack: **React + Node.js/Express + PostgreSQL + Stripe + JWT auth**.

## User decision
- (Q1) Chose **option B**: build with Node.js + Express + PostgreSQL even though the platform sandbox only supports FastAPI+Mongo. Preview will NOT run in this environment; delivery is code-only with full local setup instructions.
- Defaults accepted: Stripe test keys, JWT (Bearer) custom auth, image URL fields only, 20% commission.

## Architecture
- **Backend** `/app/backend` — Node.js 18+, Express 4, `pg`, `bcrypt`, `jsonwebtoken`, `stripe`, `express-validator`, `cors`, `cookie-parser`, `morgan`, `express-rate-limit`. Entry: `src/server.js`.
- **Database** PostgreSQL 16 with three tables: `users`, `listings`, `orders`. Schema at `backend/src/schema.sql`. Idempotent init/seed scripts.
- **Frontend** `/app/frontend` — React 19, React Router, Tailwind, sonner toasts, lucide-react icons. Brutalist Swiss / High-Contrast dark theme per `design_guidelines.json` (Unbounded + JetBrains Mono, #FF3333 accent, zero border-radius).
- **Payments** Stripe Checkout + webhook (raw-body verification, `checkout.session.completed` → orders.paid + listings.sold).
- **Auth** JWT Bearer in `Authorization` header (cookie fallback), bcrypt password hashes, rate-limited login/register, role-gated routes (`owner` / `advertiser`).

## User personas
1. **Website Owner** — lists banner inventory, edits/pauses listings, tracks sales & earnings.
2. **Advertiser** — browses, filters, buys ad space via Stripe, views active campaigns.

## Core requirements (static)
- Role selection at signup
- Marketplace listings CRUD with status (active/paused/sold)
- Search + filter (text, category, price range)
- Stripe Checkout flow with webhook reconciliation
- 20% platform fee, 80% seller earnings, stored per-order
- Owner & Advertiser dashboards with stats

## Implemented (2026-02)
- [x] PostgreSQL schema + idempotent init/seed scripts (2 demo users + 5 listings)
- [x] Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` (bcrypt + JWT, rate-limited)
- [x] Listings: GET (filters: search/category/min_price/max_price/owner_id/include_inactive), GET by id, POST (owner), PUT (owner), DELETE (owner). Ownership enforced.
- [x] Orders: `POST /api/orders/create-checkout-session` (advertiser), `GET /api/orders/session/:id`, `GET /api/orders/my`, `GET /api/orders/sales` (owner), `POST /api/orders/webhook` (Stripe raw body)
- [x] Frontend pages: Home (hero + marquee + filters + grid), Login, Register (role select), ListingDetail (Buy + duration picker), CreateListing, EditListing (delete, pause/activate), OwnerDashboard, AdvertiserDashboard, CheckoutResult (success/cancel), NotFound
- [x] Brutalist Swiss design system, fonts loaded via Google Fonts, all interactive elements carry `data-testid`
- [x] `docker-compose.yml` for one-line local Postgres
- [x] Comprehensive README with API reference, schema, payment flow diagram, Render deploy steps

## Verified (curl smoke tests, 2026-02)
- ✅ `GET /api/health` → 200 ok
- ✅ `GET /api/listings` returns seeded inventory
- ✅ Search + category filters
- ✅ Login (correct creds) → JWT; wrong creds → 401
- ✅ `/auth/me` with Bearer token → user payload
- ✅ Advertiser POSTs /listings → 403 Forbidden (role gating works)
- ✅ Stripe SDK wired (error correctly surfaced from invalid placeholder key)

## Prioritized backlog (P0/P1/P2)
- **P0** — Real Stripe webhook end-to-end test with `stripe listen` (requires real Stripe test keys from user)
- **P1** — Banner image upload to object storage (currently URL-only per spec)
- **P1** — Email receipts on successful purchase (Resend / SendGrid)
- **P1** — Order refund flow + admin override for `listings.status`
- **P2** — Multi-currency support
- **P2** — Listing analytics for owners (impressions/clicks)
- **P2** — Featured/boosted placements (additional revenue stream)
- **P2** — Reviews & reputation per owner

## Next action items
1. Get Stripe test keys from user → drop into `backend/.env` → run `stripe listen --forward-to localhost:8001/api/orders/webhook` → place a real test purchase end-to-end.
2. Deploy backend + frontend + Postgres to Render using instructions in README.
3. Build email receipts (Resend or SendGrid) once Stripe is live.
