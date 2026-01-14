# Google Search Console Setup Guide

Complete guide to verify your site and submit sitemap to Google Search Console.

## Step 1: Access Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Sign in with your Google account
3. Click **"Add Property"**

## Step 2: Choose Property Type

Select **"URL prefix"** (recommended):
- Enter: `https://societyledger.com.ng`
- Click **"Continue"**

## Step 3: Verify Ownership

Choose one of these verification methods:

### Method 1: HTML Meta Tag (Easiest for Next.js)

1. Copy the meta tag provided
2. Add to `apps/web/src/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  // ... existing metadata
  verification: {
    google: 'YOUR_VERIFICATION_CODE_HERE',
  },
};
```

3. Deploy your changes
4. Click **"Verify"** in Search Console

### Method 2: DNS Verification

1. Copy the TXT record provided
2. Add to your domain DNS settings:
   - Type: TXT
   - Name: @
   - Value: google-site-verification=XXXXX
3. Wait for DNS propagation (up to 48 hours)
4. Click **"Verify"**

### Method 3: HTML File Upload

1. Download the verification file
2. Place in `apps/web/public/` folder
3. Deploy your changes
4. Click **"Verify"**

## Step 4: Submit Sitemap

After verification:

1. Go to **Sitemaps** in left sidebar
2. Enter sitemap URL: `sitemap.xml`
3. Click **"Submit"**

Your sitemap URL will be:
```
https://societyledger.com.ng/sitemap.xml
```

## Step 5: Request Indexing for Key Pages

1. Go to **URL Inspection** tool
2. Enter each important URL:
   - `https://societyledger.com.ng`
   - `https://societyledger.com.ng/pricing`
   - `https://societyledger.com.ng/features`
   - `https://societyledger.com.ng/contact`
   - `https://societyledger.com.ng/about`
3. Click **"Request Indexing"** for each

## Step 6: Configure Settings

### Set Preferred Domain
1. Go to **Settings** → **Property settings**
2. Verify domain is correct

### Set Target Country
1. Go to **Settings** → **Property settings**
2. Set **Target country:** Nigeria

### Link Google Analytics
1. Go to **Settings** → **Associations**
2. Click **"Associate"**
3. Select your GA4 property
4. Click **"Associate"**

## Step 7: Monitor Performance

### Coverage Report
- Check **Index** → **Coverage**
- Monitor indexed pages
- Fix any errors

### Performance Report
- Check **Performance** → **Search results**
- Monitor:
  - Total clicks
  - Total impressions
  - Average CTR
  - Average position

### Mobile Usability
- Check **Experience** → **Mobile Usability**
- Fix any mobile issues

## Important Reports to Monitor

### 1. Performance Report
Track:
- **Queries:** What people search for
- **Pages:** Which pages get traffic
- **Countries:** Where traffic comes from
- **Devices:** Desktop vs mobile

### 2. Coverage Report
Monitor:
- **Valid pages:** Successfully indexed
- **Errors:** Pages with issues
- **Warnings:** Potential problems
- **Excluded:** Pages not indexed

### 3. Core Web Vitals
Check:
- **LCP:** Largest Contentful Paint
- **FID:** First Input Delay
- **CLS:** Cumulative Layout Shift

### 4. Sitemaps Report
Verify:
- Sitemap discovered
- Pages submitted vs indexed
- Any errors

## Common Issues & Solutions

### Sitemap Not Found
- Verify sitemap is accessible: `https://societyledger.com.ng/sitemap.xml`
- Check robots.txt references sitemap
- Wait 24-48 hours after submission

### Pages Not Indexed
- Check robots.txt isn't blocking
- Verify no `noindex` meta tags
- Request indexing manually
- Wait 1-2 weeks for crawling

### Coverage Errors
- **404 errors:** Fix broken links
- **Redirect errors:** Check redirect chains
- **Server errors:** Fix 500 errors
- **Soft 404:** Add more content

## Set Up Email Alerts

1. Go to **Settings** → **Users and permissions**
2. Add your email
3. Enable notifications for:
   - Critical issues
   - New issues detected
   - Manual actions

## Best Practices

### Regular Monitoring
- Check weekly for first month
- Then monthly ongoing
- Review after major updates

### Fix Issues Promptly
- Address errors within 7 days
- Monitor impact of fixes
- Document changes

### Track Rankings
- Monitor keyword positions
- Track click-through rates
- Optimize low-performing pages

## Verification Checklist

- [ ] Property added and verified
- [ ] Sitemap submitted
- [ ] Key pages requested for indexing
- [ ] Google Analytics linked
- [ ] Email alerts configured
- [ ] Mobile usability checked
- [ ] No critical errors
- [ ] Performance data showing

## Next Steps

1. ✅ Verify ownership
2. ✅ Submit sitemap
3. ✅ Request indexing for main pages
4. ✅ Link Google Analytics
5. ✅ Set up email alerts
6. ⏳ Wait 1-2 weeks for data
7. ⏳ Monitor and optimize

## Resources

- [Search Console Help](https://support.google.com/webmasters)
- [SEO Starter Guide](https://developers.google.com/search/docs/beginner/seo-starter-guide)
- [Indexing API](https://developers.google.com/search/apis/indexing-api/v3/quickstart)

---

**Last Updated:** January 14, 2026
