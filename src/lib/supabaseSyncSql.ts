export const SUPABASE_SETUP_SQL = `-- =========================================================================
-- PARAS KACHORIWALA: COMPLETE DATABASE & REAL-TIME MULTI-DEVICE SYNC SETUP
-- Run this single script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xrvdohzqdzcunqshgqoz/sql
-- =========================================================================

-- 1. Create Tables If Not Exist

-- Products table
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

-- Store status table
CREATE TABLE IF NOT EXISTS store_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_open boolean NOT NULL DEFAULT true,
  crowd_level text NOT NULL DEFAULT 'Moderate',
  last_updated timestamptz DEFAULT now(),
  closed_for_date text,
  force_open_date text,
  override_mode text,
  updated_by text
);

-- Ensure columns exist if table was already present
ALTER TABLE store_status ADD COLUMN IF NOT EXISTS closed_for_date text;
ALTER TABLE store_status ADD COLUMN IF NOT EXISTS force_open_date text;
ALTER TABLE store_status ADD COLUMN IF NOT EXISTS override_mode text;

-- Feedback & Reviews table
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

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;

-- Gallery table
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

ALTER TABLE gallery ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

-- 2. Enable Row Level Security (RLS) on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

-- 3. Clean up any existing conflicting policies
DROP POLICY IF EXISTS "allow_all_products" ON products;
DROP POLICY IF EXISTS "public_read_products" ON products;
DROP POLICY IF EXISTS "public_update_products" ON products;
DROP POLICY IF EXISTS "public_insert_products" ON products;
DROP POLICY IF EXISTS "public_delete_products" ON products;

DROP POLICY IF EXISTS "allow_all_store_status" ON store_status;
DROP POLICY IF EXISTS "public_read_store_status" ON store_status;
DROP POLICY IF EXISTS "public_update_store_status" ON store_status;
DROP POLICY IF EXISTS "public_insert_store_status" ON store_status;
DROP POLICY IF EXISTS "public_delete_store_status" ON store_status;

DROP POLICY IF EXISTS "allow_all_feedback" ON feedback;
DROP POLICY IF EXISTS "client_read_all_feedback" ON feedback;
DROP POLICY IF EXISTS "client_update_feedback" ON feedback;
DROP POLICY IF EXISTS "client_delete_feedback" ON feedback;
DROP POLICY IF EXISTS "public_read_feedback" ON feedback;
DROP POLICY IF EXISTS "public_insert_feedback" ON feedback;
DROP POLICY IF EXISTS "public_update_feedback" ON feedback;
DROP POLICY IF EXISTS "public_delete_feedback" ON feedback;
DROP POLICY IF EXISTS "public_read_approved_feedback" ON feedback;
DROP POLICY IF EXISTS "author_read_all_feedback" ON feedback;
DROP POLICY IF EXISTS "author_update_feedback" ON feedback;

DROP POLICY IF EXISTS "allow_all_gallery" ON gallery;
DROP POLICY IF EXISTS "public_read_gallery" ON gallery;
DROP POLICY IF EXISTS "public_insert_gallery" ON gallery;
DROP POLICY IF EXISTS "public_update_gallery" ON gallery;
DROP POLICY IF EXISTS "public_delete_gallery" ON gallery;

-- 4. Enable Full Real-Time Sync Policies (Allows Website & Author across all devices)
CREATE POLICY "allow_all_products" ON products
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_store_status" ON store_status
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_feedback" ON feedback
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_gallery" ON gallery
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Add Tables to Realtime Publication (Enables 0ms WebSockets across all devices)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'store_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE store_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'feedback'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE feedback;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gallery'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gallery;
  END IF;
END $$;

-- 6. Seed Initial Store Status (if not exists)
INSERT INTO store_status (is_open, crowd_level, last_updated)
SELECT true, 'Moderate', now()
WHERE NOT EXISTS (SELECT 1 FROM store_status);

-- 7. Seed All 4 Menu Varieties into products table
INSERT INTO products (slug, name, price, description, image_url, available, stock, featured, display_order)
VALUES
  ('kachori', 'Regular Kachori', 40, 'Crispy, golden-fried puffed pastry stuffed with our classic spiced lentil and onion filling — served fresh with tangy house chutneys.', '/images/kachori.webp', true, 80, true, 1),
  ('kachori-jain', 'Jain Kachori (No Onion / No Garlic)', 40, 'Prepared strictly per Jain dietary traditions without onion or garlic — packed with rich authentic spices and served with fresh sweet and spicy chutneys.', '', true, 50, false, 2),
  ('kachori-swaminarayan', 'Swaminarayan Kachori (Satvik)', 40, 'Pure satvik preparation crafted strictly without onion or garlic, following Swaminarayan dietary guidelines with fragrant spices and fresh chutneys.', '', true, 50, false, 3),
  ('bhel', 'Fresh Bhel', 40, 'Light, crunchy puffed rice tossed with fresh tomatoes, onions, sev and our house chutneys — a burst of flavour in every bite.', '/images/bhel.webp', true, 60, false, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = CASE WHEN products.image_url IS NULL OR products.image_url = '' THEN EXCLUDED.image_url ELSE products.image_url END;

-- 8. Seed Initial Gallery Images (if table is empty)
INSERT INTO gallery (src, alt, category, caption, display_order)
SELECT '/images/kachori.webp', 'Crispy signature Kachori served hot at Paras Kachoriwala', 'food', 'Signature Kachori', 1
WHERE NOT EXISTS (SELECT 1 FROM gallery);
`;
