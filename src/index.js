const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });

const cleanText = (value, maxLength) =>
  String(value ?? "").trim().replace(/\0/g, "").slice(0, maxLength);

async function handleContact(request, env) {
  if (request.method !== "POST") {
    return json({ result: "error", error: "Method not allowed." }, 405);
  }

  let body;
  try {
    const type = request.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      body = await request.json();
    } else if (type.includes("application/x-www-form-urlencoded") ||
               type.includes("multipart/form-data")) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      return json({ result: "error", error: "Unsupported content type." }, 415);
    }
  } catch {
    return json({ result: "error", error: "Invalid request body." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ result: "error", error: "Invalid request body." }, 400);
  }

  const name = cleanText(body.name, 100);
  const phone = cleanText(body.phone, 20);
  const email = cleanText(body.email, 254);
  const subject = cleanText(body.subject, 160);
  const message = cleanText(body.message, 3000);
  const website = cleanText(body.website, 200);

  // Honeypot: silently accept automated bot submissions.
  if (website) return json({ result: "success" });

  if (!name || !phone || !email || !subject || !message) {
    return json({ result: "error", error: "Please fill in all required fields." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ result: "error", error: "Please enter a valid email address." }, 400);
  }
  if (!/^[+0-9()\-\s]{7,20}$/.test(phone)) {
    return json({ result: "error", error: "Please enter a valid phone number." }, 400);
  }

  if (!env.BREVO_API_KEY || !env.EMAIL_FROM || !env.EMAIL_TO) {
    console.error("Contact API configuration missing: BREVO_API_KEY, EMAIL_FROM or EMAIL_TO.");
    return json({ result: "error", error: "Email service is not configured. Please contact us by phone or WhatsApp." }, 503);
  }

  const emailPayload = {
    sender: { name: "Shree Gajanand India Website", email: env.EMAIL_FROM },
    to: [{ email: env.EMAIL_TO }],
    replyTo: { email },
    subject: "Website Enquiry: " + subject.replace(/[\r\n]+/g, " ").slice(0, 160),
    textContent: [
      "New enquiry from Shree Gajanand India website",
      "",
      "Name: " + name,
      "Phone: " + phone,
      "Email: " + email,
      "Enquiry Type: " + subject,
      "",
      "Message:",
      message
    ].join("\n")
  };

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Brevo API rejected contact email:", response.status, details.slice(0, 1500));
      return json({ result: "error", error: "Unable to send your enquiry right now. Please try again or contact us by phone/WhatsApp." }, 502);
    }

    return json({ result: "success", message: "Enquiry sent successfully." });
  } catch (error) {
    console.error("Brevo request failed:", error instanceof Error ? error.message : String(error));
    return json({ result: "error", error: "Email service is temporarily unavailable. Please try again later." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/submit-form") {
      return handleContact(request, env);
    }

    // Handle API preflight only if a future cross-origin caller is added.
    if (url.pathname.startsWith("/submit-form/")) {
      return json({ result: "error", error: "Not found." }, 404);
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
