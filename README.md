# Shree Gajanand India — Live Ready

This production-ready Node.js/Express website includes an enquiry-form backend, structured with a `public/` folder for assets and `server.js` for the server.

## Local Test

1. Ensure Node.js 20+ is installed and run `npm ci`.
2. Copy `.env.example` to `.env`, set `MAIL_MODE=console`, run `npm start`, and open `http://localhost:3000`.

## Gmail Enquiry Delivery & Deployment

Configure production SMTP variables (`SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_TO`) pointing to `shreegajanandindia751@gmail.com`. The project supports deployment on standard Node.js hosts using the provided `render.yaml` Blueprint.
