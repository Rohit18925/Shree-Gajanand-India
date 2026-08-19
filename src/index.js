export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/submit-form") {
      if (request.method !== "POST") {
        return jsonResponse(
          { result: "error", error: "Method not allowed." },
          405
        );
      }

      let body;

      try {
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          body = await request.json();
        } else {
          body = Object.fromEntries((await request.formData()).entries());
        }
      } catch {
        return jsonResponse(
          { result: "error", error: "Invalid form data." },
          400
        );
      }

      const name = clean(body.name, 100);
      const phone = clean(body.phone, 20);
      const email = clean(body.email, 254);
      const subject = clean(body.subject, 160);
      const message = clean(body.message, 3000);
      const website = clean(body.website, 200);

      if (website) {
        return jsonResponse({ result: "success" });
      }

      if (!name || !phone || !email || !subject || !message) {
        return jsonResponse(
          { result: "error", error: "Please fill in all required fields." },
          400
        );
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse(
          { result: "error", error: "Please enter a valid email address." },
          400
        );
      }

      if (!/^[+0-9()\-\s]{7,20}$/.test(phone)) {
        return jsonResponse(
          { result: "error", error: "Please enter a valid phone number." },
          400
        );
      }

      if (!env.RESEND_API_KEY) {
        console.error("RESEND_API_KEY is missing");

        return jsonResponse(
          { result: "error", error: "Email service is not configured." },
          500
        );
      }

      const recipient =
        env.EMAIL_TO || "shreegajanandindia751@gmail.com";

      const from =
        env.RESEND_FROM ||
        "Shree Gajanand India Website <onboarding@resend.dev>";

      const emailText = [
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

      try {
        const resendResponse = await fetch(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from,
              to: [recipient],
              reply_to: email,
              subject: `Website Enquiry: ${safeHeader(subject)}`,
              text: emailText
            })
          }
        );

        const resendData = await resendResponse
          .json()
          .catch(() => ({}));

        if (!resendResponse.ok) {
          console.error("Resend error:", resendData);

          return jsonResponse(
            {
              result: "error",
              error: "Unable to send enquiry right now."
            },
            502
          );
        }

        console.log("Email sent:", resendData.id || "success");

        return jsonResponse({
          result: "success"
        });
      } catch (error) {
        console.error("Email send failed:", error);

        return jsonResponse(
          {
            result: "error",
            error: "Unable to send enquiry right now."
          },
          500
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};

function clean(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/\0/g, "")
    .slice(0, maxLength);
}

function safeHeader(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 160);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}