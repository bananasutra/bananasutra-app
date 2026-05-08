# Contact Form Setup

The site includes a contact form embedded in the global footer (collapsed by default, expandable). Submissions are sent to a Google Apps Script endpoint that logs each message in a Google Sheet and emails a notification to itsbananasutra@gmail.com.

## Architecture

**Client side** — The form lives in `src/catalog/GlobalFooter.tsx` as the `FooterContactForm` component. It POSTs form data to a Google Apps Script web app URL stored in the `VITE_CONTACT_ENDPOINT` environment variable.

**Server side** — A Google Apps Script (`src/catalog/contact-form-apps-script.js`) handles the POST, appends a row to a Google Sheet, and sends an email via Gmail. No third-party services, no API keys, no cost.

**Spam guardrails** (all client-side, no CAPTCHA):

- Honeypot field — invisible to humans, bots auto-fill it, submissions with it filled are silently dropped.
- Timing gate — rejects submissions faster than 3 seconds after the form opens (bots submit instantly).
- Session rate limit — max 3 submissions per browser tab lifetime.

## Google Apps Script Setup

If you need to redeploy or set up from scratch:

1. Create a Google Sheet. Add headers in row 1: `Timestamp`, `Name`, `Email`, `Subject`, `Message`.
2. Go to **Extensions → Apps Script**.
3. Delete the default code and paste the contents of `src/catalog/contact-form-apps-script.js`.
4. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**. Google will ask you to authorize — grant both permissions (Sheets + Gmail). The "unverified app" warning is expected for personal scripts; click through it.
6. Copy the deployment URL.

## Environment Variable

Create a `.env` file in `apps/banana-catalog-prototype/` (gitignored — never commit this):

```
VITE_CONTACT_ENDPOINT=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

A `.env.example` is checked in as a template.

Vite injects this at build time. Restart the dev server after changing it.

## File Locations

- `src/catalog/GlobalFooter.tsx` — footer component with embedded contact form
- `src/catalog/GlobalFooter.css` — form styles (2-col desktop/tablet, 1-col mobile, collapse animation)
- `src/catalog/contact-form-apps-script.js` — Google Apps Script source (paste into Apps Script editor)
- `.env` — deployment URL (gitignored)
- `.env.example` — template for the above

## Updating the Script

If you edit the Apps Script code, you need to create a **new deployment version** in the Apps Script editor (Deploy → Manage deployments → edit → bump version). The deployment URL stays the same but the new code only takes effect after you publish a new version.

## Quotas

Gmail free tier allows 100 emails/day. Google Sheets has no practical row limit for this use case. Both are more than sufficient for a personal site contact form.
