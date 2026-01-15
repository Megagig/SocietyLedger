# Blog & Documentation System - Final Implementation Plan

**Project:** SocietyLedger  
**Created:** January 15, 2026  
**Status:** Ready for Implementation  
**Confidence Level:** 95%+

---

## ✅ Confirmed Requirements

### Access Control
1. **Super Admin Only** (`platformRole === 'SUPER_ADMIN'`)
   - `/admin/blog/*` - Manage blog (CRUD)
   - `/admin/documentation/*` - Manage docs (CRUD)
   - Sidebar: New "CMS" dropdown with "Blog" and "Documentation"

2. **Public Access** (No Authentication)
   - `/blog` - Blog listing
   - `/blog/[slug]` - Blog post
   - `/documentation` - Docs home
   - `/documentation/[slug]` - Doc page

3. **Association Admins** (No Access)
   - Cannot see CMS section in sidebar
   - Cannot access `/admin/*` routes

### Data Scope
- Platform-level content (same for everyone)
- One blog for entire SocietyLedger platform
- One documentation system for entire platform
- Authors: Super Admin users only

### Technical Stack
- **Frontend:** Next.js 14, Mantine UI, TipTap editor
- **Backend:** Express.js, Prisma, PostgreSQL
- **Storage:** Cloudinary (existing upload system)
- **Auth:** `platformRole === 'SUPER_ADMIN'` check

### UI Patterns
- Follow `/admin/associations/page.tsx` structure
- Use same table/card layouts
- Breadcrumb navigation
- Tabs for different views
- Mobile responsive

---

## 📐 Database Schema (Final)


### Blog Models

```prisma
enum ContentScope {
  PLATFORM
  ASSOCIATION  // Future extensibility
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

model BlogPost {
  id              Int       @id @default(autoincrement())
  title           String
  slug            String    @unique
  excerpt         String?
  content         String    @db.Text
  coverImage      String?   // Cloudinary URL
  status          PostStatus @default(DRAFT)
  scope           ContentScope @default(PLATFORM)
  publishedAt     DateTime?
  viewCount       Int       @default(0)
  readTimeMinutes Int?
  
  // SEO
  metaTitle       String?
  metaDescription String?
  metaKeywords    String[]  @default([])
  
  // Relations
  authorId        Int
  author          User      @relation("BlogPostAuthor", fields: [authorId], references: [id])
  categoryId      Int?
  category        BlogCategory? @relation(fields: [categoryId], references: [id])
  tags            BlogPostTag[]
  comments        BlogComment[]
  
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  
  @@map("blog_posts")
  @@index([status, publishedAt])
  @@index([slug])
  @@index([authorId])
}

model BlogCategory {
  id          Int         @id @default(autoincrement())
  name        String
  slug        String      @unique
  description String?
  color       String?     // Hex color for UI
  posts       BlogPost[]
  
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  
  @@map("blog_categories")
}

model BlogTag {
  id        Int           @id @default(autoincrement())
  name      String
  slug      String        @unique
  posts     BlogPostTag[]
  
  createdAt DateTime      @default(now()) @map("created_at")
  
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
  status    CommentStatus @default(PENDING)
  
  postId    Int
  post      BlogPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  // Authenticated user (optional)
  authorId  Int?
  author    User?     @relation("BlogCommentAuthor", fields: [authorId], references: [id])
  
  // Guest comments (optional)
  guestName  String?
  guestEmail String?
  
  // Threading
  parentId  Int?
  parent    BlogComment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies   BlogComment[] @relation("CommentReplies")
  
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  
  @@map("blog_comments")
  @@index([postId, status])
}
```

### Documentation Models

```prisma
enum DocStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model DocPage {
  id              Int       @id @default(autoincrement())
  title           String
  slug            String    @unique
  content         String    @db.Text
  excerpt         String?
  order           Int       @default(0)
  scope           ContentScope @default(PLATFORM)
  
  // Hierarchy
  parentId        Int?
  parent          DocPage?  @relation("DocPageHierarchy", fields: [parentId], references: [id])
  children        DocPage[] @relation("DocPageHierarchy")
  
  // Section
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
  author          User      @relation("DocPageAuthor", fields: [authorId], references: [id])
  feedback        DocFeedback[]
  
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  
  @@map("doc_pages")
  @@index([status, publishedAt])
  @@index([slug])
  @@index([sectionId])
}

model DocSection {
  id          Int       @id @default(autoincrement())
  name        String
  slug        String    @unique
  description String?
  icon        String?   // Icon name (e.g., "rocket", "book")
  order       Int       @default(0)
  pages       DocPage[]
  
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  @@map("doc_sections")
  @@index([order])
}

model DocFeedback {
  id        Int      @id @default(autoincrement())
  pageId    Int
  page      DocPage  @relation(fields: [pageId], references: [id], onDelete: Cascade)
  
  isHelpful Boolean
  comment   String?  @db.Text
  
  // Authenticated user (optional)
  userId    Int?
  user      User?    @relation("DocFeedbackUser", fields: [userId], references: [id])
  
  // Anonymous feedback
  email     String?
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@map("doc_feedback")
  @@index([pageId])
}
```

### User Model Updates

```prisma
// Add to existing User model
model User {
  // ... existing fields
  
  // Blog relations
  blogPosts       BlogPost[]    @relation("BlogPostAuthor")
  blogComments    BlogComment[] @relation("BlogCommentAuthor")
  
  // Documentation relations
  docPages        DocPage[]     @relation("DocPageAuthor")
  docFeedback     DocFeedback[] @relation("DocFeedbackUser")
}
```

---

## 🔄 Implementation Phases (49 hours total)

### Phase 1: Database Setup (2 hours)
**Files:**
- `apps/api/prisma/schema.prisma` - Add all models
- `apps/api/prisma/migrations/` - Create migration
- `apps/api/prisma/seed.ts` - Seed initial data

**Tasks:**
1. Add blog models to schema
2. Add documentation models to schema
3. Update User model with relations
4. Create migration: `npx prisma migrate dev --name add_blog_docs`
5. Seed initial categories and sections

**Seed Data:**
```typescript
// Blog categories
- Finance
- Management
- Technology
- Best Practices

// Doc sections
- Getting Started
- Member Management
- Financial Management
- Communication
- Advanced Features
- Troubleshooting
```

---

### Phase 2: Backend API - Blog (6 hours)

**Module Structure:**
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
│   ├── create-tag.dto.ts
│   └── create-comment.dto.ts
└── types/
    └── blog.types.ts
```

**API Endpoints:**

**Public (No Auth):**
```
GET    /api/blog/posts              - List published posts
GET    /api/blog/posts/:slug        - Get post by slug
GET    /api/blog/categories         - List categories
GET    /api/blog/tags               - List tags
GET    /api/blog/posts/:id/related  - Related posts
POST   /api/blog/posts/:id/comments - Create comment
GET    /api/blog/posts/:id/comments - List comments
POST   /api/blog/posts/:id/view     - Increment view
```

**Super Admin Only:**
```
POST   /api/admin/blog/posts        - Create post
PUT    /api/admin/blog/posts/:id    - Update post
DELETE /api/admin/blog/posts/:id    - Delete post
GET    /api/admin/blog/posts        - List all (including drafts)
POST   /api/admin/blog/categories   - Create category
PUT    /api/admin/blog/categories/:id - Update category
DELETE /api/admin/blog/categories/:id - Delete category
POST   /api/admin/blog/tags         - Create tag
PUT    /api/admin/blog/tags/:id     - Update tag
DELETE /api/admin/blog/tags/:id     - Delete tag
PUT    /api/admin/blog/comments/:id/approve - Approve comment
DELETE /api/admin/blog/comments/:id - Delete comment
POST   /api/admin/blog/upload       - Upload image (Cloudinary)
```

**Middleware:**
```typescript
// Super Admin check
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.platformRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ 
      success: false, 
      message: 'Super Admin access required' 
    });
  }
  next();
};
```

---

### Phase 3: Backend API - Documentation (4 hours)

**Module Structure:**
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

**API Endpoints:**

**Public (No Auth):**
```
GET    /api/docs/sections           - List sections
GET    /api/docs/pages              - List published pages
GET    /api/docs/pages/:slug        - Get page by slug
GET    /api/docs/search?q=query     - Search docs
POST   /api/docs/pages/:id/feedback - Submit feedback
POST   /api/docs/pages/:id/view     - Increment view
GET    /api/docs/pages/:id/related  - Related pages
```

**Super Admin Only:**
```
POST   /api/admin/docs/pages        - Create page
PUT    /api/admin/docs/pages/:id    - Update page
DELETE /api/admin/docs/pages/:id    - Delete page
GET    /api/admin/docs/pages        - List all (including drafts)
POST   /api/admin/docs/sections     - Create section
PUT    /api/admin/docs/sections/:id - Update section
DELETE /api/admin/docs/sections/:id - Delete section
GET    /api/admin/docs/feedback     - List feedback
POST   /api/admin/docs/upload       - Upload image
```

---

### Phase 4: Super Admin UI - Blog Management (8 hours)

**Pages Structure:**
```
apps/web/src/app/admin/blog/
├── page.tsx                    - Blog dashboard
├── posts/
│   ├── page.tsx               - List posts
│   ├── new/
│   │   └── page.tsx           - Create post
│   └── [id]/
│       └── edit/
│           └── page.tsx       - Edit post
├── categories/
│   └── page.tsx               - Manage categories
├── tags/
│   └── page.tsx               - Manage tags
└── comments/
    └── page.tsx               - Moderate comments
```

**Components:**
```
apps/web/src/components/admin/blog/
├── PostEditor.tsx             - TipTap rich text editor
├── PostList.tsx               - Posts table (like associations)
├── CategoryManager.tsx        - Categories CRUD
├── TagManager.tsx             - Tags CRUD
├── CommentModerator.tsx       - Comments table
├── ImageUploader.tsx          - Cloudinary upload
├── SEOFields.tsx              - Meta fields
└── PostPreview.tsx            - Preview modal
```

**UI Pattern (from /admin/associations):**
- Breadcrumb navigation
- Tabs for different views
- Search and filters
- Table view (desktop) + Card view (mobile)
- Action buttons (Edit, Delete, etc.)
- Loading states
- Pagination

**Super Admin Guard:**
```typescript
// In each admin page
useEffect(() => {
  if (user?.platformRole !== 'SUPER_ADMIN') {
    router.push('/dashboard');
    return;
  }
}, [user]);
```

---

### Phase 5: Super Admin UI - Documentation Management (6 hours)

**Pages Structure:**
```
apps/web/src/app/admin/documentation/
├── page.tsx                    - Docs dashboard
├── pages/
│   ├── page.tsx               - List pages (tree view)
│   ├── new/
│   │   └── page.tsx           - Create page
│   └── [id]/
│       └── edit/
│           └── page.tsx       - Edit page
├── sections/
│   └── page.tsx               - Manage sections
└── feedback/
    └── page.tsx               - Review feedback
```

**Components:**
```
apps/web/src/components/admin/documentation/
├── DocEditor.tsx              - Markdown/TipTap editor
├── DocTree.tsx                - Hierarchical tree view
├── SectionManager.tsx         - Sections CRUD
├── FeedbackList.tsx           - Feedback table
├── HierarchyManager.tsx       - Drag-drop ordering
└── DocPreview.tsx             - Preview modal
```

---

### Phase 6: Public Frontend - Blog (6 hours)

**Pages:**
```
apps/web/src/app/blog/
├── page.tsx                    - Blog listing (update existing)
├── [slug]/
│   └── page.tsx               - Single post
├── category/
│   └── [slug]/
│       └── page.tsx           - Category posts
├── tag/
│   └── [slug]/
│       └── page.tsx           - Tag posts
└── search/
    └── page.tsx               - Search results
```

**Components:**
```
apps/web/src/components/blog/
├── PostCard.tsx               - Post preview
├── PostContent.tsx            - Content renderer
├── PostMeta.tsx               - Author, date, time
├── CategoryBadge.tsx          - Category badge
├── TagList.tsx                - Tags
├── CommentSection.tsx         - Comments UI
├── CommentForm.tsx            - Comment form
├── RelatedPosts.tsx           - Related posts
├── ShareButtons.tsx           - Social share
└── BlogSearch.tsx             - Search
```

**SEO (Dynamic Metadata):**
```typescript
// In each page
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug);
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    keywords: post.metaKeywords,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
    },
  };
}
```

---

### Phase 7: Public Frontend - Documentation (6 hours)

**Pages:**
```
apps/web/src/app/documentation/
├── page.tsx                    - Docs home (update existing)
├── [slug]/
│   └── page.tsx               - Single doc page
└── search/
    └── page.tsx               - Search results
```

**Components:**
```
apps/web/src/components/documentation/
├── DocSidebar.tsx             - Navigation sidebar
├── DocContent.tsx             - Content renderer
├── TableOfContents.tsx        - TOC
├── DocSearch.tsx              - Search
├── DocFeedback.tsx            - Helpful widget
├── DocBreadcrumbs.tsx         - Breadcrumbs
├── CodeBlock.tsx              - Syntax highlighting
└── DocNavigation.tsx          - Prev/Next
```

---

### Phase 8: Sidebar Integration (2 hours)

**Update Super Admin Sidebar:**
```typescript
// In sidebar component
{user?.platformRole === 'SUPER_ADMIN' && (
  <NavSection title="CMS">
    <NavItem 
      icon={<IconArticle />} 
      label="Blog" 
      href="/admin/blog"
    />
    <NavItem 
      icon={<IconBook />} 
      label="Documentation" 
      href="/admin/documentation"
    />
  </NavSection>
)}
```

**Find and update:**
- Sidebar component location
- Add CMS dropdown section
- Only visible to Super Admins

---

### Phase 9: Search & Performance (4 hours)

**Tasks:**
1. Implement PostgreSQL full-text search
2. Add search indexing
3. Implement Redis caching
4. Add pagination
5. Optimize queries
6. Add lazy loading

**Search Implementation:**
```typescript
// In Prisma query
where: {
  OR: [
    { title: { contains: query, mode: 'insensitive' } },
    { content: { contains: query, mode: 'insensitive' } },
    { excerpt: { contains: query, mode: 'insensitive' } },
  ],
  status: 'PUBLISHED',
}
```

---

### Phase 10: SEO & Testing (3 hours)

**Tasks:**
1. Add dynamic metadata to all pages
2. Add JSON-LD schemas (Article, BreadcrumbList)
3. Generate RSS feed
4. Update sitemap
5. Add analytics tracking
6. Test all endpoints
7. Test admin UI
8. Test public pages
9. Fix bugs

---

## 📅 Implementation Timeline

**Week 1: Backend**
- Day 1: Phase 1 - Database (2h)
- Day 2-3: Phase 2 - Blog API (6h)
- Day 4-5: Phase 3 - Docs API (4h)

**Week 2: Admin UI**
- Day 1-3: Phase 4 - Blog Admin (8h)
- Day 4-5: Phase 5 - Docs Admin (6h)

**Week 3: Public UI**
- Day 1-2: Phase 6 - Blog Frontend (6h)
- Day 3-4: Phase 7 - Docs Frontend (6h)
- Day 5: Phase 8 - Sidebar (2h)

**Week 4: Polish**
- Day 1-2: Phase 9 - Search & Performance (4h)
- Day 3-4: Phase 10 - SEO & Testing (3h)
- Day 5: Content creation & launch

---

## 🎯 Success Criteria

### Blog System
- [ ] Super Admins can create/edit/delete posts
- [ ] Can manage categories and tags
- [ ] Can moderate comments
- [ ] Posts are SEO optimized
- [ ] Search works accurately
- [ ] Social sharing works
- [ ] Mobile responsive
- [ ] Page load < 3 seconds

### Documentation System
- [ ] Super Admins can create/edit/delete pages
- [ ] Hierarchical structure works
- [ ] Search is fast and accurate
- [ ] Code highlighting works
- [ ] Feedback system works
- [ ] Navigation is intuitive
- [ ] Mobile responsive
- [ ] Print-friendly

---

## 🚀 Ready to Start!

All requirements confirmed. Implementation can begin with Phase 1 (Database Setup).

**Next Step:** Create Prisma models and run migration.

---

**Last Updated:** January 15, 2026  
**Status:** Ready for Implementation ✅
