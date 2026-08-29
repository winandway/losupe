import { describe, expect, it } from "vitest";
import {
  construirBoletin,
  DIAS_ENTRE_BOLETINES,
  enviarBoletin,
  estadoBoletin,
  NOTAS_POR_BOLETIN,
  tocaBoletin,
  type NotaDelBoletin,
} from "@/lib/boletin";

const ENV = { YAD_SITE: "losupe", YAD_TOKEN: "t", MAIL_FROM: "avisos@losupe.com" };
const AHORA = new Date("2026-08-29T16:00:00Z");

const NOTAS: NotaDelBoletin[] = [
  {
    title: "Qué es lo que más se vende en Estados Unidos",
    excerpt: "La respuesta lleva décadas sin cambiar y tiene que ver con la comida.",
    slug: "que-mas-se-vende-estados-unidos",
    section_id: "ventas",
    image_url: "/media/notas/foto.jpg",
    published_at: "2026-08-28T21:00:00Z",
  },
  {
    title: "La inflación baja y el bolsillo no lo nota: por qué",
    excerpt: "Los precios suben más despacio, que no es lo mismo que bajar.",
    slug: "inflacion-baja-bolsillo",
    section_id: "economia",
    image_url: null,
    published_at: "2026-08-28T11:00:00Z",
  },
];

/** Base falsa con ajustes en memoria. */
function base(ajustes: Record<string, string>, suscriptores = 1, notas = NOTAS) {
  const calls: string[] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...p: unknown[]) => ({
        first: async () => {
          calls.push(sql);
          const k = String(p[0]);
          return ajustes[k] !== undefined ? { value: ajustes[k] } : null;
        },
        all: async () => {
          calls.push(sql);
          if (sql.includes("FROM subscribers")) {
            return {
              results: Array.from({ length: suscriptores }, (_, i) => ({
                email: `lector${i}@ejemplo.com`,
                token: `tok${i}`,
              })),
            };
          }
          return { results: notas };
        },
        run: async () => {
          calls.push(sql);
          return { meta: { changes: 1 } };
        },
      }),
      first: async () => {
        calls.push(sql);
        const m = /key = '([a-z_]+)'/.exec(sql);
        const k = m?.[1] ?? "";
        return ajustes[k] !== undefined ? { value: ajustes[k] } : null;
      },
      all: async () => {
        calls.push(sql);
        if (sql.includes("FROM subscribers")) {
          return {
            results: Array.from({ length: suscriptores }, (_, i) => ({
              email: `lector${i}@ejemplo.com`,
              token: `tok${i}`,
            })),
          };
        }
        return { results: notas };
      },
      run: async () => {
        calls.push(sql);
        return { meta: { changes: 1 } };
      },
    }),
  } as unknown as D1Database;
  return { db, calls };
}

describe("el boletín sale cada pocos días, no en cada nota", () => {
  it("cuatro días es el ritmo, y seis notas el tamaño", () => {
    // Un correo por nota son cuatro al día: la vía rápida a que te marquen como spam.
    expect(DIAS_ENTRE_BOLETINES).toBe(4);
    expect(NOTAS_POR_BOLETIN).toBeLessThanOrEqual(8);
  });

  it("la primera vez sale; justo después, no", async () => {
    expect(await tocaBoletin(base({}).db, AHORA)).toBe(true);
    const ayer = new Date(AHORA.getTime() - 86_400_000).toISOString();
    expect(await tocaBoletin(base({ boletin_ultimo: ayer }).db, AHORA)).toBe(false);
    const haceCinco = new Date(AHORA.getTime() - 5 * 86_400_000).toISOString();
    expect(await tocaBoletin(base({ boletin_ultimo: haceCinco }).db, AHORA)).toBe(true);
  });

  it("apagado desde el panel, no sale", async () => {
    expect(await tocaBoletin(base({ boletin_activo: "0" }).db, AHORA)).toBe(false);
  });
});

describe("el correo del boletín", () => {
  it("es una portada, no una lista de enlaces sueltos", () => {
    const c = construirBoletin("https://losupe.com", NOTAS, "https://losupe.com/baja");
    // El asunto es el titular de la nota principal: es lo que decide si se abre.
    expect(c.subject).toContain("Qué es lo que más se vende");
    // Cada nota con su enlace completo y su entradilla.
    for (const n of NOTAS) {
      expect(c.html).toContain(n.title);
      expect(c.html).toContain(`/${n.slug}`);
      expect(c.text).toContain(`https://losupe.com/es/`);
    }
    // Y la baja, siempre, en los dos formatos.
    expect(c.html).toContain("https://losupe.com/baja");
    expect(c.text).toContain("https://losupe.com/baja");
  });

  it("no se puede colar código por el titular de una nota", () => {
    const malicioso: NotaDelBoletin[] = [
      { ...NOTAS[0]!, title: "<script>alert(1)</script>", excerpt: '<img onerror="x">' },
    ];
    const c = construirBoletin("https://losupe.com", malicioso, "https://losupe.com/baja");
    expect(c.html).not.toContain("<script>");
    expect(c.html).toContain("&lt;script&gt;");
  });
});

describe("cuándo NO se manda", () => {
  it("sin correo configurado", async () => {
    expect(await enviarBoletin(base({}).db, {}, "https://losupe.com", AHORA)).toEqual({
      ok: false,
      motivo: "sin_correo",
    });
  });

  it("sin suscriptores confirmados NO se gasta el turno", async () => {
    // Importante: si se marcara como enviado, el primer boletín de verdad tardaría cuatro días más.
    const { db, calls } = base({}, 0);
    const r = await enviarBoletin(db, ENV, "https://losupe.com", AHORA);
    expect(r).toEqual({ ok: false, motivo: "sin_suscriptores" });
    expect(calls.some((c) => c.includes("boletin_ultimo") && c.includes("INSERT"))).toBe(false);
  });

  it("con suscriptores y notas, sale y queda apuntada la fecha", async () => {
    const { db, calls } = base({}, 3);
    let enviados = 0;
    const fetchImpl: typeof fetch = async () => {
      enviados += 1;
      return new Response("{}", { status: 200 });
    };
    const r = await enviarBoletin(db, ENV, "https://losupe.com", AHORA, fetchImpl);
    expect(r).toEqual({ ok: true, enviados: 3, notas: NOTAS.length });
    expect(enviados).toBe(3);
    expect(calls.some((c) => c.includes("boletin_ultimo"))).toBe(true);
  });

  it("si el servicio de correo rechaza, se para en vez de insistir", async () => {
    const { db } = base({}, 5);
    const roto: typeof fetch = async () => new Response("no", { status: 429 });
    const r = await enviarBoletin(db, ENV, "https://losupe.com", AHORA, roto);
    // Insistir con el servicio rechazando es la forma de quemar el dominio.
    expect(r).toMatchObject({ ok: true, enviados: 0 });
  });
});

describe("el panel sabe cuándo toca el siguiente", () => {
  it("dice si está encendido, cada cuánto y qué día sale", async () => {
    const haceDos = new Date(AHORA.getTime() - 2 * 86_400_000).toISOString();
    const e = await estadoBoletin(base({ boletin_ultimo: haceDos, boletin_dias: "4" }).db, AHORA);
    expect(e.activo).toBe(true);
    expect(e.cada).toBe(4);
    expect(e.proximo).toBe("2026-08-31");
  });
});
