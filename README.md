# Shree Gajanand India — Live Ready

This package is production-ready as a Node.js/Express website with a working enquiry-form backend.

## What was fixed
- Removed local debug/ingest calls and placeholder form URLs.
- Contact form now posts to `/submit-form`.
- Email credentials are loaded from environment variables instead of source code.
- Gmail/SMTP delivery supports `replyTo` so replies go to the visitor.
- Added server-side validation, honeypot spam protection, and basic rate limiting.
- Fixed mobile navigation on all pages.
- Fixed gallery lightbox and keyboard access.
- Removed dead Home-page form script and added consistent footer/WhatsApp access.
- Normalized `contact.html`, `client.html`, and `style.css` filenames for Linux hosting.
- Optimized the three largest gallery images to WebP.
- Added `/health`, custom 404 page, Dockerfile, Render Blueprint, `.env.example`, and `.gitignore`.
- `node_modules` is intentionally excluded from the deployment ZIP.

## Local test
1. Install Node.js 20 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env`.
4. For a no-email test, add `MAIL_MODE=console` to `.env`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

## Real Gmail enquiry delivery
Use a Google account with 2-Step Verification and create an App Password. Put the 16-character App Password in `SMTP_PASS`. Never put the normal Gmail password in the code.

Required production variables:
- `SMTP_USER=shreegajanandindia751@gmail.com`
- `SMTP_PASS=<Google App Password>`
- `EMAIL_FROM=shreegajanandindia751@gmail.com`
- `EMAIL_TO=shreegajanandindia751@gmail.com`

## Deploy
This project can be deployed to any Node.js host. The included `render.yaml` is ready for Render Blueprint deployment. Add the four email variables as secrets in the hosting dashboard.

After deployment, point your domain DNS to the hosting provider and enable HTTPS.
