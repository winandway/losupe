import Link from "next/link";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { SECTIONS } from "@/lib/sections";
import {
  aboutPath,
  contactPath,
  homePath,
  rssPath,
  searchPath,
  sectionPath,
  staticPath,
} from "@/lib/urls";
import { Logo } from "./Logo";

export function Footer({ lang, dict, year }: { lang: Lang; dict: Dict; year?: number }) {
  const y = year ?? new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <Link href={homePath(lang)} aria-label={dict.brand.name}>
            <Logo id="losupe-mark-footer" />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">{dict.brand.description}</p>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            {dict.footer.sections}
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Link href={sectionPath(lang, s.id)} className="hover:underline">
                  {s.name[lang]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            {dict.footer.site}
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href={aboutPath(lang)} className="hover:underline">
                {dict.nav.about}
              </Link>
            </li>
            {/* Contacto visible: Google Noticias exige saber a quién se le escribe a un medio, y
                penaliza la opacidad. No es un enlace más del pie. */}
            <li>
              <Link href={contactPath(lang)} className="hover:underline">
                {dict.contact.title}
              </Link>
            </li>
            <li>
              <Link href={staticPath("widget", lang)} className="hover:underline">
                {dict.widget.title}
              </Link>
            </li>
            <li>
              <Link href={searchPath(lang)} className="hover:underline">
                {dict.nav.search}
              </Link>
            </li>
            <li>
              <Link href={staticPath("publish", lang)} className="font-semibold hover:underline">
                {dict.publish.nav}
              </Link>
            </li>
            <li>
              <a href={rssPath(lang)} className="hover:underline">
                {dict.footer.feeds}
              </a>
            </li>
            <li>
              <Link href={staticPath("editorial", lang)} className="hover:underline">
                {dict.footer.editorial}
              </Link>
            </li>
            <li>
              <Link href={staticPath("privacy", lang)} className="hover:underline">
                {dict.footer.privacy}
              </Link>
            </li>
            <li>
              <Link href={staticPath("terms", lang)} className="hover:underline">
                {dict.footer.terms}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-center text-xs text-muted">
          © {y} {dict.brand.domain} | {dict.footer.rights} {dict.footer.developedBy}{" "}
          <a
            href="https://windoce.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ink hover:text-coral"
          >
            Windoce LLC
          </a>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <Link href="/panel" className="hover:text-ink hover:underline" rel="nofollow">
            {dict.footer.panelLogin}
          </Link>
        </p>
      </div>
    </footer>
  );
}
