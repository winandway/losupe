import Link from "next/link";
import { Container } from "@/components/Container";
import type { Metadata } from "next";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";
import { getDb } from "@/lib/db";
import { listWriters } from "@/lib/queries";
import { aboutPath, authorPath } from "@/lib/urls";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  return {
    title: dict.about.title,
    description: dict.about.intro,
    alternates: {
      canonical: aboutPath(lang),
      languages: { es: aboutPath("es"), en: aboutPath("en"), "x-default": aboutPath("es") },
    },
  };
}

export default async function AboutPage({ params }: Props) {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  const writers = await listWriters(await getDb(), lang);
  return (
    <Container className="py-6 md:py-8">
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">{dict.about.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">{dict.about.intro}</p>

        <h2 className="mt-12 font-display text-2xl font-bold text-ink">{dict.about.teamTitle}</h2>
        <p className="mt-2 text-muted">{dict.about.teamIntro}</p>
        <ul className="mt-5 grid gap-5 sm:grid-cols-2">
          {writers.map((w) => (
            <li key={w.id} className="flex gap-4 rounded-2xl border border-line bg-white p-4">
              {w.avatarUrl ? (
                <img
                  src={w.avatarUrl}
                  alt={w.name}
                  width={72}
                  height={72}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-accent"
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-display text-lg font-bold leading-tight text-ink">
                  <Link href={authorPath(lang, w.id)} className="hover:underline">
                    {w.name}
                  </Link>
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{w.role}</p>
                {w.bio ? <p className="mt-1.5 line-clamp-4 text-sm text-muted">{w.bio}</p> : null}
              </div>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 font-display text-2xl font-bold text-ink">
          {dict.about.principlesTitle}
        </h2>
        <ul className="mt-4 space-y-3">
          {dict.about.principles.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-ink"
              >
                {i + 1}
              </span>
              <span className="leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 font-display text-2xl font-bold text-ink">{dict.about.aiTitle}</h2>
        <p className="mt-3 leading-relaxed">{dict.about.aiBody}</p>

        <h2 className="mt-10 font-display text-2xl font-bold text-ink">{dict.about.originTitle}</h2>
        <p className="mt-3 leading-relaxed">{dict.about.originBody}</p>
      </article>
    </Container>
  );
}
