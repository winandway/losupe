import type { Metadata, Viewport } from "next";
import { Inter, Newsreader, Space_Grotesk } from "next/font/google";
import "../globals.css";
import { Footer } from "@/components/Footer";
import { Sensor } from "@/components/Sensor";
import { Header } from "@/components/Header";
import { getDict, toLang } from "@/i18n";
import { getBaseUrl } from "@/lib/site";
import { homePath, rssPath } from "@/lib/urls";
import { WebMcp } from "@/components/WebMcp";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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

// Todo el sitio se sirve dinámico desde D1: siempre fresco, nada prerenderizado con datos viejos.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0b1f3a",
  colorScheme: "only light",
  width: "device-width",
  initialScale: 1,
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const lang = toLang((await params).lang);
  const dict = getDict(lang);
  const base = await getBaseUrl();
  const title = `${dict.brand.name} — ${dict.brand.tagline}`;
  return {
    metadataBase: new URL(base),
    title: { default: title, template: `%s · ${dict.brand.name}` },
    description: dict.brand.description,
    applicationName: dict.brand.name,
    alternates: {
      canonical: homePath(lang),
      languages: { es: homePath("es"), en: homePath("en"), "x-default": homePath("es") },
      types: { "application/rss+xml": rssPath(lang) },
    },
    openGraph: {
      type: "website",
      siteName: dict.brand.name,
      locale: dict.ogLocale,
      alternateLocale: lang === "es" ? ["en_US"] : ["es_US"],
      url: homePath(lang),
      title,
      description: dict.brand.description,
    },
    twitter: { card: "summary_large_image", title, description: dict.brand.description },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children, params }: Props) {
  const lang = toLang((await params).lang);
  const dict = getDict(lang);
  return (
    <html
      lang={lang}
      className={`${inter.variable} ${newsreader.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Header lang={lang} dict={dict} />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer lang={lang} dict={dict} />
        {/* El sensor de lectores: que este código se ejecute es la prueba de que hay una persona
            de verdad al otro lado. Ver src/lib/lectores.ts. */}
        <Sensor lang={lang} />
        <WebMcp lang={lang} />
      </body>
    </html>
  );
}
