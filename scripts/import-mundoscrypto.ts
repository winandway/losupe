/**
 * Importa las noticias de MundosCrypto (exportación CSV de su base) a losupe.
 *
 *   npx tsx scripts/import-mundoscrypto.ts --csv <ruta.csv> --images <carpeta-con-imagenes>
 *
 * Produce:
 *   - seed/legacy-mundoscrypto.sql  (INSERT OR IGNORE, idempotente)
 *   - public/img/legacy/*            (copia de las imágenes)
 *
 * No toca ninguna base remota: solo genera archivos en el repo.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { parseCsv } from "../src/lib/csv";
import { toIso } from "../src/lib/dates";
import { excerptFrom, readingMinutes, sanitizeHtml, stripHtml } from "../src/lib/html";
import { slugify } from "../src/lib/slug";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const csvPath = arg("csv");
const imagesDir = arg("images");
if (!csvPath || !imagesDir) {
  console.error("Uso: tsx scripts/import-mundoscrypto.ts --csv <archivo.csv> --images <carpeta>");
  process.exit(1);
}

const root = resolve(__dirname, "..");
const outSql = join(root, "seed", "legacy-mundoscrypto.sql");
const outImages = join(root, "public", "img", "legacy");
mkdirSync(join(root, "seed"), { recursive: true });
mkdirSync(outImages, { recursive: true });

const rows = parseCsv(readFileSync(csvPath, "utf8"), ";");
const available = new Set(readdirSync(imagesDir));

function q(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function authorIdFor(name: string): string {
  const clean = name.trim().toLowerCase();
  if (!clean) return "equipo-losupe";
  if (clean.includes("rond")) return "kevin-rondon";
  return slugify(name);
}

function parseTags(raw: string): string[] {
  const t = raw.trim();
  if (!t || t === "[]" || t === "{}") return [];
  try {
    const parsed: unknown = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    /* formato Postgres {a,b} o lista separada por comas */
  }
  return t
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((s) => s.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

const extraAuthors = new Map<string, string>();
const lines: string[] = [
  "-- Noticias heredadas de MundosCrypto. Generado por scripts/import-mundoscrypto.ts",
  "-- Idempotente (INSERT OR IGNORE). Una sentencia por línea.",
];
let imported = 0;
let withImage = 0;

for (const r of rows) {
  if ((r.status ?? "published") !== "published") continue;
  const id = r.id?.trim();
  const title = r.title?.trim();
  const slug = r.slug?.trim();
  if (!id || !title || !slug) continue;

  const contentHtml = sanitizeHtml(r.content ?? "");
  const authorName = (r.author_name ?? "").trim();
  const authorId = authorIdFor(authorName);
  if (authorId !== "equipo-losupe" && authorId !== "kevin-rondon" && authorName) {
    extraAuthors.set(authorId, authorName);
  }

  // Imagen: el archivo se llamó con el slug al descargarlo.
  let imageUrl: string | null = null;
  const candidates = [...available].filter((f) => basename(f, extname(f)) === slugify(slug).slice(0, 60));
  const file = candidates[0];
  if (file) {
    const dest = join(outImages, file);
    if (!existsSync(dest)) copyFileSync(join(imagesDir, file), dest);
    imageUrl = `/img/legacy/${file}`;
    withImage++;
  }

  const publishedAt = toIso(r.published_at) ?? toIso(r.updated_at) ?? new Date().toISOString();
  const updatedAt = toIso(r.last_modified_at) ?? toIso(r.updated_at) ?? publishedAt;
  const excerpt = stripHtml(r.excerpt ?? "").trim() || excerptFrom(contentHtml, 200);
  const minutes = Number.parseInt(r.reading_time ?? "", 10) || readingMinutes(contentHtml);
  const views = Number.parseInt(r.views ?? "0", 10) || 0;
  const tags = parseTags(r.tags ?? "");
  const sources = JSON.stringify([]);

  lines.push(
    `INSERT OR IGNORE INTO articles (id, section_id, author_id, status, kind, origin, image_url, image_alt_es, image_credit, sources_json, ai_assisted, reading_minutes, views, legacy_id, legacy_slug, is_premium, published_at, created_at, updated_at) VALUES (${q(id)}, 'cripto', ${q(authorId)}, 'published', 'news', 'mundoscrypto', ${q(imageUrl)}, ${q(stripHtml(r.featured_image_alt ?? "") || title)}, NULL, ${q(sources)}, 0, ${minutes}, ${views}, ${q(id)}, ${q(slug)}, ${r.is_premium === "true" ? 1 : 0}, ${q(publishedAt)}, ${q(publishedAt)}, ${q(updatedAt)});`,
  );
  lines.push(
    `INSERT OR IGNORE INTO article_i18n (article_id, lang, slug, title, excerpt, content_html, meta_title, meta_description, tags_json, machine_translated) VALUES (${q(id)}, 'es', ${q(slug)}, ${q(title)}, ${q(excerpt)}, ${q(contentHtml)}, ${q(stripHtml(r.meta_title ?? "") || null)}, ${q(stripHtml(r.meta_description ?? "") || null)}, ${q(JSON.stringify(tags))}, 0);`,
  );
  imported++;
}

// Autores que no estaban en schema.sql (van antes de los artículos).
const authorLines = [...extraAuthors].map(
  ([id, name]) =>
    `INSERT OR IGNORE INTO authors (id, name, kind, role_es, role_en) VALUES (${q(id)}, ${q(name)}, 'person', 'Periodista', 'Journalist');`,
);
writeFileSync(outSql, [...lines.slice(0, 2), ...authorLines, ...lines.slice(2)].join("\n") + "\n");

console.log(`✓ ${imported} noticias → ${outSql}`);
console.log(`✓ ${withImage} imágenes → ${outImages}`);
if (extraAuthors.size) console.log(`  autores adicionales: ${[...extraAuthors.values()].join(", ")}`);
