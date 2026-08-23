/** D1 falsa para pruebas: registra las consultas y responde con filas que decide la prueba. */
export type FakeRow = Record<string, unknown>;
export type Responder = (sql: string, params: unknown[]) => FakeRow[];

export class FakeD1 {
  calls: { sql: string; params: unknown[] }[] = [];
  constructor(private responder: Responder = () => []) {}

  prepare(sql: string) {
    let params: unknown[] = [];
    const record = () => {
      // D1 rechaza la consulta si el número de valores enlazados no coincide con el mayor ?N.
      const numbered = [...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1]));
      const anonymous = (sql.match(/\?(?!\d)/g) ?? []).length;
      const expected = numbered.length > 0 ? Math.max(...numbered) : anonymous;
      if (expected !== params.length) {
        throw new Error(
          `D1_ERROR: Wrong number of parameter bindings for SQL query (espera ${expected}, recibió ${params.length}).`,
        );
      }
      this.calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    };
    const stmt = {
      bind: (...p: unknown[]) => {
        params = p;
        return stmt;
      },
      all: async <T>() => {
        record();
        return { results: this.responder(sql, params) as T[], success: true, meta: {} };
      },
      first: async <T>() => {
        record();
        const rows = this.responder(sql, params);
        return (rows[0] ?? null) as T | null;
      },
      run: async () => {
        record();
        // Las escrituras también pasan por el respondedor, para que la prueba pueda reaccionar.
        this.responder(sql, params);
        return { success: true, meta: {} };
      },
      raw: async () => [],
    };
    return stmt;
  }

  asD1(): D1Database {
    return this as unknown as D1Database;
  }
}

export const sampleCardRow = {
  id: "a1",
  section_id: "cripto",
  author_id: "kevin-rondon",
  author_name: "Kevin Rondón",
  image_url: "/img/legacy/x.webp",
  image_alt_es: "Bitcoin",
  image_alt_en: null,
  published_at: "2025-11-20T10:00:00.000Z",
  updated_at: "2025-11-21T10:00:00.000Z",
  reading_minutes: 4,
  kind: "news",
  origin: "mundoscrypto",
  ai_assisted: 0,
  lang: "es",
  slug: "bitcoin-sube",
  title: "Bitcoin sube",
  excerpt: "Resumen",
  fallback: 0,
};

export const sampleFullRow = {
  ...sampleCardRow,
  content_html: "<p>Hola <strong>mundo</strong></p>",
  meta_title: "Bitcoin sube hoy",
  meta_description: "Descripción",
  tags_json: '["bitcoin","mercado"]',
  sources_json: '[{"title":"Fuente","url":"https://example.com/f"}]',
  image_credit: null,
  machine_translated: 0,
};
