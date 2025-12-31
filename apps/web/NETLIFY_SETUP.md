# Quick Netlify Setup Checklist

## ⚠️ IMPORTANT: Wildcard Subdomains Require Custom Domain

Netlify's `.netlify.app` domains **DO NOT** support wildcard subdomains like:
- ❌ `opuogunstate.societyledger.netlify.app` 
- ❌ `testassoc.societyledger.netlify.app`

You **MUST** use your own domain (e.g., `societyledger.com`) for multi-tenant subdomains to work.

## Option 1: Use Custom Domain (Recommended)

### 1. Buy a Domain
- Go to Namecheap, GoDaddy, or Cloudflare
- Purchase: `societyledger.com` (or any domain you prefer)

### 2. Configure DNS
Add these DNS records:

```
Type    Name    Value                           
A       @       75.2.60.5                       
CNAME   *       societyledger.netlify.app.      
```

The `*` wildcard is crucial!

### 3. Add to Netlify
1. Netlify Dashboard → Domain Settings
2. Add custom domain: `societyledger.com`
3. Wait for DNS propagation (5-30 minutes)
4. Enable HTTPS

### 4. Set Environment Variable
```
NEXT_PUBLIC_BASE_DOMAIN=societyledger.com
```

### 5. Redeploy

## Option 2: Test Without Custom Domain (Temporary)

For testing purposes only, you can:

1. **Test on main domain**: `https://societyledger.netlify.app`
2. **Use localhost for development**: `http://testassoc.localhost:3000`
3. **Accept that subdomains won't work** until you add a custom domain

## Current Environment Variables Needed

```bash
NEXT_PUBLIC_API_URL=https://societyledger.onrender.com
NEXT_PUBLIC_BASE_DOMAIN=societyledger.com  # Change this!
NEXT_PUBLIC_APP_NAME=SocietyLedger
```

## Why This Happens

Multi-tenant apps need wildcard DNS:
- `*.societyledger.com` → All subdomains point to your app
- Netlify only provides this for custom domains
- `.netlify.app` domains don't support wildcards

## Cost

- Domain: ~$12/year
- Everything else: Free tier is fine

## Questions?

1. Do you already own a domain?
2. Do you want to purchase one?
3. Do you want to refactor to path-based routing instead?
