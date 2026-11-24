# Shree Gajanand India Pvt. Ltd.

Static website and contact enquiry API deployed together on one Cloudflare Worker.

## Production architecture

- Frontend: static files in `public/`
- Worker entry point: `src/index.js`
- Contact endpoint: `POST /submit-form`
- Email delivery: Brevo transactional email API
- Worker name: `shreegajanandindia`

The Express/Nodemailer `server.js` file is retained for reference/legacy Node hosting. It is not used by the Cloudflare Worker deployment.

## Configure email secrets

Create a Brevo API key and verify the sender address in Brevo. In Cloudflare, open Workers & Pages → `shreegajanandindia` → Settings → Variables and Secrets, then add:

- `BREVO_API_KEY` — store as a Secret
- `EMAIL_FROM` — verified sender email address
- `EMAIL_TO` — destination inbox (currently `shreegajanandindia751@gmail.com`)

Do not put production credentials in source files or commit them to GitHub.

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in the same values. `.dev.vars` is ignored by Git.

## Local development

Use Node.js and Wrangler:

```bash
npx wrangler@latest login
npx wrangler@latest dev
```

The local site is served by Wrangler. The contact form calls the same-origin `/submit-form` route.

## Deploy

Set the three production values as Worker secrets/variables in the Cloudflare dashboard, then run:

```bash
npx wrangler@latest deploy
```

Or set the secrets from the terminal:

```bash
npx wrangler@latest secret put BREVO_API_KEY
npx wrangler@latest secret put EMAIL_FROM
npx wrangler@latest secret put EMAIL_TO
```

## Test

A GET request to `/submit-form` should return HTTP 405. Submit a real test enquiry from the website to verify email delivery. Check Cloudflare Worker logs if the API returns an error:

```bash
npx wrangler@latest tail shreegajanandindia
```

A successful API response confirms that Brevo accepted the send request; check the recipient inbox and Brevo logs to confirm delivery.

## Contact form protections

The Worker validates required fields, email and phone formats, supports the existing honeypot field, and never exposes the Brevo API key to the browser. Configure Cloudflare rate limiting for `POST /submit-form` before relying on the public form at scale.

