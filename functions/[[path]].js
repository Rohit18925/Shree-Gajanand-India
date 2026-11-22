import { createApp } from "../server.js";

let appPromise;

export async function onRequest(context) {
  if (!appPromise) {
    appPromise = createApp();
  }
  const app = await appPromise;

  // Convert Cloudflare Request to Node.js-like request
  const request = context.request;
  const url = new URL(request.url);

  // Create a mock request/response for Express
  const req = {
    method: request.method,
    url: url.pathname + url.search,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(request.headers),
    get: (name) => request.headers.get(name),
    ip: request.headers.get("cf-connecting-ip") || "unknown",
    body: null,
    cookies: {},
    params: {},
  };

  // Parse body for POST requests
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      req.body = await request.json().catch(() => ({}));
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      req.body = Object.fromEntries(formData);
    }
  }

  // Mock response object
  let statusCode = 200;
  let responseHeaders = new Headers();
  let responseBody = null;
  let responseSent = false;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    setHeader: (name, value) => {
      responseHeaders.set(name, value);
      return res;
    },
    getHeader: (name) => responseHeaders.get(name),
    removeHeader: (name) => responseHeaders.delete(name),
    json: (data) => {
      if (responseSent) return;
      responseSent = true;
      responseBody = JSON.stringify(data);
      responseHeaders.set("content-type", "application/json");
      return res;
    },
    send: (data) => {
      if (responseSent) return;
      responseSent = true;
      responseBody = data;
      if (typeof data === "string") {
        responseHeaders.set("content-type", "text/html");
      }
      return res;
    },
    redirect: (code, url) => {
      if (responseSent) return;
      responseSent = true;
      statusCode = code;
      responseHeaders.set("location", url);
      return res;
    },
    sendFile: async (filePath) => {
      if (responseSent) return;
      responseSent = true;
      // For static files, we'll let the Pages static asset serving handle it
      // This is a fallback
      const fs = await import("fs/promises");
      const path = await import("path");
      try {
        const content = await fs.readFile(filePath);
        responseBody = content;
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          ".html": "text/html",
          ".css": "text/css",
          ".js": "application/javascript",
          ".json": "application/json",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
        };
        responseHeaders.set("content-type", mimeTypes[ext] || "application/octet-stream");
      } catch {
        statusCode = 404;
        responseBody = "File not found";
      }
      return res;
    },
  };

  // Run Express middleware and routes
  await new Promise((resolve) => {
    app(req, res, () => resolve());
  });

  // Return Cloudflare Response
  return new Response(responseBody, {
    status: statusCode,
    headers: responseHeaders,
  });
}