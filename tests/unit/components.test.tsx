import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { ArticleCard } from "@/components/ArticleCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { HeroBanner } from "@/components/HeroBanner";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Pagination } from "@/components/Pagination";
import { SearchBox } from "@/components/SearchBox";
import { SectionBadge } from "@/components/SectionBadge";
import { Byline } from "@/components/Byline";
import { Prose } from "@/components/Prose";
import { ShareLinks } from "@/components/ShareLinks";
import { JsonLd } from "@/components/JsonLd";
import { SectionHeading } from "@/components/SectionHeading";
import { mapCard } from "@/lib/queries";
import { sampleCardRow } from "./fake-d1";

vi.mock("next/navigation", () => ({
  usePathname: () => "/es/economia",
  useSearchParams: () => new URLSearchParams("page=2"),
  useRouter: () => ({ push: vi.fn() }),
}));

const article = mapCard(sampleCardRow, "es");

describe("ArticleCard", () => {
  it("enlaza al artículo en la sección correcta (tarjeta)", () => {
    const { container } = render(<ArticleCard article={article} lang="es" dict={es} />);
    const link = screen.getByRole("link", { name: "Bitcoin sube" });
    expect(link).toHaveAttribute("href", "/es/cripto/bitcoin-sube");
    // La foto enlaza igual pero va oculta al lector de pantalla (el titular ya es el enlace)
    expect(container.querySelector("img")).toHaveAttribute("alt", "Bitcoin");
    expect(container.querySelector("a[aria-hidden='true']")).toHaveAttribute(
      "href",
      "/es/cripto/bitcoin-sube",
    );
  });
  it("variantes hero y fila, y sin imagen", () => {
    const { rerender } = render(
      <ArticleCard article={article} lang="en" dict={en} variant="hero" priority />,
    );
    expect(screen.getByRole("link", { name: "Bitcoin sube" })).toHaveAttribute(
      "href",
      "/en/crypto/bitcoin-sube",
    );
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
    rerender(
      <ArticleCard article={{ ...article, imageUrl: null }} lang="es" dict={es} variant="row" />,
    );
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("Footer", () => {
  it("lleva el crédito de Windoce LLC con enlace en pestaña nueva", () => {
    render(<Footer lang="es" dict={es} year={2026} />);
    const credit = screen.getByRole("link", { name: "Windoce LLC" });
    expect(credit).toHaveAttribute("href", "https://windoce.com");
    expect(credit).toHaveAttribute("target", "_blank");
    expect(credit).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/© 2026 losupe.com \| All rights reserved\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Economía" })).toHaveAttribute("href", "/es/economia");
  });
});

describe("Header, botonera y selector de idioma", () => {
  it("muestra portada, las cinco secciones, acerca, el buscador y las dos banderas", () => {
    render(<Header lang="es" dict={es} />);
    expect(screen.getByRole("link", { name: "Portada" })).toHaveAttribute("href", "/es");
    expect(screen.getByRole("link", { name: "Cripto" })).toHaveAttribute("href", "/es/cripto");
    // usePathname simulado = /es/economia → Economía activa en la botonera
    expect(screen.getByRole("link", { name: "Economía" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Portada" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Acerca de losupe" })).toHaveAttribute(
      "href",
      "/es/acerca",
    );
    expect(screen.getByRole("link", { name: "Buscar" })).toHaveAttribute("href", "/es/buscar");
    const english = screen.getByRole("link", { name: "English" });
    expect(english).toHaveAttribute("href", "/en/economy?page=2");
    expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute("aria-current", "true");
  });
  it("HeroBanner trae el póster del video y el buscador grande", () => {
    const { container } = render(<HeroBanner lang="en" dict={en} />);
    // El video se carga después del evento load (componente cliente); el póster va de una.
    expect(container.querySelector('img[src="/video/hero-v2-poster.jpg"]')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "What's happening, explained.",
    );
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/en/search");
    expect(screen.getByPlaceholderText("What do you want to know today?")).toBeInTheDocument();
  });
  it("LangSwitcher marca el idioma activo", () => {
    render(<LangSwitcher lang="en" labels={en.languages} groupLabel="Language" />);
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
      "href",
      "/es/economia?page=2",
    );
  });
});

describe("piezas pequeñas", () => {
  it("Pagination", () => {
    const { container, rerender } = render(
      <Pagination basePath="/es/cripto" page={1} pages={1} dict={es} />,
    );
    expect(container.innerHTML).toBe("");
    rerender(<Pagination basePath="/es/cripto" page={2} pages={3} dict={es} />);
    expect(screen.getByRole("link", { name: /Anteriores/ })).toHaveAttribute("href", "/es/cripto");
    expect(screen.getByRole("link", { name: /Siguientes/ })).toHaveAttribute(
      "href",
      "/es/cripto?page=3",
    );
  });
  it("SearchBox apunta a la ruta del idioma y funciona como formulario", () => {
    const labels = {
      placeholder: en.search.placeholder,
      button: en.search.button,
      label: en.search.label,
      seeAllTemplate: en.search.seeAllTemplate,
      noneTemplate: en.search.noneTemplate,
      close: en.search.close,
    };
    const { container } = render(<SearchBox lang="en" labels={labels} initialValue="btc" />);
    expect(container.querySelector("form")).toHaveAttribute("action", "/en/search");
    expect(screen.getByRole("combobox")).toHaveValue("btc");
    expect(screen.getByRole("combobox")).toHaveAttribute("name", "q");
  });
  it("SectionBadge como enlace y como texto", () => {
    const { rerender } = render(<SectionBadge sectionId="cripto" lang="en" />);
    expect(screen.getByRole("link", { name: "Crypto" })).toHaveAttribute("href", "/en/crypto");
    rerender(<SectionBadge sectionId="cripto" lang="es" asLink={false} size="md" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Cripto")).toBeInTheDocument();
  });
  it("Byline", () => {
    render(
      <Byline
        lang="en"
        dict={en}
        authorId="kevin-rondon"
        authorName="Kevin"
        publishedAt="2025-11-20T15:00:00.000Z"
        readingMinutes={4}
      />,
    );
    expect(screen.getByRole("link", { name: "Kevin" })).toHaveAttribute(
      "href",
      "/en/author/kevin-rondon",
    );
    expect(screen.getByText("4 min read")).toBeInTheDocument();
    expect(screen.getByText("November 20, 2025")).toBeInTheDocument();
  });
  it("Prose limpia scripts, JsonLd escapa, ShareLinks y SectionHeading", () => {
    const { container } = render(<Prose html="<p>ok</p><script>x()</script>" />);
    expect(container.innerHTML).not.toContain("<script>x()");
    const { container: ld } = render(<JsonLd data={{ a: "<b>" }} />);
    expect(ld.innerHTML).toContain("\\u003cb>");
    render(<ShareLinks url="https://losupe.com/es/cripto/a" title="A & B" dict={es} />);
    expect(screen.getByRole("link", { name: "Compartir en WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me"),
    );
    render(<SectionHeading title="Lo último" href="/es/cripto" linkLabel="Ver" color="#000" />);
    expect(screen.getByRole("link", { name: /Ver/ })).toHaveAttribute("href", "/es/cripto");
  });
});

describe("celular: menú hamburguesa y hoja de búsqueda", () => {
  it("el menú abre a pantalla completa con secciones, idioma y enlaces del sitio, y cierra con Escape", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<Header lang="es" dict={es} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const btn = screen.getByRole("button", { name: "Menú" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await user.click(btn);
    const dialog = screen.getByRole("dialog", { name: "Menú" });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const { within } = await import("@testing-library/react");
    expect(within(dialog).getByRole("link", { name: "Cripto" })).toHaveAttribute(
      "href",
      "/es/cripto",
    );
    expect(within(dialog).getByRole("link", { name: "Economía" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(dialog).getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/en/economy?page=2",
    );
    expect(within(dialog).getByRole("link", { name: "Política editorial" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "RSS en español" })).toHaveAttribute(
      "href",
      "/es/rss.xml",
    );
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    // Al tocar una sección también se cierra
    await user.click(btn);
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Cripto" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("en celular, tocar el buscador abre la hoja a pantalla completa; en la página de resultados no", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    try {
      const labels = {
        placeholder: es.search.placeholder,
        button: es.search.button,
        label: es.search.label,
        seeAllTemplate: es.search.seeAllTemplate,
        noneTemplate: es.search.noneTemplate,
        close: es.search.close,
        hint: es.search.typing,
      };
      const { unmount } = render(<SearchBox lang="es" labels={labels} size="lg" />);
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(screen.getByRole("combobox"));
      const dialog = screen.getByRole("dialog", { name: "Buscar" });
      expect(dialog).toHaveTextContent("Escribe y te vamos sugiriendo notas.");
      expect(screen.getAllByRole("combobox")).toHaveLength(2);
      expect(document.activeElement).toBe(screen.getAllByRole("combobox")[1]);
      await user.click(screen.getByRole("button", { name: "Cerrar la búsqueda" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      unmount();
      // Página de resultados: enfoca sola y NO abre la hoja
      render(<SearchBox lang="es" labels={labels} autoFocus />);
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(screen.getByRole("combobox"));
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });
});
