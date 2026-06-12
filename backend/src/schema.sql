-- BadAdz schema — fully idempotent against brand-new AND partial pre-existing databases.
-- Strategy: CREATE TABLE IF NOT EXISTS, then ALTER TABLE ADD COLUMN IF NOT EXISTS for every column,
-- then add constraints / indexes / triggers guarded by IF NOT EXISTS or DO-blocks.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid fallback if uuid-ossp not available

-- ============================================================================
-- users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS name          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now();

-- NOT NULL constraints (guarded — Postgres errors if column already has data violating NOT NULL,
-- so we use ALTER COLUMN inside a DO block that swallows the duplicate-constraint error).
DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN name SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN email SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN role SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- Unique on email
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- Role check — normalize legacy values BEFORE adding the constraint
-- so existing rows from older BadAdz versions don't violate it.
UPDATE users SET role = CASE
  WHEN role IS NULL                                                                                  THEN 'advertiser'
  WHEN lower(trim(role)) IN ('owner','website_owner','site_owner','siteowner','site-owner','host','publisher','seller') THEN 'owner'
  WHEN lower(trim(role)) IN ('advertiser','buyer','brand','agency','user','customer','client')      THEN 'advertiser'
  ELSE 'advertiser'   -- safest default for anything unrecognised (advertisers can't create listings)
END
WHERE role IS NULL OR role NOT IN ('owner','advertiser');

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner','advertiser'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS user_id        UUID;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS website_name   TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS website_url    TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description    TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS category       TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS monthly_price  NUMERIC(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url      TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS traffic_stats  TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'active';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE listings ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN ALTER TABLE listings ALTER COLUMN user_id       SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN website_name  SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN website_url   SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN category      SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN monthly_price SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN image_url     SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Status check — normalize legacy values first
UPDATE listings SET status = CASE
  WHEN status IS NULL                                                              THEN 'active'
  WHEN lower(trim(status)) IN ('active','live','enabled','published')             THEN 'active'
  WHEN lower(trim(status)) IN ('paused','inactive','disabled','archived','draft') THEN 'paused'
  WHEN lower(trim(status)) IN ('sold','occupied','booked')                        THEN 'sold'
  ELSE 'paused'
END
WHERE status IS NULL OR status NOT IN ('active','paused','sold');

DO $$ BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_status_check CHECK (status IN ('active','paused','sold'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Non-negative price — clamp legacy negatives to 0 before adding the constraint
UPDATE listings SET monthly_price = 0 WHERE monthly_price < 0;

DO $$ BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_price_nonneg CHECK (monthly_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_listings_status   ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_user_id  ON listings(user_id);

-- ============================================================================
-- orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS listing_id         UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS advertiser_id      UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_paid         NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee       NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_earnings    NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status     TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_starts_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_ends_at   TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN ALTER TABLE orders ALTER COLUMN listing_id      SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN advertiser_id   SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN price_paid      SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN platform_fee    SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN seller_earnings SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_listing_fk FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_advertiser_fk FOREIGN KEY (advertiser_id) REFERENCES users(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment-status check — normalize legacy values first
UPDATE orders SET payment_status = CASE
  WHEN payment_status IS NULL                                                                THEN 'pending'
  WHEN lower(trim(payment_status)) IN ('pending','processing','awaiting_payment','unpaid')   THEN 'pending'
  WHEN lower(trim(payment_status)) IN ('paid','completed','complete','success','successful') THEN 'paid'
  WHEN lower(trim(payment_status)) IN ('failed','cancelled','canceled','error','declined')   THEN 'failed'
  WHEN lower(trim(payment_status)) IN ('refunded','refund','reversed')                       THEN 'refunded'
  ELSE 'pending'
END
WHERE payment_status IS NULL OR payment_status NOT IN ('pending','paid','failed','refunded');

DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending','paid','failed','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_stripe_session_unique UNIQUE (stripe_session_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_orders_advertiser     ON orders(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing        ON orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- ============================================================================
-- updated_at trigger on listings
-- ============================================================================
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
