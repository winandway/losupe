"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LANGS, type Lang } from "@/i18n/config";
import { swapLangPath } from "@/lib/urls";

const FLAGS: Record<Lang, string> = { es: "🇪🇸", en: "🇺🇸" };
const SHORT: Record<Lang, string> = { es: "ES", en: "EN" };

export function LangSwitcher({
  lang,
  labels,
  groupLabel,
}: {
  lang: Lang;
  labels: Record<Lang, string>;
  groupLabel: string;
}) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const qs = searchParams?.toString();

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex items-center overflow-hidden rounded-full border border-line bg-white text-xs font-bold"
    >
      {LANGS.map((l) => {
        const active = l === lang;
        const href = l === lang ? pathname : `${swapLangPath(pathname, l)}${qs ? `?${qs}` : ""}`;
        return (
          <Link
            key={l}
            href={href}
            hrefLang={l}
            lang={l}
            aria-label={labels[l]}
            aria-current={active ? "true" : undefined}
            className={`flex items-center gap-1 px-2.5 py-1.5 transition ${
              active ? "bg-ink text-white" : "text-ink hover:bg-paper"
            }`}
          >
            <span aria-hidden="true">{FLAGS[l]}</span>
            <span>{SHORT[l]}</span>
          </Link>
        );
      })}
    </div>
  );
}
