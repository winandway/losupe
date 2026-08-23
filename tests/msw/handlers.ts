import { http, HttpResponse } from "msw";

// Simulaciones de servicios externos. En el bloque 2 se agregan Gemini, fal.ai, Pexels y Brave.
export const handlers = [
  http.get("https://example.com/feed.xml", () =>
    HttpResponse.text(
      `<?xml version="1.0"?><rss version="2.0"><channel><title>Ejemplo</title><item><title>Nota de prueba</title><link>https://example.com/nota</link></item></channel></rss>`,
      { headers: { "Content-Type": "application/rss+xml" } },
    ),
  ),
];
