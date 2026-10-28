# Shree Gajanand India — Live Ready

This package is production-ready as a Node.js/Express website with a working enquiry-form backend.

## Project structure
- `public/` is the only website folder (used by both Cloudflare Workers and the Node server).
- `public/img/` holds the optimized WebP images.
- `src/index.js` is the Cloudflare Worker (portal API + enquiry form). `server.js` is the Node/Express alternative.

## Latest cleanup
- One clean stylesheet (was 5,700 lines of stacked overrides) with a high-contrast purple theme.
- Removed all backup files, the duplicate root-level copy of the site, and unused images.
- Images compressed from about 13 MB to about 2.3 MB total; pages load much faster.
- Removed gallery sections that pointed to photos that did not exist.
- Consistent header, footer, SEO tags and Font Awesome loading on every page.
- Accessible mobile menu, keyboard/swipe-friendly photo viewer, skip link.

## Local test
1. Install Node.js 20 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env`.
4. For a no-email test, add `MAIL_MODE=console` to `.env`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

## Gmail enquiry delivery on Node/Render
Use a Google account with 2-Step Verification and create an App Password. Put the 16-character App Password in `SMTP_PASS`. Never put the normal Gmail password in the code.

Required production variables:
- `SMTP_USER=shreegajanandindia751@gmail.com`
- `SMTP_PASS=<Google App Password>`
- `EMAIL_FROM=shreegajanandindia751@gmail.com`
- `EMAIL_TO=shreegajanandindia751@gmail.com`

## Deploy
This project can be deployed to any Node.js host. The included `render.yaml` is ready for Render Blueprint deployment. Add the four email variables as secrets in the hosting dashboard.

After deployment, point your domain DNS to the hosting provider and enable HTTPS.


## ECMS portal / Cloudflare D1

The Employee Management Portal uses the Cloudflare Worker in `src/index.js` and the D1 database bound as `DB`. Before first use, execute `portal-schema.sql` against the `sgi-ecms` D1 database and configure the `PORTAL_SETUP_KEY` secret. The Node/Render server serves the public website and enquiry form; the D1-backed portal API is provided by the Cloudflare Worker.
