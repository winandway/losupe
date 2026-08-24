/**
 * El fallo de las dos fechas, probado contra SQLite DE VERDAD.
 *
 * Sin esta prueba el error del 24 ago 2026 vuelve sin avisar: el código se ve correcto, no lanza
 * ninguna excepción y simplemente deja de frenar. Aquí se ejecuta el SQL real.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextQueuedAssignment, sponsorNextSlot } from "@/lib/robot/queue";
import { SQL_NOW } from "@/lib/sql-time";
import { SqliteD1 } from "./sqlite-d1";

const AHORA = new Date("2026-08-24T12:00:00Z");
const SP = "sp-prueba";

function base() {
  const db = new SqliteD1();
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE sponsors (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, website TEXT NOT NULL, contact_name TEXT,
      contact_email TEXT, brief TEXT, section_id TEXT, notes_total INTEGER NOT NULL DEFAULT 1,
      period_start TEXT, period_end TEXT, status TEXT NOT NULL DEFAULT 'active',
      internal_notes TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE assignments (
      id TEXT PRIMARY KEY, sponsor_id TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
      title_idea TEXT NOT NULL, brief TEXT, section_id TEXT,
      source_urls_json TEXT NOT NULL DEFAULT '[]', scheduled_for TEXT,
      status TEXT NOT NULL DEFAULT 'queued', research_json TEXT, article_id TEXT, run_id TEXT,
      error TEXT, created_at TEXT, updated_at TEXT, published_at TEXT);
    INSERT INTO settings (key, value) VALUES ('sponsor_min_gap_hours','72'),('sponsor_max_per_week','2');
    INSERT INTO sponsors (id, name, website, section_id, notes_total, status)
      VALUES ('${SP}', 'Empresa de prueba', 'https://ejemplo.com/', 'tecnologia', 6, 'active');
    INSERT INTO assignments (id, sponsor_id, position, title_idea, status) VALUES
      ('a1','${SP}',1,'Primera idea','queued'),
      ('a2','${SP}',2,'Segunda idea','queued'),
      ('a3','${SP}',3,'Tercera idea','queued');
  `);
  return db;
}

/** Marca un encargo como publicado hace N horas, con el formato ISO que usa el código. */
function publicadoHace(db: SqliteD1, id: string, horas: number) {
  const iso = new Date(AHORA.getTime() - horas * 3_600_000).toISOString();
  db.raw
    .prepare(`UPDATE assignments SET status = 'published', published_at = ?1 WHERE id = ?2`)
    .run(iso, id);
}

describe("las fechas de la base y las de JavaScript tienen que compararse bien", () => {
  it("SQLite comparando texto DA LA VUELTA a las dos formas (esto es el fallo)", () => {
    const db = new SqliteD1();
    const r = db.raw
      .prepare(`SELECT ('2026-08-24 08:00:00' > '2026-08-24T02:00:00.000Z') AS mal`)
      .get() as { mal: number };
    // Una nota de las 8 de la mañana parece MÁS VIEJA que el corte de las 2. Por eso no se compara
    // como texto: se usa julianday(). Si algún día esto diera 1, el problema estaría resuelto en
    // SQLite y esta prueba se puede borrar.
    expect(r.mal).toBe(0);
    const bien = db.raw
      .prepare(
        `SELECT (julianday('2026-08-24 08:00:00') > julianday('2026-08-24T02:00:00.000Z')) AS ok`,
      )
      .get() as { ok: number };
    expect(bien.ok).toBe(1);
  });

  it("SQL_NOW escribe en el mismo formato que toISOString()", () => {
    const db = new SqliteD1();
    const r = db.raw.prepare(`SELECT ${SQL_NOW} AS ahora`).get() as { ahora: string };
    expect(r.ahora).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(r.ahora).toISOString()).toBe(r.ahora);
  });

  it("con una nota publicada hace 4 horas, el patrocinador NO puede sacar otra", async () => {
    const db = base();
    publicadoHace(db, "a1", 4);
    expect(await nextQueuedAssignment(db.asD1(), AHORA)).toBeNull();
  });

  it("CASO QUE MUERDE: separación corta (6 h) con una fila en el formato viejo", async () => {
    // Aquí es donde el desfase de formatos hace daño de verdad: si la separación es de pocas horas,
    // el corte cae el MISMO día que la nota, y entonces comparar como texto sí da la vuelta
    // (' ' < 'T'). Con una separación de 3 días las fechas difieren en el día y el error se
    // esconde — por eso este caso concreto es el candado.
    const db = base();
    db.raw.prepare(`UPDATE settings SET value = '6' WHERE key = 'sponsor_min_gap_hours'`).run();
    // Publicada hace 4 horas, escrita como lo dejaba `datetime('now')`: con espacio y sin Z.
    db.raw
      .prepare(`UPDATE assignments SET status = 'published', published_at = ?1 WHERE id = 'a1'`)
      .run("2026-08-24 08:00:00");
    // Con 6 horas de separación, una nota de hace 4 NO deja salir la siguiente.
    expect(await nextQueuedAssignment(db.asD1(), AHORA)).toBeNull();
    const slot = await sponsorNextSlot(db.asD1(), SP, AHORA);
    expect(slot.availableAt).toBe("2026-08-24T14:00:00.000Z");
  });

  it("aunque la fila vieja tenga el formato antiguo de datetime('now'), el freno salta igual", async () => {
    const db = base();
    // Exactamente lo que dejó `datetime('now')`: con espacio y sin Z.
    db.raw
      .prepare(`UPDATE assignments SET status = 'published', published_at = ?1 WHERE id = 'a1'`)
      .run("2026-08-24 08:00:00");
    expect(await nextQueuedAssignment(db.asD1(), AHORA)).toBeNull();
    const slot = await sponsorNextSlot(db.asD1(), SP, AHORA);
    expect(slot.availableAt).toBe("2026-08-27T08:00:00.000Z");
  });

  it("pasadas las 72 horas sí le toca otra vez", async () => {
    const db = base();
    publicadoHace(db, "a1", 80);
    const r = await nextQueuedAssignment(db.asD1(), AHORA);
    expect(r?.titleIdea).toBe("Segunda idea");
  });

  it("con 2 notas ya publicadas esta semana se queda fuera hasta la siguiente", async () => {
    const db = base();
    publicadoHace(db, "a1", 80);
    publicadoHace(db, "a2", 100);
    expect(await nextQueuedAssignment(db.asD1(), AHORA)).toBeNull();
    const slot = await sponsorNextSlot(db.asD1(), SP, AHORA);
    expect(slot.availableAt).toBe("semana");
    expect(slot.publishedThisWeek).toBe(2);
  });

  it("las dos de hace más de una semana no cuentan para el tope", async () => {
    const db = base();
    publicadoHace(db, "a1", 24 * 9);
    publicadoHace(db, "a2", 24 * 10);
    const r = await nextQueuedAssignment(db.asD1(), AHORA);
    expect(r?.titleIdea).toBe("Tercera idea");
  });

  it("nadie vuelve a colar datetime('now') en el código", () => {
    // El formato de SQLite no se puede comparar con el de JavaScript. Si hace falta la hora dentro
    // de una consulta, se usa SQL_NOW (de src/lib/sql-time.ts).
    const permitidos = new Set(["src/lib/schema-sql.ts", "src/lib/sql-time.ts"]);
    const culpables: string[] = [];
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const ruta = `${dir}/${entrada.name}`;
        if (entrada.isDirectory()) recorrer(ruta);
        else if (/\.tsx?$/.test(entrada.name) && !permitidos.has(ruta)) {
          if (readFileSync(ruta, "utf8").includes("datetime('now')")) culpables.push(ruta);
        }
      }
    };
    recorrer("src");
    expect(culpables).toEqual([]);
  });

  it("schema.sql repara las fechas viejas y es idempotente", () => {
    const sql = readFileSync("schema.sql", "utf8");
    expect(sql).toContain("UPDATE assignments SET published_at = replace(published_at, ' ', 'T')");
    const db = new SqliteD1();
    db.exec(`CREATE TABLE assignments (id TEXT, published_at TEXT)`);
    db.raw.prepare(`INSERT INTO assignments VALUES ('x', '2026-08-24 08:00:00')`).run();
    const arreglo = `UPDATE assignments SET published_at = replace(published_at, ' ', 'T') || 'Z'
      WHERE published_at IS NOT NULL AND substr(published_at, 11, 1) = ' '`;
    db.exec(arreglo);
    db.exec(arreglo); // dos veces: no puede volver a tocarla
    const r = db.raw.prepare(`SELECT published_at AS p FROM assignments`).get() as { p: string };
    expect(r.p).toBe("2026-08-24T08:00:00Z");
  });
});
