import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "../globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getDict, toLang } from "@/i18n";
import { getBaseUrl } from "@/lib/site";
import { homePath, rssPath } from "@/lib/urls";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  variable: "--font-newsreader",
  display: "swap",
  axes: ["opsz"],
});

// Todo el sitio se sirve dinámico desde D1: siempre fresco, nada prerenderizado con datos viejos.
export const dynamic = "force-dynamic";

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
    <html lang={lang} className={`${inter.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header lang={lang} dict={dict} />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer lang={lang} dict={dict} />
      </body>
    </html>
  );
}
