import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VideoEnLectura } from "@/components/VideoEnLectura";
import { notasSinVideo, rescatarVideos, TEMA_DELICADO } from "@/lib/robot/rescate-video";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { FakeD1 } from "./fake-d1";

/**
 * Candado 56 — el video dentro de la lectura (19 oct 2026).
 *
 * Sale de mirar por dentro una nota de El Tiempo: 3.059 peticiones a 260 dominios, 61 % de ellas
 * de publicidad y rastreo, con el reproductor de video arrancando junto al SDK de anuncios. Aquí
 * se copia lo bueno (el video en medio del texto y el mini reproductor al seguir leyendo) y se tira
 * el resto.
 */

const TEXTOS = es.article.video;

/**
 * jsdom no trae `IntersectionObserver`. Se pone uno que avisa «ya está a la vista» en cuanto se
 * observa: así la prueba ve lo mismo que vería alguien que llega leyendo hasta el video.
 */
class ObservadorQueSiempreVe {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb(
      [
        {
          isIntersecting: true,
          target: el,
          boundingClientRect: { bottom: 100 } as DOMRectReadOnly,
        } as unknown as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", ObservadorQueSiempreVe);

const RESPUESTA_PEXELS = {
  videos: [
    {
      url: "https://www.pexels.com/video/123",
      image: "https://images.pexels.com/videos/123/poster.jpg",
      duration: 12,
      user: { name: "Ana Ruiz" },
      video_files: [
        {
          link: "https://videos.pexels.com/123-hd.mp4",
          width: 1280,
          height: 720,
          file_type: "video/mp4",
        },
      ],
    },
  ],
};

function base(
  filas: { id: string; title: string; title_en?: string | null; excerpt?: string | null }[],
) {
  return new FakeD1((sql) => {
    if (sql.includes("FROM articles a") && sql.includes("video_url IS NULL"))
      return filas.map((f) => ({ title_en: null, excerpt: null, ...f }));
    return [];
  });
}

describe("a una nota delicada no se le pone un video de archivo", () => {
  it("una muerte, una tragedia o una guerra se marcan como sin video, y NO se llama a Pexels", async () => {
    const db = base([
      { id: "n1", title: "Muere el actor que dio voz a Topo Gigio a los 100 años" },
    ]);
    const fetchImpl = vi.fn();
    const r = await rescatarVideos(
      db.asD1(),
      { PEXELS_API_KEY: "k" },
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(r.sinTema).toBe(1);
    expect(r.conVideo).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    // Y queda marcada para no volver a intentarlo en cada corrida.
    const marca = db.calls.find((c) => c.sql.includes("SET video_url = ''"));
    expect(marca?.params[0]).toBe("n1");
  });

  it("el filtro reconoce las palabras que de verdad importan", () => {
    // «Muere X» es el titular más común de un obituario y la primera versión del filtro NO lo
    // veía: decía «muert», y «muere» no lleva esa t. Lo cazó esta prueba.
    for (const t of [
      "Muere el actor que dio voz a Topo Gigio",
      "murió ayer",
      "tragedia en la mina",
      "víctimas del ataque",
      "war in Sudan",
    ]) {
      expect(TEMA_DELICADO.test(t), t).toBe(true);
    }
    for (const t of ["nuevo iPhone", "concierto en Miami", "el dólar sube"]) {
      expect(TEMA_DELICADO.test(t), t).toBe(false);
    }
  });
});

describe("a una nota normal sí, y sin tocar la fecha de la noticia", () => {
  it("guarda el video, su imagen y el crédito", async () => {
    const db = base([
      {
        id: "n2",
        title: "Casillero en Miami: cómo comprar en Estados Unidos",
        excerpt: "Una bodega en Miami.",
      },
    ]);
    const fetchImpl = vi.fn(async () => Response.json(RESPUESTA_PEXELS));
    const r = await rescatarVideos(
      db.asD1(),
      { PEXELS_API_KEY: "k" },
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(r.conVideo).toBe(1);
    const guardado = db.calls.find((c) => c.sql.includes("SET video_url = ?2"));
    expect(guardado?.params[1]).toBe("https://videos.pexels.com/123-hd.mp4");
    expect(String(guardado?.params[3])).toContain("Ana Ruiz");
    // Poner el video no es actualizar la noticia (candado 53).
    expect(guardado?.sql).not.toContain("updated_at");
  });

  it("no se le pone un segundo video a la nota que ya trae uno en el texto", async () => {
    const db = base([]);
    await notasSinVideo(db.asD1(), 4);
    expect(db.calls[0]?.sql).toContain("nota-video");
  });

  it("sin llave de Pexels no se intenta nada", async () => {
    const db = base([{ id: "n3", title: "Lo que sea" }]);
    expect(await rescatarVideos(db.asD1(), {})).toEqual({
      encontradas: 0,
      conVideo: 0,
      sinTema: 0,
      errores: [],
    });
    expect(db.calls).toHaveLength(0);
  });
});

describe("el reproductor dentro de la lectura", () => {
  it("arranca en silencio, sin controles del navegador y sin precargar nada", async () => {
    const { container } = render(
      <VideoEnLectura
        src="https://videos.pexels.com/123-hd.mp4"
        poster="/p.jpg"
        credito="Video: Ana Ruiz / Pexels"
        textos={TEXTOS}
      />,
    );
    await screen.findByRole("button", { name: /Reproducir/ });
    const v = container.querySelector("video")!;
    expect(v).toBeTruthy();
    expect(v.muted).toBe(true);
    expect(v.getAttribute("preload")).toBe("none");
    // Nada de la barra del navegador: los botones son nuestros y son dos.
    expect(v.hasAttribute("controls")).toBe(false);
    expect(screen.getByRole("button", { name: /Reproducir/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Con sonido/ })).toBeInTheDocument();
  });

  it("el hueco está reservado: la página no salta cuando carga el video", () => {
    const { container } = render(
      <VideoEnLectura src="https://x/v.mp4" poster="/p.jpg" textos={TEXTOS} />,
    );
    expect(container.querySelector(".aspect-video")).toBeTruthy();
  });

  it("el sonido lo enciende la persona, nunca el sitio", async () => {
    const { container } = render(<VideoEnLectura src="https://x/v.mp4" textos={TEXTOS} />);
    await screen.findByRole("button", { name: /Con sonido/ });
    const v = container.querySelector("video")!;
    v.play = vi.fn(async () => undefined);
    expect(v.muted).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /Con sonido/ }));
    expect(v.muted).toBe(false);
    expect(screen.getByRole("button", { name: /Silenciar/ })).toBeInTheDocument();
  });

  it("el crédito del video se ve, que es la condición de la licencia", () => {
    render(
      <VideoEnLectura src="https://x/v.mp4" credito="Video: Ana Ruiz / Pexels" textos={TEXTOS} />,
    );
    expect(screen.getByText("Video: Ana Ruiz / Pexels")).toBeInTheDocument();
  });

  it("existe en inglés con las mismas piezas", () => {
    expect(Object.keys(en.article.video).sort()).toEqual(Object.keys(es.article.video).sort());
    render(<VideoEnLectura src="https://x/v.mp4" textos={en.article.video} />);
    expect(screen.getByRole("button", { name: /Unmute/ })).toBeInTheDocument();
  });
});
