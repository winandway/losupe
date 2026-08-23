import Link from "next/link";

export function SectionHeading({
  title,
  color,
  href,
  linkLabel,
  linkLabelShort,
  as: Tag = "h2",
}: {
  title: string;
  color?: string;
  href?: string;
  linkLabel?: string;
  /** Versión corta del enlace para pantallas chicas (p. ej. «Ver más»). */
  linkLabelShort?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 border-b-2 border-line pb-2 md:mb-5 md:gap-4">
      <Tag className="flex min-w-0 items-center gap-2.5 font-display text-xl font-bold leading-tight text-ink md:gap-3 md:text-2xl">
        {color ? (
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm md:h-4 md:w-4"
            style={{ backgroundColor: color }}
          />
        ) : null}
        <span className="min-w-0">{title}</span>
      </Tag>
      {href && linkLabel ? (
        <Link
          href={href}
          className="shrink-0 whitespace-nowrap text-xs font-semibold text-ink hover:underline md:text-sm"
        >
          {linkLabelShort ? (
            <>
              <span className="sm:hidden">{linkLabelShort}</span>
              <span className="hidden sm:inline">{linkLabel}</span>
            </>
          ) : (
            linkLabel
          )}{" "}
          →
        </Link>
      ) : null}
    </div>
  );
}
