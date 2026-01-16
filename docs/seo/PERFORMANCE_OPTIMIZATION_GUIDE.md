# Performance Optimization Guide - Phase 9

**Goal:** Achieve 90+ Lighthouse scores and optimal Core Web Vitals  
**Timeline:** 2-3 hours  
**Last Updated:** January 14, 2026

---

## Overview

This guide covers all performance optimization tasks for SocietyLedger to ensure fast loading, excellent user experience, and top SEO rankings.

---

## Task 9.1: Run Lighthouse Audits

### What is Lighthouse?

Lighthouse is an automated tool built into Chrome DevTools that audits web pages for:
- Performance
- Accessibility
- Best Practices
- SEO
- Progressive Web App (PWA)

### How to Run Lighthouse

**Method 1: Chrome DevTools (Recommended)**
1. Open Chrome browser
2. Navigate to your page (e.g., https://societyledger.com.ng)
3. Right-click → Inspect (or press F12)
4. Click "Lighthouse" tab
5. Select categories to audit (all recommended)
6. Select "Desktop" or "Mobile"
7. Click "Analyze page load"
8. Wait for results (30-60 seconds)

**Method 2: PageSpeed Insights**
1. Go to https://pagespeed.web.dev
2. Enter your URL
3. Click "Analyze"
4. View mobile and desktop results

**Method 3: CLI (for automation)**
```bash
npm install -g lighthouse
lighthouse https://societyledger.com.ng --view
```

### Pages to Audit

Run Lighthouse on all public pages:
- [ ] Homepage (/)
- [ ] Pricing (/pricing)
- [ ] Features (/features)
- [ ] Contact (/contact)
- [ ] About (/about)
- [ ] FAQ (/faq)
- [ ] Documentation (/documentation)
- [ ] Testimonials (/testimonials)
- [ ] Blog (/blog)
- [ ] Privacy (/privacy)
- [ ] Terms (/terms)

### Target Scores

**Minimum Acceptable:**
- Performance: 80+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 95+

**Ideal Target:**
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

### Recording Results

Create a spreadsheet to track scores:

| Page | Performance | Accessibility | Best Practices | SEO | Date |
|------|-------------|---------------|----------------|-----|------|
| Homepage | 92 | 98 | 100 | 100 | 2026-01-14 |
| Pricing | 90 | 95 | 100 | 100 | 2026-01-14 |
| ... | ... | ... | ... | ... | ... |

### Common Issues & Fixes

**Performance Issues:**
- Large images → Compress and use WebP
- Render-blocking resources → Defer non-critical JS/CSS
- Unused JavaScript → Code splitting
- Long tasks → Break up JavaScript execution

**Accessibility Issues:**
- Missing alt text → Add to all images
- Low contrast → Adjust colors
- Missing ARIA labels → Add to interactive elements
- Heading order → Fix heading hierarchy

**Best Practices Issues:**
- Mixed content → Ensure all resources use HTTPS
- Console errors → Fix JavaScript errors
- Deprecated APIs → Update code

**SEO Issues:**
- Missing meta description → Add to all pages
- Non-crawlable links → Use proper <a> tags
- Missing structured data → Add JSON-LD schemas

---

## Task 9.2: Optimize Core Web Vitals

### What are Core Web Vitals?

Core Web Vitals are Google's metrics for measuring user experience:

1. **LCP (Largest Contentful Paint)** - Loading performance
2. **FID (First Input Delay)** - Interactivity
3. **CLS (Cumulative Layout Shift)** - Visual stability

### Target Metrics

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | 2.5s - 4.0s | > 4.0s |
| FID | ≤ 100ms | 100ms - 300ms | > 300ms |
| CLS | ≤ 0.1 | 0.1 - 0.25 | > 0.25 |

### How to Check Core Web Vitals

**Method 1: Google Search Console**
1. Go to Search Console
2. Click "Core Web Vitals" in left menu
3. View mobile and desktop reports
4. Identify pages with issues

**Method 2: PageSpeed Insights**
1. Go to https://pagespeed.web.dev
2. Enter your URL
3. View "Core Web Vitals Assessment"

**Method 3: Chrome DevTools**
1. Open DevTools
2. Go to "Performance" tab
3. Record page load
4. View Web Vitals in timeline

### Optimizing LCP (Largest Contentful Paint)

**Goal:** < 2.5 seconds

**Common Causes:**
- Slow server response time
- Render-blocking JavaScript and CSS
- Slow resource load times
- Client-side rendering

**Fixes:**

1. **Optimize Images**
```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/hero-image.png"
  alt="SocietyLedger Dashboard"
  width={1200}
  height={600}
  priority // Loads image immediately
  quality={85}
/>
```

2. **Preload Critical Resources**
```typescript
// In layout.tsx or page.tsx
export const metadata = {
  // ... other metadata
  other: {
    'link': [
      {
        rel: 'preload',
        href: '/fonts/inter.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
    ],
  },
};
```

3. **Optimize Server Response Time**
- Use CDN (Vercel Edge Network)
- Enable caching
- Optimize database queries
- Use static generation where possible

4. **Remove Render-Blocking Resources**
```typescript
// Defer non-critical CSS
<link rel="stylesheet" href="/styles.css" media="print" onload="this.media='all'" />

// Defer non-critical JavaScript
<script src="/analytics.js" defer></script>
```

### Optimizing FID (First Input Delay)

**Goal:** < 100 milliseconds

**Common Causes:**
- Heavy JavaScript execution
- Long tasks blocking main thread
- Large JavaScript bundles

**Fixes:**

1. **Code Splitting**
```typescript
// Use dynamic imports for heavy components
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
});
```

2. **Break Up Long Tasks**
```typescript
// Instead of:
function processLargeArray(items) {
  items.forEach(item => processItem(item));
}

// Use:
async function processLargeArray(items) {
  for (const item of items) {
    await processItem(item);
    // Allow browser to handle user input
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

3. **Use Web Workers for Heavy Computation**
```typescript
// worker.ts
self.addEventListener('message', (e) => {
  const result = heavyComputation(e.data);
  self.postMessage(result);
});

// main.ts
const worker = new Worker('/worker.js');
worker.postMessage(data);
worker.onmessage = (e) => {
  console.log('Result:', e.data);
};
```

4. **Minimize Third-Party Scripts**
- Load analytics asynchronously
- Defer non-critical scripts
- Use facade pattern for embeds

### Optimizing CLS (Cumulative Layout Shift)

**Goal:** < 0.1

**Common Causes:**
- Images without dimensions
- Ads, embeds, iframes without dimensions
- Dynamically injected content
- Web fonts causing FOIT/FOUT

**Fixes:**

1. **Always Set Image Dimensions**
```typescript
// Bad
<img src="/image.jpg" alt="..." />

// Good
<Image
  src="/image.jpg"
  alt="..."
  width={800}
  height={600}
/>
```

2. **Reserve Space for Dynamic Content**
```css
.ad-container {
  min-height: 250px; /* Reserve space */
}

.skeleton-loader {
  width: 100%;
  height: 200px;
  background: #f0f0f0;
}
```

3. **Optimize Font Loading**
```typescript
// In layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Prevents invisible text
  preload: true,
});
```

4. **Avoid Inserting Content Above Existing Content**
```typescript
// Bad: Inserting banner at top
<div id="banner">New content!</div>
<div id="main-content">...</div>

// Good: Append to bottom or use fixed positioning
<div id="main-content">...</div>
<div id="banner" style={{ position: 'fixed', top: 0 }}>New content!</div>
```

### Monitoring Core Web Vitals

**Real User Monitoring (RUM):**
```typescript
// Add to layout.tsx
'use client';

import { useEffect } from 'react';

export function WebVitals() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('web-vitals').then(({ getCLS, getFID, getLCP }) => {
        getCLS(console.log);
        getFID(console.log);
        getLCP(console.log);
      });
    }
  }, []);

  return null;
}
```

**Send to Analytics:**
```typescript
function sendToAnalytics(metric) {
  const body = JSON.stringify(metric);
  const url = '/api/analytics';

  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body);
  } else {
    fetch(url, { body, method: 'POST', keepalive: true });
  }
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getLCP(sendToAnalytics);
```

---

## Task 9.3: Test Social Sharing

### Why Test Social Sharing?

When users share your pages on social media, you want:
- Correct title and description
- Attractive preview image
- Proper branding
- No broken images or missing data

### Testing Tools

#### 1. Facebook Sharing Debugger
**URL:** https://developers.facebook.com/tools/debug/

**Steps:**
1. Enter your page URL
2. Click "Debug"
3. View preview
4. Check for errors
5. Click "Scrape Again" if you made changes

**What to Check:**
- Title displays correctly
- Description is compelling
- Image shows (1200x630px)
- No warnings or errors
- URL is correct

#### 2. Twitter Card Validator
**URL:** https://cards-dev.twitter.com/validator

**Steps:**
1. Enter your page URL
2. Click "Preview card"
3. View how it looks on Twitter
4. Check for errors

**What to Check:**
- Card type: summary_large_image
- Title displays correctly
- Description is compelling
- Image shows properly
- No errors

#### 3. LinkedIn Post Inspector
**URL:** https://www.linkedin.com/post-inspector/

**Steps:**
1. Enter your page URL
2. Click "Inspect"
3. View preview
4. Check for issues

**What to Check:**
- Title and description correct
- Image displays (1200x627px recommended)
- No errors

#### 4. Open Graph Checker
**URL:** https://www.opengraph.xyz/

**Steps:**
1. Enter your page URL
2. View how it appears on multiple platforms
3. Check all social networks at once

### Pages to Test

Test all public pages:
- [ ] Homepage
- [ ] Pricing
- [ ] Features
- [ ] Contact
- [ ] About
- [ ] FAQ
- [ ] Documentation
- [ ] Testimonials
- [ ] Blog listing
- [ ] Individual blog posts (when created)

### Common Issues & Fixes

**Issue: Image Not Showing**
- Check image URL is absolute (not relative)
- Verify image is accessible (not behind auth)
- Ensure image meets size requirements
- Check image format (JPG, PNG, WebP)

**Issue: Wrong Title/Description**
- Clear social media cache
- Use "Scrape Again" in Facebook Debugger
- Wait 24 hours for cache to clear
- Check metadata in page source

**Issue: Old Content Showing**
- Social platforms cache for 7-30 days
- Use debugger tools to force refresh
- Update og:updated_time meta tag

### Testing Checklist

For each page, verify:
- [ ] Title is compelling and accurate
- [ ] Description is engaging (< 160 chars)
- [ ] Image displays correctly
- [ ] Image is high quality
- [ ] URL is correct
- [ ] No errors in debuggers
- [ ] Looks good on all platforms

### Manual Testing

**Test Real Sharing:**
1. Share page on Facebook (use test account)
2. Share page on Twitter
3. Share page on LinkedIn
4. Check how it looks in feed
5. Click through to verify link works

---

## Task 9.4: Security Audit

### Why Security Matters for SEO

- Google penalizes insecure sites
- HTTPS is a ranking factor
- Security issues can cause de-indexing
- User trust affects engagement metrics

### Security Checklist

#### 1. HTTPS Verification

**Check:**
- [ ] Site loads with https://
- [ ] No mixed content warnings
- [ ] SSL certificate is valid
- [ ] Certificate not expired
- [ ] All resources load over HTTPS

**How to Check:**
1. Visit https://societyledger.com.ng
2. Click padlock icon in browser
3. Verify "Connection is secure"
4. Check certificate details

**Tools:**
- SSL Labs: https://www.ssllabs.com/ssltest/
- Why No Padlock: https://www.whynopadlock.com/

#### 2. Security Headers

**Required Headers:**

```nginx
# Content Security Policy
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';

# X-Frame-Options (prevent clickjacking)
X-Frame-Options: SAMEORIGIN

# X-Content-Type-Options (prevent MIME sniffing)
X-Content-Type-Options: nosniff

# Referrer Policy
Referrer-Policy: strict-origin-when-cross-origin

# Permissions Policy
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

**How to Add in Next.js:**

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ];
  },
};
```

**How to Check:**
1. Open DevTools → Network tab
2. Click on main document
3. View "Response Headers"
4. Verify security headers present

**Tools:**
- Security Headers: https://securityheaders.com/
- Mozilla Observatory: https://observatory.mozilla.org/

#### 3. Mixed Content Check

**What is Mixed Content?**
Loading HTTP resources on an HTTPS page.

**How to Check:**
1. Open page in Chrome
2. Open DevTools → Console
3. Look for mixed content warnings
4. Check Network tab for HTTP requests

**How to Fix:**
- Change all http:// to https://
- Use protocol-relative URLs: //example.com/image.jpg
- Use relative URLs: /images/logo.png

#### 4. XSS Protection

**What is XSS?**
Cross-Site Scripting attacks inject malicious scripts.

**Prevention:**
- Sanitize user input
- Use React (auto-escapes by default)
- Avoid dangerouslySetInnerHTML (or sanitize first)
- Use Content Security Policy

**Example:**
```typescript
// Bad
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// Good
import DOMPurify from 'isomorphic-dompurify';

<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(userInput) 
}} />
```

#### 5. Dependency Vulnerabilities

**Check for Vulnerabilities:**
```bash
# Run npm audit
npm audit

# Fix automatically
npm audit fix

# Fix with breaking changes
npm audit fix --force
```

**Tools:**
- npm audit (built-in)
- Snyk: https://snyk.io/
- Dependabot (GitHub)

#### 6. API Security

**Best Practices:**
- Use authentication for sensitive endpoints
- Rate limit API requests
- Validate all input
- Use CORS properly
- Don't expose sensitive data

**Example Rate Limiting:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimit = new Map();

export function middleware(request: NextRequest) {
  const ip = request.ip ?? 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const max = 100; // 100 requests per minute

  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
  } else {
    const data = rateLimit.get(ip);
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
    } else {
      data.count++;
      if (data.count > max) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
    }
  }

  return NextResponse.next();
}
```

### Security Testing Tools

**Automated Scanners:**
1. **OWASP ZAP** - https://www.zaproxy.org/
2. **Burp Suite** - https://portswigger.net/burp
3. **Acunetix** - https://www.acunetix.com/

**Online Tools:**
1. **Security Headers** - https://securityheaders.com/
2. **SSL Labs** - https://www.ssllabs.com/ssltest/
3. **Mozilla Observatory** - https://observatory.mozilla.org/
4. **Hardenize** - https://www.hardenize.com/

### Security Checklist

- [ ] HTTPS enabled and working
- [ ] Valid SSL certificate
- [ ] No mixed content warnings
- [ ] Security headers configured
- [ ] XSS protection enabled
- [ ] CSRF protection enabled
- [ ] No dependency vulnerabilities
- [ ] API endpoints secured
- [ ] Rate limiting implemented
- [ ] Input validation in place
- [ ] Error messages don't leak info
- [ ] Admin pages protected
- [ ] Database queries parameterized
- [ ] File uploads validated
- [ ] Passwords hashed (bcrypt/argon2)

---

## Task 9.5: Mobile Optimization

### Why Mobile Matters

- 60%+ of traffic is mobile
- Google uses mobile-first indexing
- Mobile speed affects rankings
- User experience impacts conversions

### Mobile Testing Tools

#### 1. Chrome DevTools Device Mode
1. Open DevTools (F12)
2. Click device icon (Ctrl+Shift+M)
3. Select device (iPhone, iPad, etc.)
4. Test responsiveness

#### 2. Google Mobile-Friendly Test
**URL:** https://search.google.com/test/mobile-friendly

1. Enter your URL
2. Click "Test URL"
3. View results
4. Fix any issues

#### 3. BrowserStack
**URL:** https://www.browserstack.com/

Test on real devices:
- iPhone 12, 13, 14
- Samsung Galaxy S21, S22
- iPad Pro
- Various Android devices

### Mobile Optimization Checklist

#### Responsive Design
- [ ] All pages responsive
- [ ] No horizontal scrolling
- [ ] Content fits screen width
- [ ] Images scale properly
- [ ] Tables responsive or scrollable
- [ ] Forms easy to fill

#### Touch Targets
- [ ] Buttons ≥ 48x48px
- [ ] Links ≥ 48x48px
- [ ] Adequate spacing between targets
- [ ] No accidental clicks

#### Typography
- [ ] Font size ≥ 16px (body text)
- [ ] Line height ≥ 1.5
- [ ] Readable without zooming
- [ ] Sufficient contrast

#### Performance
- [ ] Page loads < 3 seconds on 3G
- [ ] Images optimized for mobile
- [ ] Minimal JavaScript
- [ ] No render-blocking resources

#### Navigation
- [ ] Mobile menu works
- [ ] Easy to navigate
- [ ] Back button works
- [ ] Breadcrumbs visible

#### Forms
- [ ] Input fields large enough
- [ ] Proper input types (email, tel, etc.)
- [ ] Autocomplete enabled
- [ ] Error messages clear
- [ ] Submit button accessible

### Mobile-Specific Issues

**Issue: Text Too Small**
```css
/* Fix */
body {
  font-size: 16px;
  line-height: 1.5;
}
```

**Issue: Viewport Not Set**
```typescript
// In layout.tsx
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};
```

**Issue: Touch Targets Too Small**
```css
/* Fix */
button, a {
  min-width: 48px;
  min-height: 48px;
  padding: 12px 24px;
}
```

**Issue: Horizontal Scrolling**
```css
/* Fix */
* {
  max-width: 100%;
  box-sizing: border-box;
}

img {
  max-width: 100%;
  height: auto;
}
```

### Testing on Real Devices

**iOS Testing:**
1. Use Safari on iPhone/iPad
2. Test touch interactions
3. Check form inputs
4. Verify scrolling smooth

**Android Testing:**
1. Use Chrome on Android device
2. Test on different screen sizes
3. Check performance
4. Verify touch targets

---

## Performance Optimization Summary

### Quick Wins (Do First)

1. **Optimize Images**
   - Use Next.js Image component
   - Compress images
   - Use WebP format
   - Add width/height

2. **Enable Caching**
   - Set cache headers
   - Use CDN (Vercel)
   - Cache static assets

3. **Minimize JavaScript**
   - Code splitting
   - Dynamic imports
   - Remove unused code

4. **Fix Core Web Vitals**
   - Optimize LCP
   - Reduce FID
   - Eliminate CLS

5. **Add Security Headers**
   - X-Frame-Options
   - X-Content-Type-Options
   - CSP

### Long-Term Optimizations

1. **Advanced Caching**
   - Service workers
   - Offline support
   - Background sync

2. **Advanced Performance**
   - HTTP/2 Server Push
   - Resource hints
   - Prefetching

3. **Advanced Security**
   - Subresource Integrity
   - Certificate pinning
   - Advanced CSP

---

## Monitoring & Maintenance

### Weekly Tasks
- [ ] Check Core Web Vitals in Search Console
- [ ] Run Lighthouse on new pages
- [ ] Monitor error logs
- [ ] Check uptime

### Monthly Tasks
- [ ] Full Lighthouse audit of all pages
- [ ] Security scan
- [ ] Dependency updates
- [ ] Performance review

### Tools for Monitoring
- Google Search Console (Core Web Vitals)
- Google Analytics (page speed)
- Vercel Analytics (real user monitoring)
- Sentry (error tracking)

---

## Expected Results

### After Optimization

**Lighthouse Scores:**
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

**Core Web Vitals:**
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1

**User Experience:**
- Faster page loads
- Smoother interactions
- Better mobile experience
- Higher engagement

**SEO Benefits:**
- Better rankings
- More organic traffic
- Lower bounce rate
- Higher conversions

---

**Last Updated:** January 14, 2026  
**Status:** Ready for Implementation
