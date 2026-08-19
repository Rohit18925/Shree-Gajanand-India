const express = require("express");

const path = require("path");

const fs = require("fs");

const envPath = path.join(__dirname, ".env");

if (fs.existsSync(envPath)) {
    for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const index = line.indexOf("=");
        if (index < 1) continue;
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

const app = express();

const PORT = Number(process.env.PORT) || 3e3;

const PUBLIC_DIR = path.join(__dirname, "public");

const isProduction = process.env.NODE_ENV === "production";

app.disable("x-powered-by");

app.set("trust proxy", 1);

app.use(express.json({
    limit: "32kb"
}));

app.use(express.urlencoded({
    extended: false,
    limit: "32kb"
}));

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (isProduction && req.get("x-forwarded-proto") === "https") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        mail: process.env.RESEND_API_KEY ? "resend" : "not-configured"
    });
});

const attempts = new Map;

const WINDOW_MS = 15 * 60 * 1e3;

const MAX_ATTEMPTS = 5;

function wantsJson(req) {
    return (req.get("accept") || "").includes("application/json") || req.is("application/json");
}

function respondError(req, res, status, message) {
    if (wantsJson(req)) {
        return res.status(status).json({
            result: "error",
            error: message
        });
    }
    return res.redirect(303, "/contact.html?error=1");
}

function contactRateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const recent = (attempts.get(key) || []).filter(ts => now - ts < WINDOW_MS);
    if (recent.length >= MAX_ATTEMPTS) {
        return respondError(req, res, 429, "Too many enquiries from this connection. Please try again later.");
    }
    recent.push(now);
    attempts.set(key, recent);
    next();
}

function cleanText(value, maxLength) {
    return String(value || "").trim().replace(/\0/g, "").slice(0, maxLength);
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function safeHeader(value) {
    return String(value || "").replace(/[\r\n]+/g, " ").slice(0, 160);
}

async function sendWithResend({to: to, replyTo: replyTo, subject: subject, text: text}) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
    const from = process.env.RESEND_FROM || "Shree Gajanand India Website <onboarding@resend.dev>";
    const controller = new AbortController;
    const timeout = setTimeout(() => controller.abort(), 15e3);
    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: from,
                to: [ to ],
                reply_to: replyTo,
                subject: subject,
                text: text
            }),
            signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = data && (data.message || data.error) || `Resend returned HTTP ${response.status}`;
            throw new Error(message);
        }
        return data;
    } finally {
        clearTimeout(timeout);
    }
}

app.post("/submit-form", contactRateLimit, async (req, res) => {
    const name = cleanText(req.body.name, 100);
    const phone = cleanText(req.body.phone, 20);
    const email = cleanText(req.body.email, 254);
    const subject = cleanText(req.body.subject, 160);
    const message = cleanText(req.body.message, 3e3);
    const website = cleanText(req.body.website, 200);
    if (website) {
        return wantsJson(req) ? res.json({
            result: "success"
        }) : res.redirect(303, "/contact.html?sent=1");
    }
    if (!name || !phone || !email || !subject || !message) {
        return respondError(req, res, 400, "Please fill in all required fields.");
    }
    if (!validEmail(email)) {
        return respondError(req, res, 400, "Please enter a valid email address.");
    }
    if (!/^[+0-9()\-\s]{7,20}$/.test(phone)) {
        return respondError(req, res, 400, "Please enter a valid phone number.");
    }
    const recipient = process.env.EMAIL_TO || "shreegajanandindia751@gmail.com";
    const mailText = [ "New enquiry from Shree Gajanand India website", "", `Name: ${name}`, `Phone: ${phone}`, `Email: ${email}`, `Subject: ${subject}`, "", "Message:", message ].join("\n");
    try {
        const result = await sendWithResend({
            to: recipient,
            replyTo: email,
            subject: `Website Enquiry: ${safeHeader(subject)}`,
            text: mailText
        });
        console.log("Resend email sent:", result && result.id ? result.id : "success");
        return wantsJson(req) ? res.json({
            result: "success"
        }) : res.redirect(303, "/contact.html?sent=1");
    } catch (error) {
        console.error("Email send failed:", error && error.message ? error.message : error);
        return respondError(req, res, 500, "We could not send your enquiry right now. Please try again or contact us by phone/WhatsApp.");
    }
});

const cleanRoutes = {
    "/about": "about.html",
    "/services": "services.html",
    "/gallery": "gallery.html",
    "/client": "client.html",
    "/contact": "contact.html"
};

for (const [route, file] of Object.entries(cleanRoutes)) {
    app.get(route, (req, res) => res.sendFile(path.join(PUBLIC_DIR, file)));
}

app.use(express.static(PUBLIC_DIR, {
    extensions: [ "html" ],
    maxAge: isProduction ? "1d" : 0,
    setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache");
        } else if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=604800");
        }
    }
}));

app.use((req, res) => {
    if (req.path.startsWith("/api/") || wantsJson(req)) {
        return res.status(404).json({
            error: "Not found"
        });
    }
    return res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.use((err, req, res, next) => {
    console.error(err);
    if (wantsJson(req)) {
        return res.status(500).json({
            result: "error",
            error: "Internal server error."
        });
    }
    return res.status(500).send("Internal server error.");
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Shree Gajanand India running on port ${PORT}`);
});