# Google Analytics 4 Setup Guide for SocietyLedger

This guide will help you set up Google Analytics 4 (GA4) to track visitors and user behavior on SocietyLedger.

## Step 1: Create Google Analytics Account

1. Go to [Google Analytics](https://analytics.google.com/)
2. Sign in with your Google account
3. Click **"Start measuring"** or **"Admin"** (gear icon)
4. Click **"Create Account"**
5. Enter account details:
   - **Account name:** SocietyLedger
   - Check data sharing settings as needed
6. Click **"Next"**

## Step 2: Create GA4 Property

1. **Property name:** SocietyLedger Production
2. **Reporting time zone:** (GMT+01:00) West Central Africa
3. **Currency:** Nigerian Naira (NGN)
4. Click **"Next"**

## Step 3: Configure Business Information

1. **Industry category:** Technology / Software
2. **Business size:** Select your size
3. **How you plan to use Google Analytics:** Check relevant options
4. Click **"Create"**
5. Accept Terms of Service

## Step 4: Set Up Data Stream

1. Select **"Web"** platform
2. Enter website details:
   - **Website URL:** https://societyledger.com.ng
   - **Stream name:** SocietyLedger Website
3. Click **"Create stream"**

## Step 5: Get Your Measurement ID

After creating the stream, you'll see:
- **Measurement ID:** G-XXXXXXXXXX (copy this!)
- **Stream details**

**Save this Measurement ID - you'll need it for installation.**

## Step 6: Install Google Analytics in Next.js

### Option 1: Using @next/third-parties (Recommended)

1. Install the package:
```bash
npm install @next/third-parties
```

2. Add to your root layout (`apps/web/src/app/layout.tsx`):

```typescript
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GoogleAnalytics gaId="G-XXXXXXXXXX" />
      </body>
    </html>
  );
}
```

### Option 2: Manual Installation

Add to `apps/web/src/app/layout.tsx` in the `<head>` section:

```typescript
<script
  async
  src={`https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX`}
/>
<script
  dangerouslySetInnerHTML={{
    __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-XXXXXXXXXX');
    `,
  }}
/>
```

## Step 7: Configure Environment Variables

1. Create/update `.env.local`:
```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

2. Update your code to use the environment variable:
```typescript
<GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!} />
```

## Step 8: Set Up Custom Events (Optional)

Track important user actions:

```typescript
// Track sign up button clicks
const handleSignUp = () => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'sign_up_click', {
      event_category: 'engagement',
      event_label: 'Sign Up Button',
    });
  }
  // Your sign up logic
};

// Track contact form submissions
const handleContactSubmit = () => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'contact_form_submit', {
      event_category: 'engagement',
      event_label: 'Contact Form',
    });
  }
  // Your form logic
};
```

## Step 9: Configure Enhanced Measurement

In GA4 Admin:
1. Go to **Data Streams** → Your stream
2. Click **"Enhanced measurement"**
3. Enable:
   - ✅ Page views (automatic)
   - ✅ Scrolls
   - ✅ Outbound clicks
   - ✅ Site search
   - ✅ Video engagement
   - ✅ File downloads

## Step 10: Set Up Conversions

Define key conversions:
1. Go to **Admin** → **Events**
2. Mark these as conversions:
   - `sign_up` - User registration
   - `purchase` - Subscription purchase
   - `contact_form_submit` - Contact form
   - `trial_start` - Free trial start

## Step 11: Create Custom Reports

Set up reports for:
1. **User Acquisition:** Where users come from
2. **Engagement:** How users interact with your site
3. **Conversions:** Track sign-ups and purchases
4. **Pages:** Most visited pages

## Step 12: Verify Installation

1. Visit your website
2. In GA4, go to **Reports** → **Realtime**
3. You should see your visit in real-time
4. Check that page views are being tracked

## Important Metrics to Monitor

### Traffic Metrics
- **Users:** Total unique visitors
- **Sessions:** Total visits
- **Page views:** Total pages viewed
- **Bounce rate:** Single-page sessions
- **Average session duration:** Time on site

### Engagement Metrics
- **Pages per session:** Pages viewed per visit
- **Event count:** Custom events triggered
- **Conversion rate:** Sign-ups / visitors

### Acquisition Metrics
- **Traffic sources:** Organic, direct, referral, social
- **Top landing pages:** Entry points
- **Top exit pages:** Where users leave

## Privacy & Compliance

### GDPR Compliance
1. Update Privacy Policy to mention Google Analytics
2. Implement cookie consent banner (if required)
3. Provide opt-out option

### Cookie Consent Implementation
```typescript
// Example: Only load GA after consent
const [cookieConsent, setCookieConsent] = useState(false);

useEffect(() => {
  const consent = localStorage.getItem('cookie_consent');
  if (consent === 'accepted') {
    setCookieConsent(true);
  }
}, []);

// Only render GA if consent given
{cookieConsent && <GoogleAnalytics gaId="G-XXXXXXXXXX" />}
```

## Troubleshooting

### Not Seeing Data?
- Wait 24-48 hours for data to populate
- Check Realtime reports for immediate data
- Verify Measurement ID is correct
- Check browser console for errors
- Disable ad blockers when testing

### Events Not Tracking?
- Verify gtag is loaded: `console.log(window.gtag)`
- Check Network tab for gtag requests
- Ensure events are properly formatted

## Next Steps

1. ✅ Install Google Analytics
2. ✅ Verify data is being collected
3. ✅ Set up custom events
4. ✅ Create custom reports
5. ✅ Link to Google Search Console (see next guide)

## Resources

- [GA4 Documentation](https://support.google.com/analytics/answer/10089681)
- [Next.js Analytics](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)
- [@next/third-parties](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries)

---

**Last Updated:** January 14, 2026
