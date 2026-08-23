import type { Metadata } from "next";
import { z } from "zod";
import { ArticleCard } from "@/components/ArticleCard";
import { SearchForm } from "@/components/SearchForm";
import { getDict, toLang } from "@/i18n";
import { getDb } from "@/lib/db";
import { searchArticles } from "@/lib/queries";
import { searchPath } from "@/lib/urls";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

const querySchema = z.string().trim().min(2).max(80);

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const lang = toLang((await params).lang);
  const dict = getDict(lang);
  return {
    title: dict.search.title,
    robots: { index: false, follow: true },
    alternates: { canonical: searchPath(lang) },
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const lang = toLang((await params).lang);
  const dict = getDict(lang);
  const raw = (await searchParams).q;
  const parsed = querySchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  const q = parsed.success ? parsed.data : "";
  const typedSomething = typeof raw === "string" && raw.length > 0;

  const results = q ? await searchArticles(await getDb(), lang, q) : [];

  return (
    <>
      <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">{dict.search.title}</h1>
      <div className="mt-5 max-w-2xl">
        <SearchForm lang={lang} dict={dict} defaultValue={q} autoFocus={!q} />
        {typedSomething && !q ? <p className="mt-2 text-sm text-coral">{dict.search.hint}</p> : null}
      </div>

      {q ? (
        <section className="mt-10" aria-live="polite">
          <p className="mb-6 text-sm font-semibold text-muted">
            {results.length > 0 ? dict.search.results(results.length, q) : dict.search.none(q)}
          </p>
          {results.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((a) => (
                <ArticleCard key={a.id} article={a} lang={lang} dict={dict} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
