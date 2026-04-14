-- Migration: Reviews Module
-- Adds google_place_id to brand_config and creates reviews table

-- 1. Add google_place_id to brand_config
ALTER TABLE brand_config ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- 2. Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  google_review_id TEXT NOT NULL UNIQUE,
  reviewer_name TEXT NOT NULL,
  reviewer_photo_url TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  review_date TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'google',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index for fast brand lookups (used by website embeds)
CREATE INDEX IF NOT EXISTS reviews_brand_rating_idx ON reviews (brand, rating);

-- 4. Index for deduplication checks
CREATE INDEX IF NOT EXISTS reviews_google_review_id_idx ON reviews (google_review_id);
