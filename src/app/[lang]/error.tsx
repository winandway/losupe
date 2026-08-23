"use client";

import { Container } from "@/components/Container";
import { usePathname } from "next/navigation";

const TEXT = {
  es: {
    title: "Algo falló de nuestro lado",
    body: "Ya quedó registrado. Intenta de nuevo en unos segundos.",
    retry: "Reintentar",
    home: "Ir a la portada",
  },
  en: {
    title: "Something went wrong on our end",
    body: "It's been logged. Please try again in a few seconds.",
    retry: "Try again",
    home: "Go to the homepage",
  },
};

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() ?? "/es";
  const lang = pathname.startsWith("/en") ? "en" : "es";
  const t = TEXT[lang];
  return (
    <Container>
      <section className="mx-auto max-w-xl py-16 text-center">
        <p className="font-display text-7xl font-extrabold text-coral">500</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">{t.title}</h1>
        <p className="mt-3 text-muted">{t.body}</p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white hover:bg-ink-2"
          >
            {t.retry}
          </button>
          <a
            href={`/${lang}`}
            className="rounded-full border border-line px-6 py-3 text-sm font-bold text-ink hover:bg-paper"
          >
            {t.home}
          </a>
        </div>
      </section>
    </Container>
  );
}
