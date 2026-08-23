import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const isDev = process.env.NODE_ENV === "development";

// Política de seguridad de contenido. Next necesita scripts/estilos inline para hidratar;
// el resto queda cerrado (sin orígenes externos salvo imágenes https y videos de YouTube).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  "media-src 'self' https:",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // En producción el worker redirige "/" según el idioma del navegador antes de llegar aquí;
      // esto cubre `next dev`.
      { source: "/", destination: "/es", permanent: false },
      // Enlaces viejos de MundosCrypto (/noticia/<slug>) caen en la sección cripto.
      { source: "/noticia/:slug", destination: "/es/cripto/:slug", permanent: false },
    ];
  },
};

export default nextConfig;

// Bindings locales (D1, R2) durante `next dev`, leyendo wrangler.jsonc.
initOpenNextCloudflareForDev();
