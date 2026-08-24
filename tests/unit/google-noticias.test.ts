import { describe, expect, it } from "vitest";
import { construirMensaje, contactoSchema, enviarContacto } from "@/lib/contacto";
import { personJsonLd } from "@/lib/seo";
import { contactPath, staticPath } from "@/lib/urls";
import type { Author } from "@/lib/queries";
import { FakeD1 } from "./fake-d1";

/**
 * Lo que Google Noticias exige para tomarse en serio a un medio. Cada una de estas pruebas fija una
 * señal concreta que, si desaparece de la web, nos deja fuera sin avisar: quién está detrás, cómo
 * escribirle, y si detrás de una firma hay una persona verificable.
 */

const ENV = {
  YAD_SITE: "losupe",
  YAD_TOKEN: "t0ken",
  MAIL_FROM: "avisos@losupe.com",
};

const autor: Author = {
  id: "andreea-blidar",
  name: "Andreea Blidar",
  kind: "person",
  bio: "Escribe de economía desde hace años.",
  role: "Economía y tecnología",
  avatarUrl: "/img/autores/andreea-blidar.jpg",
  expertise: "Economía de Estados Unidos, inflación, empleo",
  links: {
    linkedin: "https://www.linkedin.com/in/ejemplo",
    x: "https://x.com/ejemplo",
    email: "andreea@losupe.com",
  },
};

describe("transparencia: quién está detrás del medio", () => {
  it("la página de contacto existe en los dos idiomas y con su palabra propia", () => {
    expect(contactPath("es")).toBe("/es/contacto");
    expect(contactPath("en")).toBe("/en/contact");
    // Y las demás institucionales siguen ahí: si alguien borra una, esto se pone rojo.
    for (const key of ["editorial", "privacy", "terms"] as const) {
      expect(staticPath(key, "es")).toMatch(/^\/es\//);
      expect(staticPath(key, "en")).toMatch(/^\/en\//);
    }
  });

  it("el formulario exige nombre, correo válido y un mensaje de verdad", () => {
    expect(
      contactoSchema.safeParse({
        nombre: "Ana",
        email: "ana@ejemplo.com",
        mensaje: "Tengo una corrección sobre una nota.",
      }).success,
    ).toBe(true);
    expect(contactoSchema.safeParse({ nombre: "A", email: "x", mensaje: "hola" }).success).toBe(
      false,
    );
    expect(
      contactoSchema.safeParse({ nombre: "Ana", email: "ana@ejemplo.com", mensaje: "corto" })
        .success,
    ).toBe(false);
  });

  it("el mensaje llega con quien escribe en «responder a», para poder contestarle de un clic", async () => {
    const db = new FakeD1(() => [{ value: "windoce1@gmail.com" }]);
    let enviado: Record<string, unknown> | null = null;
    const fetchImpl: typeof fetch = async (_u, init) => {
      enviado = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("{}", { status: 200 });
    };
    const r = await enviarContacto(
      db.asD1(),
      ENV,
      contactoSchema.parse({
        nombre: "Ana Pérez",
        email: "ana@ejemplo.com",
        mensaje: "Creo que la cifra de inflación está mal.",
      }),
      fetchImpl,
    );
    expect(r).toEqual({ ok: true, state: "enviado" });
    expect(enviado).toMatchObject({ reply_to: "ana@ejemplo.com" });
  });

  it("la trampa para robots descarta el mensaje sin mandar nada", async () => {
    const db = new FakeD1(() => [{ value: "windoce1@gmail.com" }]);
    let envios = 0;
    const fetchImpl: typeof fetch = async () => {
      envios += 1;
      return new Response("{}");
    };
    const r = await enviarContacto(
      db.asD1(),
      ENV,
      contactoSchema.parse({
        nombre: "Robot",
        email: "spam@ejemplo.com",
        mensaje: "Compre seguidores baratos ahora mismo",
        web: "http://spam.example",
      }),
      fetchImpl,
    );
    expect(r).toEqual({ ok: true, state: "descartado" });
    expect(envios).toBe(0);
  });

  it("el correo no se puede colar código en el asunto ni en el cuerpo", () => {
    const m = construirMensaje(
      contactoSchema.parse({
        nombre: "<script>alert(1)</script>",
        email: "x@ejemplo.com",
        mensaje: '<img src=x onerror="alert(1)">',
      }),
    );
    // Lo que importa no es que la palabra «onerror» no aparezca, sino que llegue como TEXTO y no
    // como una etiqueta que el gestor de correo pueda ejecutar.
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    // Y en el asunto tampoco se cuela nada raro
    expect(m.subject).not.toContain("<");
  });
});

describe("autoría verificable (E-E-A-T)", () => {
  it("los perfiles públicos salen como sameAs: es como Google comprueba que la persona existe", () => {
    const ld = personJsonLd("https://losupe.com", "es", autor, "losupe") as {
      mainEntity: { sameAs?: string[]; knowsAbout?: string[]; email?: string; image?: string };
    };
    expect(ld.mainEntity.sameAs).toEqual([
      "https://www.linkedin.com/in/ejemplo",
      "https://x.com/ejemplo",
    ]);
    expect(ld.mainEntity.email).toBe("andreea@losupe.com");
  });

  it("la especialidad de la persona manda sobre la lista genérica del medio", () => {
    const ld = personJsonLd("https://losupe.com", "es", autor, "losupe") as {
      mainEntity: { knowsAbout: string[] };
    };
    expect(ld.mainEntity.knowsAbout).toEqual(["Economía de Estados Unidos", "inflación", "empleo"]);
  });

  it("sin perfiles no se inventa un sameAs vacío (peor que no ponerlo)", () => {
    const sinRedes: Author = {
      ...autor,
      expertise: null,
      links: { linkedin: null, x: null, email: null },
    };
    const ld = personJsonLd("https://losupe.com", "es", sinRedes, "losupe") as {
      mainEntity: Record<string, unknown>;
    };
    expect(ld.mainEntity.sameAs).toBeUndefined();
    expect(ld.mainEntity.email).toBeUndefined();
    // Y cae en las áreas del medio, no en una lista vacía
    expect(Array.isArray(ld.mainEntity.knowsAbout)).toBe(true);
    expect((ld.mainEntity.knowsAbout as string[]).length).toBeGreaterThan(0);
  });
});

describe("el roadmap dice la verdad", () => {
  it("cada tarea tiene estado y responsable, y ninguna se queda sin detalle", async () => {
    const { ROADMAP, contarRoadmap, pendientesDeRichard } = await import("@/lib/roadmap");
    expect(ROADMAP.length).toBeGreaterThan(0);
    for (const b of ROADMAP) {
      expect(b.tareas.length).toBeGreaterThan(0);
      for (const t of b.tareas) {
        expect(["hecho", "falta", "espera"]).toContain(t.estado);
        expect(["nosotros", "richard"]).toContain(t.quien);
        // Un roadmap con títulos sueltos y sin explicación no sirve para decidir nada.
        expect(t.detalle.length).toBeGreaterThan(40);
      }
    }
    const r = contarRoadmap();
    expect(r.hecho + r.falta + r.espera).toBe(r.total);
    // Lo que espera un dato de Richard siempre es suyo, nunca nuestro.
    for (const t of pendientesDeRichard()) expect(t.quien).toBe("richard");
  });

  it("los títulos no se repiten (una tarea, un sitio)", async () => {
    const { ROADMAP } = await import("@/lib/roadmap");
    const titulos = ROADMAP.flatMap((b) => b.tareas.map((t) => t.titulo));
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});
