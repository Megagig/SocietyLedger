# Migrate from Netlify to Vercel (Wildcard Subdomain Support)

## Why Migrate?

- ✅ Vercel Free tier supports wildcard domains (`*.societyledger.com.ng`)
- ✅ Better Next.js integration (Vercel created Next.js)
- ✅ Free SSL for wildcard subdomains
- ✅ No need for Cloudflare proxy workarounds

## Step-by-Step Migration (15 minutes)

### Step 1: Deploy to Vercel (5 minutes)

1. **Go to Vercel**: https://vercel.com
2. **Sign up/Login** (use GitHub account for easy integration)
3. **Click "Add New Project"**
4. **Import your GitHub repository**:
   - If not connected, authorize Vercel to access your GitHub
   - Select your `SocietyLedger` repository
5. **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web` (IMPORTANT!)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

6. **Add Environment Variables**:
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_API_URL=https://societyledger.onrender.com
   NEXT_PUBLIC_BASE_DOMAIN=societyledger.com.ng
   NEXT_PUBLIC_APP_NAME=SocietyLedger
   ```

7. **Click "Deploy"**
8. Wait 2-3 minutes for deployment

### Step 2: Add Custom Domain to Vercel (5 minutes)

After deployment succeeds:

1. **Go to Project Settings** → **Domains**
2. **Add Domain**: `societyledger.com.ng`
3. Vercel will verify DNS (already configured in Cloudflare)
4. **Add Wildcard Domain**: `*.societyledger.com.ng`
5. Vercel will automatically provision SSL for both

### Step 3: Update Cloudflare DNS (2 minutes)

1. **Go to Cloudflare** → DNS for `societyledger.com.ng`
2. **Update these records**:

   **Change the A records to point to Vercel:**
   ```
   Type: A | Name: @ | Content: 76.76.21.21 | Proxy: DNS only (gray)
   Type: A | Name: www | Content: 76.76.21.21 | Proxy: DNS only (gray)
   ```

   **Update the wildcard CNAME:**
   ```
   Type: CNAME | Name: * | Content: cname.vercel-dns.com | Proxy: DNS only (gray)
   ```

   **Note**: Vercel will give you the exact DNS records in the domain settings. Use those instead if different.

3. **Save changes**

### Step 4: Wait for DNS Propagation (5-15 minutes)

- DNS changes take 5-15 minutes
- Vercel will show "Valid Configuration" when ready
- SSL certificates will be auto-provisioned

### Step 5: Test Everything (5 minutes)

1. **Test main domain**: https://societyledger.com.ng
2. **Test subdomain**: https://opuogunstate.societyledger.com.ng
3. **Test login** on subdomain
4. **Test signup** and create new association

### Step 6: Remove Netlify Site (Optional)

Once everything works on Vercel:
1. Go to Netlify dashboard
2. Delete the old site
3. This frees up your Netlify account

---

## Vercel DNS Records (You'll Get These from Vercel)

Vercel will provide exact DNS records. They typically look like:

```
Type: A     | Name: @   | Value: 76.76.21.21
Type: CNAME | Name: www | Value: cname.vercel-dns.com
Type: CNAME | Name: *   | Value: cname.vercel-dns.com
```

**IMPORTANT**: Use the exact values Vercel provides in your domain settings!

---

## Troubleshooting

### Issue: "Invalid Configuration" in Vercel
**Solution**: Wait 15 minutes for DNS to propagate, then click "Refresh" in Vercel

### Issue: Subdomain still shows 404
**Solution**: 
- Verify wildcard domain `*.societyledger.com.ng` is added in Vercel
- Check Cloudflare DNS has wildcard CNAME pointing to Vercel

### Issue: Build fails on Vercel
**Solution**: 
- Check Root Directory is set to `apps/web`
- Verify environment variables are set
- Check build logs for specific errors

---

## Why Vercel is Better for This Use Case

| Feature | Netlify Free | Vercel Free |
|---------|--------------|-------------|
| Wildcard SSL | ❌ No | ✅ Yes |
| Wildcard Domains | ❌ No | ✅ Yes |
| Next.js Optimization | ✅ Good | ✅ Excellent |
| Build Time | ✅ Fast | ✅ Very Fast |
| Edge Functions | ✅ Yes | ✅ Yes |

---

## Timeline

- Deploy to Vercel: 3 minutes
- Add domains: 2 minutes
- Update DNS: 2 minutes
- DNS propagation: 5-15 minutes
- **Total: ~20 minutes**

---

## Next Steps

1. Go to https://vercel.com and start Step 1
2. Follow the steps above
3. Test thoroughly
4. Report any issues

Good luck! 🚀
