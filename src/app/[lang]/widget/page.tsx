import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { VistaPreviaWidget } from "@/components/VistaPreviaWidget";
import { getDict } from "@/i18n";
import { requireLang } from "@/lib/params";
import { SECTIONS } from "@/lib/sections";
import { getBaseUrl } from "@/lib/site";
import { staticPath } from "@/lib/urls";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await requireLang(params);
  const d = getDict(lang).widget;
  return {
    title: d.title,
    description: d.intro,
    alternates: {
      canonical: staticPath("widget", lang),
      languages: {
        es: staticPath("widget", "es"),
        en: staticPath("widget", "en"),
        "x-default": staticPath("widget", "es"),
      },
    },
  };
}

/**
 * La página donde cualquiera copia el código para mostrar nuestras notas en su sitio.
 *
 * Es la idea nº 5 del plan de ingresos, de Richard: cuanto más fácil sea pegarlo, en más sitios
 * acaba — y cada sitio son visitas nuevas y un enlace desde otro dominio, que es lo que más pesa
 * para el posicionamiento.
 */
export default async function WidgetPage({ params }: Props) {
  const lang = await requireLang(params);
  const dict = getDict(lang);
  const d = dict.widget;
  const base = await getBaseUrl();
  const codigo = `<script src="${base}/datos/widget?lang=${lang}" async></script>`;

  return (
    <Container className="py-6 md:py-8">
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">{d.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">{d.intro}</p>

        <h2 className="mt-10 font-display text-2xl font-bold text-ink">{d.howTitle}</h2>
        <p className="mt-2 text-muted">{d.howBody}</p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-5 text-sm text-white">
          <code>{codigo}</code>
        </pre>

        <h2 className="mt-10 font-display text-2xl font-bold text-ink">{d.optionsTitle}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-bold">{d.option}</th>
                <th className="py-2 pr-4 font-bold">{d.values}</th>
                <th className="py-2 font-bold">{d.what}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { o: "lang", v: "es · en", q: d.optLang },
                { o: "n", v: "1 – 10", q: d.optN },
                { o: "tema", v: "claro · oscuro", q: d.optTheme },
                { o: "seccion", v: SECTIONS.map((s) => s.id).join(" · "), q: d.optSection },
              ].map((r) => (
                <tr key={r.o} className="border-b border-line/60">
                  <td className="py-2 pr-4 font-mono font-semibold text-ink">{r.o}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted">{r.v}</td>
                  <td className="py-2 text-muted">{r.q}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-paper p-5 text-sm text-ink">
          <code>{`<script src="${base}/datos/widget?lang=${lang}&seccion=cripto&n=3&tema=oscuro" async></script>`}</code>
        </pre>

        <h2 className="mt-10 font-display text-2xl font-bold text-ink">{d.previewTitle}</h2>
        <p className="mt-2 text-sm text-muted">{d.previewBody}</p>
        <VistaPreviaWidget lang={lang} n={3} />

        <h2 className="mt-10 font-display text-2xl font-bold text-ink">{d.rulesTitle}</h2>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-muted">
          {d.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">{d.slotTip}</p>
        <pre className="mt-2 overflow-x-auto rounded-2xl bg-paper p-4 text-xs text-ink">
          <code>{`<div data-losupe-aqui></div>`}</code>
        </pre>
      </article>
    </Container>
  );
}
