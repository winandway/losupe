import { notFound } from "next/navigation";
import { isLang, type Lang } from "@/i18n/config";

/** Idioma de la ruta o 404 limpio. Evita que /cualquier-cosa se sirva como portada (soft-404). */
export async function requireLang(params: Promise<{ lang: string }>): Promise<Lang> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return lang;
}
