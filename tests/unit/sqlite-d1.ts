/**
 * D1 de verdad para las pruebas: SQLite real (`node:sqlite`, incluido en Node 22+) con la misma
 * interfaz que usa el código en producción.
 *
 * ¿Por qué hace falta si ya existe `FakeD1`? Porque la D1 falsa responde lo que la prueba le diga y
 * NUNCA ejecuta el SQL. El 24 ago 2026 eso dejó pasar un fallo real: el freno de los patrocinadores
 * comparaba `2026-08-24 05:12:00` contra `2026-08-24T02:00:00.000Z` y SQLite, comparando texto,
 * decía que la nota de hace 4 horas era más vieja que el corte. Con SQLite de verdad, la prueba
 * se pone roja. Úsala siempre que lo que se prueba sea la CONSULTA, no la lógica alrededor.
 */
import { DatabaseSync } from "node:sqlite";

export class SqliteD1 {
  readonly raw: DatabaseSync;
  constructor() {
    this.raw = new DatabaseSync(":memory:");
    this.raw.exec("PRAGMA foreign_keys = ON");
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  prepare(sql: string) {
    const db = this.raw;
    let params: unknown[] = [];
    // node:sqlite usa ?1, ?2… igual que D1, pero quiere los valores como lista posicional.
    const norm = (p: unknown[]) =>
      p.map((v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v)) as never[];
    const stmt = {
      bind: (...p: unknown[]) => {
        params = p;
        return stmt;
      },
      all: async <T>() => ({
        results: db.prepare(sql).all(...norm(params)) as T[],
        success: true,
        meta: {},
      }),
      first: async <T>() => (db.prepare(sql).get(...norm(params)) ?? null) as T | null,
      run: async () => {
        const r = db.prepare(sql).run(...norm(params));
        return { success: true, meta: { changes: Number(r.changes) } };
      },
    };
    return stmt;
  }

  async batch(stmts: unknown[]) {
    return stmts.map(() => ({ success: true, meta: {} }));
  }

  asD1(): D1Database {
    return this as unknown as D1Database;
  }
}
