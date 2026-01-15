# Phase 10: Testing Guide

**Date:** January 15, 2026
**Purpose:** Comprehensive testing of Blog & Documentation system SEO and functionality

---

## 🧪 Testing Checklist

### 1. API Endpoint Testing

#### Blog API Endpoints
- [ ] **GET** `/api/blog/posts` - List published posts
  - Verify response structure
  - Check pagination works
  - Test with category filter
  - Test with search query

- [ ] **GET** `/api/blog/posts/:slug` - Get single post
  - Verify all fields returned
  - Check 404 handling
  - Test with valid slug
  - Test with invalid slug

- [ ] **GET** `/api/blog/posts/:id/related` - Related posts
  - Verify related posts logic
  - Check empty result handling
  - Test with post ID

- [ ] **GET** `/api/blog/posts/:id/comments` - List comments
  - Verify comment structure
  - Check approved comments only
  - Test pagination

- [ ] **POST** `/api/blog/posts/:id/comments` - Create comment
  - Test authenticated user comment
  - Test guest comment
  - Verify validation
  - Check error handling

- [ ] **POST** `/api/blog/posts/:id/view` - Increment views
  - Verify view count increments
  - Test concurrent requests
  - Check rate limiting

- [ ] **GET** `/api/blog/categories` - List categories
  - Verify all categories returned
  - Check category structure

- [ ] **GET** `/api/blog/tags` - List tags
  - Verify all tags returned
  - Check tag structure

#### Documentation API Endpoints
- [ ] **GET** `/api/docs/sections` - List sections
  - Verify all sections returned
  - Check ordering

- [ ] **GET** `/api/docs/pages` - List pages
  - Verify published pages only
  - Test with section filter
  - Check ordering

- [ ] **GET** `/api/docs/pages/:slug` - Get single page
  - Verify all fields returned
  - Check 404 handling
  - Test with valid slug
  - Test with invalid slug

- [ ] **GET** `/api/docs/search` - Search docs
  - Test search functionality
  - Verify relevance
  - Check empty results

- [ ] **POST** `/api/docs/pages/:id/feedback` - Submit feedback
  - Test helpful/not helpful
  - Test with comment
  - Verify validation
  - Check rate limiting

- [ ] **POST** `/api/docs/pages/:id/view` - Increment views
  - Verify view count increments
  - Test concurrent requests

- [ ] **GET** `/api/docs/pages/:id/related` - Related pages
  - Verify related pages logic
  - Check empty result handling

#### Admin API Endpoints (Super Admin Only)
- [ ] **POST** `/api/admin/blog/posts` - Create post
- [ ] **PUT** `/api/admin/blog/posts/:id` - Update post
- [ ] **DELETE** `/api/admin/blog/posts/:id` - Delete post
- [ ] **POST** `/api/admin/blog/categories` - Create category
- [ ] **PUT** `/api/admin/blog/categories/:id` - Update category
- [ ] **DELETE** `/api/admin/blog/categories/:id` - Delete category
- [ ] **POST** `/api/admin/blog/tags` - Create tag
- [ ] **PUT** `/api/admin/blog/tags/:id` - Update tag
- [ ] **DELETE** `/api/admin/blog/tags/:id` - Delete tag
- [ ] **PUT** `/api/admin/blog/comments/:id/approve` - Approve comment
- [ ] **DELETE** `/api/admin/blog/comments/:id` - Delete comment
- [ ] **POST** `/api/admin/docs/pages` - Create page
- [ ] **PUT** `/api/admin/docs/pages/:id` - Update page
- [ ] **DELETE** `/api/admin/docs/pages/:id` - Delete page
- [ ] **POST** `/api/admin/docs/sections` - Create section
- [ ] **PUT** `/api/admin/docs/sections/:id` - Update section
- [ ] **DELETE** `/api/admin/docs/sections/:id` - Delete section
- [ ] **GET** `/api/admin/docs/feedback` - List feedback

### 2. Admin UI Testing

#### Blog Management
- [ ] **Blog Dashboard** (`/admin/blog`)
  - Verify statistics display
  - Check quick actions work
  - Test navigation

- [ ] **Posts List** (`/admin/blog/posts`)
  - Verify all posts displayed
  - Test search functionality
  - Test filtering by status
  - Test pagination
  - Verify actions (edit, delete, view)

- [ ] **Create Post** (`/admin/blog/posts/new`)
  - Test TipTap editor
  - Verify all fields work (title, content, excerpt, etc.)
  - Test image upload (Cloudinary)
  - Test category selection
  - Test tag selection
  - Test SEO fields (meta title, description, keywords)
  - Test save functionality
  - Test preview

- [ ] **Edit Post** (`/admin/blog/posts/[id]/edit`)
  - Verify existing data loads
  - Test all field updates
  - Test image replacement
  - Verify save works
  - Test status changes (draft → published)

- [ ] **Categories** (`/admin/blog/categories`)
  - Verify all categories displayed
  - Test create category
  - Test edit category
  - Test delete category
  - Test color selection

- [ ] **Tags** (`/admin/blog/tags`)
  - Verify all tags displayed
  - Test create tag
  - Test edit tag
  - Test delete tag

- [ ] **Comments** (`/admin/blog/comments`)
  - Verify all comments displayed
  - Test approve/reject
  - Test delete
  - Test filtering by status

#### Documentation Management
- [ ] **Docs Dashboard** (`/admin/documentation`)
  - Verify statistics display
  - Check quick actions work
  - Test navigation

- [ ] **Pages List** (`/admin/documentation/pages`)
  - Verify all pages displayed
  - Test tree view
  - Test search
  - Test filtering by status
  - Verify actions (edit, delete, view)

- [ ] **Create Page** (`/admin/documentation/pages/new`)
  - Test editor
  - Verify all fields work
  - Test section selection
  - Test parent selection (hierarchy)
  - Test SEO fields
  - Test save functionality
  - Test preview

- [ ] **Edit Page** (`/admin/documentation/pages/[id]/edit`)
  - Verify existing data loads
  - Test all field updates
  - Verify save works
  - Test status changes

- [ ] **Sections** (`/admin/documentation/sections`)
  - Verify all sections displayed
  - Test create section
  - Test edit section
  - Test delete section
  - Test ordering

- [ ] **Feedback** (`/admin/documentation/feedback`)
  - Verify all feedback displayed
  - Test helpful/not helpful counts
  - Test view comments
  - Test filtering

### 3. Public Pages Testing

#### Blog Pages
- [ ] **Blog Listing** (`/blog`)
  - Verify all published posts displayed
  - Test category filter
  - Test search functionality
  - Test tag filter
  - Verify responsive design
  - Test dark mode
  - Check metadata (title, description)
  - Verify JSON-LD schemas

- [ ] **Blog Post** (`/blog/[slug]`)
  - Verify post content displays correctly
  - Test TipTap content rendering
  - Test cover image display
  - Test author information
  - Test category badge
  - Test tags display
  - Test comment section
    - Test comment form (authenticated)
    - Test comment form (guest)
    - Verify approved comments display
  - Test related posts
  - Test share buttons
  - Test view count increment
  - Test navigation (back to blog)
  - Check metadata (title, description, OG tags)
  - Verify JSON-LD schemas (Article, BreadcrumbList)
  - Verify responsive design
  - Test dark mode

- [ ] **Category Page** (`/blog/category/[slug]`)
  - Verify posts in category displayed
  - Test category info
  - Test navigation

- [ ] **Tag Page** (`/blog/tag/[slug]`)
  - Verify posts with tag displayed
  - Test tag info
  - Test navigation

- [ ] **Blog Search** (`/blog/search`)
  - Test search functionality
  - Verify search results
  - Test empty results
  - Test navigation

#### Documentation Pages
- [ ] **Documentation Home** (`/documentation`)
  - Verify all sections displayed
  - Test section cards
  - Test search functionality
  - Verify responsive design
  - Test dark mode
  - Check metadata
  - Test navigation to sections

- [ ] **Documentation Page** (`/documentation/[slug]`)
  - Verify page content displays correctly
  - Test content rendering
  - Test sidebar navigation
  - Test table of contents
  - Test feedback widget
    - Test helpful button
    - Test not helpful button
    - Test comment submission
  - Test navigation (prev/next)
  - Test breadcrumbs
  - Test related pages
  - Test view count increment
  - Test back to docs
  - Check metadata (title, description, OG tags)
  - Verify JSON-LD schemas (WebPage, BreadcrumbList)
  - Verify responsive design
  - Test dark mode

- [ ] **Documentation Search** (`/documentation/search`)
  - Test search functionality
  - Verify search results
  - Test empty results
  - Test navigation

### 4. SEO Testing

#### Technical SEO
- [ ] **Sitemap** (`/sitemap.xml`)
  - Verify XML is valid
  - Check all static pages included
  - Check blog posts included
  - Check documentation pages included
  - Verify lastModified dates
  - Verify proper XML structure

- [ ] **Robots.txt** (`/robots.txt`)
  - Verify proper format
  - Check allow directives
  - Check disallow directives
  - Verify sitemap reference

- [ ] **RSS Feed** (`/rss.xml`)
  - Verify XML is valid
  - Check feed structure
  - Verify all published posts included
  - Check proper XML tags
  - Test RSS validator

#### Metadata Testing
- [ ] **Blog Listing Page**
  - Check page title
  - Check meta description
  - Check meta keywords
  - Verify OpenGraph tags
  - Verify Twitter Card tags
  - Check canonical URL

- [ ] **Blog Post Pages**
  - Verify dynamic title
  - Check dynamic description
  - Verify author meta
  - Check publication date
  - Verify OpenGraph with images
  - Test Twitter Card with images
  - Check canonical URL
  - Verify JSON-LD Article schema
  - Verify JSON-LD BreadcrumbList schema

- [ ] **Documentation Pages**
  - Verify dynamic title
  - Check dynamic description
  - Verify OpenGraph tags
  - Test Twitter Card tags
  - Check canonical URL
  - Verify JSON-LD WebPage schema
  - Verify JSON-LD BreadcrumbList schema

#### Structured Data Testing
- [ ] Use [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Use [Schema.org Validator](https://validator.schema.org/)
- [ ] Test with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [ ] Test with [Twitter Card Validator](https://cards-dev.twitter.com/validator)

### 5. Performance Testing

#### Page Load Times
- [ ] Blog listing < 2 seconds
- [ ] Blog post < 2 seconds
- [ ] Documentation listing < 2 seconds
- [ ] Documentation page < 2 seconds
- [ ] Admin pages < 2 seconds

#### Caching
- [ ] Verify sitemap caching (1 hour)
- [ ] Verify RSS caching (1 hour)
- [ ] Verify metadata caching
- [ ] Check API response caching

### 6. Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### 7. Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Proper ARIA labels
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Alt text on all images

### 8. Mobile Responsiveness

- [ ] Blog listing responsive
- [ ] Blog post responsive
- [ ] Documentation listing responsive
- [ ] Documentation page responsive
- [ ] Admin pages responsive
- [ ] Touch targets adequate size
- [ ] No horizontal scrolling

---

## 🐛 Bug Reporting Template

If you find any issues during testing, use this template:

```
**Issue Title:** [Brief description]

**Severity:** [Critical/High/Medium/Low]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Browser: [Chrome/Firefox/Safari/etc]
- Device: [Desktop/Mobile/Tablet]
- OS: [Windows/Mac/Linux]

**Screenshots:**
[Attach screenshots if applicable]

**Console Errors:**
[Paste any console errors]
```

---

## ✅ Sign-Off Criteria

Phase 10 is complete when:

- [ ] All API endpoints tested and working
- [ ] All admin UI features tested and working
- [ ] All public pages tested and working
- [ ] SEO features verified (sitemap, robots, RSS, metadata)
- [ ] No critical bugs found
- [ ] TypeScript compilation passes
- [ ] Performance benchmarks met
- [ ] Cross-browser compatibility confirmed
- [ ] Accessibility standards met
- [ ] Mobile responsiveness verified

---

## 📝 Testing Notes

### Test Environment Setup
1. Ensure API server is running
2. Ensure database is seeded with test data
3. Ensure web app is running in development mode
4. Open browser dev tools for console errors
5. Use network tab to monitor API calls

### Test Data Requirements
- At least 5 published blog posts
- At least 3 categories
- At least 5 tags
- At least 5 published documentation pages
- At least 3 documentation sections
- Mix of published and draft content
- Comments on some posts
- Feedback on some doc pages

### Performance Benchmarks
- **Good**: < 2 seconds page load
- **Acceptable**: 2-3 seconds page load
- **Needs Improvement**: > 3 seconds page load

---

**Ready for testing!** Follow this checklist systematically to ensure all features work correctly.
