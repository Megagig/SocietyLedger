-- ============================================
-- Phase: Full-Text Search for Blog & Documentation
-- Safe for Production - No data loss
-- ============================================

-- Enable pg_trgm extension for trigram search (better partial matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- BLOG POSTS FULL-TEXT SEARCH
-- ============================================

-- Add search vector column to blog_posts
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION blog_posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS blog_posts_search_vector_trigger ON "blog_posts";
CREATE TRIGGER blog_posts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, excerpt, content ON "blog_posts"
  FOR EACH ROW EXECUTE FUNCTION blog_posts_search_vector_update();

-- Populate existing records (safe - only updates NULL values)
UPDATE "blog_posts" SET "searchVector" = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C')
WHERE "searchVector" IS NULL;

-- ============================================
-- DOCUMENTATION PAGES FULL-TEXT SEARCH
-- ============================================

-- Add search vector column to doc_pages
ALTER TABLE "doc_pages" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION doc_pages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS doc_pages_search_vector_trigger ON "doc_pages";
CREATE TRIGGER doc_pages_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, excerpt, content ON "doc_pages"
  FOR EACH ROW EXECUTE FUNCTION doc_pages_search_vector_update();

-- Populate existing records (safe - only updates NULL values)
UPDATE "doc_pages" SET "searchVector" = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C')
WHERE "searchVector" IS NULL;

-- ============================================
-- CREATE INDEXES (Non-blocking for production)
-- ============================================

-- Blog posts indexes
CREATE INDEX IF NOT EXISTS "blog_posts_categoryId_idx" ON "blog_posts"("categoryId");
CREATE INDEX IF NOT EXISTS "blog_posts_status_viewcount_idx" ON "blog_posts"("status", "viewCount");
CREATE INDEX IF NOT EXISTS "blog_posts_search_idx" ON "blog_posts" USING GIN ("searchVector");

-- Documentation pages indexes
CREATE INDEX IF NOT EXISTS "doc_pages_parentId_idx" ON "doc_pages"("parentId");
CREATE INDEX IF NOT EXISTS "doc_pages_status_viewcount_idx" ON "doc_pages"("status", "viewCount");
CREATE INDEX IF NOT EXISTS "doc_pages_search_idx" ON "doc_pages" USING GIN ("searchVector");

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION blog_posts_search_vector_update() IS 'Automatically updates full-text search vector for blog posts';
COMMENT ON FUNCTION doc_pages_search_vector_update() IS 'Automatically updates full-text search vector for documentation pages';
