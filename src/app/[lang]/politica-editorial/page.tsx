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
    title: dict.legal.editorial.title,
    description: dict.legal.editorial.intro,
    alternates: {
      canonical: staticPath("editorial", lang),
      languages: {
        es: staticPath("editorial", "es"),
        en: staticPath("editorial", "en"),
        "x-default": staticPath("editorial", "es"),
      },
    },
  };
}

export default async function EditorialPolicyPage({ params }: Props) {
  const lang = await requireLang(params);
  return <LegalPage lang={lang} dict={getDict(lang)} kind="editorial" />;
}
