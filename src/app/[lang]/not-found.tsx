import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import { getDict, toLang } from "@/i18n";
import { homePath } from "@/lib/urls";

export default async function NotFound() {
  const lang = toLang(await rootLang());
  const dict = getDict(lang);
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <p className="font-display text-7xl font-extrabold text-accent">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">{dict.notFound.title}</h1>
      <p className="mt-3 text-muted">{dict.notFound.body}</p>
      <Link
        href={homePath(lang)}
        className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white hover:bg-ink-2"
      >
        {dict.notFound.back}
      </Link>
    </section>
  );
}
