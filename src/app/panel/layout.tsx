import type { Metadata, Viewport } from "next";
import { Inter, Newsreader, Space_Grotesk } from "next/font/google";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-newsreader",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel · losupe",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1f3a",
  colorScheme: "only light",
  width: "device-width",
  initialScale: 1,
};

/** Raíz del panel (/panel): sin cabecera pública, sin indexar. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${newsreader.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper">{children}</body>
    </html>
  );
}
