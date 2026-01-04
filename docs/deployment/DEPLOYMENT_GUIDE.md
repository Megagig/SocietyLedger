# SocietyLedger Deployment Guide

## 🚨 Critical: Multi-Tenant Subdomain Setup

### The Problem

Your application uses **subdomain-based multi-tenancy**:
- Each association gets its own subdomain (e.g., `opuogunstate.yourdomain.com`)
- Netlify's free `.netlify.app` domains **DO NOT support wildcard subdomains**
- This means `opuogunstate.societyledger.netlify.app` will never work

### ✅ Solution: Use a Custom Domain

You **MUST** use your own domain for multi-tenant subdomains to work.

## Step-by-Step Setup

### 1. Purchase a Domain

Buy a domain from:
- Namecheap
- GoDaddy
- Cloudflare
- Google Domains

Example: `societyledger.com`

### 2. Configure DNS (Wildcard Subdomain)

In your domain registrar's DNS settings, add these records:

```
Type    Name    Value                           TTL
A       @       75.2.60.5                       3600
CNAME   *       societyledger.netlify.app.      3600
```

**Important**: The `*` (wildcard) CNAME is crucial for subdomains to work.

### 3. Add Domain to Netlify

1. Go to Netlify Dashboard → Your Site → Domain Settings
2. Click "Add custom domain"
3. Enter: `societyledger.com`
4. Netlify will verify DNS
5. Enable HTTPS (automatic with Let's Encrypt)

### 4. Update Environment Variables

#### Netlify (Production):
```bash
NEXT_PUBLIC_API_URL=https://societyledger.onrender.com
NEXT_PUBLIC_BASE_DOMAIN=societyledger.com
NEXT_PUBLIC_APP_NAME=SocietyLedger
```

#### Render (API):
```bash
FRONTEND_URL=https://societyledger.com
APP_URL=https://societyledger.com
NEXTAUTH_URL=https://societyledger.com
```

### 5. Update Local Development

`apps/web/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_BASE_DOMAIN=localhost:3000
NEXT_PUBLIC_APP_NAME=SocietyLedger
```

### 6. Redeploy Both Apps

1. Push changes to GitHub
2. Netlify will auto-deploy
3. Render will auto-deploy

## How It Works After Setup

### Association Signup:
- User creates "Ogun State Association"
- Subdomain: `ogunstate`
- Full URL: `https://ogunstate.societyledger.com`

### Login:
- User visits: `https://ogunstate.societyledger.com/auth/login`
- DNS resolves via wildcard CNAME
- Netlify serves the app
- App detects subdomain and loads tenant context

## Testing

### Test Wildcard DNS:
```bash
# Should resolve to your Netlify IP
nslookup test123.societyledger.com
nslookup anything.societyledger.com
```

### Test in Browser:
1. Create association: `testassoc`
2. Visit: `https://testassoc.societyledger.com`
3. Should load your app with tenant context

## Alternative: Path-Based Multi-Tenancy

If you can't use a custom domain, you'd need to refactor to:
- `societyledger.netlify.app/ogunstate/dashboard`
- `societyledger.netlify.app/testassoc/auth/login`

This requires significant code changes to the tenant detection logic.

## Current Status

- ✅ API deployed on Render
- ✅ Frontend deployed on Netlify
- ❌ Wildcard subdomains not working (need custom domain)
- ⚠️ Localhost accounts in database won't work in production

## Migration Plan for Existing Accounts

If you have accounts with `localhost` subdomains in the database:

```sql
-- Update subdomain for existing associations
UPDATE associations 
SET subdomain = REPLACE(subdomain, '.localhost', '')
WHERE subdomain LIKE '%.localhost';
```

## Cost Estimate

- Domain: $10-15/year
- Netlify: Free (or $19/month for Pro)
- Render: Free (or $7/month for Starter)

**Total**: ~$15/year minimum

## Support

If you need help:
1. Check DNS propagation: https://dnschecker.org
2. Verify Netlify domain settings
3. Check browser console for errors
4. Review Netlify deploy logs
