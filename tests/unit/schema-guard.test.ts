import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applySchema,
  applySeed,
  createSchemaGuard,
  ensureSchema,
  ensureSeed,
  getStoredSchemaHash,
  hasCoreTables,
  hashSchema,
  isSeedApplied,
  SCHEMA_HASH_KEY,
  splitSql,
  type ContentSeed,
} from "@/lib/schema-guard";
import { buildHealthReport } from "@/lib/health";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import { CONTENT_SEEDS } from "@/lib/seed-content";
import { FakeD1 } from "./fake-d1";

const SCHEMA = readFileSync(resolve(process.cwd(), "schema.sql"), "utf8");
const HASH = hashSchema(SCHEMA);

/** D1 falsa con batch() que registra las sentencias aplicadas. */
class FakeD1WithBatch extends FakeD1 {
  batched: string[] = [];
  async batch(stmts: unknown[]) {
    this.batched.push(...stmts.map(() => "stmt"));
    return stmts.map(() => ({ success: true, results: [], meta: {} }));
  }
}

/** Base simulada con tablas, huella del esquema y marca de semilla configurables. */
function fakeDb(opts: { tables?: number; hash?: string | null; seeded?: boolean } = {}) {
  const state = { tables: opts.tables ?? 5, hash: opts.hash ?? null, seeded: opts.seeded ?? false };
  const db = new FakeD1WithBatch((sql, params) => {
    if (sql.includes("sqlite_master")) return [{ n: state.tables }];
    if (sql.includes("FROM settings")) {
      if (params[0] === SCHEMA_HASH_KEY) return state.hash ? [{ value: state.hash }] : [];
      if (String(params[0]).startsWith("seed:") || params[0] === "legacy_seeded")
        return state.seeded ? [{ value: "1" }] : [];
      return [];
    }
    if (sql.includes("INSERT OR REPLACE INTO settings")) {
      if (params[0] === SCHEMA_HASH_KEY) state.hash = String(params[1]);
      if (String(params[0]).startsWith("seed:") || params[0] === "legacy_seeded")
        state.seeded = true;
      return [];
    }
    return [];
  });
  return { db, state };
}

describe("esquema incrustado", () => {
  it("src/lib/schema-sql.ts está al día con schema.sql (corre npm run schema:embed si falla)", () => {
    expect(SCHEMA_SQL).toBe(SCHEMA);
  });
  it("hashSchema es estable y cambia con el texto", () => {
    expect(hashSchema("a")).toBe(hashSchema("a"));
    expect(hashSchema("a")).not.toBe(hashSchema("b"));
    expect(HASH).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("splitSql", () => {
  it("separa sentencias y descarta comentarios", () => {
    const parts = splitSql(
      `-- comentario\nCREATE TABLE a (x TEXT);\n\nINSERT INTO a VALUES ('hola, mundo');\n-- fin\n`,
    );
    expect(parts).toEqual(["CREATE TABLE a (x TEXT)", "INSERT INTO a VALUES ('hola, mundo')"]);
  });
  it("el schema.sql real se parte en sentencias válidas y ninguna trae ';' adentro", () => {
    const parts = splitSql(SCHEMA);
    expect(parts.length).toBeGreaterThan(15);
    for (const p of parts) {
      expect(p).not.toContain(";");
      expect(p).toMatch(
        /^(CREATE TABLE IF NOT EXISTS|CREATE VIRTUAL TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|CREATE UNIQUE INDEX IF NOT EXISTS|INSERT OR IGNORE INTO|ALTER TABLE|UPDATE )/,
      );
    }
  });
});

describe("migraciones de columnas (ALTER TABLE)", () => {
  it("si la columna ya existe, sigue adelante; cualquier otro error se propaga", async () => {
    const vistos: string[] = [];
    const duplicada = {
      prepare: (sql: string) => ({
        run: async () => {
          vistos.push(sql);
          if (/^ALTER TABLE/i.test(sql)) throw new Error("duplicate column name: sections_json");
          return { success: true };
        },
      }),
      batch: async (stmts: unknown[]) => stmts.map(() => ({ success: true })),
    } as unknown as D1Database;
    await expect(
      applySchema(
        duplicada,
        "ALTER TABLE a ADD COLUMN b TEXT;\nCREATE TABLE IF NOT EXISTS x (a TEXT);",
      ),
    ).resolves.toBe(2);
    expect(vistos.some((s) => s.startsWith("ALTER TABLE"))).toBe(true);

    const rota = {
      prepare: () => ({
        run: async () => {
          throw new Error("no such table: a");
        },
      }),
      batch: async (stmts: unknown[]) => stmts.map(() => ({ success: true })),
    } as unknown as D1Database;
    await expect(applySchema(rota, "ALTER TABLE a ADD COLUMN b TEXT;")).rejects.toThrow(
      /no such table/,
    );
  });
});

describe("ensureSchema", () => {
  it("sin binding reporta el problema sin lanzar", async () => {
    const status = await ensureSchema(undefined, SCHEMA);
    expect(status).toMatchObject({ binding: false, applied: false });
    expect(status.error).toContain("env.DB");
  });
  it("si las tablas existen y la huella coincide no toca nada", async () => {
    const { db } = fakeDb({ tables: 5, hash: HASH });
    expect(await hasCoreTables(db.asD1())).toBe(true);
    expect(await getStoredSchemaHash(db.asD1())).toBe(HASH);
    const status = await ensureSchema(db.asD1(), SCHEMA);
    expect(status).toEqual({ binding: true, hadTables: true, applied: false });
    expect(db.batched).toHaveLength(0);
  });
  it("si las tablas existen pero el esquema cambió, lo vuelve a aplicar y guarda la huella", async () => {
    const { db, state } = fakeDb({ tables: 5, hash: "vieja" });
    const status = await ensureSchema(db.asD1(), SCHEMA);
    expect(status).toEqual({ binding: true, hadTables: true, applied: true, upgraded: true });
    expect(db.batched.length).toBe(splitSql(SCHEMA).filter((x) => !/^ALTER TABLE/i.test(x)).length);
    expect(state.hash).toBe(HASH);
  });
  it("si faltan tablas aplica todo el esquema en lote y guarda la huella", async () => {
    const { db, state } = fakeDb({ tables: 0 });
    const status = await ensureSchema(db.asD1(), SCHEMA);
    expect(status).toEqual({ binding: true, hadTables: false, applied: true });
    expect(db.batched.length).toBe(splitSql(SCHEMA).filter((x) => !/^ALTER TABLE/i.test(x)).length);
    expect(state.hash).toBe(HASH);
    expect(await applySchema(db.asD1(), "CREATE TABLE IF NOT EXISTS x (a TEXT);")).toBe(1);
  });
  it("el guardián memoriza el resultado, lo reverifica al vencer el plazo y al forzar", async () => {
    let clock = 1_000;
    const { db } = fakeDb({ tables: 5, hash: HASH });
    const guard = createSchemaGuard(SCHEMA, { ttlMs: 1_000, now: () => clock });
    const checks = () => db.calls.filter((c) => c.sql.includes("sqlite_master")).length;
    expect(guard.status()).toBeNull();
    await Promise.all([guard.ensure(db.asD1()), guard.ensure(db.asD1())]);
    await guard.ensure(db.asD1());
    expect(checks()).toBe(1);
    expect(guard.status()?.hadTables).toBe(true);
    clock += 999;
    await guard.ensure(db.asD1());
    expect(checks()).toBe(1);
    clock += 2;
    await guard.ensure(db.asD1());
    expect(checks()).toBe(2);
    await guard.ensure(db.asD1(), { force: true });
    expect(checks()).toBe(3);
  });
  it("si las tablas desaparecen, el guardián las vuelve a crear al reverificar", async () => {
    const { db, state } = fakeDb({ tables: 5, hash: HASH });
    const guard = createSchemaGuard(SCHEMA, { ttlMs: 0 });
    expect((await guard.ensure(db.asD1())).hadTables).toBe(true);
    state.tables = 0;
    const after = await guard.ensure(db.asD1());
    expect(after.applied).toBe(true);
    expect(db.batched.length).toBeGreaterThan(10);
  });
  it("si la base lanza error, lo reporta", async () => {
    const broken = {
      prepare: () => {
        throw new Error("no such table");
      },
    } as unknown as D1Database;
    const status = await ensureSchema(broken, SCHEMA);
    expect(status.applied).toBe(false);
    expect(status.error).toContain("no such table");
  });
});

describe("semillas de contenido", () => {
  const SEED: ContentSeed = {
    id: "prueba",
    flag: "seed:prueba:abc",
    statements: [
      "INSERT OR IGNORE INTO authors (id, name) VALUES ('x', 'X')",
      "INSERT OR IGNORE INTO articles (id) VALUES ('a')",
    ],
  };

  it("siembra una sola vez y deja la marca en settings", async () => {
    const { db } = fakeDb({ tables: 5, hash: HASH });
    const first = await ensureSeed(db.asD1(), SEED);
    expect(first).toEqual({ id: "prueba", seeded: true, applied: true, statements: 2 });
    expect(db.batched).toHaveLength(2);
    const second = await ensureSeed(db.asD1(), SEED);
    expect(second).toEqual({ id: "prueba", seeded: true, applied: false, statements: 2 });
    expect(db.batched).toHaveLength(2);
    expect(await isSeedApplied(db.asD1(), SEED.flag)).toBe(true);
  });

  it("aplica en lotes del tamaño pedido", async () => {
    const { db } = fakeDb();
    await applySeed(
      db.asD1(),
      {
        id: "lotes",
        flag: "seed:lotes",
        statements: Array.from({ length: 45 }, (_, i) => `INSERT OR IGNORE INTO t VALUES (${i})`),
      },
      20,
    );
    expect(db.batched).toHaveLength(45);
  });

  it("sin sentencias o con error no rompe", async () => {
    expect(
      await ensureSeed(new FakeD1().asD1(), { id: "vacia", flag: "seed:vacia", statements: [] }),
    ).toEqual({
      id: "vacia",
      seeded: true,
      applied: false,
      statements: 0,
    });
    const broken = {
      prepare: () => {
        throw new Error("sin settings");
      },
    } as unknown as D1Database;
    const r = await ensureSeed(broken, SEED);
    expect(r.seeded).toBe(false);
    expect(r.error).toContain("sin settings");
  });

  it("el guardián siembra después de crear el esquema y no lo repite", async () => {
    const { db, state } = fakeDb({ tables: 0 });
    const guard = createSchemaGuard(SCHEMA, { seeds: [SEED], ttlMs: 0 });
    const s1 = await guard.ensure(db.asD1());
    expect(s1.applied).toBe(true);
    expect(s1.seeds).toEqual([{ id: "prueba", seeded: true, applied: true, statements: 2 }]);
    state.tables = 5; // ya existen las tablas y la huella coincide
    const s2 = await guard.ensure(db.asD1());
    expect(s2.seeds?.[0]?.applied).toBe(false);
    // Los ALTER van uno a uno (fuera del lote); el resto del esquema + las 2 de la semilla sí van en lote.
    expect(db.batched).toHaveLength(
      splitSql(SCHEMA).filter((x) => !/^ALTER TABLE/i.test(x)).length + 2,
    );
  });

  it("las semillas reales incrustadas: archivo de MundosCrypto (33 notas) y notas editoriales", () => {
    const legacy = CONTENT_SEEDS.find((s) => s.id === "legacy-mundoscrypto");
    expect(legacy?.flag).toBe("legacy_seeded");
    expect(
      legacy?.statements.filter((s) => s.startsWith("INSERT OR IGNORE INTO articles ")).length,
    ).toBe(33);
    for (const s of legacy?.statements ?? []) expect(s.endsWith(")")).toBe(true);
    const editorial = CONTENT_SEEDS.filter((s) => s.id !== "legacy-mundoscrypto");
    expect(editorial.length).toBeGreaterThanOrEqual(1);
    for (const seed of editorial) {
      expect(seed.flag.startsWith(`seed:${seed.id}:`)).toBe(true);
      expect(seed.flag.split(":")[2]).toMatch(/^[0-9a-f]{8}$/);
      expect(seed.statements[0]).toMatch(/^INSERT OR REPLACE INTO articles /);
      expect(seed.statements.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("health", () => {
  it("reporta conteos cuando la base responde", async () => {
    const db = new FakeD1((sql) => [{ n: sql.includes("articles") ? 33 : 7 }]);
    const report = await buildHealthReport(db.asD1(), {
      binding: true,
      hadTables: true,
      applied: false,
    });
    expect(report.ok).toBe(true);
    expect(report.db.articles).toBe(33);
    expect(report.db.authors).toBe(7);
  });
  it("reporta el fallo sin binding o con error", async () => {
    expect((await buildHealthReport(undefined, null)).ok).toBe(false);
    const broken = {
      prepare: () => {
        throw new Error("boom");
      },
    } as unknown as D1Database;
    const r = await buildHealthReport(broken, null);
    expect(r.ok).toBe(false);
    expect(r.db.error).toBe("boom");
  });
});
