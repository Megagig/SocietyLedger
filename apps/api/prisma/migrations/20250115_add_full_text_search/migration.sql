-- ============================================
-- Phase 9: Full-Text Search for Blog & Documentation
-- ============================================

-- Enable pg_trgm extension for trigram search (better partial matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- BLOG POSTS FULL-TEXT SEARCH
-- ============================================

-- Add search vector column to blog_posts
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION blog_posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS blog_posts_search_vector_trigger ON blog_posts;
CREATE TRIGGER blog_posts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, excerpt, content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_posts_search_vector_update();

-- Create GIN index for full-text search
DROP INDEX IF EXISTS blog_posts_search_idx;
CREATE INDEX blog_posts_search_idx ON blog_posts USING GIN(search_vector);

-- Create trigram index for partial matching
DROP INDEX IF EXISTS blog_posts_title_trgm_idx;
CREATE INDEX blog_posts_title_trgm_idx ON blog_posts USING GIN(title gin_trgm_ops);

DROP INDEX IF EXISTS blog_posts_excerpt_trgm_idx;
CREATE INDEX blog_posts_excerpt_trgm_idx ON blog_posts USING GIN(excerpt gin_trgm_ops);

-- Populate existing records
UPDATE blog_posts SET search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C')
WHERE search_vector IS NULL;

-- ============================================
-- DOCUMENTATION PAGES FULL-TEXT SEARCH
-- ============================================

-- Add search vector column to doc_pages
ALTER TABLE doc_pages ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION doc_pages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS doc_pages_search_vector_trigger ON doc_pages;
CREATE TRIGGER doc_pages_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, excerpt, content ON doc_pages
  FOR EACH ROW EXECUTE FUNCTION doc_pages_search_vector_update();

-- Create GIN index for full-text search
DROP INDEX IF EXISTS doc_pages_search_idx;
CREATE INDEX doc_pages_search_idx ON doc_pages USING GIN(search_vector);

-- Create trigram index for partial matching
DROP INDEX IF EXISTS doc_pages_title_trgm_idx;
CREATE INDEX doc_pages_title_trgm_idx ON doc_pages USING GIN(title gin_trgm_ops);

DROP INDEX IF EXISTS doc_pages_excerpt_trgm_idx;
CREATE INDEX doc_pages_excerpt_trgm_idx ON doc_pages USING GIN(excerpt gin_trgm_ops);

-- Populate existing records
UPDATE doc_pages SET search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C')
WHERE search_vector IS NULL;

-- ============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ============================================

-- Blog posts composite indexes for common queries
DROP INDEX IF EXISTS blog_posts_status_publishedat_idx;
CREATE INDEX blog_posts_status_publishedat_idx ON blog_posts(status, publishedAt DESC NULLS LAST);

DROP INDEX IF EXISTS blog_posts_category_status_idx;
CREATE INDEX blog_posts_category_status_idx ON blog_posts(categoryId, status);

DROP INDEX IF EXISTS blog_posts_author_status_idx;
CREATE INDEX blog_posts_author_status_idx ON blog_posts(authorId, status);

-- Documentation pages composite indexes
DROP INDEX IF EXISTS doc_pages_status_publishedat_idx;
CREATE INDEX doc_pages_status_publishedat_idx ON doc_pages(status, publishedAt DESC NULLS LAST);

DROP INDEX IF EXISTS doc_pages_section_status_idx;
CREATE INDEX doc_pages_section_status_idx ON doc_pages(sectionId, status);

DROP INDEX IF EXISTS doc_pages_parent_status_idx;
CREATE INDEX doc_pages_parent_status_idx ON doc_pages(parentId, status);

-- ============================================
-- COMMENT: Migration Complete
-- ============================================
COMMENT ON FUNCTION blog_posts_search_vector_update() IS 'Automatically updates full-text search vector for blog posts';
COMMENT ON FUNCTION doc_pages_search_vector_update() IS 'Automatically updates full-text search vector for documentation pages';
