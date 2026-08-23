import type { Metadata } from "next";
import { ArticleCard } from "@/components/ArticleCard";
import { Container } from "@/components/Container";
import { HeroBanner } from "@/components/HeroBanner";
import { JsonLd } from "@/components/JsonLd";
import { SectionHeading } from "@/components/SectionHeading";
import { getDict, toLang } from "@/i18n";
import { getDb } from "@/lib/db";
import { listLatest, listLatestPerSection } from "@/lib/queries";
import { SECTIONS } from "@/lib/sections";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { getBaseUrl } from "@/lib/site";
import { searchPath, sectionPath } from "@/lib/urls";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = toLang((await params).lang);
  const dict = getDict(lang);
  return {
    title: { absolute: `${dict.brand.name} — ${dict.brand.tagline}` },
    description: dict.brand.description,
  };
}

export default async function HomePage({ params }: Props) {
  const lang = toLang((await params).lang);
  const dict = getDict(lang);
  const [db, base] = await Promise.all([getDb(), getBaseUrl()]);
  const [latest, perSection] = await Promise.all([
    listLatest(db, lang, { limit: 7 }),
    listLatestPerSection(db, lang, 3),
  ]);
  const [hero, ...rest] = latest;

  return (
    <>
      <JsonLd data={organizationJsonLd(base, dict.brand.name, dict.brand.description)} />
      <JsonLd data={websiteJsonLd(base, lang, dict.brand.name, searchPath(lang))} />

      <HeroBanner lang={lang} dict={dict} />

      <Container className="py-8 md:py-10">
        {hero ? (
          <section aria-label={dict.home.topStory}>
            <ArticleCard article={hero} lang={lang} dict={dict} variant="hero" priority />
          </section>
        ) : (
          <section className="rounded-2xl bg-paper px-6 py-10 text-center">
            <p className="text-muted">{dict.home.empty}</p>
          </section>
        )}

        {rest.length > 0 ? (
          <section className="mt-12" aria-label={dict.home.latest}>
            <SectionHeading title={dict.home.latest} />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <ArticleCard key={a.id} article={a} lang={lang} dict={dict} />
              ))}
            </div>
          </section>
        ) : null}

        {SECTIONS.map((s) => {
          const items = perSection[s.id];
          if (!items || items.length === 0) return null;
          return (
            <section key={s.id} className="mt-12" aria-label={s.name[lang]}>
              <SectionHeading
                title={s.name[lang]}
                color={s.color}
                href={sectionPath(lang, s.id)}
                linkLabel={dict.home.viewAll}
              />
              <div className="grid gap-6 md:grid-cols-3">
                {items.map((a) => (
                  <ArticleCard key={a.id} article={a} lang={lang} dict={dict} variant="row" />
                ))}
              </div>
            </section>
          );
        })}
      </Container>
    </>
  );
}
