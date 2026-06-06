# Map Image & OAuth Fix Guide

## 1. Unit Map Image (BROKEN - imgur link is dead)

The original map image `https://i.imgur.com/YQZoRTJ.png` no longer exists.

**Fix:** Replace the map image URL in `public/index.html` line with `id="map-img"`.

Options:
- Upload your ERLC map image to a permanent host (e.g. Discord CDN, Cloudinary, your own server)
- Replace the `src` attribute with your new URL

```html
<img id="map-img" src="YOUR_MAP_IMAGE_URL_HERE" alt="ERLC Map">
```

---

## 2. Invalid OAuth2 redirect_uri (login error)

This error means the redirect URI registered in your Discord Developer Portal
does not match what the app is sending.

**Steps to fix:**
1. Go to https://discord.com/developers/applications
2. Select your application (Client ID: 1503905550931333352)
3. Go to OAuth2 → General
4. Under "Redirects", make sure this exact URL is listed:
   ```
   https://YOUR_ACTUAL_DOMAIN/auth/callback
   ```
5. In your `.env` file, set `BASE_URL` to match:
   ```
   BASE_URL=https://YOUR_ACTUAL_DOMAIN
   ```

If you're running on Render, your domain looks like:
`https://your-service-name.onrender.com`

The redirect URI must match **exactly** — no trailing slash, correct https/http.
