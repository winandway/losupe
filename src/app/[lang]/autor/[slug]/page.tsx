import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { Pagination } from "@/components/Pagination";
import { getDict, toLang } from "@/i18n";
import { getDb } from "@/lib/db";
import { getAuthor, listPaged } from "@/lib/queries";
import { authorPath } from "@/lib/urls";

type Props = {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = toLang(rawLang);
  const db = await getDb();
  const author = await getAuthor(db, slug, lang);
  if (!author) return {};
  return {
    title: author.name,
    description: author.bio ?? undefined,
    alternates: {
      canonical: authorPath(lang, author.id),
      languages: { es: authorPath("es", author.id), en: authorPath("en", author.id) },
    },
  };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { lang: rawLang, slug } = await params;
  const lang = toLang(rawLang);
  const dict = getDict(lang);
  const db = await getDb();
  const author = await getAuthor(db, slug, lang);
  if (!author) notFound();

  const rawPage = (await searchParams).page;
  const page = Math.max(1, Number.parseInt((Array.isArray(rawPage) ? rawPage[0] : rawPage) ?? "1", 10) || 1);
  const result = await listPaged(db, lang, page, { authorId: author.id });

  return (
    <>
      <header className="mb-10 flex items-start gap-5">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink font-display text-2xl font-bold text-accent"
        >
          {author.name.charAt(0)}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {author.kind === "newsroom" ? dict.author.newsroom : (author.role ?? "")}
          </p>
          <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">{author.name}</h1>
          {author.bio ? <p className="mt-2 max-w-2xl text-muted">{author.bio}</p> : null}
          <p className="mt-2 text-xs text-muted">{dict.section.count(result.total)}</p>
        </div>
      </header>

      <h2 className="mb-5 border-b-2 border-line pb-2 font-display text-2xl font-bold text-ink">
        {dict.author.articlesBy} {author.name}
      </h2>
      {result.items.length === 0 ? (
        <p className="rounded-2xl bg-paper px-6 py-10 text-center text-muted">{dict.section.empty}</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((a) => (
            <ArticleCard key={a.id} article={a} lang={lang} dict={dict} />
          ))}
        </div>
      )}
      <Pagination basePath={authorPath(lang, author.id)} page={result.page} pages={result.pages} dict={dict} />
    </>
  );
}
