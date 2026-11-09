# Shree Gajanand India Pvt. Ltd. — Live Ready

This production-ready Node.js/Express website includes an enquiry-form backend, structured with a `public/` folder for assets and `server.js` for the server.

**Company:** Shree Gajanand India Pvt. Ltd.  
**Certifications:** ISO 9001:2015 (25MEQTA93), ISO 14001:2015 (25MEETW90), ISO 45001:2018 (25MEOTB71)  
**Scope:** Government Contractor of Mechanized Cleaning & Supplier  
**Certification Body:** Qualified Management Services Pvt. Ltd. (EGAC Accredited, CAB #011805)

## Local Test

1. Ensure Node.js 20+ is installed and run `npm ci`.
2. Copy `.env.example` to `.env`, set `MAIL_MODE=console`, run `npm start`, and open `http://localhost:3000`.

## Gmail Enquiry Delivery & Deployment

Configure production SMTP variables (`SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_TO`) pointing to `shreegajanandindia751@gmail.com`. The project supports deployment on standard Node.js hosts using the provided `render.yaml` Blueprint.

## Key Features

- **30+ Service Pages** — Each service has its own SEO-friendly URL
- **Project Gallery** — 27 photos across 3 railway projects with lightbox viewer
- **ISO Certifications** — Prominently displayed with certificate numbers and verification link
- **Enhanced Footer** — Quick links, certifications, contact info, certificate verification
- **Client/Partner Section** — Trusted industries and sectors served
- **Contact Form** — Honeypot protection, rate limiting, JSON + redirect fallback
- **Health Check** — `/health` endpoint for monitoring
- **Security Headers** — CSP-ready, HSTS, X-Frame-Options, Referrer-Policy
- **Responsive Design** — Mobile-first, accessible, reduced-motion support