import type { Metadata } from "next";
import { PaginaNoEncontrada } from "@/components/PaginaNoEncontrada";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";

/**
 * La página 404 hecha desde el servidor (candado 59). El worker la sirve, con estado 404, en lugar del
 * cascarón vacío que Next 16 manda cuando una página llama a `notFound()`. Nunca se indexa.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const dict = getDict(await requireLang(params));
  return {
    title: dict.notFound.title,
    robots: { index: false, follow: true },
    alternates: { canonical: null, languages: {} },
  };
}

export default async function Error404({ params }: { params: Promise<{ lang: string }> }) {
  return <PaginaNoEncontrada lang={await requireLang(params)} />;
}
