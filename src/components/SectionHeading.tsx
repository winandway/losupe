import Link from "next/link";

export function SectionHeading({
  title,
  color,
  href,
  linkLabel,
  as: Tag = "h2",
}: {
  title: string;
  color?: string;
  href?: string;
  linkLabel?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-line pb-2">
      <Tag className="flex items-center gap-3 font-display text-2xl font-bold text-ink">
        {color ? (
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-sm"
            style={{ backgroundColor: color }}
          />
        ) : null}
        {title}
      </Tag>
      {href && linkLabel ? (
        <Link href={href} className="shrink-0 text-sm font-semibold text-ink hover:underline">
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}
