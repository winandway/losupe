import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParaCreadores } from "@/components/ParaCreadores";
import { SabiasQue } from "@/components/SabiasQue";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";

const GUION = "Primera frase del guion.\n\nSegunda frase.\n\nLo leí en losupe.com";

describe("el botón de copiar el guion", () => {
  it("copia EL GUION ENTERO y avisa que ya está copiado", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ParaCreadores guion={GUION} duracion="1 min" textos={es.article.creadores} />);
    await userEvent.click(screen.getByRole("button", { name: /Copiar guion/ }));
    expect(writeText).toHaveBeenCalledWith(GUION);
    expect(await screen.findByRole("button", { name: /Copiado/ })).toBeInTheDocument();
  });

  it("si el navegador no deja usar el portapapeles, lo intenta a la antigua", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("bloqueado");
        }),
      },
    });
    const exec = vi.fn(() => true);
    Object.assign(document, { execCommand: exec });
    render(<ParaCreadores guion={GUION} duracion="1 min" textos={es.article.creadores} />);
    await userEvent.click(screen.getByRole("button", { name: /Copiar guion/ }));
    expect(exec).toHaveBeenCalledWith("copy");
    expect(await screen.findByRole("button", { name: /Copiado/ })).toBeInTheDocument();
  });

  it("y si nada funciona, lo DICE en vez de quedarse callado", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("no");
        }),
      },
    });
    Object.assign(document, { execCommand: vi.fn(() => false) });
    render(<ParaCreadores guion={GUION} duracion="1 min" textos={es.article.creadores} />);
    await userEvent.click(screen.getByRole("button", { name: /Copiar guion/ }));
    expect(await screen.findByText(/No se pudo copiar/)).toBeInTheDocument();
  });

  it("muestra la duración, el tutorial de tres pasos y el permiso para monetizar", () => {
    render(<ParaCreadores guion={GUION} duracion="1 min 40 s" textos={es.article.creadores} />);
    expect(screen.getByText(/1 min 40 s/)).toBeInTheDocument();
    expect(screen.getByText(/Pégalo en la app de teleprompter/)).toBeInTheDocument();
    expect(screen.getByText(/monetizar tu video/)).toBeInTheDocument();
  });

  it("existe en inglés con las mismas piezas", () => {
    expect(Object.keys(en.article.creadores).sort()).toEqual(
      Object.keys(es.article.creadores).sort(),
    );
    render(<ParaCreadores guion={GUION} duracion="1 min" textos={en.article.creadores} />);
    expect(screen.getByRole("button", { name: /Copy script/ })).toBeInTheDocument();
  });
});

describe("¿Sabías qué?", () => {
  it("no pinta NADA si la nota no tiene datos: mejor sin bloque que un bloque vacío", () => {
    const { container } = render(<SabiasQue datos={[]} titulo="¿Sabías qué?" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("pinta los datos cuando los hay", () => {
    render(
      <SabiasQue datos={["¿Sabías que el diésel llegó a 5,85 dólares?"]} titulo="¿Sabías qué?" />,
    );
    expect(screen.getByRole("heading", { name: "¿Sabías qué?" })).toBeInTheDocument();
    expect(screen.getByText(/5,85 dólares/)).toBeInTheDocument();
  });
});
