import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { Byline } from "@/components/Byline";
import { JsonLd } from "@/components/JsonLd";
import { Prose } from "@/components/Prose";
import { SectionBadge } from "@/components/SectionBadge";
import { SectionHeading } from "@/components/SectionHeading";
import { ShareLinks } from "@/components/ShareLinks";
import { getDict, toLang, otherLang } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { getArticleBySlug, listRelated, type ArticleFull } from "@/lib/queries";
import { getSection, sectionByAnySlug } from "@/lib/sections";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { getBaseUrl } from "@/lib/site";
import { absoluteUrl, articlePath, homePath, sectionPath } from "@/lib/urls";

type Props = { params: Promise<{ lang: string; section: string; slug: string }> };

async function load(params: Props["params"]) {
  const { lang: rawLang, section: sectionSlug, slug } = await params;
  const lang = toLang(rawLang);
  const db = await getDb();
  const article = await getArticleBySlug(db, lang, decodeURIComponent(slug));
  return { lang, sectionSlug, slug, db, article };
}

function canonicalPathFor(lang: ReturnType<typeof toLang>, article: ArticleFull): string {
  const slugInLang = article.translations[lang] ?? article.slug;
  return articlePath(lang, article.sectionId, slugInLang);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, article } = await load(params);
  if (!article) return {};
  const dict = getDict(lang);
  const canonical = canonicalPathFor(lang, article);
  const languages: Record<string, string> = {};
  if (article.translations.es) languages.es = articlePath("es", article.sectionId, article.translations.es);
  if (article.translations.en) languages.en = articlePath("en", article.sectionId, article.translations.en);
  if (languages.es) languages["x-default"] = languages.es;
  const description = article.metaDescription ?? article.excerpt;
  return {
    title: article.metaTitle ?? article.title,
    description,
    alternates: { canonical, languages },
    // Sin traducción todavía: la página en el otro idioma muestra el español y no se indexa aparte.
    robots: article.fallback ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: canonical,
      locale: dict.ogLocale,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.authorName],
      section: getSection(article.sectionId)?.name[lang],
      tags: article.tags,
      images: article.imageUrl ? [{ url: article.imageUrl, alt: article.imageAlt }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.imageUrl ? [article.imageUrl] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { lang, sectionSlug, slug, db, article } = await load(params);
  if (!article) notFound();

  // URL canónica: sección correcta para el idioma y slug traducido si existe.
  const expectedPath = canonicalPathFor(lang, article);
  const currentSection = sectionByAnySlug(sectionSlug);
  const currentPath = currentSection
    ? `/${lang}/${sectionSlug}/${encodeURIComponent(decodeURIComponent(slug))}`
    : null;
  if (currentPath !== expectedPath) permanentRedirect(expectedPath);

  const dict = getDict(lang);
  const section = getSection(article.sectionId);
  const base = await getBaseUrl();
  const url = absoluteUrl(base, expectedPath);
  const related = await listRelated(db, lang, article.sectionId, article.id, 4);
  const showLegacy = article.origin === "mundoscrypto";

  return (
    <>
      <JsonLd data={articleJsonLd(base, lang, article, dict.brand.name)} />
      <JsonLd
        data={breadcrumbJsonLd(base, lang, [
          { name: dict.nav.home, path: homePath(lang) },
          { name: section?.name[lang] ?? article.sectionId, path: sectionPath(lang, article.sectionId) },
          { name: article.title, path: expectedPath },
        ])}
      />

      <article className="mx-auto max-w-3xl">
        <nav aria-label="breadcrumb" className="mb-4 text-xs text-muted">
          <Link href={homePath(lang)} className="hover:underline">
            {dict.nav.home}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href={sectionPath(lang, article.sectionId)} className="hover:underline">
            {section?.name[lang]}
          </Link>
        </nav>

        <header>
          <SectionBadge sectionId={article.sectionId} lang={lang} size="md" />
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-ink md:text-5xl">
            {article.title}
          </h1>
          {article.excerpt ? (
            <p className="mt-4 text-lg leading-relaxed text-muted">{article.excerpt}</p>
          ) : null}
          <div className="mt-5 flex flex-col gap-3 border-y border-line py-3 md:flex-row md:items-center md:justify-between">
            <Byline
              lang={lang}
              dict={dict}
              authorId={article.authorId}
              authorName={article.authorName}
              publishedAt={article.publishedAt}
              readingMinutes={article.readingMinutes}
            />
            <ShareLinks url={url} title={article.title} dict={dict} />
          </div>
        </header>

        {article.fallback ? (
          <p className="mt-5 rounded-xl border border-accent bg-accent/15 px-4 py-3 text-sm text-ink">
            {dict.article.fallbackNotice}{" "}
            <Link
              href={articlePath(otherLang(lang), article.sectionId, article.slug)}
              className="font-semibold underline"
            >
              {dict.languages[otherLang(lang)]} →
            </Link>
          </p>
        ) : null}

        {article.imageUrl ? (
          <figure className="mt-6">
            <img
              src={article.imageUrl}
              alt={article.imageAlt}
              fetchPriority="high"
              decoding="async"
              className="aspect-video w-full rounded-2xl object-cover"
            />
            {article.imageCredit ? (
              <figcaption className="mt-2 text-xs text-muted">{article.imageCredit}</figcaption>
            ) : null}
          </figure>
        ) : null}

        <div className="mt-8">
          <Prose html={article.contentHtml} />
        </div>

        {article.sources.length > 0 ? (
          <section className="mt-10 rounded-2xl bg-paper p-5" aria-label={dict.article.sources}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
              {dict.article.sources}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {article.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-ink underline hover:text-coral"
                  >
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {article.tags.length > 0 ? (
          <p className="mt-6 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold uppercase tracking-widest text-muted">{dict.article.tags}</span>
            {article.tags.map((t) => (
              <span key={t} className="rounded-full bg-paper px-3 py-1 text-ink">
                {t}
              </span>
            ))}
          </p>
        ) : null}

        <footer className="mt-8 space-y-2 border-t border-line pt-4 text-xs text-muted">
          {article.aiAssisted ? <p>{dict.article.aiNotice}</p> : null}
          {showLegacy ? <p>{dict.article.legacyNotice}</p> : null}
          {article.updatedAt !== article.publishedAt ? (
            <p>
              {dict.article.updated}: {formatDate(article.updatedAt, lang)}
            </p>
          ) : null}
        </footer>
      </article>

      {related.length > 0 ? (
        <section className="mx-auto mt-14 max-w-5xl" aria-label={dict.article.related}>
          <SectionHeading
            title={dict.article.related}
            color={section?.color}
            href={sectionPath(lang, article.sectionId)}
            linkLabel={dict.home.viewAll}
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} lang={lang} dict={dict} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
