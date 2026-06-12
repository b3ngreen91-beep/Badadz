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

DO $$ BEGIN ALTER TABLE listings ALTER COLUMN website_name  SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN website_url   SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN category      SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN monthly_price SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN image_url     SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- listings.user_id FK self-healing
-- ----------------------------------------------------------------------------
-- 1) Drop pre-existing FK so we can convert column type if needed
DO $$ BEGIN ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_user_fk; EXCEPTION WHEN others THEN NULL; END $$;

-- 2) Drop NOT NULL temporarily so non-UUID garbage can be rewritten to NULL
DO $$ BEGIN ALTER TABLE listings ALTER COLUMN user_id DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- 3) Convert listings.user_id to UUID if legacy TEXT/varchar
DO $$
DECLARE col_type TEXT;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='listings' AND column_name='user_id';
  IF col_type IS NOT NULL AND col_type <> 'uuid' THEN
    BEGIN
      ALTER TABLE listings
        ALTER COLUMN user_id TYPE UUID
        USING CASE
          WHEN user_id IS NULL THEN NULL
          WHEN user_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN user_id::text::uuid
          ELSE NULL
        END;
      RAISE NOTICE '[schema] converted listings.user_id from % to uuid', col_type;
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[schema] could not convert listings.user_id (%): %', col_type, SQLERRM;
    END;
  END IF;
END $$;

-- 4) Re-add FK; fall back to NOT VALID if orphans exist; skip-with-notice on any other failure
DO $$
BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN
    BEGIN
      ALTER TABLE listings
        ADD CONSTRAINT listings_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
      RAISE NOTICE '[schema] added listings_user_fk as NOT VALID (legacy orphan rows skipped): %', SQLERRM;
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[schema] could NOT add listings_user_fk: %', SQLERRM;
    END;
END $$;

-- 5) Re-apply NOT NULL (best-effort; skipped if any row still has NULL)
DO $$ BEGIN
  ALTER TABLE listings ALTER COLUMN user_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE '[schema] kept listings.user_id NULLable (legacy rows had non-UUID values): %', SQLERRM;
END $$;

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

DO $$ BEGIN ALTER TABLE orders ALTER COLUMN price_paid      SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN platform_fee    SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN seller_earnings SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- orders.listing_id + orders.advertiser_id FK self-healing
-- ----------------------------------------------------------------------------
-- 1) Drop pre-existing FKs (type conversion requires no dependent FK)
DO $$ BEGIN ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_listing_fk;    EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_advertiser_fk; EXCEPTION WHEN others THEN NULL; END $$;

-- 2) Drop NOT NULL temporarily so bad values can become NULL
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN listing_id    DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN advertiser_id DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- 3) Convert column types to UUID if legacy TEXT/varchar
DO $$
DECLARE col_type TEXT;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='orders' AND column_name='listing_id';
  IF col_type IS NOT NULL AND col_type <> 'uuid' THEN
    BEGIN
      ALTER TABLE orders
        ALTER COLUMN listing_id TYPE UUID
        USING CASE
          WHEN listing_id IS NULL THEN NULL
          WHEN listing_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN listing_id::text::uuid
          ELSE NULL
        END;
      RAISE NOTICE '[schema] converted orders.listing_id from % to uuid', col_type;
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[schema] could not convert orders.listing_id (%): %', col_type, SQLERRM;
    END;
  END IF;
END $$;

DO $$
DECLARE col_type TEXT;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='orders' AND column_name='advertiser_id';
  IF col_type IS NOT NULL AND col_type <> 'uuid' THEN
    BEGIN
      ALTER TABLE orders
        ALTER COLUMN advertiser_id TYPE UUID
        USING CASE
          WHEN advertiser_id IS NULL THEN NULL
          WHEN advertiser_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN advertiser_id::text::uuid
          ELSE NULL
        END;
      RAISE NOTICE '[schema] converted orders.advertiser_id from % to uuid', col_type;
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[schema] could not convert orders.advertiser_id (%): %', col_type, SQLERRM;
    END;
  END IF;
END $$;

-- 4) Re-add FKs (strict → NOT VALID fallback → skip-with-notice)
DO $$
BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_listing_fk FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN
    BEGIN
      ALTER TABLE orders
        ADD CONSTRAINT orders_listing_fk FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT NOT VALID;
      RAISE NOTICE '[schema] added orders_listing_fk as NOT VALID: %', SQLERRM;
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[schema] could NOT add orders_listing_fk: %', SQLERRM;
    END;
END $$;

DO $$
BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_advertiser_fk FOREIGN KEY (advertiser_id) REFERENCES users(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN
    BEGIN
      ALTER TABLE orders
        ADD CONSTRAINT orders_advertiser_fk FOREIGN KEY (advertiser_id) REFERENCES users(id) ON DELETE RESTRICT NOT VALID;
      RAISE NOTICE '[schema] added orders_advertiser_fk as NOT VALID: %', SQLERRM;
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[schema] could NOT add orders_advertiser_fk: %', SQLERRM;
    END;
END $$;

-- 5) Re-apply NOT NULL (best-effort)
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN listing_id    SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN advertiser_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

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
