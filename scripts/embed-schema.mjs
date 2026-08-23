// Incrusta schema.sql (y la semilla de noticias heredadas) como texto dentro del worker, para que
// la base se cree y se siembre sola en producción. Se corre antes de cada build (npm run schema:embed).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const sql = readFileSync(new URL("schema.sql", root), "utf8");
writeFileSync(
  new URL("src/lib/schema-sql.ts", root),
  `// Generado por scripts/embed-schema.mjs a partir de schema.sql. NO editar a mano.
export const SCHEMA_SQL = ${JSON.stringify(sql)};
`,
);
console.log(`✓ schema.sql incrustado (${sql.length} caracteres)`);

// Semilla heredada: un INSERT por sentencia, generada por scripts/import-mundoscrypto.ts.
const seedUrl = new URL("seed/legacy-mundoscrypto.sql", root);
let statements = [];
if (existsSync(seedUrl)) {
  const raw = readFileSync(seedUrl, "utf8")
    .split("\n")
    .filter(
      (line, i, all) =>
        !(line.startsWith("--") && all.slice(0, i).every((l) => l.startsWith("--"))),
    )
    .join("\n");
  statements = raw
    .split(/;\n(?=INSERT OR IGNORE INTO |$)/)
    .map((s) => s.trim().replace(/;$/, ""))
    .filter((s) => s.length > 0);
}
writeFileSync(
  new URL("src/lib/seed-legacy.ts", root),
  `// Generado por scripts/embed-schema.mjs a partir de seed/legacy-mundoscrypto.sql. NO editar a mano.
export const LEGACY_SEED: readonly string[] = ${JSON.stringify(statements)};
`,
);
console.log(`✓ semilla heredada incrustada (${statements.length} sentencias)`);
