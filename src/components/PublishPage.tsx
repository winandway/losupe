import Link from "next/link";
import { CampoPase } from "@/components/CampoPase";
import { Container } from "@/components/Container";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { PLANS, type PlanId } from "@/lib/orders";
import { SECTIONS } from "@/lib/sections";
import { homePath } from "@/lib/urls";

const field =
  "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent";

/**
 * Página pública de venta: «Publica tu noticia». El pedido va a /datos/pedido (sin JavaScript
 * también funciona) y aparece en Panel → Pedidos.
 */
export async function PublishPage({
  lang,
  dict,
  state,
}: {
  lang: Lang;
  dict: Dict;
  state?: "ok" | "error";
}) {
  const p = dict.publish;
  const planOrder: PlanId[] = ["basica", "destacada", "paquete", "anual"];

  if (state === "ok") {
    return (
      <Container className="py-12 md:py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-mint bg-mint/10 p-8 text-center">
          <h1 className="font-display text-3xl font-bold text-ink">{p.okTitle}</h1>
          <p className="mt-3 text-muted">{p.okBody}</p>
          <Link
            href={homePath(lang)}
            className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white"
          >
            {p.okBack}
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold leading-tight text-ink md:text-5xl">
          {p.title}
        </h1>
        <p className="mt-4 text-lg text-muted">{p.subtitle}</p>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold text-ink">{p.howTitle}</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {p.steps.map((step, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-line bg-white p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-ink">
                  {i + 1}
                </span>
                <span className="text-sm text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold text-ink">{p.plansTitle}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {planOrder.map((id) => {
              const plan = PLANS[id];
              const featured = id === "destacada";
              return (
                <div
                  key={id}
                  className={`rounded-2xl bg-white p-5 ${featured ? "border-2 border-accent" : "border border-line"}`}
                >
                  {featured ? (
                    <span className="mb-2 inline-block rounded-full bg-accent px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink">
                      {p.popular}
                    </span>
                  ) : null}
                  <h3 className="font-display text-xl font-bold text-ink">{p.plans[id].name}</h3>
                  <p className="mt-1 text-3xl font-bold text-ink">
                    ${plan.priceUsd}
                    <span className="ml-1 text-sm font-semibold text-muted">
                      {plan.notes > 1 ? `· ${plan.notes} ${p.notes}` : `· 1 ${p.perNote}`}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-muted">{p.plans[id].detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="pedido" className="mt-12 rounded-2xl border border-line bg-paper p-5 md:p-7">
          <h2 className="font-display text-2xl font-bold text-ink">{p.formTitle}</h2>
          {state === "error" ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-coral bg-coral/10 px-4 py-3 text-sm font-semibold text-ink"
            >
              <strong>{p.errorTitle}.</strong> {p.errorBody}
            </p>
          ) : null}
          <form action="/datos/pedido" method="post" className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Pase firmado y trampa: es el formulario más goloso para el spam, porque aquí se
                pide un servicio de pago. Ver src/lib/anti-bots.ts. */}
            <CampoPase />
            <input type="hidden" name="lang" value={lang} />
            <label className="block text-sm font-semibold text-ink">
              {p.company}
              <input name="company" required maxLength={120} className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink">
              {p.website}
              <input name="website" type="url" required placeholder="https://" className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink">
              {p.contactName}
              <input name="contactName" maxLength={120} className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink">
              {p.email}
              <input name="email" type="email" required maxLength={200} className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink">
              {p.phone}
              <input name="phone" maxLength={40} className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink">
              {p.plan}
              <select name="plan" defaultValue="destacada" className={field}>
                {planOrder.map((id) => (
                  <option key={id} value={id}>
                    {p.plans[id].name} — ${PLANS[id].priceUsd}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-ink">
              {p.section}
              <select name="sectionId" defaultValue="ventas" className={field}>
                {SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name[lang]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-ink">
              {p.lang}
              <select name="mainLang" defaultValue={lang} className={field}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-ink sm:col-span-2">
              {p.brief}
              <textarea name="brief" rows={4} maxLength={4000} className={field} />
              <span className="mt-1 block text-xs font-normal text-muted">{p.briefHint}</span>
            </label>
            <label className="block text-sm font-semibold text-ink sm:col-span-2">
              {p.ideas}
              <textarea name="ideas" rows={3} maxLength={4000} className={field} />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-full bg-accent px-6 py-3 text-base font-extrabold uppercase tracking-wide text-ink hover:brightness-95 sm:w-auto"
              >
                {p.submit}
              </button>
              <p className="mt-3 text-xs text-muted">{p.legal}</p>
            </div>
          </form>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold text-ink">{p.faqTitle}</h2>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {p.faq.map((item, i) => (
              <div key={i} className="py-4">
                <dt className="font-semibold text-ink">{item.q}</dt>
                <dd className="mt-1 text-sm text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Container>
  );
}
