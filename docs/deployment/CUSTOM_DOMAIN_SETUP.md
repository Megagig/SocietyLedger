# Custom Domain Setup: societyledger.com.ng

## ✅ Step-by-Step Setup Checklist

### Step 1: Configure DNS at HostAfrica (15 minutes)

1. **Login to HostAfrica**
   - Go to: https://hostafrica.com
   - Login to your control panel
   - Navigate to: Domain Management → DNS Management

2. **Delete Existing Records**
   - Remove any existing A records for `@` or `www`
   - Remove any existing CNAME records
   - Keep only NS (nameserver) records

3. **Add These 3 DNS Records**

   | Type  | Name/Host | Value/Points To           | TTL  |
   |-------|-----------|---------------------------|------|
   | A     | @         | 75.2.60.5                 | 3600 |
   | A     | www       | 75.2.60.5                 | 3600 |
   | CNAME | *         | societyledger.netlify.app.| 3600 |

   **Critical Notes:**
   - `@` = root domain (societyledger.com.ng)
   - `*` = wildcard (all subdomains like opuogunstate.societyledger.com.ng)
   - The dot at the end of `societyledger.netlify.app.` is important!
   - If HostAfrica adds `.com.ng` automatically, just use `*` for the wildcard

4. **Save Changes**
   - Click Save/Update
   - DNS propagation takes 5-30 minutes

5. **Verify DNS (Optional)**
   - Use: https://dnschecker.org
   - Check: `societyledger.com.ng` → Should show `75.2.60.5`
   - Check: `test.societyledger.com.ng` → Should show Netlify

---

### Step 2: Add Domain to Netlify (10 minutes)

1. **Go to Netlify Dashboard**
   - Visit: https://app.netlify.com
   - Click on your site (societyledger-web or similar)

2. **Add Custom Domain**
   - Click "Domain settings" (left sidebar)
   - Scroll to "Custom domains"
   - Click "Add custom domain"
   - Enter: `societyledger.com.ng`
   - Click "Verify"
   - Click "Add domain"

3. **Set as Primary Domain**
   - In the domains list, find `societyledger.com.ng`
   - Click "Options" → "Set as primary domain"

4. **Add www Subdomain (Optional)**
   - Click "Add domain alias"
   - Enter: `www.societyledger.com.ng`
   - This will redirect www to main domain

5. **Wait for HTTPS**
   - Netlify will automatically provision SSL certificate
   - Status will change from "Awaiting certificate" to "HTTPS" (green)
   - This takes 10-30 minutes after DNS propagates
   - **Don't proceed until you see the green HTTPS badge!**

---

### Step 3: Update Netlify Environment Variables (5 minutes)

1. **In Netlify Dashboard**
   - Go to: Site settings → Environment variables
   - Click "Add a variable"

2. **Add These Variables:**

   ```
   Key: NEXT_PUBLIC_API_URL
   Value: https://societyledger.onrender.com
   
   Key: NEXT_PUBLIC_BASE_DOMAIN
   Value: societyledger.com.ng
   
   Key: NEXT_PUBLIC_APP_NAME
   Value: SocietyLedger
   ```

3. **Save and Redeploy**
   - Click "Save"
   - Go to "Deploys" tab
   - Click "Trigger deploy" → "Clear cache and deploy site"

---

### Step 4: Update Render Environment Variables (5 minutes)

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Click on your API service

2. **Update Environment Variables**
   - Go to "Environment" tab
   - Update these variables:

   ```
   FRONTEND_URL=https://societyledger.com.ng
   APP_URL=https://societyledger.com.ng
   NEXTAUTH_URL=https://societyledger.com.ng
   ```

3. **Save Changes**
   - Render will automatically redeploy

---

### Step 5: Push Code Changes (2 minutes)

The code has been updated. Just commit and push:

```bash
git add -A
git commit -m "Update domain to societyledger.com.ng"
git push
```

Both Netlify and Render will auto-deploy.

---

### Step 6: Test Everything (10 minutes)

Wait 30 minutes after DNS changes, then test:

#### Test 1: Main Domain
```
Visit: https://societyledger.com.ng
Expected: Your app homepage loads
```

#### Test 2: Create Association
```
1. Go to: https://societyledger.com.ng/signup
2. Create association: "Test Association"
3. Subdomain: "testassoc"
4. Complete signup
Expected: Shows URL as testassoc.societyledger.com.ng
```

#### Test 3: Subdomain Access
```
Visit: https://testassoc.societyledger.com.ng/auth/login
Expected: Login page loads with "Test Association" branding
```

#### Test 4: API Connection
```
1. Try to login at: https://testassoc.societyledger.com.ng/auth/login
2. Use the credentials you created
Expected: Successfully logs in and redirects to dashboard
```

---

## 🔍 Troubleshooting

### Issue: DNS not propagating
**Solution:** 
- Wait 30 minutes
- Clear browser cache (Ctrl+Shift+Delete)
- Try incognito mode
- Check: https://dnschecker.org

### Issue: HTTPS not working
**Solution:**
- Wait for Netlify to provision certificate (can take 30 min)
- Make sure DNS is fully propagated first
- Check Netlify domain settings for errors

### Issue: Subdomain shows "Site not found"
**Solution:**
- Verify wildcard CNAME (`*`) is set correctly
- Check if HostAfrica requires special syntax for wildcards
- Contact HostAfrica support if needed

### Issue: API calls failing
**Solution:**
- Check browser console for CORS errors
- Verify Render environment variables are updated
- Check API is running: https://societyledger.onrender.com/health

### Issue: Still redirecting to localhost
**Solution:**
- Clear browser cache
- Check Netlify environment variables are set
- Verify latest code is deployed
- Try incognito mode

---

## 📋 Quick Reference

### Your URLs After Setup:
- **Main site**: https://societyledger.com.ng
- **API**: https://societyledger.onrender.com
- **Example association**: https://opuogunstate.societyledger.com.ng
- **Admin panel**: https://societyledger.com.ng/admin

### DNS Records Summary:
```
@   → 75.2.60.5 (Netlify)
www → 75.2.60.5 (Netlify)
*   → societyledger.netlify.app. (Wildcard for subdomains)
```

### Environment Variables:
**Netlify:**
- NEXT_PUBLIC_API_URL=https://societyledger.onrender.com
- NEXT_PUBLIC_BASE_DOMAIN=societyledger.com.ng

**Render:**
- FRONTEND_URL=https://societyledger.com.ng
- APP_URL=https://societyledger.com.ng

---

## ⏱️ Timeline

- DNS propagation: 5-30 minutes
- SSL certificate: 10-30 minutes after DNS
- Total setup time: ~1 hour

---

## 🎉 Success Criteria

You'll know it's working when:
- ✅ https://societyledger.com.ng loads your app
- ✅ Creating an association shows correct domain
- ✅ https://testassoc.societyledger.com.ng works
- ✅ Login works on subdomain
- ✅ Green HTTPS padlock in browser

---

## 📞 Support

If you get stuck:
1. Check HostAfrica DNS documentation
2. Check Netlify domain setup guide
3. Verify all environment variables are set
4. Wait full 30 minutes for DNS propagation
5. Contact HostAfrica support for DNS issues
