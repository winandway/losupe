import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { formatDate, nowIso } from "@/lib/dates";
import { HeroVideo } from "./HeroVideo";
import { SearchBox } from "./SearchBox";

export const HERO_VIDEO = "/video/hero-v2.mp4";
export const HERO_VIDEO_MOBILE = "/video/hero-v2-m.mp4";
export const HERO_POSTER = "/video/hero-v2-poster.jpg";

/** Franja de video a todo lo ancho con la promesa del medio y el buscador grande. */
export function HeroBanner({ lang, dict }: { lang: Lang; dict: Dict }) {
  return (
    <section
      aria-label={dict.hero.title}
      className="relative h-[240px] w-full bg-ink md:h-[300px] lg:h-[320px]"
    >
      {/* Capas de fondo recortadas; el contenido (y el desplegable del buscador) queda libre. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <img
          src={HERO_POSTER}
          alt=""
          width={1280}
          height={427}
          fetchPriority="low"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <HeroVideo
          src={HERO_VIDEO}
          mobileSrc={HERO_VIDEO_MOBILE}
          poster={HERO_POSTER}
          title={dict.hero.videoTitle}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/10 md:bg-gradient-to-r md:from-ink/90 md:via-ink/60 md:to-ink/20" />
      </div>
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
          <SearchBox
            lang={lang}
            size="lg"
            labels={{
              placeholder: dict.hero.searchPlaceholder,
              button: dict.search.button,
              label: dict.search.label,
              seeAllTemplate: dict.search.seeAllTemplate,
              noneTemplate: dict.search.noneTemplate,
              close: dict.search.close,
              hint: dict.search.typing,
            }}
          />
        </div>
      </div>
    </section>
  );
}
