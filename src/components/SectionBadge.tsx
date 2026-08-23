import Link from "next/link";
import type { Lang } from "@/i18n/config";
import { getSection, type SectionId } from "@/lib/sections";
import { sectionPath } from "@/lib/urls";

export function SectionBadge({
  sectionId,
  lang,
  asLink = true,
  size = "sm",
}: {
  sectionId: SectionId;
  lang: Lang;
  asLink?: boolean;
  size?: "sm" | "md";
}) {
  const section = getSection(sectionId);
  if (!section) return null;
  const className = `inline-block rounded-full font-bold uppercase tracking-wide ${
    size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[10px]"
  }`;
  const style = { backgroundColor: section.color, color: section.onColor };
  if (!asLink) {
    return (
      <span className={className} style={style}>
        {section.name[lang]}
      </span>
    );
  }
  return (
    <Link href={sectionPath(lang, sectionId)} className={className} style={style}>
      {section.name[lang]}
    </Link>
  );
}
