import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { Container } from "./Container";

export type LegalKind = "editorial" | "privacy" | "terms";

export function LegalPage({ lang, dict, kind }: { lang: Lang; dict: Dict; kind: LegalKind }) {
  const doc = dict.legal[kind];
  return (
    <Container className="py-6 md:py-8">
      <article className="mx-auto max-w-3xl" lang={lang}>
        <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">{doc.title}</h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted">
          {dict.legal.updated}
        </p>
        <p className="mt-5 text-lg leading-relaxed text-muted">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="font-display text-2xl font-bold text-ink">{s.h}</h2>
            {s.p.map((para, i) => (
              <p key={i} className="mt-3 leading-relaxed">
                {para}
              </p>
            ))}
          </section>
        ))}
        <p className="mt-10 rounded-2xl bg-paper p-5 text-sm text-muted">{dict.legal.contact}</p>
      </article>
    </Container>
  );
}
