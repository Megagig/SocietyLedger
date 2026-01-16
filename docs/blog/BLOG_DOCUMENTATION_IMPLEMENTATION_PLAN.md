# Blog & Documentation System Implementation Plan

**Project:** SocietyLedger  
**Created:** January 15, 2026  
**Status:** Planning Phase

---

## 📋 Overview

This document outlines the complete implementation plan for:
1. **Blog System** - Full-featured blog with CMS capabilities
2. **Documentation System** - Comprehensive documentation with search and navigation

Both systems will have:
- Frontend (Next.js pages)
- Backend API (Express.js)
- Database models (Prisma)
- Admin interface for content management
- SEO optimization
- Search functionality

---

## 🎯 Goals

### Blog System
- Publish and manage blog posts
- Categories and tags
- Author profiles
- Comments (optional)
- SEO-optimized
- Social sharing
- Related posts
- RSS feed

### Documentation System
- Hierarchical documentation structure
- Search functionality
- Code syntax highlighting
- Table of contents
- Version control
- Feedback system
- Print-friendly

---

## 📊 Current State Analysis

### What Exists
✅ Blog listing page (`apps/web/src/app/blog/page.tsx`) - Static placeholder  
✅ Documentation page (`apps/web/src/app/documentation/page.tsx`) - Static placeholder  
✅ Database schema with Association model  
✅ API structure with modules pattern  
✅ Authentication & RBAC system  

### What's Needed
❌ Database models (BlogPost, DocPage, Category, Tag, etc.)  
❌ Backend API endpoints  
❌ Admin interface for content management  
❌ Dynamic blog post pages  
❌ Dynamic documentation pages  
❌ Search functionality  
❌ Rich text editor integration  
❌ Image upload system  

---

## 🏗️ Architecture Overview


### Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- Mantine UI components
- TipTap or Lexical (Rich text editor)
- React Markdown (for rendering)
- Prism.js (Code highlighting)

**Backend:**
- Express.js
- Prisma ORM
- PostgreSQL
- Redis (caching)
- Cloudinary/S3 (image storage)

**Content Management:**
- Admin dashboard pages
- WYSIWYG editor
- Markdown support
- Image upload
- SEO fields

---

## 📐 Database Schema Design

### Blog System Models

```prisma
model BlogPost {
  id              Int       @id @default(autoincrement())
  title           String
  slug            String    @unique
  excerpt         String?
  content         String    @db.Text
  coverImage      String?
  status          PostStatus @default(DRAFT) // DRAFT, PUBLISHED, ARCHIVED
  publishedAt     DateTime?
  viewCount       Int       @default(0)
  readTimeMinutes Int?
  
  // SEO
  metaTitle       String?
  metaDescription String?
  metaKeywords    String[]  @default([])
  
  // Relations
  authorId        Int
  author          User      @relation(fields: [authorId], references: [id])
  categoryId      Int?
  category        BlogCategory? @relation(fields: [categoryId], references: [id])
  tags            BlogPostTag[]
  comments        BlogComment[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@map("blog_posts")
}

model BlogCategory {
  id          Int         @id @default(autoincrement())
  name        String
  slug        String      @unique
  description String?
  color       String?     // For UI display
  posts       BlogPost[]
  
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  @@map("blog_categories")
}

model BlogTag {
  id        Int           @id @default(autoincrement())
  name      String
  slug      String        @unique
  posts     BlogPostTag[]
  
  createdAt DateTime      @default(now())
  
  @@map("blog_tags")
}

model BlogPostTag {
  postId    Int
  tagId     Int
  post      BlogPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag       BlogTag  @relation(fields: [tagId], references: [id], onDelete: Cascade)
  
  @@id([postId, tagId])
  @@map("blog_post_tags")
}

model BlogComment {
  id        Int       @id @default(autoincrement())
  content   String    @db.Text
  status    CommentStatus @default(PENDING) // PENDING, APPROVED, SPAM
  
  postId    Int
  post      BlogPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  authorId  Int?
  author    User?     @relation(fields: [authorId], references: [id])
  
  // For guest comments
  guestName  String?
  guestEmail String?
  
  parentId  Int?
  parent    BlogComment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies   BlogComment[] @relation("CommentReplies")
  
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  @@map("blog_comments")
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum CommentStatus {
  PENDING
  APPROVED
  SPAM
}
```

### Documentation System Models

```prisma
model DocPage {
  id              Int       @id @default(autoincrement())
  title           String
  slug            String    @unique
  content         String    @db.Text
  excerpt         String?
  order           Int       @default(0)
  
  // Hierarchy
  parentId        Int?
  parent          DocPage?  @relation("DocPageHierarchy", fields: [parentId], references: [id])
  children        DocPage[] @relation("DocPageHierarchy")
  
  // Category/Section
  sectionId       Int?
  section         DocSection? @relation(fields: [sectionId], references: [id])
  
  // SEO
  metaTitle       String?
  metaDescription String?
  
  // Versioning
  version         String    @default("1.0")
  isLatest        Boolean   @default(true)
  
  // Status
  status          DocStatus @default(DRAFT)
  publishedAt     DateTime?
  
  // Analytics
  viewCount       Int       @default(0)
  helpfulCount    Int       @default(0)
  notHelpfulCount Int       @default(0)
  
  // Relations
  authorId        Int
  author          User      @relation(fields: [authorId], references: [id])
  feedback        DocFeedback[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@map("doc_pages")
}

model DocSection {
  id          Int       @id @default(autoincrement())
  name        String
  slug        String    @unique
  description String?
  icon        String?   // Icon name for UI
  order       Int       @default(0)
  pages       DocPage[]
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@map("doc_sections")
}

model DocFeedback {
  id        Int      @id @default(autoincrement())
  pageId    Int
  page      DocPage  @relation(fields: [pageId], references: [id], onDelete: Cascade)
  
  isHelpful Boolean
  comment   String?  @db.Text
  
  userId    Int?
  user      User?    @relation(fields: [userId], references: [id])
  
  // For anonymous feedback
  email     String?
  
  createdAt DateTime @default(now())
  
  @@map("doc_feedback")
}

enum DocStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

---

## 🔄 Implementation Phases

### Phase 1: Database Setup (2 hours)
**Priority:** CRITICAL

**Tasks:**
1. Add blog models to Prisma schema
2. Add documentation models to Prisma schema
3. Create and run migrations
4. Seed initial data (categories, sections)

**Files to Create/Modify:**
- `apps/api/prisma/schema.prisma` (add models)
- `apps/api/prisma/migrations/` (new migration)
- `apps/api/prisma/seed.ts` (seed data)

**Deliverables:**
- ✅ Database tables created
- ✅ Relations established
- ✅ Initial seed data loaded

---

### Phase 2: Backend API - Blog System (6 hours)
**Priority:** HIGH

**Tasks:**
1. Create blog module structure
2. Implement blog post CRUD endpoints
3. Implement category & tag endpoints
4. Implement comment endpoints
5. Add image upload functionality
6. Add search & filtering
7. Add pagination
8. Add view count tracking

**API Endpoints:**

**Public Endpoints:**
```
GET    /api/blog/posts              - List published posts (paginated)
GET    /api/blog/posts/:slug        - Get single post by slug
GET    /api/blog/categories         - List all categories
GET    /api/blog/tags               - List all tags
GET    /api/blog/posts/:id/related  - Get related posts
POST   /api/blog/posts/:id/comments - Create comment (auth optional)
GET    /api/blog/posts/:id/comments - List comments
POST   /api/blog/posts/:id/view     - Increment view count
```

**Admin Endpoints (Protected):**
```
POST   /api/admin/blog/posts        - Create post
PUT    /api/admin/blog/posts/:id    - Update post
DELETE /api/admin/blog/posts/:id    - Delete post
GET    /api/admin/blog/posts        - List all posts (including drafts)
POST   /api/admin/blog/categories   - Create category
PUT    /api/admin/blog/categories/:id - Update category
DELETE /api/admin/blog/categories/:id - Delete category
POST   /api/admin/blog/tags         - Create tag
PUT    /api/admin/blog/tags/:id     - Update tag
DELETE /api/admin/blog/tags/:id     - Delete tag
PUT    /api/admin/blog/comments/:id/approve - Approve comment
DELETE /api/admin/blog/comments/:id - Delete comment
POST   /api/admin/blog/upload       - Upload image
```

**Files to Create:**
```
apps/api/src/modules/blog/
├── blog.routes.ts
├── blog.controller.ts
├── blog.service.ts
├── blog.validation.ts
├── dto/
│   ├── create-post.dto.ts
│   ├── update-post.dto.ts
│   ├── create-category.dto.ts
│   └── create-comment.dto.ts
└── types/
    └── blog.types.ts
```

**Deliverables:**
- ✅ All blog API endpoints working
- ✅ Validation implemented
- ✅ Authorization checks in place
- ✅ Image upload functional
- ✅ Search & filtering working

---

### Phase 3: Backend API - Documentation System (4 hours)
**Priority:** HIGH

**Tasks:**
1. Create documentation module structure
2. Implement doc page CRUD endpoints
3. Implement section endpoints
4. Implement search functionality
5. Add feedback endpoints
6. Add view tracking

**API Endpoints:**

**Public Endpoints:**
```
GET    /api/docs/sections           - List all sections
GET    /api/docs/pages              - List all published pages
GET    /api/docs/pages/:slug        - Get single page by slug
GET    /api/docs/search?q=query     - Search documentation
POST   /api/docs/pages/:id/feedback - Submit feedback
POST   /api/docs/pages/:id/view     - Increment view count
GET    /api/docs/pages/:id/related  - Get related pages
```

**Admin Endpoints (Protected):**
```
POST   /api/admin/docs/pages        - Create page
PUT    /api/admin/docs/pages/:id    - Update page
DELETE /api/admin/docs/pages/:id    - Delete page
GET    /api/admin/docs/pages        - List all pages (including drafts)
POST   /api/admin/docs/sections     - Create section
PUT    /api/admin/docs/sections/:id - Update section
DELETE /api/admin/docs/sections/:id - Delete section
GET    /api/admin/docs/feedback     - List all feedback
POST   /api/admin/docs/upload       - Upload image
```

**Files to Create:**
```
apps/api/src/modules/documentation/
├── documentation.routes.ts
├── documentation.controller.ts
├── documentation.service.ts
├── documentation.validation.ts
├── dto/
│   ├── create-page.dto.ts
│   ├── update-page.dto.ts
│   └── create-section.dto.ts
└── types/
    └── documentation.types.ts
```

**Deliverables:**
- ✅ All documentation API endpoints working
- ✅ Hierarchical structure supported
- ✅ Search functionality implemented
- ✅ Feedback system working

---

### Phase 4: Admin Interface - Blog Management (8 hours)
**Priority:** HIGH

**Tasks:**
1. Create blog admin dashboard
2. Create post editor (rich text)
3. Create category management
4. Create tag management
5. Create comment moderation
6. Add image upload UI
7. Add SEO fields
8. Add preview functionality

**Pages to Create:**
```
apps/web/src/app/admin/blog/
├── page.tsx                    - Blog dashboard
├── posts/
│   ├── page.tsx               - List all posts
│   ├── new/
│   │   └── page.tsx           - Create new post
│   └── [id]/
│       ├── page.tsx           - View post
│       └── edit/
│           └── page.tsx       - Edit post
├── categories/
│   ├── page.tsx               - List categories
│   └── [id]/
│       └── page.tsx           - Edit category
├── tags/
│   ├── page.tsx               - List tags
│   └── [id]/
│       └── page.tsx           - Edit tag
└── comments/
    └── page.tsx               - Moderate comments
```

**Components to Create:**
```
apps/web/src/components/admin/blog/
├── PostEditor.tsx             - Rich text editor
├── PostList.tsx               - Posts table
├── CategoryForm.tsx           - Category form
├── TagForm.tsx                - Tag form
├── CommentList.tsx            - Comments table
├── ImageUploader.tsx          - Image upload
├── SEOFields.tsx              - SEO metadata fields
└── PostPreview.tsx            - Preview modal
```

**Deliverables:**
- ✅ Full blog admin interface
- ✅ Rich text editor working
- ✅ Image upload functional
- ✅ SEO fields editable
- ✅ Preview working

---

### Phase 5: Admin Interface - Documentation Management (6 hours)
**Priority:** HIGH

**Tasks:**
1. Create documentation admin dashboard
2. Create page editor
3. Create section management
4. Add hierarchy management
5. Add feedback review
6. Add search preview

**Pages to Create:**
```
apps/web/src/app/admin/documentation/
├── page.tsx                    - Docs dashboard
├── pages/
│   ├── page.tsx               - List all pages
│   ├── new/
│   │   └── page.tsx           - Create new page
│   └── [id]/
│       ├── page.tsx           - View page
│       └── edit/
│           └── page.tsx       - Edit page
├── sections/
│   ├── page.tsx               - List sections
│   └── [id]/
│       └── page.tsx           - Edit section
└── feedback/
    └── page.tsx               - Review feedback
```

**Components to Create:**
```
apps/web/src/components/admin/documentation/
├── DocEditor.tsx              - Markdown/rich text editor
├── DocList.tsx                - Pages tree view
├── SectionForm.tsx            - Section form
├── HierarchyManager.tsx       - Drag-drop hierarchy
├── FeedbackList.tsx           - Feedback table
└── DocPreview.tsx             - Preview modal
```

**Deliverables:**
- ✅ Full documentation admin interface
- ✅ Hierarchical structure management
- ✅ Markdown editor working
- ✅ Feedback review functional

---

### Phase 6: Public Frontend - Blog (6 hours)
**Priority:** HIGH

**Tasks:**
1. Create dynamic blog listing page
2. Create dynamic blog post page
3. Create category pages
4. Create tag pages
5. Add search functionality
6. Add comments UI
7. Add social sharing
8. Add related posts

**Pages to Create:**
```
apps/web/src/app/blog/
├── page.tsx                    - Blog listing (update existing)
├── [slug]/
│   └── page.tsx               - Single blog post
├── category/
│   └── [slug]/
│       └── page.tsx           - Category posts
├── tag/
│   └── [slug]/
│       └── page.tsx           - Tag posts
└── search/
    └── page.tsx               - Search results
```

**Components to Create:**
```
apps/web/src/components/blog/
├── PostCard.tsx               - Post preview card
├── PostContent.tsx            - Post content renderer
├── PostMeta.tsx               - Author, date, read time
├── CategoryBadge.tsx          - Category badge
├── TagList.tsx                - Tags list
├── CommentSection.tsx         - Comments UI
├── CommentForm.tsx            - Comment form
├── RelatedPosts.tsx           - Related posts
├── ShareButtons.tsx           - Social share buttons
└── BlogSearch.tsx             - Search component
```

**Deliverables:**
- ✅ Dynamic blog pages working
- ✅ SEO optimized
- ✅ Comments functional
- ✅ Social sharing working
- ✅ Search working

---

### Phase 7: Public Frontend - Documentation (6 hours)
**Priority:** HIGH

**Tasks:**
1. Create dynamic documentation pages
2. Create sidebar navigation
3. Create table of contents
4. Add search functionality
5. Add feedback UI
6. Add breadcrumbs
7. Add print styles
8. Add code highlighting

**Pages to Create:**
```
apps/web/src/app/documentation/
├── page.tsx                    - Docs home (update existing)
├── [slug]/
│   └── page.tsx               - Single doc page
└── search/
    └── page.tsx               - Search results
```

**Components to Create:**
```
apps/web/src/components/documentation/
├── DocSidebar.tsx             - Navigation sidebar
├── DocContent.tsx             - Content renderer
├── TableOfContents.tsx        - TOC component
├── DocSearch.tsx              - Search component
├── DocFeedback.tsx            - Feedback widget
├── DocBreadcrumbs.tsx         - Breadcrumbs
├── CodeBlock.tsx              - Code highlighting
└── DocNavigation.tsx          - Prev/Next navigation
```

**Deliverables:**
- ✅ Dynamic documentation pages
- ✅ Sidebar navigation working
- ✅ Search functional
- ✅ Code highlighting working
- ✅ Feedback widget working

---

### Phase 8: Search & Performance (4 hours)
**Priority:** MEDIUM

**Tasks:**
1. Implement full-text search (PostgreSQL)
2. Add search indexing
3. Implement caching (Redis)
4. Add pagination
5. Optimize queries
6. Add lazy loading

**Deliverables:**
- ✅ Fast search results
- ✅ Caching implemented
- ✅ Optimized performance

---

### Phase 9: SEO & Analytics (3 hours)
**Priority:** MEDIUM

**Tasks:**
1. Add dynamic metadata
2. Add JSON-LD schemas
3. Generate RSS feed
4. Add sitemap entries
5. Add analytics tracking
6. Add social meta tags

**Deliverables:**
- ✅ SEO optimized
- ✅ RSS feed generated
- ✅ Analytics tracking

---

### Phase 10: Testing & Polish (4 hours)
**Priority:** MEDIUM

**Tasks:**
1. Test all API endpoints
2. Test admin interfaces
3. Test public pages
4. Fix bugs
5. Improve UI/UX
6. Add loading states
7. Add error handling

**Deliverables:**
- ✅ All features tested
- ✅ Bugs fixed
- ✅ Polish complete

---

## 📊 Implementation Timeline

### Week 1 (Backend Foundation)
- **Day 1-2:** Phase 1 - Database Setup (2 hours)
- **Day 3-5:** Phase 2 - Blog API (6 hours)
- **Day 6-7:** Phase 3 - Documentation API (4 hours)

### Week 2 (Admin Interfaces)
- **Day 1-4:** Phase 4 - Blog Admin (8 hours)
- **Day 5-7:** Phase 5 - Documentation Admin (6 hours)

### Week 3 (Public Frontend)
- **Day 1-3:** Phase 6 - Blog Frontend (6 hours)
- **Day 4-6:** Phase 7 - Documentation Frontend (6 hours)
- **Day 7:** Phase 8 - Search & Performance (4 hours)

### Week 4 (Polish & Launch)
- **Day 1-2:** Phase 9 - SEO & Analytics (3 hours)
- **Day 3-5:** Phase 10 - Testing & Polish (4 hours)
- **Day 6-7:** Content creation & launch

**Total Estimated Time:** 49 hours (approximately 1 month)

---

## 🎨 UI/UX Design Considerations

### Blog Design
- Clean, readable typography
- Featured images
- Author profiles with avatars
- Category colors
- Tag clouds
- Related posts sidebar
- Social sharing buttons
- Comment threading
- Mobile responsive

### Documentation Design
- Collapsible sidebar
- Sticky table of contents
- Code syntax highlighting
- Copy code button
- Search with keyboard shortcuts
- Breadcrumb navigation
- Prev/Next navigation
- Print-friendly styles
- Dark mode support

---

## 🔒 Security & Access Control

### Authentication & Authorization
- **Super Admin Only Access:** Blog/Docs management routes protected by `platformRole === 'SUPER_ADMIN'` check
- **Public Read Access:** All blog and documentation pages viewable without authentication
- **Association Admins:** NO access to blog/docs management (completely separate from `/dashboard/*`)
- Comment moderation to prevent spam
- Rate limiting on public endpoints
- XSS protection in content rendering
- CSRF protection on forms

### Route Protection
```typescript
// Super Admin check (like in /admin/associations/page.tsx)
if (user?.platformRole !== 'SUPER_ADMIN') {
  router.push('/dashboard');
  return;
}
```

### Content Security
- Sanitize HTML input
- Validate image uploads (Cloudinary)
- Prevent SQL injection
- Secure file storage
- Content versioning

---

## 📈 Analytics & Metrics

### Blog Metrics
- Total posts published
- Views per post
- Comments per post
- Most popular posts
- Most popular categories
- Traffic sources
- Engagement rate

### Documentation Metrics
- Total pages
- Views per page
- Search queries
- Helpful/Not helpful ratio
- Most viewed pages
- Search success rate
- Time on page

---

## 🚀 Future Enhancements

### Blog System
- [ ] Newsletter integration
- [ ] Author profiles page
- [ ] Series/collections
- [ ] Bookmarking
- [ ] Reading progress
- [ ] Estimated read time
- [ ] Related posts AI
- [ ] Content scheduling
- [ ] A/B testing

### Documentation System
- [ ] Multi-language support
- [ ] Version switching
- [ ] API documentation generator
- [ ] Interactive examples
- [ ] Video embeds
- [ ] PDF export
- [ ] Offline mode
- [ ] AI-powered search
- [ ] Chatbot integration

---

## 📝 Content Strategy

### Initial Blog Content (From SEO Plan)
1. How to Manage Cooperative Finances in Nigeria
2. 5 Best Practices for HOA Management
3. Digital Transformation for Town Unions
4. Complete Guide to Welfare Fund Management
5. Effective Member Communication Strategies
6. Understanding Cooperative Accounting in Nigeria
7. How to Collect Dues and Levies Efficiently
8. Building Trust in Your Association
9. Financial Transparency Best Practices
10. Managing Association Elections
11. SMS Communication for Associations
12. Budgeting for Community Organizations

### Initial Documentation Structure
1. **Getting Started**
   - Create Account
   - Association Setup
   - Add Members
   - Configure Settings

2. **Member Management**
   - Add Members
   - Member Profiles
   - Bulk Operations
   - Member Status

3. **Financial Management**
   - Dues Setup
   - Payment Tracking
   - Financial Reports
   - Welfare Funds

4. **Communication**
   - SMS Notifications
   - Email Campaigns
   - Announcements

5. **Advanced Features**
   - Role Permissions
   - Elections
   - API Access
   - Integrations

6. **Troubleshooting**
   - Common Issues
   - FAQs
   - Contact Support

---

## ✅ Success Criteria

### Blog System
- [ ] Can create, edit, delete posts
- [ ] Can manage categories and tags
- [ ] Can moderate comments
- [ ] Posts are SEO optimized
- [ ] Search works accurately
- [ ] Social sharing works
- [ ] Mobile responsive
- [ ] Page load < 3 seconds

### Documentation System
- [ ] Can create, edit, delete pages
- [ ] Hierarchical structure works
- [ ] Search is fast and accurate
- [ ] Code highlighting works
- [ ] Feedback system works
- [ ] Navigation is intuitive
- [ ] Mobile responsive
- [ ] Print-friendly

---

## 📞 Next Steps

1. **Review this plan** - Confirm approach and timeline
2. **Set up development environment** - Ensure all tools ready
3. **Start Phase 1** - Database schema implementation
4. **Daily progress updates** - Track completion
5. **Test incrementally** - Don't wait until end

---

**Ready to start implementation? Let me know and we'll begin with Phase 1!**

---

**Last Updated:** January 15, 2026  
**Status:** Planning Complete - Ready for Implementation
