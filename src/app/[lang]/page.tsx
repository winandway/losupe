import type { Metadata } from "next";
import { ArticleCard } from "@/components/ArticleCard";
import { Container } from "@/components/Container";
import { Boletin } from "@/components/Boletin";
import { HeroBanner } from "@/components/HeroBanner";
import { JsonLd } from "@/components/JsonLd";
import { SectionHeading } from "@/components/SectionHeading";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";
import { getDb } from "@/lib/db";
import { listLatest, listLatestPerSection } from "@/lib/queries";
import { SECTIONS } from "@/lib/sections";
import { itemListJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { getBaseUrl } from "@/lib/site";
import { searchPath, sectionPath } from "@/lib/urls";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  return {
    title: { absolute: `${dict.brand.name} — ${dict.brand.tagline}` },
    description: dict.brand.description,
  };
}

export default async function HomePage({ params, searchParams }: Props) {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  const sp = await searchParams;
  const boletin = typeof sp.boletin === "string" ? sp.boletin : undefined;
  const [db, base] = await Promise.all([getDb(), getBaseUrl()]);
  const [latest, perSectionRaw] = await Promise.all([
    listLatest(db, lang, { limit: 7 }),
    listLatestPerSection(db, lang, 6),
  ]);
  const [hero, ...rest] = latest;
  // Los bloques de sección no repiten lo que ya salió arriba (principal + «Lo último»).
  const shown = new Set(latest.map((a) => a.id));
  const perSection = Object.fromEntries(
    Object.entries(perSectionRaw).map(([id, items]) => [
      id,
      items.filter((a) => !shown.has(a.id)).slice(0, 3),
    ]),
  ) as typeof perSectionRaw;

  return (
    <>
      <JsonLd data={organizationJsonLd(base, dict.brand.name, dict.brand.description, lang)} />
      <JsonLd data={websiteJsonLd(base, lang, dict.brand.name, searchPath(lang))} />
      {latest.length > 0 ? (
        <JsonLd
          data={itemListJsonLd(
            base,
            lang,
            `${dict.brand.name} — ${dict.brand.tagline}`,
            latest.map((a) => ({ title: a.title, sectionId: a.sectionId, slug: a.slug })),
            `/${lang}`,
          )}
        />
      ) : null}

      <HeroBanner lang={lang} dict={dict} />

      <Container className="py-6 md:py-10">
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
          <section className="mt-10 md:mt-12" aria-label={dict.home.latest}>
            <SectionHeading title={dict.home.latest} />
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 [&>*+*]:border-t [&>*+*]:border-line [&>*+*]:pt-5 sm:[&>*+*]:border-0 sm:[&>*+*]:pt-0">
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
            <section key={s.id} className="mt-10 md:mt-12" aria-label={s.name[lang]}>
              <SectionHeading
                title={s.name[lang]}
                color={s.color}
                href={sectionPath(lang, s.id)}
                linkLabel={dict.home.viewAll}
                linkLabelShort={dict.home.more}
              />
              <div className="grid gap-5 md:grid-cols-3 md:gap-6 [&>*+*]:border-t [&>*+*]:border-line [&>*+*]:pt-5 md:[&>*+*]:border-0 md:[&>*+*]:pt-0">
                {items.map((a) => (
                  <ArticleCard key={a.id} article={a} lang={lang} dict={dict} variant="row" />
                ))}
              </div>
            </section>
          );
        })}

        <Boletin lang={lang} dict={dict} state={boletin} />
      </Container>
    </>
  );
}
