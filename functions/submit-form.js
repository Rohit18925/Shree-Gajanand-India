import nodemailer from "nodemailer";

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/\0/g, "").slice(0, maxLength);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function safeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").slice(0, 160);
}

let mailTransporter;

function getMailTransporter(env) {
  if (mailTransporter) return mailTransporter;

  // Support MAIL_MODE=console for local testing without real SMTP
  if (env.MAIL_MODE === "console") {
    mailTransporter = {
      sendMail: async ({ from, to, replyTo, subject, text }) => {
        console.log("=== EMAIL (console mode) ===");
        console.log(`From: ${from}`);
        console.log(`To: ${to}`);
        console.log(`Reply-To: ${replyTo}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text:\n${text}`);
        console.log("==============================");
        return { messageId: "<console-mode>" };
      }
    };
    return mailTransporter;
  }

  const host = env.SMTP_HOST;
  const port = Number(env.SMTP_PORT) || 465;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASS are required (or set MAIL_MODE=console for local testing).");
  }

  mailTransporter = nodemailer.createTransport({
    host,
    port,
    secure: String(env.SMTP_SECURE || (port === 465)).toLowerCase() === "true",
    auth: { user, pass }
  });

  return mailTransporter;
}

async function sendEmail(env, { to, replyTo, subject, text }) {
  const from = env.EMAIL_FROM || env.SMTP_USER;
  if (!from) throw new Error("EMAIL_FROM or SMTP_USER is required.");
  return getMailTransporter(env).sendMail({ from, to, replyTo, subject, text });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const name = cleanText(body.name, 100);
    const phone = cleanText(body.phone, 20);
    const email = cleanText(body.email, 254);
    const subject = cleanText(body.subject, 160);
    const message = cleanText(body.message, 3000);
    const website = cleanText(body.website, 200);

    // Honeypot check
    if (website) {
      return new Response(JSON.stringify({ result: "success" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validation
    if (!name || !phone || !email || !subject || !message) {
      return new Response(JSON.stringify({ result: "error", error: "Please fill in all required fields." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!validEmail(email)) {
      return new Response(JSON.stringify({ result: "error", error: "Please enter a valid email address." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!/^[+0-9()\-\s]{7,20}$/.test(phone)) {
      return new Response(JSON.stringify({ result: "error", error: "Please enter a valid phone number." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const recipient = env.EMAIL_TO || "shreegajanandindia751@gmail.com";
    const mailText = [
      "New enquiry from Shree Gajanand India website",
      "",
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      "",
      "Message:",
      message
    ].join("\n");

    const result = await sendEmail(env, {
      to: recipient,
      replyTo: email,
      subject: `Website Enquiry: ${safeHeader(subject)}`,
      text: mailText
    });

    console.log("SMTP email sent:", result && result.messageId ? result.messageId : "success");

    return new Response(JSON.stringify({ result: "success" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Email send failed:", error && error.message ? error.message : error);
    return new Response(JSON.stringify({ result: "error", error: "We could not send your enquiry right now. Please try again or contact us by phone/WhatsApp." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}