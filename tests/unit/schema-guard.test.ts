import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyLegacySeed,
  applySchema,
  createSchemaGuard,
  ensureLegacySeed,
  ensureSchema,
  hasCoreTables,
  isLegacySeeded,
  splitSql,
} from "@/lib/schema-guard";
import { buildHealthReport } from "@/lib/health";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import { LEGACY_SEED } from "@/lib/seed-legacy";
import { FakeD1 } from "./fake-d1";

const SCHEMA = readFileSync(resolve(process.cwd(), "schema.sql"), "utf8");

/** D1 falsa con batch() que registra las sentencias aplicadas. */
class FakeD1WithBatch extends FakeD1 {
  batched: string[] = [];
  async batch(stmts: unknown[]) {
    this.batched.push(...stmts.map(() => "stmt"));
    return stmts.map(() => ({ success: true, results: [], meta: {} }));
  }
}

describe("esquema incrustado", () => {
  it("src/lib/schema-sql.ts está al día con schema.sql (corre npm run schema:embed si falla)", () => {
    expect(SCHEMA_SQL).toBe(SCHEMA);
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
        /^(CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|CREATE UNIQUE INDEX IF NOT EXISTS|INSERT OR IGNORE INTO)/,
      );
    }
  });
});

describe("ensureSchema", () => {
  it("sin binding reporta el problema sin lanzar", async () => {
    const status = await ensureSchema(undefined, SCHEMA);
    expect(status).toMatchObject({ binding: false, applied: false });
    expect(status.error).toContain("env.DB");
  });
  it("si las tablas existen no toca nada", async () => {
    const db = new FakeD1WithBatch(() => [{ n: 5 }]);
    expect(await hasCoreTables(db.asD1())).toBe(true);
    const status = await ensureSchema(db.asD1(), SCHEMA);
    expect(status).toEqual({ binding: true, hadTables: true, applied: false });
    expect(db.batched).toHaveLength(0);
  });
  it("si faltan tablas aplica todo el esquema en lote", async () => {
    const db = new FakeD1WithBatch(() => [{ n: 0 }]);
    const status = await ensureSchema(db.asD1(), SCHEMA);
    expect(status).toEqual({ binding: true, hadTables: false, applied: true });
    expect(db.batched.length).toBe(splitSql(SCHEMA).length);
    expect(await applySchema(db.asD1(), "CREATE TABLE IF NOT EXISTS x (a TEXT);")).toBe(1);
  });
  it("el guardián memoriza el resultado, lo reverifica al vencer el plazo y al forzar", async () => {
    let clock = 1_000;
    const db = new FakeD1WithBatch(() => [{ n: 5 }]);
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
    let tables = 5;
    const db = new FakeD1WithBatch(() => [{ n: tables }]);
    const guard = createSchemaGuard(SCHEMA, { ttlMs: 0 });
    expect((await guard.ensure(db.asD1())).hadTables).toBe(true);
    tables = 0;
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

describe("semilla heredada", () => {
  const SEED = [
    "INSERT OR IGNORE INTO authors (id, name) VALUES ('x', 'X')",
    "INSERT OR IGNORE INTO articles (id) VALUES ('a')",
  ];

  it("siembra una sola vez y deja la marca en settings", async () => {
    let flag: string | null = null;
    const db = new FakeD1WithBatch((sql) => {
      if (sql.includes("FROM settings")) return flag ? [{ value: flag }] : [];
      if (sql.includes("INSERT OR REPLACE INTO settings")) {
        flag = "1";
        return [];
      }
      return [{ n: 5 }];
    });
    const first = await ensureLegacySeed(db.asD1(), SEED);
    expect(first).toEqual({ seeded: true, applied: true, statements: 2 });
    expect(db.batched).toHaveLength(2);
    const second = await ensureLegacySeed(db.asD1(), SEED);
    expect(second).toEqual({ seeded: true, applied: false, statements: 2 });
    expect(db.batched).toHaveLength(2);
    expect(await isLegacySeeded(db.asD1())).toBe(true);
  });

  it("aplica en lotes del tamaño pedido", async () => {
    const db = new FakeD1WithBatch(() => []);
    await applyLegacySeed(
      db.asD1(),
      Array.from({ length: 45 }, (_, i) => `INSERT OR IGNORE INTO t VALUES (${i})`),
      20,
    );
    expect(db.batched).toHaveLength(45);
  });

  it("sin semilla o con error no rompe", async () => {
    expect(await ensureLegacySeed(new FakeD1().asD1(), [])).toEqual({
      seeded: true,
      applied: false,
      statements: 0,
    });
    const broken = {
      prepare: () => {
        throw new Error("sin settings");
      },
    } as unknown as D1Database;
    const r = await ensureLegacySeed(broken, SEED);
    expect(r.seeded).toBe(false);
    expect(r.error).toContain("sin settings");
  });

  it("el guardián siembra después de crear el esquema y no lo repite", async () => {
    let flag: string | null = null;
    const db = new FakeD1WithBatch((sql) => {
      if (sql.includes("FROM settings")) return flag ? [{ value: flag }] : [];
      if (sql.includes("INSERT OR REPLACE INTO settings")) {
        flag = "1";
        return [];
      }
      if (sql.includes("sqlite_master")) return [{ n: 5 }];
      return [];
    });
    const guard = createSchemaGuard(SCHEMA, { seed: SEED, ttlMs: 0 });
    const s1 = await guard.ensure(db.asD1());
    expect(s1.seed).toEqual({ seeded: true, applied: true, statements: 2 });
    const s2 = await guard.ensure(db.asD1());
    expect(s2.seed?.applied).toBe(false);
    expect(db.batched).toHaveLength(2);
  });

  it("la semilla real incrustada tiene las 33 noticias y cada sentencia es un INSERT completo", () => {
    expect(LEGACY_SEED.length).toBeGreaterThanOrEqual(66);
    for (const s of LEGACY_SEED) {
      expect(s.startsWith("INSERT OR IGNORE INTO ")).toBe(true);
      expect(s.endsWith(")")).toBe(true);
    }
    expect(LEGACY_SEED.filter((s) => s.startsWith("INSERT OR IGNORE INTO articles ")).length).toBe(
      33,
    );
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
