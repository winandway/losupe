import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applySchema } from "@/lib/schema-guard";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import { runPipeline } from "@/lib/robot/pipeline";
import { efemeridesDeHoy, esAptaParaFamilias } from "@/lib/robot/efemerides";
import { generateJson, GeminiContenidoError } from "@/lib/robot/gemini";
import { SqliteD1 } from "./sqlite-d1";

/**
 * Candado 68 — un tema que el modelo rechaza se aparta para siempre (26 nov 2026).
 *
 * La madrugada del 26 nov 2026 la efeméride elegida fue «Ilona Staller: 75 años de su nacimiento».
 * Wikipedia la presentaba como «actriz y política italiana»; la ficha de su artículo dice «actriz
 * pornográfica». Gemini respondió `PROHIBITED_CONTENT` y, como nada apartaba el tema, salió elegido
 * otra vez en cada corrida: seis errores seguidos, la guardia de GitHub se cortó a las 06:58 UTC y
 * el diario se quedó sin reloj. Tres arreglos, tres pruebas.
 */

// 12:30 del Este: dentro del día, con el turno del mediodía (curiosidades → efeméride) abierto.
const AHORA = new Date("2026-11-26T17:30:00Z");

const para = (n: number, seed: string) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<p>${seed} párrafo ${i} con palabras propias ${i * 3} para la nota de prueba número ${i} y algo más.</p>`,
  ).join("");
const draft = {
  es: {
    title: "Cincuenta años de una voz que marcó a varias generaciones",
    excerpt:
      "La cantante cumple cincuenta años de su nacimiento y su música sigue sonando en radios y listas de todo el continente.",
    content_html: `<h2>Quién es</h2>${para(40, "es")}`,
    meta_title: "Cincuenta años de una voz",
    meta_description:
      "La cantante cumple cincuenta años de su nacimiento y su música sigue sonando en radios y listas de todo el continente.",
    tags: ["música", "aniversario", "cantantes", "historia"],
  },
  en: {
    title: "Fifty years of a voice that shaped several generations",
    excerpt:
      "The singer turns fifty and her music is still playing on radio stations and charts across the continent today.",
    content_html: `<h2>Who she is</h2>${para(40, "en")}`,
    meta_title: "Fifty years of a voice",
    meta_description:
      "The singer turns fifty and her music is still playing on radio stations and charts across the continent today.",
    tags: ["music", "anniversary", "singers", "history"],
  },
  kind: "evergreen",
  image_prompt: "Wide editorial photo of a vintage microphone on a stage",
  image_alt_es: "Micrófono antiguo en un escenario",
  image_alt_en: "Vintage microphone on a stage",
  image_keywords: ["microphone", "stage"],
};

const persona = (nombre: string, year: number, descripcion: string) => ({
  year,
  text: `${nombre}, cantante y actriz.`,
  pages: [
    {
      titles: { normalized: nombre },
      description: descripcion,
      content_urls: {
        desktop: { page: `https://es.wikipedia.org/wiki/${nombre.replace(/ /g, "_")}` },
      },
    },
  ],
});

/** Wikipedia con dos efemérides redondas; el modelo se niega a escribir la de `rechazada`. */
function mundo(rechazada: string, births: unknown[]) {
  const llamadas: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("onthisday")) {
      return Response.json({ births });
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      const cuerpo = String(init?.body ?? "");
      const tema = /años de su nacimiento/.test(cuerpo)
        ? (/«([^»]+): \d+ años de su nacimiento»/.exec(cuerpo)?.[1] ??
          /([A-ZÁÉÍÓÚ][\wáéíóú]+ [A-ZÁÉÍÓÚ][\wáéíóú]+): \d+ años/.exec(cuerpo)?.[1] ??
          "?")
        : "otro";
      llamadas.push(tema);
      if (cuerpo.includes(rechazada)) {
        return Response.json({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } });
      }
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }],
        usageMetadata: { promptTokenCount: 6000, candidatesTokenCount: 4000 },
      });
    }
    if (url.includes("wikipedia.org/wiki/")) {
      return new Response(
        `<html><head><title>Ficha</title></head><body><main><p>${"Biografía con fechas, discos y premios de la artista en su carrera. ".repeat(30)}</p></main></body></html>`,
        { headers: { "content-type": "text/html" } },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, llamadas };
}

async function base() {
  const db = new SqliteD1();
  const d1 = db.asD1();
  await applySchema(d1, SCHEMA_SQL);
  db.raw.exec(`UPDATE settings SET value = '0' WHERE key = 'robot_paused'`);
  db.raw.exec(`UPDATE settings SET value = '1' WHERE key = 'robot_auto_publish'`);
  db.raw.exec(`UPDATE settings SET value = '5' WHERE key = 'daily_budget_usd'`);
  // Sin encargos de patrocinador: aquí se mira solo la mesa de redacción.
  db.raw.exec(`UPDATE assignments SET status = 'published'`);
  // Una noticia en la cola, para que la corrida tenga trabajo universal.
  db.raw
    .prepare(
      `INSERT INTO candidates (id, section_id, url, title, summary, published_at, score)
       VALUES ('c1', 'economia', 'https://medio.example/nota', 'Sube la bolsa', 'La bolsa sube.', ?1, 5)`,
    )
    .run(AHORA.toISOString());
  return { db, d1 };
}

describe("1) el tema que el modelo rechaza se aparta y la corrida sigue con otro", () => {
  it("rechaza a la primera, escribe la segunda EN LA MISMA corrida y no la da por fallida", async () => {
    const { db, d1 } = await base();
    const { fetchImpl, llamadas } = mundo("Persona Rechazada", [
      persona("Persona Rechazada", 1951, "cantante italiana"),
      persona("Persona Aceptada", 1976, "cantante mexicana"),
    ]);
    const r = await runPipeline(
      { DB: d1, GEMINI_API_KEY: "k" },
      { trigger: "cron", base: "https://losupe.com", fetchImpl, now: AHORA, franja: "mediodia" },
    );
    expect(r.status).toBe("done");
    expect(r.notes.filter((n) => n.ok)).toHaveLength(1);
    expect(r.notes.find((n) => !n.ok)?.apartado).toBe(true);
    // El rechazado quedó en la lista que no olvida.
    const fila = db.raw
      .prepare(`SELECT value FROM settings WHERE key = 'temas_rechazados_por_contenido'`)
      .get() as { value: string } | undefined;
    expect(JSON.parse(fila?.value ?? "[]")).toEqual([
      "Persona Rechazada: 75 años de su nacimiento",
    ]);
    expect(llamadas.length).toBeGreaterThanOrEqual(2);
  });

  it("y la corrida siguiente ya ni lo intenta: no se vuelve a pagar por un no", async () => {
    const { db, d1 } = await base();
    db.raw.exec(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('temas_rechazados_por_contenido', '["Persona Rechazada: 75 años de su nacimiento"]')`,
    );
    const { fetchImpl, llamadas } = mundo("Persona Rechazada", [
      persona("Persona Rechazada", 1951, "cantante italiana"),
      persona("Persona Aceptada", 1976, "cantante mexicana"),
    ]);
    const r = await runPipeline(
      { DB: d1, GEMINI_API_KEY: "k" },
      { trigger: "cron", base: "https://losupe.com", fetchImpl, now: AHORA, franja: "mediodia" },
    );
    expect(r.status).toBe("done");
    expect(r.notes.every((n) => n.ok)).toBe(true);
    expect(llamadas).toHaveLength(1);
  });

  it("el rechazo por contenido tiene su propia clase (los demás errores siguen igual)", async () => {
    const responde = (body: unknown) =>
      (async () => Response.json(body)) as unknown as typeof fetch;
    const pedir = (fetchImpl: typeof fetch) =>
      generateJson({ apiKey: "k", model: "gemini-2.5-flash", system: "s", prompt: "x", fetchImpl });
    await expect(
      pedir(responde({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } })),
    ).rejects.toBeInstanceOf(GeminiContenidoError);
    await expect(
      pedir(responde({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] })),
    ).rejects.toBeInstanceOf(GeminiContenidoError);
    const vacio = pedir(responde({ candidates: [{ finishReason: "OTHER" }] }));
    await expect(vacio).rejects.not.toBeInstanceOf(GeminiContenidoError);
  });
});

describe("2) el selector de efemérides no elige lo que un diario familiar no celebra", () => {
  it("EL CASO DEL 26 NOV: el texto dice «actriz», la ficha dice «actriz pornográfica»", async () => {
    const { fetchImpl } = mundo("nadie", [
      {
        year: 1951,
        text: "Ilona Staller, actriz y política italiana.",
        pages: [
          {
            titles: { normalized: "Ilona Staller" },
            description: "actriz pornográfica, cantante y política hungaroitaliana",
            content_urls: { desktop: { page: "https://es.wikipedia.org/wiki/Ilona_Staller" } },
          },
        ],
      },
      persona("Persona Aceptada", 1976, "cantante mexicana"),
    ]);
    const lista = await efemeridesDeHoy(AHORA, fetchImpl);
    expect(lista.map((e) => e.fuentes[0]?.titulo)).toEqual(["Persona Aceptada"]);
  });

  it("fuera: cine para adultos y crímenes atroces; dentro: lo que sí es noticia", () => {
    for (const malo of [
      "actriz pornográfica",
      "estrella del cine para adultos",
      "modelo de Playboy",
      "asesino en serie estadounidense",
      "narcotraficante colombiano",
      "terrorista",
    ]) {
      expect(esAptaParaFamilias("Nació alguien, actor", malo), malo).toBe(false);
    }
    for (const bueno of [
      "Murió John Lennon, músico británico, asesinado en Nueva York",
      "Nació Juan Gabriel, cantante y compositor mexicano",
      "Quebró un banco importante en plena crisis económica",
    ]) {
      expect(esAptaParaFamilias(bueno), bueno).toBe(true);
    }
  });
});

describe("3) el reloj no se apaga solo ni publica de madrugada", () => {
  it("seis fallos seguidos se avisan, pero la guardia de GitHub sigue llamando", () => {
    const yml = readFileSync(".github/workflows/robot.yml", "utf8");
    const bucle = yml
      .slice(yml.indexOf("while ["), yml.indexOf("done\n"))
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    // Dentro del bucle no puede haber un `exit`: fue lo que dejó al diario sin reloj el 26 nov.
    expect(bucle).not.toMatch(/\bexit\b/);
    expect(yml).toContain("RACHA=1");
  });

  it("el reloj fuera de franja no escribe, aunque el cupo del día esté vacío", async () => {
    const { d1 } = await base();
    const { fetchImpl, llamadas } = mundo("nadie", [persona("Persona Aceptada", 1976, "cantante")]);
    const { runScheduled } = await import("@/lib/robot/scheduled");
    // 00:21 del Este: lo que pasó el 26 nov 2026 (una nota a las 12:21 AM).
    const madrugada = new Date("2026-11-26T05:21:00Z");
    const r = await runPipeline(
      { DB: d1, GEMINI_API_KEY: "k" },
      {
        trigger: "cron",
        base: "https://losupe.com",
        fetchImpl,
        now: madrugada,
        respetarHorario: true,
      },
    );
    expect(r).toMatchObject({ status: "skipped", reason: "fuera_de_horario" });
    expect(llamadas).toHaveLength(0);
    expect(typeof runScheduled).toBe("function");
  });

  it("y runScheduled lo pide para el reloj, no para la corrida a mano", () => {
    const fuente = readFileSync("src/lib/robot/scheduled.ts", "utf8");
    expect(fuente).toMatch(/respetarHorario: trigger === "cron"/);
  });
});
