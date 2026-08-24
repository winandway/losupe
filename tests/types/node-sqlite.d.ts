/**
 * Tipos mínimos de `node:sqlite` (SQLite incluido en Node desde la 22). El proyecto usa
 * `@types/node` 20, que todavía no lo declara, y subir esa dependencia solo por una prueba movería
 * los tipos de todo el proyecto. Esto declara lo poco que usa `tests/unit/sqlite-d1.ts`.
 * Cuando `@types/node` suba a 22+, este archivo se puede borrar.
 */
declare module "node:sqlite" {
  export class StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
