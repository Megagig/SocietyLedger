# Bing Webmaster Tools Setup Guide

Complete guide to set up Bing Webmaster Tools for SocietyLedger.

## Why Bing Webmaster Tools?

- Bing powers ~3% of searches in Nigeria
- Easy to set up (can import from Google)
- Additional SEO insights
- Free tool with valuable data

## Step 1: Access Bing Webmaster Tools

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Sign in with Microsoft account (or create one)
3. Click **"Add a site"**

## Step 2: Add Your Site

### Option 1: Import from Google Search Console (Easiest)

1. Click **"Import from Google Search Console"**
2. Sign in to your Google account
3. Select **societyledger.com.ng**
4. Click **"Import"**
5. Done! Bing will automatically verify and import settings

### Option 2: Manual Setup

1. Enter site URL: `https://societyledger.com.ng`
2. Click **"Add"**

## Step 3: Verify Ownership (If Manual Setup)

Choose one verification method:

### Method 1: XML File (Recommended)

1. Download the BingSiteAuth.xml file
2. Place in `apps/web/public/` folder
3. Verify accessible at: `https://societyledger.com.ng/BingSiteAuth.xml`
4. Click **"Verify"** in Bing Webmaster

### Method 2: Meta Tag

1. Copy the meta tag provided
2. Add to `apps/web/src/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  // ... existing metadata
  verification: {
    google: 'YOUR_GOOGLE_CODE',
    other: {
      'msvalidate.01': 'YOUR_BING_CODE',
    },
  },
};
```

3. Deploy changes
4. Click **"Verify"**

### Method 3: DNS CNAME

1. Add CNAME record to DNS:
   - Host: @
   - Points to: verify.bing.com
2. Wait for DNS propagation
3. Click **"Verify"**

## Step 4: Submit Sitemap

1. Go to **Sitemaps** section
2. Enter: `https://societyledger.com.ng/sitemap.xml`
3. Click **"Submit"**

## Step 5: Configure Settings

### Site Settings
1. Go to **Configure My Site** → **Site Settings**
2. Set:
   - **Country/Region:** Nigeria
   - **Language:** English
   - **Time Zone:** (GMT+01:00) West Central Africa

### Crawl Control
1. Go to **Configure My Site** → **Crawl Control**
2. Set crawl rate (default is fine)
3. Set crawl time preferences if needed

## Step 6: Submit URLs for Indexing

1. Go to **URL Submission**
2. Submit key pages:
```
https://societyledger.com.ng
https://societyledger.com.ng/pricing
https://societyledger.com.ng/features
https://societyledger.com.ng/contact
https://societyledger.com.ng/about
```

## Key Reports to Monitor

### 1. Site Explorer
- **Pages Indexed:** Total pages in Bing index
- **Crawl Errors:** Issues found during crawling
- **Crawl Stats:** Crawl frequency and volume

### 2. Search Performance
- **Impressions:** How often your site appears
- **Clicks:** Actual visits from Bing
- **CTR:** Click-through rate
- **Average Position:** Ranking position

### 3. SEO Reports
- **SEO Analyzer:** Site health score
- **Keyword Research:** Keyword suggestions
- **SEO Recommendations:** Improvement tips

### 4. Backlinks
- **Inbound Links:** Sites linking to you
- **Link Quality:** Authority of linking sites
- **Anchor Text:** Text used in links

## Bing SEO Analyzer

Run the SEO Analyzer:
1. Go to **Diagnostics & Tools** → **SEO Analyzer**
2. Enter your homepage URL
3. Review recommendations:
   - **Errors:** Critical issues (fix immediately)
   - **Warnings:** Important issues (fix soon)
   - **Notices:** Minor improvements

## Set Up Notifications

1. Go to **Settings** → **Notifications**
2. Enable email alerts for:
   - Crawl errors
   - Malware detection
   - Manual actions
   - Important updates

## Bing vs Google: Key Differences

### Bing Prefers:
- Exact match domains
- Social signals (Facebook, Twitter)
- Multimedia content (images, videos)
- Older, established domains
- Flash content (still supported)

### Optimization Tips for Bing:
- Use exact keywords in titles
- Optimize meta descriptions
- Include multimedia
- Build social media presence
- Get quality backlinks

## Common Issues & Solutions

### Site Not Verified
- Check verification file is accessible
- Verify meta tag is in <head>
- Wait 24 hours and try again

### Sitemap Not Processed
- Verify sitemap URL is correct
- Check sitemap is valid XML
- Ensure robots.txt allows Bingbot
- Wait 48 hours for processing

### Low Indexing
- Submit URLs manually
- Check for crawl errors
- Verify robots.txt isn't blocking
- Improve site speed

## Best Practices

### Regular Monitoring
- Check weekly for first month
- Monthly thereafter
- After major site updates

### Fix Issues Promptly
- Address errors within 7 days
- Monitor crawl stats
- Track indexing progress

### Optimize for Bing
- Use Bing Keyword Research tool
- Follow SEO recommendations
- Build quality backlinks
- Engage on social media

## Verification Checklist

- [ ] Site added and verified
- [ ] Sitemap submitted
- [ ] Key pages submitted for indexing
- [ ] Site settings configured
- [ ] Email notifications enabled
- [ ] SEO Analyzer run
- [ ] No critical errors
- [ ] Backlinks monitored

## Additional Tools

### Bing Places for Business
- List your business on Bing Maps
- Improve local SEO
- Free business listing

### Bing URL Submission API
- Programmatically submit URLs
- Faster indexing
- Up to 10,000 URLs/day

## Resources

- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmasters-guidelines-30fba23a)
- [Bing SEO Guide](https://www.bing.com/webmasters/help/bing-seo-guide-24fb3c5f)
- [Bing Webmaster Blog](https://blogs.bing.com/webmaster/)

## Next Steps

1. ✅ Add and verify site
2. ✅ Submit sitemap
3. ✅ Submit key URLs
4. ✅ Configure settings
5. ✅ Run SEO Analyzer
6. ✅ Set up notifications
7. ⏳ Wait 1-2 weeks for data
8. ⏳ Monitor and optimize

---

**Last Updated:** January 14, 2026
