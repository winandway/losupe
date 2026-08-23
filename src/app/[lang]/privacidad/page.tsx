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
    title: dict.legal.privacy.title,
    description: dict.legal.privacy.intro,
    alternates: {
      canonical: staticPath("privacy", lang),
      languages: {
        es: staticPath("privacy", "es"),
        en: staticPath("privacy", "en"),
        "x-default": staticPath("privacy", "es"),
      },
    },
  };
}

export default async function PrivacyPage({ params }: Props) {
  const lang = await requireLang(params);
  return <LegalPage lang={lang} dict={getDict(lang)} kind="privacy" />;
}
