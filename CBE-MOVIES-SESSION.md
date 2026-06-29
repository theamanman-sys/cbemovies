# CBE Movies — Session Notes

## Project Overview

**CBE Movies** — A streaming and film culture website from Commercial Bank of Ethiopia with TMDB/VidAPI movie/TV playback and a dedicated YouTube channel section.

- Dark theme, glass-morphism UI, vanilla JS/CSS/HTML, SPA-style
- Based in Ethiopia — mix of English and Amharic content
- Focus on African cinema and film discourse

---

## YouTube Channel

- **Handle**: `@CommercialBankofEthiopia`
- **Channel URL**: `https://www.youtube.com/@CommercialBankofEthiopia`
- **Channel ID**: `UCe-dwO_r_EppHk13L_CZX_w`
- **Uploads Playlist ID**: `UUe-dwO_r_EppHk13L_CZX_w`
- **16 videos** — podcast episodes, film discussions, shorts, trailers

### Extracted Media URLs

**Channel Banner (hero background)**:
```
https://yt3.googleusercontent.com/cHmJhPCn_XkezOH__q10Z9OU6TirEBM0nWumAhXIQuYVLhWZqSPQq-EDWsJdayINPlJVw7mS4OY=w2560-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj
```

**Channel Avatar**:
```
https://yt3.googleusercontent.com/ee_P4B8Suz5o19hawcGI5mWwTiAciB_oOoAiaJ4vyuNkMG2gY1orXDrMOLnwfG12V0y4aKwXiw=s160-c-k-c0x00ffffff-no-rj
```

---

## File Structure

```
/
├── index.html          # Main SPA — hero, carousels, search, modals, player
├── youtube.html        # Dedicated YouTube channel page
├── img/
│   ├── logo.svg        # CBE Movies branding logo
│   └── logo.png        # Legacy logo (to be removed)
├── css/
│   └── style.css       # All styles (shared)
├── js/
│   ├── app.js          # Core logic — state, rendering, API calls, YouTube
│   ├── youtube.js      # YouTube page logic — grid, filters, modals
│   ├── api.js          # TMDB & VidAPI integration
│   └── i18n.js         # Internationalization (EN/AM)
```

---

## Key Features Implemented

- Hero carousel with timer/dots/parallax
- Movie/TV carousels (trending, now playing, latest, popular)
- Search overlay with TMDB movie/TV search
- Detail modal with cast, facts, trailer, TV season/episode selector
- Player page with TV season/episode sidebar controls
- YouTube section on index.html (4 video cards)
- Dedicated youtube.html page with channel banner hero, filterable video grid, detail modal, embedded player
- Race condition fix for TV episode loading (per-request ID counter)
- Modal scroll fix, episode detail enrichment, TV selector timing fix

---

## CBE SuperApp Integration

### SDK Wrapper (`js/cbe-superapp.js`)
Detects `window.cbesuperapp` and provides methods:
- `CbeSuperApp.fetchAccessToken(appCode)` — Login via SuperApp
- `CbeSuperApp.initiatePayment(orderPayload, authPayload, appName)` — In-app payment
- `CbeSuperApp.requestPermissions(permissions)` — Request native permissions
- `CbeSuperApp.fetchCurrentLocation()` — Get device location

### Environment Variables (Vercel)
Add to Vercel project settings:
```
CBE_APP_CODE=<miniapp_code>
CBE_MERCHANT_CODE=<merchant_code>
CBE_APP_SECRET=<your_hmac_secret>
CBE_PRIVATE_KEY=<ed25519_private_key_base64>
CBE_X_API_KEY=<api_key>
WEBHOOK_SECRET=<webhook_secret>
```

### API Endpoints
- `POST /api/cbe-auth` — Exchange SuperApp access token for Firebase custom token
- `POST /api/cbe-payment` — Sign payment payload (Ed25519 + HMAC-SHA256)

### Pages Modified
- `login.html` — CBE SuperApp login button (hidden when SDK unavailable); added `getRedirectUrl()` + localStorage redirect support
- `register.html` — CBE SuperApp register button
- `profile.html` — Pay with CBE SuperApp button on Subscription tab; "Choose Plan" buttons now redirect to `payment.html?plan=...`
- `home.html`, `movies.html`, `tv.html`, `youtube.html`, `index.html` — Added `js/cbe-superapp.js`

## Payment System (June 2026)

### Payment Page
- **`payment.html`** — Dedicated payment page at `/payment.html`
- Accessed from profile.html "Choose Plan" buttons: `/payment.html?plan=monthly|yearly`
- Redirects unauthenticated users to login.html, then back after login via localStorage

### Payment Methods
1. **CBE SuperApp** — In-app payment via native SDK (existing integration)
2. **Chapa** — Online card/bank/mobile money via Chapa API
   - `/api/chapa-init.js` — POST: initializes Chapa transaction, returns checkout URL
   - `/api/chapa-verify.js` — GET|POST: verifies payment via Chapa verify API, activates subscription
   - Test keys (hardcoded, set `CHAPA_SECRET_KEY` env var for production):
     - Public: `CHAPUBK_TEST-g9g6GslObE7g7fUssBLKcmStUgcLGaGl`
     - Secret: `CHASECK_TEST-Gbi7RbSHFgHJlzcdbY1diPpPr7e80uaw`
     - Encryption: `RTrNeg90APrhdpWMBE7kD6VV`
3. **Telebirr** — Manual QR-based payment; user sends to Telebirr account, enters reference
4. **WhatsApp** — Opens WhatsApp with pre-filled plan+ref message; user sends payment screenshot + QR code

### QR Code
- Generated client-side via `qrcodejs` CDN library
- Contains: plan, amount, unique ref (CBE-XXXXXXXX), user ID prefix, date
- Downloadable as PNG; shareable via WhatsApp link

### Firestore Rules Update
- `payments` collection: user who created payment can now update their own payment record (needed for adding transactionRef and manual verification)
- Previously required admin role for all updates

### New Files
- `payment.html` — Payment page UI
- `js/payment.js` — Payment logic + QR generation
- `api/chapa-init.js` — Chapa transaction init
- `api/chapa-verify.js` — Chapa payment verification + webhook handler
