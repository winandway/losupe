import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { FormularioContacto } from "@/components/FormularioContacto";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/robot/budget";
import { crearPase } from "@/lib/anti-bots";
import { safeJsonLd } from "@/lib/seo";
import { getBaseUrl } from "@/lib/site";
import { absoluteUrl, contactPath, staticPath } from "@/lib/urls";

type Props = { params: Promise<{ lang: string }> };

/** Correo público del medio. Configurable en el panel; si no está, se usa el del dominio. */
async function correoPublico(): Promise<string> {
  try {
    return (await getSetting(await getDb(), "contact_email")) || "contacto@losupe.com";
  } catch {
    return "contacto@losupe.com";
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  return {
    title: dict.contact.title,
    description: dict.contact.intro,
    alternates: {
      canonical: contactPath(lang),
      languages: {
        es: contactPath("es"),
        en: contactPath("en"),
        "x-default": contactPath("es"),
      },
    },
  };
}

export default async function ContactoPage({ params }: Props) {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  const c = dict.contact;
  const email = await correoPublico();
  const base = await getBaseUrl();

  // ContactPage: le dice a Google que esta es LA página de contacto del medio, no una cualquiera.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: c.title,
    url: absoluteUrl(base, contactPath(lang)),
    inLanguage: lang,
    isPartOf: { "@id": `${base}#organizacion` },
    mainEntity: {
      "@type": "Organization",
      "@id": `${base}#organizacion`,
      name: "losupe.com",
      email,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: lang === "en" ? "editorial" : "redacción",
        email,
        availableLanguage: ["es", "en"],
      },
    },
  };

  return (
    <Container className="py-6 md:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">{c.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">{c.intro}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-lg font-bold text-ink">{c.emailTitle}</h2>
            <a
              href={`mailto:${email}`}
              className="mt-1 inline-block break-all text-base font-semibold text-ink underline"
            >
              {email}
            </a>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-lg font-bold text-ink">{c.publisherTitle}</h2>
            <p className="mt-1 text-sm text-muted">{c.publisher}</p>
          </div>
        </div>

        <h2 className="mt-10 font-display text-2xl font-bold text-ink">{c.reasonsTitle}</h2>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-muted">
          {c.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <FormularioContacto
          pase={await crearPase(await getDb())}
          lang={lang}
          t={{
            name: c.name,
            email: c.email,
            subject: c.subject,
            message: c.message,
            send: c.send,
            sending: c.sending,
            thanks: c.thanks,
            invalid: c.invalid,
            mailDown: c.mailDown,
            namePlaceholder: c.namePlaceholder,
            emailPlaceholder: c.emailPlaceholder,
            subjectPlaceholder: c.subjectPlaceholder,
            messagePlaceholder: c.messagePlaceholder,
          }}
        />

        <h2 className="mt-10 font-display text-2xl font-bold text-ink">{c.whoTitle}</h2>
        <p className="mt-2 leading-relaxed text-muted">{c.who}</p>
        <p className="mt-4 text-sm">
          <a href={staticPath("editorial", lang)} className="font-semibold text-ink underline">
            {dict.footer.editorial}
          </a>
        </p>
      </article>
    </Container>
  );
}
