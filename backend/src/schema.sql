-- BadAdz schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'advertiser')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  website_name  TEXT NOT NULL,
  website_url   TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL CHECK (monthly_price >= 0),
  image_url     TEXT NOT NULL,
  traffic_stats TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','sold')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listings_status   ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_user_id  ON listings(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id         UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  advertiser_id      UUID NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  price_paid         NUMERIC(10,2) NOT NULL,
  platform_fee       NUMERIC(10,2) NOT NULL,
  seller_earnings    NUMERIC(10,2) NOT NULL,
  stripe_session_id  TEXT UNIQUE,
  payment_status     TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  campaign_starts_at TIMESTAMPTZ,
  campaign_ends_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_advertiser    ON orders(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing       ON orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Auto-update updated_at on listings
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listings_updated_at ON listings;
CREATE TRIGGER trg_listings_updated_at
BEFORE UPDATE ON listings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
