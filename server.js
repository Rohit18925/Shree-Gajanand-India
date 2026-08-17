const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Lightweight .env loader for local development. Hosting platforms should use their secret manager/env settings.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction && req.get('x-forwarded-proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Small in-memory anti-spam/rate limit for contact submissions.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
function contactRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (attempts.get(key) || []).filter(ts => now - ts < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    return respondError(req, res, 429, 'Too many enquiries from this connection. Please try again later.');
  }
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 1000) {
    for (const [ip, times] of attempts) if (!times.some(ts => now - ts < WINDOW_MS)) attempts.delete(ip);
  }
  next();
}

function text(value, max) {
  return String(value || '').trim().replace(/\0/g, '').slice(0, max);
}
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
function safeHeader(value) {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 160);
}
function wantsJson(req) {
  return (req.get('accept') || '').includes('application/json') || req.is('application/json');
}
function respondError(req, res, status, message) {
  if (wantsJson(req)) return res.status(status).json({ result: 'error', error: message });
  return res.redirect(303, '/contact.html?error=1');
}

function createTransporter() {
  if ((process.env.MAIL_MODE || '').toLowerCase() === 'console') return null;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? (port === 465)).toLowerCase() === 'true';
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('Email service is not configured.');
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

app.post('/submit-form', contactRateLimit, async (req, res) => {
  const name = text(req.body.name, 100);
  const phone = text(req.body.phone, 20);
  const email = text(req.body.email, 254);
  const subject = text(req.body.subject, 160);
  const message = text(req.body.message, 3000);
  const website = text(req.body.website, 200); // honeypot

  // Quietly accept obvious bot submissions.
  if (website) return wantsJson(req) ? res.json({ result: 'success' }) : res.redirect(303, '/contact.html?sent=1');

  if (!name || !phone || !email || !subject || !message) return respondError(req, res, 400, 'Please fill in all required fields.');
  if (!validEmail(email)) return respondError(req, res, 400, 'Please enter a valid email address.');
  if (!/^[+0-9()\-\s]{7,20}$/.test(phone)) return respondError(req, res, 400, 'Please enter a valid phone number.');

  const recipient = process.env.EMAIL_TO || process.env.SMTP_USER || process.env.EMAIL_USER;
  const sender = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
  if (!recipient || !sender) return respondError(req, res, 503, 'Email service is not configured yet. Please contact us by phone or WhatsApp.');

  const mail = {
    from: `Shree Gajanand India Website <${sender}>`,
    to: recipient,
    replyTo: email,
    subject: `Website Enquiry: ${safeHeader(subject)}`,
    text: [
      'New enquiry from shree-gajanand-india.com',
      '',
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      '',
      'Message:',
      message
    ].join('\n')
  };

  try {
    if ((process.env.MAIL_MODE || '').toLowerCase() === 'console') {
      console.log('[MAIL_MODE=console] Enquiry:', mail);
    } else {
      const transporter = createTransporter();
      await transporter.sendMail(mail);
    }
    return wantsJson(req) ? res.json({ result: 'success' }) : res.redirect(303, '/contact.html?sent=1');
  } catch (error) {
    console.error('Email send failed:', error && error.message ? error.message : error);
    return respondError(req, res, 500, 'We could not send your enquiry right now. Please try again or contact us by phone/WhatsApp.');
  }
});

const cleanRoutes = {
  '/about': 'about.html',
  '/services': 'services.html',
  '/gallery': 'gallery.html',
  '/client': 'client.html',
  '/contact': 'contact.html'
};
for (const [route, file] of Object.entries(cleanRoutes)) {
  app.get(route, (req, res) => res.sendFile(path.join(PUBLIC_DIR, file)));
}

app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  maxAge: isProduction ? '1d' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/') || wantsJson(req)) return res.status(404).json({ error: 'Not found' });
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (wantsJson(req)) return res.status(500).json({ result: 'error', error: 'Internal server error.' });
  res.status(500).send('Internal server error.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shree Gajanand India running on port ${PORT}`);
});
