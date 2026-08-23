import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "losupe — Lo que pasa, explicado.",
    short_name: "losupe",
    description:
      "Noticias y guías de economía, ventas, tecnología e IA, cripto y tendencias, en español e inglés.",
    start_url: "/es",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b1f3a",
    lang: "es",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
