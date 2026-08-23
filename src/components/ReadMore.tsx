import Link from "next/link";
import type { Lang } from "@/i18n/config";
import type { ArticleCard } from "@/lib/queries";
import { articlePath } from "@/lib/urls";

/**
 * Enlace interno dentro del cuerpo de la nota («Sigue leyendo»). Se pinta como bloque aparte, con
 * la etiqueta clara, para que el lector sepa que es otra nota nuestra y no parte del texto.
 */
export function ReadMore({
  article,
  lang,
  label,
}: {
  article: ArticleCard;
  lang: Lang;
  label: string;
}) {
  return (
    <aside className="my-6 rounded-xl border-l-4 border-accent bg-paper px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-display text-lg font-bold leading-snug">
        <Link
          href={articlePath(lang, article.sectionId, article.slug)}
          className="text-ink hover:underline"
        >
          {article.title}
        </Link>
      </p>
    </aside>
  );
}
