import { Container } from "@/components/Container";
import type { Metadata } from "next";
import { z } from "zod";
import { ArticleCard } from "@/components/ArticleCard";
import { SearchBox } from "@/components/SearchBox";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";
import { getDb } from "@/lib/db";
import { searchSmart } from "@/lib/search";
import { searchIndexGuard } from "@/lib/search-guard";
import { searchPath } from "@/lib/urls";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

const querySchema = z.string().trim().min(2).max(80);

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  return {
    title: dict.search.title,
    robots: { index: false, follow: true },
    alternates: { canonical: searchPath(lang) },
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  const raw = (await searchParams).q;
  const parsed = querySchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  const q = parsed.success ? parsed.data : "";
  const typedSomething = typeof raw === "string" && raw.length > 0;

  let results: Awaited<ReturnType<typeof searchSmart>> = [];
  if (q) {
    const db = await getDb();
    await searchIndexGuard.ensure(db);
    results = await searchSmart(db, lang, q, { limit: 30 });
  }

  return (
    <Container className="py-6 md:py-8">
      <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">{dict.search.title}</h1>
      <div className="mt-5 max-w-2xl">
        <SearchBox
          lang={lang}
          initialValue={q}
          autoFocus={!q}
          labels={{
            placeholder: dict.search.placeholder,
            button: dict.search.button,
            label: dict.search.label,
            seeAllTemplate: dict.search.seeAllTemplate,
            noneTemplate: dict.search.noneTemplate,
            close: dict.search.close,
          }}
        />
        {!q ? <p className="mt-2 text-sm text-muted">{dict.search.typing}</p> : null}
        {typedSomething && !q ? (
          <p className="mt-2 text-sm text-coral">{dict.search.hint}</p>
        ) : null}
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
    </Container>
  );
}
