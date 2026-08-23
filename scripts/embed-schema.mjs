// Incrusta schema.sql y las semillas de contenido dentro del worker, para que la base se cree y se
// siembre sola en producción. Se corre antes de cada build (npm run schema:embed).
//
// Semillas:
//   - seed/legacy-mundoscrypto.sql  → id "legacy-mundoscrypto", marca "legacy_seeded" (una sola vez).
//   - seed/content/*.mjs            → una nota editorial por archivo (INSERT OR REPLACE), marca
//                                     "seed:<id>:<huella>": si editas la nota y publicas, se actualiza.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);

// ---------- esquema ----------
const sql = readFileSync(new URL("schema.sql", root), "utf8");
writeFileSync(
  new URL("src/lib/schema-sql.ts", root),
  `// Generado por scripts/embed-schema.mjs a partir de schema.sql. NO editar a mano.
export const SCHEMA_SQL = ${JSON.stringify(sql)};
`,
);
console.log(`✓ schema.sql incrustado (${sql.length} caracteres)`);

// ---------- utilidades ----------
function q(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
function wordCount(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

const seeds = [];

// ---------- semilla heredada ----------
const legacyUrl = new URL("seed/legacy-mundoscrypto.sql", root);
if (existsSync(legacyUrl)) {
  const raw = readFileSync(legacyUrl, "utf8")
    .split("\n")
    .filter(
      (line, i, all) =>
        !(line.startsWith("--") && all.slice(0, i).every((l) => l.startsWith("--"))),
    )
    .join("\n");
  const statements = raw
    .split(/;\n(?=INSERT OR IGNORE INTO |$)/)
    .map((s) => s.trim().replace(/;$/, ""))
    .filter((s) => s.length > 0);
  seeds.push({ id: "legacy-mundoscrypto", flag: "legacy_seeded", statements });
}

// ---------- notas editoriales ----------
const contentDir = new URL("seed/content/", root);
if (existsSync(contentDir)) {
  const files = readdirSync(contentDir)
    .filter((f) => f.endsWith(".mjs"))
    .sort();
  for (const file of files) {
    const mod = await import(pathToFileURL(new URL(file, contentDir).pathname).href);
    const note = mod.default;
    const a = note.article;
    const statements = [];
    const minutes = Math.max(1, Math.round(wordCount(note.i18n.es?.content_html ?? "") / 200));
    statements.push(
      `INSERT OR REPLACE INTO articles (id, section_id, author_id, status, kind, origin, image_url, image_alt_es, image_alt_en, image_credit, sources_json, ai_assisted, reading_minutes, views, published_at, created_at, updated_at) VALUES (${q(a.id)}, ${q(a.section_id)}, ${q(a.author_id)}, ${q(a.status ?? "published")}, ${q(a.kind ?? "news")}, ${q(a.origin ?? "editorial")}, ${q(a.image_url)}, ${q(a.image_alt_es)}, ${q(a.image_alt_en)}, ${q(a.image_credit)}, ${q(JSON.stringify(a.sources ?? []))}, ${a.ai_assisted ? 1 : 0}, ${minutes}, COALESCE((SELECT views FROM articles WHERE id = ${q(a.id)}), 0), ${q(a.published_at)}, COALESCE((SELECT created_at FROM articles WHERE id = ${q(a.id)}), ${q(a.published_at)}), ${q(a.updated_at ?? a.published_at)})`,
    );
    for (const [lang, t] of Object.entries(note.i18n)) {
      statements.push(
        `INSERT OR REPLACE INTO article_i18n (article_id, lang, slug, title, excerpt, content_html, meta_title, meta_description, tags_json, machine_translated) VALUES (${q(a.id)}, ${q(lang)}, ${q(t.slug)}, ${q(t.title)}, ${q(t.excerpt ?? "")}, ${q(t.content_html.trim())}, ${q(t.meta_title ?? null)}, ${q(t.meta_description ?? null)}, ${q(JSON.stringify(t.tags ?? []))}, ${t.machine_translated ? 1 : 0})`,
      );
    }
    const fingerprint = hash(statements.join("\n"));
    seeds.push({ id: note.id, flag: `seed:${note.id}:${fingerprint}`, statements });
  }
}

writeFileSync(
  new URL("src/lib/seed-content.ts", root),
  `// Generado por scripts/embed-schema.mjs (seed/legacy-mundoscrypto.sql + seed/content/*.mjs). NO editar a mano.
import type { ContentSeed } from "./schema-guard";
export const CONTENT_SEEDS: readonly ContentSeed[] = ${JSON.stringify(seeds)};
`,
);
console.log(
  `✓ semillas incrustadas: ${seeds.map((s) => `${s.id} (${s.statements.length})`).join(", ")}`,
);
