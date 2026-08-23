import type { Metadata } from "next";
import { PublishPage } from "@/components/PublishPage";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";
import { staticPath } from "@/lib/urls";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  return {
    title: dict.publish.title,
    description: dict.publish.subtitle,
    alternates: {
      canonical: staticPath("publish", lang),
      languages: { es: staticPath("publish", "es"), en: staticPath("publish", "en") },
    },
  };
}

/** Página pública de venta de notas (comunicados autoservicio). */
export default async function Publica({ params, searchParams }: Props) {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  const sp = await searchParams;
  const raw = typeof sp.estado === "string" ? sp.estado : undefined;
  const state = raw === "ok" ? "ok" : raw === "error" ? "error" : undefined;
  return <PublishPage lang={lang} dict={dict} state={state} />;
}
