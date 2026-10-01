import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParaCreadores } from "@/components/ParaCreadores";
import { SabiasQue } from "@/components/SabiasQue";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";

const GUION = "Primera frase del guion.\n\nSegunda frase.\n\nLa nota completa está en losupe.com";
const LARGO = `${GUION}\n\nY un párrafo más de contexto.`;

/** Las dos versiones, como las arma la página de la nota. */
const VERSIONES = [
  { medida: "1m", etiqueta: "1 minuto", texto: GUION, duracion: "1 min" },
  { medida: "2m", etiqueta: "2 minutos", texto: LARGO, duracion: "2 min" },
];
const VERSIONES_EN = [{ medida: "1m", etiqueta: "1 minute", texto: GUION, duracion: "1 min" }];

describe("el botón de copiar el guion", () => {
  it("copia EL GUION ENTERO y avisa que ya está copiado", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ParaCreadores versiones={VERSIONES} textos={es.article.creadores} />);
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
    render(<ParaCreadores versiones={VERSIONES} textos={es.article.creadores} />);
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
    render(<ParaCreadores versiones={VERSIONES} textos={es.article.creadores} />);
    await userEvent.click(screen.getByRole("button", { name: /Copiar guion/ }));
    expect(await screen.findByText(/No se pudo copiar/)).toBeInTheDocument();
  });

  it("muestra la duración, el tutorial de tres pasos y el permiso para monetizar", () => {
    render(
      <ParaCreadores
        versiones={[{ ...VERSIONES[0]!, duracion: "1 min 40 s" }]}
        textos={es.article.creadores}
      />,
    );
    expect(screen.getByText(/1 min 40 s/)).toBeInTheDocument();
    expect(screen.getByText(/Pégalo en la app de teleprompter/)).toBeInTheDocument();
    expect(screen.getByText(/monetizar tu video/)).toBeInTheDocument();
  });

  it("existe en inglés con las mismas piezas", () => {
    expect(Object.keys(en.article.creadores).sort()).toEqual(
      Object.keys(es.article.creadores).sort(),
    );
    render(<ParaCreadores versiones={VERSIONES_EN} textos={en.article.creadores} />);
    expect(screen.getByRole("button", { name: /Copy script/ })).toBeInTheDocument();
  });
});

/**
 * Las dos versiones (Richard, 1 oct 2026): para un Short hace falta UN minuto, y el guion de la
 * nota de República Dominicana salía de 2 minutos 45.
 */
describe("un minuto o dos minutos, a un toque", () => {
  it("abre en la de 1 minuto y copia ESA", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ParaCreadores versiones={VERSIONES} textos={es.article.creadores} />);
    expect(screen.getByRole("tab", { name: "1 minuto" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("button", { name: /Copiar guion/ }));
    expect(writeText).toHaveBeenCalledWith(GUION);
  });

  it("al cambiar a 2 minutos, se ve y se copia el largo", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ParaCreadores versiones={VERSIONES} textos={es.article.creadores} />);
    await userEvent.click(screen.getByRole("tab", { name: "2 minutos" }));
    expect(screen.getByText(/Y un párrafo más de contexto/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Copiar guion/ }));
    expect(writeText).toHaveBeenCalledWith(LARGO);
  });

  it("si la nota solo tiene una versión, no se pintan pestañas", () => {
    render(<ParaCreadores versiones={[VERSIONES[0]!]} textos={es.article.creadores} />);
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("el título del video se ve y se copia por separado", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <ParaCreadores
        versiones={VERSIONES}
        tituloVideo="Casillero en Miami sin sorpresas"
        textos={es.article.creadores}
      />,
    );
    expect(screen.getByText("Casillero en Miami sin sorpresas")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Copiar título/ }));
    expect(writeText).toHaveBeenCalledWith("Casillero en Miami sin sorpresas");
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
