import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { formatDate, nowIso } from "@/lib/dates";
import { SearchForm } from "./SearchForm";

export const HERO_VIDEO = "/video/hero.mp4";
export const HERO_POSTER = "/video/hero-poster.jpg";

/** Franja de video a todo lo ancho con la promesa del medio y el buscador grande. */
export function HeroBanner({ lang, dict }: { lang: Lang; dict: Dict }) {
  return (
    <section
      aria-label={dict.hero.title}
      className="relative h-[240px] w-full overflow-hidden bg-ink md:h-[300px] lg:h-[320px]"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={HERO_POSTER}
        title={dict.hero.videoTitle}
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>
      <img
        src={HERO_POSTER}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 hidden h-full w-full object-cover motion-reduce:block"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/10 md:bg-gradient-to-r md:from-ink/90 md:via-ink/60 md:to-ink/20"
      />
      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
          {dict.hero.kicker} · {formatDate(nowIso(), lang)}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight text-white md:text-5xl">
          {dict.hero.title}
        </h1>
        <p className="mt-1 hidden max-w-xl text-sm text-white/80 md:block md:text-base">
          {dict.hero.subtitle}
        </p>
        <div className="mt-4 max-w-2xl">
          <SearchForm lang={lang} dict={dict} size="lg" placeholder={dict.hero.searchPlaceholder} />
        </div>
      </div>
    </section>
  );
}
