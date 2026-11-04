-- =========================================================================
-- PARAS KACHORIWALA : SINGLE SOURCE OF TRUTH FIX
-- Target project: xrvdohzqdzcunqshgqoz  (Supabase Dashboard > SQL Editor)
--
-- Idempotent and NON-DESTRUCTIVE. Safe to re-run any number of times.
--   * Only missing tables / columns / policies / publication entries are added.
--   * No menu, feedback, gallery or review content is ever deleted.
--   * Cannot fail because of pre-existing rows, policies or tables.
-- =========================================================================

-- 0. BASE TABLES : create every table this script references, so the
--    statements below can never fail with "relation does not exist".
--    (CREATE TABLE IF NOT EXISTS is a no-op when the table is already there.)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  price integer NOT NULL DEFAULT 40,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  available boolean NOT NULL DEFAULT true,
  stock integer DEFAULT 50,
  featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_open boolean NOT NULL DEFAULT true,
  crowd_level text NOT NULL DEFAULT 'Moderate',
  last_updated timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overall_rating integer NOT NULL,
  food_rating integer,
  service_rating integer,
  cleanliness_rating integer,
  message text,
  customer_name text,
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  src text NOT NULL,
  alt text NOT NULL,
  category text NOT NULL DEFAULT 'food',
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 1. STORE STATUS / FEEDBACK / GALLERY : add every column the app writes -----
ALTER TABLE store_status
  ADD COLUMN IF NOT EXISTS closed_for_date text,
  ADD COLUMN IF NOT EXISTS force_open_date text,
  ADD COLUMN IF NOT EXISTS override_mode   text,
  ADD COLUMN IF NOT EXISTS updated_by      text;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;
ALTER TABLE gallery  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

-- 2. SINGLE AUTHORITATIVE STATUS ROW ----------------------------------------
-- The app expects exactly one store_status row. Enforce that with a unique
-- index, but ONLY when the table is already clean. If duplicate rows exist they
-- are left untouched (no data loss); a notice is raised instead, so this script
-- can never fail on an existing database.
DO $$
DECLARE
  status_rows integer;
BEGIN
  SELECT count(*) INTO status_rows FROM store_status;

  IF status_rows > 1 THEN
    RAISE NOTICE 'store_status contains % rows - singleton index skipped. Duplicate shop-status rows can be merged later (newest kept).', status_rows;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'store_status_singleton_idx'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX store_status_singleton_idx ON store_status ((true))';
  END IF;
END $$;

-- 3. ROW LEVEL SECURITY : keep the app working exactly as today --------------
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_status  ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_products"     ON products;
DROP POLICY IF EXISTS "allow_all_store_status" ON store_status;
DROP POLICY IF EXISTS "allow_all_feedback"     ON feedback;
DROP POLICY IF EXISTS "allow_all_gallery"      ON gallery;

CREATE POLICY "allow_all_products"     ON products     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_store_status" ON store_status FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_feedback"     ON feedback     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_gallery"      ON gallery      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. REALTIME : make sure the tables are actually published ------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='store_status') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.store_status;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='products') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='feedback') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='gallery') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery;
    END IF;
  END IF;
END $$;

-- 5. Ensure exactly one store status row exists ------------------------------
INSERT INTO store_status (is_open, crowd_level, last_updated)
SELECT true, 'Moderate', now()
WHERE NOT EXISTS (SELECT 1 FROM store_status);
