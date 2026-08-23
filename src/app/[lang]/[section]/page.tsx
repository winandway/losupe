import { Container } from "@/components/Container";
import { JsonLd } from "@/components/JsonLd";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { Pagination } from "@/components/Pagination";
import { SectionHeading } from "@/components/SectionHeading";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";
import { getDb } from "@/lib/db";
import { listPaged } from "@/lib/queries";
import { sectionByAnySlug, sectionBySlug } from "@/lib/sections";
import { breadcrumbJsonLd, itemListJsonLd, sectionAlternates } from "@/lib/seo";
import { getBaseUrl } from "@/lib/site";
import { homePath, sectionPath } from "@/lib/urls";

type Props = {
  params: Promise<{ lang: string; section: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const lang = await requireLang(params);
  const { section: slug } = await params;
  const section = sectionBySlug(lang, slug);
  if (!section) return {};
  return {
    title: section.name[lang],
    description: section.description[lang],
    alternates: {
      canonical: sectionPath(lang, section.id),
      languages: sectionAlternates(section.id),
    },
    openGraph: { title: section.name[lang], description: section.description[lang] },
  };
}

export default async function SectionPage({ params, searchParams }: Props) {
  const lang = await requireLang(params);
  const { section: slug } = await params;
  const dict = getDict(lang);

  const section = sectionBySlug(lang, slug);
  if (!section) {
    // ¿Es el slug de la sección en el otro idioma? Redirige al correcto.
    const other = sectionByAnySlug(slug);
    if (other) permanentRedirect(sectionPath(lang, other.section.id));
    notFound();
  }

  const page = parsePage((await searchParams).page);
  const db = await getDb();
  const result = await listPaged(db, lang, page, { sectionId: section.id });
  if (page > 1 && result.items.length === 0) notFound();

  const base = await getBaseUrl();

  return (
    <Container className="py-6 md:py-8">
      {page === 1 && result.items.length > 0 ? (
        <>
          <JsonLd
            data={itemListJsonLd(
              base,
              lang,
              section.name[lang],
              result.items.map((a) => ({ title: a.title, sectionId: a.sectionId, slug: a.slug })),
              sectionPath(lang, section.id),
            )}
          />
          <JsonLd
            data={breadcrumbJsonLd(base, lang, [
              { name: dict.nav.home, path: homePath(lang) },
              { name: section.name[lang], path: sectionPath(lang, section.id) },
            ])}
          />
        </>
      ) : null}
      <header className="mb-8">
        <SectionHeading as="h1" title={section.name[lang]} color={section.color} />
        <p className="max-w-2xl text-muted">{section.description[lang]}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted">
          {dict.section.count(result.total)}
        </p>
      </header>

      {result.items.length === 0 ? (
        <p className="rounded-2xl bg-paper px-6 py-10 text-center text-muted">
          {dict.section.empty}
        </p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((a, i) => (
            <ArticleCard key={a.id} article={a} lang={lang} dict={dict} priority={i < 3} />
          ))}
        </div>
      )}

      <Pagination
        basePath={sectionPath(lang, section.id)}
        page={result.page}
        pages={result.pages}
        dict={dict}
      />
    </Container>
  );
}
