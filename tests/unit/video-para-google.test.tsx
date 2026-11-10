import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { articleJsonLd, medioUrl } from "@/lib/seo";
import { VideoEnLectura } from "@/components/VideoEnLectura";
import { es } from "@/i18n/es";
import type { ArticleFull } from "@/lib/queries";

/**
 * Candado 60 — que Google vea los videos (10 nov 2026).
 *
 * Search Console, ese día: **«0 vídeos indexados»**, «vídeos descubiertos: 0» en los dos mapas del
 * sitio y el único que Google encontró marcado con **«el vídeo no está en una página de
 * visualización»**. Y sin embargo once de las doce notas recientes llevaban su video.
 *
 * Tres motivos, los tres arreglados aquí:
 *  1. El `<video>` lo pintaba el navegador al acercarte, así que el HTML que recibe Google no tenía
 *     ninguno: solo una foto.
 *  2. La nota no declaraba `VideoObject` en sus datos estructurados.
 *  3. El video no estaba en el mapa del sitio, que es por donde Google encuentra los medios.
 */

const base = "https://losupe.com";

function nota(video: ArticleFull["video"]): ArticleFull {
  return {
    id: "n1",
    sectionId: "tecnologia",
    slug: "una-nota",
    lang: "es",
    kind: "news",
    title: "Una noticia con su video",
    excerpt: "Lo que pasó, en dos líneas.",
    metaDescription: null,
    contentHtml: "<p>Texto.</p>",
    imageUrl: "/img/foto.webp",
    imageAlt: null,
    publishedAt: "2026-11-10T12:00:00.000Z",
    updatedAt: "2026-11-10T12:00:00.000Z",
    authorId: "magaly",
    authorName: "Magaly",
    readingMinutes: 3,
    tags: [],
    sources: [],
    video,
  } as unknown as ArticleFull;
}

describe("la nota con video se declara como página de visualización", () => {
  it("lleva su VideoObject con archivo, miniatura y fecha", () => {
    const jsonld = articleJsonLd(
      base,
      "es",
      nota({
        src: "https://videos.pexels.com/123-hd.mp4",
        poster: "https://images.pexels.com/videos/123/poster.jpg",
        credito: "Video: Ana Ruiz / Pexels",
      }),
      "losupe",
    ) as unknown as Record<string, Record<string, unknown>>;
    const v = jsonld.video;
    expect(v?.["@type"]).toBe("VideoObject");
    expect(v?.contentUrl).toBe("https://videos.pexels.com/123-hd.mp4");
    expect(v?.thumbnailUrl).toEqual(["https://images.pexels.com/videos/123/poster.jpg"]);
    expect(v?.uploadDate).toBe("2026-11-10T12:00:00.000Z");
    // La página donde se ve: es lo que Google echaba en falta.
    expect(v?.embedUrl).toContain("/es/tecnologia/una-nota");
    expect(v?.creditText).toContain("Ana Ruiz");
  });

  it("la nota sin video no declara ninguno", () => {
    const jsonld = articleJsonLd(base, "es", nota(null), "losupe") as unknown as Record<
      string,
      unknown
    >;
    expect(jsonld.video).toBeUndefined();
  });

  it("a una dirección que ya trae su dominio no se le pega el nuestro delante", () => {
    // `https://losupe.com/https://videos.pexels.com/…` es lo que salía con el ayudante de siempre, y
    // Google lo descarta sin decir por qué.
    expect(medioUrl(base, "https://videos.pexels.com/a.mp4")).toBe(
      "https://videos.pexels.com/a.mp4",
    );
    expect(medioUrl(base, "/media/propio.mp4")).toBe("https://losupe.com/media/propio.mp4");
  });
});

describe("el reproductor viene en el HTML, no lo pinta el navegador", () => {
  const html = renderToStaticMarkup(
    <VideoEnLectura
      src="https://videos.pexels.com/123-hd.mp4"
      poster="https://images.pexels.com/videos/123/poster.jpg"
      credito="Video: Ana Ruiz / Pexels"
      textos={es.article.video}
    />,
  );

  it("el servidor manda la etiqueta de video con su archivo y su póster", () => {
    expect(html).toContain("<video");
    expect(html).toContain("https://videos.pexels.com/123-hd.mp4");
    expect(html).toContain("poster=");
  });

  it("y sin descargar un solo byte del archivo hasta que se reproduce", () => {
    // Lo que abarata la jugada: existir en el HTML no es pesar. Sin esto, cada nota se traería el
    // video entero aunque nadie lo mire.
    expect(html).toMatch(/preload="none"/);
  });

  it("sin JavaScript quedan los controles del navegador: el video no es una foto muerta", () => {
    expect(html).toContain("controls");
  });
});

describe("el video está en el mapa del sitio", () => {
  it("se declara con su miniatura, su archivo y la página donde se ve", async () => {
    vi.resetModules();
    vi.doMock("@/lib/site", () => ({ getBaseUrl: async () => base }));
    vi.doMock("@/lib/db", () => ({ getDb: async () => ({}) }));
    vi.doMock("@/lib/queries", () => ({
      listForSitemap: async () => [
        {
          id: "n1",
          section_id: "tecnologia",
          lang: "es",
          slug: "una-nota",
          published_at: "2026-11-10T12:00:00.000Z",
          updated_at: "2026-11-10T12:00:00.000Z",
          image_url: "/img/foto.webp",
          title: "Una noticia con su video",
          excerpt: "Lo que pasó, en dos líneas.",
          video_url: "https://videos.pexels.com/123-hd.mp4",
          video_poster: "https://images.pexels.com/videos/123/poster.jpg",
        },
        {
          id: "n2",
          section_id: "tecnologia",
          lang: "es",
          slug: "sin-video",
          published_at: "2026-11-09T12:00:00.000Z",
          updated_at: "2026-11-09T12:00:00.000Z",
          image_url: "/img/otra.webp",
          title: "Una nota sin video",
          excerpt: null,
          // Vacío, no nulo: «ya se miró y no corresponde» (candado 56).
          video_url: "",
          video_poster: null,
        },
      ],
    }));
    const { default: sitemap } = await import("@/app/sitemap");
    const entradas = await sitemap();
    const conVideo = entradas.find((e) => e.url.endsWith("/es/tecnologia/una-nota"));
    const sinVideo = entradas.find((e) => e.url.endsWith("/es/tecnologia/sin-video"));
    expect(conVideo?.videos?.[0]).toMatchObject({
      title: "Una noticia con su video",
      thumbnail_loc: "https://images.pexels.com/videos/123/poster.jpg",
      content_loc: "https://videos.pexels.com/123-hd.mp4",
      player_loc: "https://losupe.com/es/tecnologia/una-nota",
    });
    expect(sinVideo?.videos).toBeUndefined();
    vi.doUnmock("@/lib/queries");
    vi.doUnmock("@/lib/db");
    vi.doUnmock("@/lib/site");
  });
});
