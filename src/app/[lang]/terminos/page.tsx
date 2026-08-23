import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";
import { staticPath } from "@/lib/urls";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  return {
    title: dict.legal.terms.title,
    description: dict.legal.terms.intro,
    alternates: {
      canonical: staticPath("terms", lang),
      languages: {
        es: staticPath("terms", "es"),
        en: staticPath("terms", "en"),
        "x-default": staticPath("terms", "es"),
      },
    },
  };
}

export default async function TermsPage({ params }: Props) {
  const lang = await requireLang(params);
  return <LegalPage lang={lang} dict={getDict(lang)} kind="terms" />;
}
