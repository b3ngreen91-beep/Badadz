# BadAdz — Advertising Marketplace

A production-structured two-sided marketplace where **website owners list banner ad inventory** and **advertisers buy ad placements**. BadAdz takes a **20% platform fee** on every transaction.

- **Frontend:** React 19 + React Router + Tailwind (Brutalist Swiss dark theme)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL 16
- **Payments:** Stripe Checkout + Webhooks
- **Auth:** JWT (Bearer) + bcrypt
- **Design system:** Unbounded + JetBrains Mono · zero border-radius · #FF3333 accent

---

## Quick start (local)

### 1. Prerequisites
- Node.js **>= 18**
- Yarn 1.x
- Docker (for Postgres) **or** a running PostgreSQL 16 server
- A Stripe test account (https://dashboard.stripe.com)

### 2. Start Postgres
```bash
docker compose up -d postgres
```
This boots Postgres on `localhost:5432` with user/password `badadz/badadz` and database `badadz`.

### 3. Backend
```bash
cd backend
cp .env.example .env
# edit .env — at minimum set JWT_SECRET and STRIPE_SECRET_KEY
yarn install
yarn db:init      # creates tables
yarn db:seed      # seeds demo owner + 5 listings (optional)
yarn dev          # starts API on http://localhost:8001
```

### 4. Frontend
```bash
cd frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env.local
yarn install
yarn start        # boots http://localhost:3000
```

### 5. Stripe webhooks (local)
```bash
# Install the Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:8001/api/orders/webhook
# Copy the printed `whsec_...` secret into backend/.env as STRIPE_WEBHOOK_SECRET, then restart the backend.
```

Use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

---

## Demo accounts (after `yarn db:seed`)

| Role        | Email                     | Password         |
|-------------|---------------------------|------------------|
| Owner       | owner@badadz.test         | `owner123!`      |
| Advertiser  | advertiser@badadz.test    | `advertiser123!` |

---

## API reference

Base: `${BACKEND_URL}/api`

### Auth
| Method | Path                  | Auth | Body                                              |
|--------|-----------------------|------|---------------------------------------------------|
| POST   | `/auth/register`      | —    | `{ name, email, password, role: 'owner'|'advertiser' }` |
| POST   | `/auth/login`         | —    | `{ email, password }`                             |
| GET    | `/auth/me`            | JWT  | —                                                 |
| POST   | `/auth/logout`        | —    | —                                                 |

### Listings
| Method | Path                          | Auth          | Notes                                                  |
|--------|-------------------------------|---------------|--------------------------------------------------------|
| GET    | `/listings`                   | —             | Query: `search`, `category`, `min_price`, `max_price`, `owner_id`, `include_inactive` |
| GET    | `/listings/meta/categories`   | —             | Active category counts                                 |
| GET    | `/listings/:id`               | —             | Single listing                                         |
| POST   | `/listings`                   | JWT (owner)   | Create                                                 |
| PUT    | `/listings/:id`               | JWT (owner)   | Update (any subset of fields, must own it)             |
| DELETE | `/listings/:id`               | JWT (owner)   | Delete (must own it)                                   |

### Orders
| Method | Path                                      | Auth              | Notes                                          |
|--------|-------------------------------------------|-------------------|------------------------------------------------|
| POST   | `/orders/create-checkout-session`         | JWT (advertiser)  | `{ listing_id, months? }` → returns Stripe URL |
| GET    | `/orders/session/:sessionId`              | JWT               | Verify a checkout session                      |
| GET    | `/orders/my`                              | JWT (advertiser)  | My campaigns                                   |
| GET    | `/orders/sales`                           | JWT (owner)       | My sales + earnings stats                      |
| POST   | `/orders/webhook`                         | Stripe sig        | Stripe → server webhook                        |

---

## Schema (PostgreSQL)

See [`backend/src/schema.sql`](backend/src/schema.sql). Three tables: `users`, `listings`, `orders`.

- `users.role` is one of `owner` | `advertiser`
- `listings.status` is `active` | `paused` | `sold`
- `orders.payment_status` is `pending` | `paid` | `failed` | `refunded`
- `orders.platform_fee` defaults to **20%** of `price_paid` (configurable via `PLATFORM_FEE_PERCENT`)

---

## Payment flow

1. Advertiser clicks **Buy Ad Space** on a listing detail page.
2. Frontend → `POST /api/orders/create-checkout-session` with `{ listing_id, months }`.
3. Backend creates a **pending** `orders` row, then a Stripe Checkout Session with `metadata.order_id`, and returns the URL.
4. Advertiser pays on Stripe-hosted Checkout.
5. Stripe → `POST /api/orders/webhook`:
   - signature verified with `STRIPE_WEBHOOK_SECRET`
   - on `checkout.session.completed`:
     - `orders.payment_status` → `paid`
     - `campaign_starts_at` / `campaign_ends_at` are set
     - `listings.status` → `sold`
6. Advertiser is redirected to `/checkout/success` and the success page calls `GET /api/orders/session/:id` to display the confirmed order.

---

## Production deployment (Render)

### Backend (Render Web Service)
- **Build:** `yarn install`
- **Start:** `node src/server.js`
- **Env:** `PORT`, `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`, `PLATFORM_FEE_PERCENT=20`
- After first deploy, exec `node src/scripts/initDb.js` (Render Shell) to create tables.

### Database
- Render PostgreSQL add-on → copy the **Internal Database URL** into `DATABASE_URL`.

### Frontend (Render Static Site)
- **Build:** `yarn install && yarn build`
- **Publish dir:** `build`
- **Env:** `REACT_APP_BACKEND_URL=https://<your-api>.onrender.com`

### Stripe webhook (production)
In Stripe Dashboard → Developers → Webhooks: add endpoint `https://<your-api>.onrender.com/api/orders/webhook`, listen for `checkout.session.completed` (+ `expired`, `async_payment_failed`), copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

---

## Project layout

```
/app
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js            # Express entry
│       ├── db.js                # pg pool
│       ├── schema.sql           # DB schema
│       ├── middleware/auth.js   # JWT helpers
│       ├── routes/
│       │   ├── auth.js
│       │   ├── listings.js
│       │   ├── orders.js
│       │   └── webhook.js
│       └── scripts/
│           ├── initDb.js        # yarn db:init
│           └── seedDb.js        # yarn db:seed
├── frontend/
│   └── src/
│       ├── App.js
│       ├── lib/   (api, auth)
│       ├── components/   (Navbar, Footer, Marquee, ListingCard, ProtectedRoute)
│       └── pages/   (Home, Login, Register, ListingDetail, CreateListing, EditListing, OwnerDashboard, AdvertiserDashboard, CheckoutResult, NotFound)
├── docker-compose.yml           # local Postgres
└── README.md
```

---

## Notes & gotchas

- The **Stripe webhook route must receive the raw request body** to verify the signature. It's mounted with `express.raw()` _before_ `express.json()` — don't reorder.
- JWTs are stored in `localStorage` and sent as `Authorization: Bearer <token>`. If you need cookie-based sessions, the backend already accepts a `token` cookie via `cookie-parser`.
- Listings are deleted with `ON DELETE RESTRICT` to protect historical orders. If you need true delete, update the FK to `SET NULL`.
- `PLATFORM_FEE_PERCENT` is configurable but the UI shows a static "20%" label — update both if you change the fee.
