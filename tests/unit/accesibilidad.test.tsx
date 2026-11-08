import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { es } from "@/i18n/es";
import { Byline } from "@/components/Byline";
import { SectionBadge } from "@/components/SectionBadge";
import { SECTIONS } from "@/lib/sections";

vi.mock("next/navigation", () => ({ usePathname: () => "/es" }));

function luminancia(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = Number.parseInt(hex.replace("#", "").slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

describe("accesibilidad: etiquetas de sección y nombres de autor", () => {
  it.each(SECTIONS.map((s) => [s.id, s] as const))(
    "la etiqueta de %s se lee (contraste AA 4,5:1 en letra pequeña)",
    (_id, s) => {
      const bg = s.badge?.bg ?? s.color;
      const fg = s.badge?.fg ?? s.onColor;
      expect(contraste(bg, fg)).toBeGreaterThanOrEqual(4.5);
      const { container } = render(<SectionBadge sectionId={s.id} lang="es" />);
      const a = container.querySelector("a") as HTMLElement;
      expect(a.style.backgroundColor).not.toBe("");
    },
  );
  it("el nombre del autor tiene tamaño táctil (44 px en la nota, 32 px en las tarjetas)", () => {
    const props = {
      lang: "es" as const,
      dict: es,
      authorId: "magaly",
      authorName: "Magaly",
      publishedAt: "2026-11-08T12:00:00Z",
    };
    const { container, rerender } = render(<Byline {...props} />);
    expect(container.querySelector("a")?.className).toContain("min-h-11");
    rerender(<Byline {...props} compact />);
    expect(container.querySelector("a")?.className).toContain("min-h-8");
  });
});
