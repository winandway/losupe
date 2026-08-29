import { describe, expect, it, vi } from "vitest";
import { bluesky, enlaceDeBluesky, facetsDeEnlace } from "@/lib/redes/bluesky";
import { armarMensaje, etiquetasDe, largo, recortar } from "@/lib/redes/mensaje";
import { normalizarHost } from "@/lib/redes/mastodon";
import { estadoDeRedes, redesConfiguradas, REDES } from "@/lib/redes";
import { telegram } from "@/lib/redes/telegram";

const NOTA = {
  titulo: "El dólar cierra la semana en su mejor nivel desde enero",
  resumen:
    "La moneda subió por tercera sesión seguida después de que el dato de empleo saliera mejor de lo que esperaba el mercado, y los analistas ya hablan de un cambio de tendencia.",
  url: "https://losupe.com/es/economia/el-dolar-cierra-la-semana",
  seccion: "economia",
  lang: "es" as const,
};

describe("el texto del post", () => {
  it("cuenta emojis como UN carácter, que es como los cuenta la red", () => {
    // Contar por bytes o por unidades UTF-16 es lo que hace que un post de 299 se rechace por 300.
    expect(largo("🇺🇸 dólar")).toBeLessThan("🇺🇸 dólar".length);
    expect(largo("abc")).toBe(3);
  });

  it("recorta por palabras y no parte ninguna por la mitad", () => {
    const r = recortar("el dólar cierra la semana arriba", 20);
    expect(largo(r)).toBeLessThanOrEqual(20);
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toMatch(/sema…$/);
  });

  it("EL ENLACE Y EL TITULAR NUNCA SE CAEN, aunque el límite apriete", () => {
    for (const limite of [300, 500, 4096]) {
      const m = armarMensaje(NOTA, limite);
      expect(largo(m.texto), `con límite ${limite}`).toBeLessThanOrEqual(limite);
      expect(m.texto).toContain(NOTA.url);
    }
    // En 300 (Bluesky) el titular entra entero: es lo primero que se protege.
    expect(armarMensaje(NOTA, 300).texto).toContain(NOTA.titulo);
  });

  it("con un titular larguísimo se recorta el titular, pero el enlace sigue ahí", () => {
    const m = armarMensaje({ ...NOTA, titulo: "palabra ".repeat(60).trim() }, 300);
    expect(largo(m.texto)).toBeLessThanOrEqual(300);
    expect(m.texto).toContain(NOTA.url);
  });

  it("las etiquetas son las primeras en caerse cuando no cabe todo", () => {
    expect(armarMensaje(NOTA, 4096).texto).toContain("#economía");
    // En un límite justo, se sacrifican ellas antes que el gancho o el enlace.
    const apretado = armarMensaje(NOTA, largo(NOTA.titulo) + largo(NOTA.url) + 6);
    expect(apretado.texto).not.toContain("#economía");
    expect(apretado.texto).toContain(NOTA.url);
  });

  it("las etiquetas cambian de idioma", () => {
    expect(etiquetasDe("tecnologia", "es")).toContain("#tecnología");
    expect(etiquetasDe("tecnologia", "en")).toContain("#tech");
    expect(etiquetasDe(undefined)).toEqual([]);
  });
});

describe("Bluesky", () => {
  it("marca el enlace EN BYTES, no en letras (el fallo de las tildes)", () => {
    const texto = `Café ñandú\n\n${NOTA.url}`;
    const [facet] = facetsDeEnlace(texto, NOTA.url);
    expect(facet).toBeDefined();
    const bytes = new TextEncoder().encode(texto);
    const trozo = new TextDecoder().decode(
      bytes.slice(facet!.index.byteStart, facet!.index.byteEnd),
    );
    // Si se contaran letras, aquí saldría el enlace desplazado por los acentos.
    expect(trozo).toBe(NOTA.url);
    expect(facet!.index.byteStart).toBeGreaterThan(largo("Café ñandú\n\n"));
  });

  it("sin enlace en el texto no inventa una marca", () => {
    expect(facetsDeEnlace("sin enlace", NOTA.url)).toEqual([]);
  });

  it("arma el enlace público del post", () => {
    expect(enlaceDeBluesky("did:plc:abc", "at://did:plc:abc/app.bsky.feed.post/3kxyz")).toBe(
      "https://bsky.app/profile/did:plc:abc/post/3kxyz",
    );
    expect(enlaceDeBluesky("did:plc:abc")).toBeUndefined();
  });
});

describe("Mastodon", () => {
  it("acepta el servidor con o sin https y con la barra de más", () => {
    expect(normalizarHost("mastodon.social")).toBe("https://mastodon.social");
    expect(normalizarHost("https://mastodon.social/")).toBe("https://mastodon.social");
    expect(normalizarHost("  ")).toBe("");
  });
});

describe("qué redes están encendidas", () => {
  it("una red a medio configurar cuenta como apagada", () => {
    // Media llave no sirve para nada y, si se intentara, el error sería confuso.
    expect(redesConfiguradas({ TELEGRAM_BOT_TOKEN: "x" })).toHaveLength(0);
    expect(redesConfiguradas({ TELEGRAM_BOT_TOKEN: "x", TELEGRAM_CHAT_ID: "@c" })).toHaveLength(1);
  });

  it("el espacio de más al pegar la llave no la rompe", () => {
    expect(telegram.configurada({ TELEGRAM_BOT_TOKEN: " x ", TELEGRAM_CHAT_ID: "@c" })).toBe(true);
    expect(telegram.configurada({ TELEGRAM_BOT_TOKEN: "   ", TELEGRAM_CHAT_ID: "@c" })).toBe(false);
  });

  it("el estado dice qué FALTA, y jamás enseña un valor", () => {
    const estado = estadoDeRedes({ TELEGRAM_BOT_TOKEN: "secretísimo" });
    const tg = estado.find((e) => e.id === "telegram")!;
    expect(tg.faltan).toEqual(["TELEGRAM_CHAT_ID"]);
    expect(JSON.stringify(estado)).not.toContain("secretísimo");
  });

  it("las cuatro redes declaran su límite y sus variables", () => {
    expect(REDES.map((r) => r.id)).toEqual(["telegram", "bluesky", "mastodon", "facebook"]);
    for (const r of REDES) {
      expect(r.limite, r.id).toBeGreaterThan(0);
      expect(r.variables.length, r.id).toBeGreaterThan(0);
    }
  });
});

describe("un fallo de la red se ve, no se traga", () => {
  it("un 401 no se reintenta; un 500 sí", async () => {
    const respuesta = (status: number) =>
      vi.fn(async () => new Response(JSON.stringify({ ok: false, description: "no" }), { status }));
    const env = { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "@c" };
    const m = armarMensaje(NOTA, telegram.limite);
    const malo = await telegram.publicar(env, m, respuesta(401) as unknown as typeof fetch);
    expect(malo.ok).toBe(false);
    if (!malo.ok) expect(malo.reintentable).toBe(false);
    const caido = await telegram.publicar(env, m, respuesta(503) as unknown as typeof fetch);
    if (!caido.ok) expect(caido.reintentable).toBe(true);
  });

  it("si la conexión se cae, devuelve el motivo en vez de lanzar", async () => {
    const roto = vi.fn(async () => {
      throw new Error("network down");
    });
    const r = await bluesky.publicar(
      { BLUESKY_IDENTIFIER: "a", BLUESKY_APP_PASSWORD: "b" },
      armarMensaje(NOTA, 300),
      roto as unknown as typeof fetch,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("network down");
  });
});

describe("la cola: qué se guarda y qué nunca se repite", () => {
  const ENV = { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "@losupe" };
  const nota = { ...NOTA, articleId: "art-1" };

  it("una nota ya mandada NO se manda dos veces", async () => {
    const { publicarEnRedes } = await import("@/lib/redes");
    const { FakeD1 } = await import("./fake-d1");
    const db = new FakeD1((sql) =>
      sql.includes("SELECT status FROM social_posts") ? [{ status: "sent" }] : [],
    );
    const enviar = vi.fn();
    const r = await publicarEnRedes(db.asD1(), ENV, nota, enviar as unknown as typeof fetch);
    expect(enviar).not.toHaveBeenCalled();
    expect(r.enviados).toHaveLength(0);
    expect(r.activas).toBe(1);
  });

  it("EL FALLO QUEDA ESCRITO, con su motivo. Nunca un catch mudo", async () => {
    const { publicarEnRedes } = await import("@/lib/redes");
    const { FakeD1 } = await import("./fake-d1");
    const db = new FakeD1();
    const caido = vi.fn(async () => new Response("{}", { status: 500 }));
    const r = await publicarEnRedes(db.asD1(), ENV, nota, caido as unknown as typeof fetch);
    expect(r.enviados[0]?.ok).toBe(false);
    const escrito = db.calls.find((c) => c.sql.startsWith("INSERT INTO social_posts"));
    expect(escrito, "el fallo tiene que quedar en la base").toBeDefined();
    expect(escrito!.params).toContain("error");
    expect(String(escrito!.params.join(" "))).toContain("Telegram 500");
  });

  it("sin ninguna red encendida no toca la base ni la llama", async () => {
    const { publicarEnRedes } = await import("@/lib/redes");
    const { FakeD1 } = await import("./fake-d1");
    const db = new FakeD1();
    const enviar = vi.fn();
    const r = await publicarEnRedes(db.asD1(), {}, nota, enviar as unknown as typeof fetch);
    expect(r).toEqual({ activas: 0, enviados: [] });
    expect(db.calls).toHaveLength(0);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("si una red revienta, las demás siguen saliendo", async () => {
    const { publicarEnRedes } = await import("@/lib/redes");
    const { FakeD1 } = await import("./fake-d1");
    const db = new FakeD1();
    // Telegram lanza; Mastodon responde bien. La segunda no puede quedarse sin publicar.
    const enviar = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("telegram")) throw new Error("boom");
      return new Response(JSON.stringify({ url: "https://mastodon.social/@losupe/1" }), {
        status: 200,
      });
    });
    const r = await publicarEnRedes(
      db.asD1(),
      { ...ENV, MASTODON_HOST: "mastodon.social", MASTODON_TOKEN: "k" },
      nota,
      enviar as unknown as typeof fetch,
    );
    expect(r.activas).toBe(2);
    expect(r.enviados.find((e) => e.red === "telegram")?.ok).toBe(false);
    expect(r.enviados.find((e) => e.red === "mastodon")?.ok).toBe(true);
  });

  it("una base rota no puede tumbar la publicación de la nota", async () => {
    const { publicarEnRedes } = await import("@/lib/redes");
    const rota = {
      prepare: () => {
        throw new Error("no such table: social_posts");
      },
    } as unknown as D1Database;
    const enviar = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const r = await publicarEnRedes(rota, ENV, nota, enviar as unknown as typeof fetch);
    expect(r.enviados[0]?.ok).toBe(true);
  });
});

describe("la tabla nace con su restricción, no se la añaden después", () => {
  it("social_posts se crea con UNIQUE dentro, y sin CREATE UNIQUE INDEX suelto", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("schema.sql", "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS social_posts");
    expect(sql).toMatch(/social_posts[\s\S]*?UNIQUE \(article_id, network\)/);
    // El 28 ago 2026 un CREATE UNIQUE INDEX sobre datos que ya existían tumbó el esquema entero.
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX[^\n]*social_posts/);
  });
});
