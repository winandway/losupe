import { describe, expect, it } from "vitest";
import { runPipeline, robotStatus } from "@/lib/robot/pipeline";
import { decideNextKind, nextQueuedAssignment, queueSummary } from "@/lib/robot/queue";
import { FakeD1 } from "./fake-d1";

class Db extends FakeD1 {
  async batch(stmts: { run: () => Promise<unknown> }[]) {
    const out: { success: boolean; results: unknown[]; meta: { changes: number } }[] = [];
    for (const s of stmts) {
      await s.run();
      out.push({ success: true, results: [], meta: { changes: 1 } });
    }
    return out;
  }
}

const para = (n: number, seed: string) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<p>${seed} párrafo ${i} con palabras propias ${i * 3} para la nota de prueba número ${i} y algo más.</p>`,
  ).join("");
const draft = {
  es: {
    title: "Una empresa lanza su tienda en línea con entregas en todo el país",
    excerpt:
      "La empresa pone en marcha una tienda en línea para pequeños negocios con entregas en todo el país y precios finales.",
    content_html: `<h2>Qué es</h2>${para(40, "es")}`,
    meta_title: "Empresa lanza tienda en línea",
    meta_description:
      "Una empresa pone en marcha su tienda en línea con entregas en todo el país y precios finales sin sorpresas para pymes.",
    tags: ["empresa", "tienda", "pymes", "ventas"],
  },
  en: {
    title: "A company launches its online store with nationwide delivery",
    excerpt:
      "The company launches an online store for small businesses with nationwide delivery and final prices with no surprises.",
    content_html: `<h2>What it is</h2>${para(40, "en")}`,
    meta_title: "Company launches online store",
    meta_description:
      "A company launches its online store with nationwide delivery and final prices with no surprises for small businesses.",
    tags: ["company", "store", "smb", "sales"],
  },
  kind: "news",
  image_prompt: "Wide editorial photo of a small business owner packing orders",
  image_alt_es: "Dueño de negocio empacando pedidos",
  image_alt_en: "Business owner packing orders",
  image_keywords: ["small business", "orders"],
};

function settings(over: Record<string, string> = {}): Record<string, string> {
  return {
    robot_paused: "0",
    daily_budget_usd: "1.00",
    notes_per_day: "6",
    robot_auto_publish: "0",
    default_author: "andreea-blidar",
    evergreen_ratio: "0.7",
    robot_notes_per_run: "1",
    robot_last_kind: "universal",
    ...over,
  };
}

const sponsorRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Empresa",
  website: "https://empresa.com",
  contact_name: null,
  contact_email: null,
  brief: "vende software a pymes",
  section_id: "ventas",
  notes_total: 3,
  period_start: null,
  period_end: null,
  status: "active",
  internal_notes: null,
  created_at: "2026-08-23T00:00:00Z",
  updated_at: "2026-08-23T00:00:00Z",
  queued: 1,
  published: 0,
  in_review: 0,
};
const assignmentRow = {
  id: "22222222-2222-4222-8222-222222222222",
  sponsor_id: sponsorRow.id,
  position: 1,
  title_idea: "Cómo ayuda Empresa a las pymes a vender",
  brief: null,
  section_id: "ventas",
  source_urls_json: "[]",
  scheduled_for: null,
  status: "queued",
  article_id: null,
  run_id: null,
  error: null,
  created_at: "2026-08-23T00:00:00Z",
  updated_at: "2026-08-23T00:00:00Z",
  published_at: null,
};

function makeDb(opts: { settings?: Record<string, string>; spent?: number; queue?: boolean } = {}) {
  const st = settings(opts.settings);
  let spent = opts.spent ?? 0;
  let queued = opts.queue ?? true;
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = new Db((sql, params) => {
    if (sql.includes("FROM settings WHERE key")) {
      const v = st[String(params[0])];
      return v === undefined ? [] : [{ value: v }];
    }
    if (sql.startsWith("INSERT OR REPLACE INTO settings")) {
      st[String(params[0])] = String(params[1]);
      return [];
    }
    if (sql.includes("SUM(cost_usd)")) return [{ total: spent }];
    if (sql.startsWith("INSERT INTO spend_log")) {
      spent += Number(params[4]);
      return [];
    }
    if (sql.includes("FROM articles WHERE origin IN")) return [];
    if (sql.includes("FROM sources WHERE active")) return [];
    if (sql.includes("FROM assignments a") && sql.includes("JOIN sponsors s"))
      return queued ? [assignmentRow] : [];
    if (sql.includes("FROM sponsors s")) return [sponsorRow];
    if (sql.includes("FROM sections WHERE active")) return [{ id: "ventas", notes_per_day: 1 }];
    if (sql.includes("FROM candidates WHERE status = 'new'")) return [];
    if (sql.includes("UPDATE assignments SET status")) {
      if (String(params[1]) !== "working") queued = false;
      return [];
    }
    if (sql.includes("SELECT 1 AS x FROM article_i18n")) return [];
    if (sql.includes("SELECT 1 AS x FROM run_items"))
      return calls.some(
        (c) => c.sql.startsWith("INSERT INTO run_items") && c.params[0] === params[0],
      )
        ? [{ x: 1 }]
        : [];
    if (sql.startsWith("INSERT INTO run_items")) calls.push({ sql, params });
    if (sql.includes("FROM article_i18n WHERE article_id")) return [];
    if (sql.includes("FROM runs ORDER BY")) return [];
    if (sql.includes("COUNT(*) FROM sponsors WHERE status"))
      return [{ sponsors_active: 1, queued: queued ? 1 : 0, in_review: 0, published_total: 0 }];
    return [];
  });
  return db;
}

const geminiOk: typeof fetch = async (input) => {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes("generativelanguage.googleapis.com")) {
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }],
        usageMetadata: { promptTokenCount: 6000, candidatesTokenCount: 4000 },
      }),
      { headers: { "content-type": "application/json" } },
    );
  }
  if (url.startsWith("https://empresa.com")) {
    return new Response(
      `<html><head><title>Empresa</title></head><body><main><p>Empresa vende software para pymes con soporte y planes claros. ${"Texto del sitio. ".repeat(40)}</p><a href="/nosotros">Nosotros</a></main></body></html>`,
      { headers: { "content-type": "text/html" } },
    );
  }
  return new Response("not found", { status: 404 });
};

describe("pipeline del robot", () => {
  it("se salta la corrida si el robot está en pausa y lo deja escrito", async () => {
    const db = makeDb({ settings: { robot_paused: "1" } });
    const r = await runPipeline(
      { DB: db.asD1(), GEMINI_API_KEY: "k" },
      { trigger: "cron", base: "https://losupe.com", fetchImpl: geminiOk },
    );
    expect(r.status).toBe("skipped");
    expect(r.reason).toBe("robot_paused");
    const upd = db.calls.find((c) => c.sql.startsWith("UPDATE runs SET status"));
    expect(upd?.params[1]).toBe("skipped");
  });
  it("sin GEMINI_API_KEY la corrida termina en error visible (no en silencio)", async () => {
    const db = makeDb();
    const r = await runPipeline(
      { DB: db.asD1() },
      { trigger: "manual", base: "https://losupe.com", fetchImpl: geminiOk },
    );
    expect(r.status).toBe("error");
    expect(r.reason).toBe("missing_env:GEMINI_API_KEY");
  });
  it("con el tope diario gastado no corre", async () => {
    const db = makeDb({ spent: 1.5 });
    const r = await runPipeline(
      { DB: db.asD1(), GEMINI_API_KEY: "k" },
      { trigger: "cron", base: "https://losupe.com", fetchImpl: geminiOk },
    );
    expect(r.status).toBe("skipped");
    expect(r.reason).toBe("daily_budget_reached");
  });
  it("escribe un encargo: investiga el sitio, redacta, guarda en revisión, anota gasto y recuerda el turno", async () => {
    const db = makeDb();
    const r = await runPipeline(
      { DB: db.asD1(), GEMINI_API_KEY: "k" },
      { trigger: "cron", base: "https://losupe.com", fetchImpl: geminiOk },
    );
    expect(r.status).toBe("done");
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]).toMatchObject({
      kind: "sponsored",
      ok: true,
      status: "review",
      sponsor: "Empresa",
    });
    expect(r.spentUsd).toBeGreaterThan(0);
    const art = db.calls.find((c) => c.sql.startsWith("INSERT INTO articles"));
    expect(art?.params[3]).toBe("review"); // status
    expect(art?.params[5]).toBe("sponsored"); // origin
    expect(db.calls.filter((c) => c.sql.startsWith("INSERT INTO article_i18n"))).toHaveLength(2);
    const last = db.calls.find(
      (c) =>
        c.sql.startsWith("INSERT OR REPLACE INTO settings") && c.params[0] === "robot_last_kind",
    );
    expect(last?.params[1]).toBe("sponsored");
    const assign = db.calls
      .filter((c) => c.sql.includes("UPDATE assignments SET status"))
      .map((c) => c.params[1]);
    expect(assign).toEqual(["working", "review"]);
    expect(db.calls.some((c) => c.sql.startsWith("INSERT INTO spend_log"))).toBe(true);
    // No se pidió IndexNow porque quedó en revisión
    expect(r.notes[0]?.path).toMatch(/^\/es\/ventas\//);
  });
  it("si el sitio del patrocinador no responde, el encargo queda en error con el motivo", async () => {
    const db = makeDb();
    const dead: typeof fetch = async () => new Response("x", { status: 500 });
    const r = await runPipeline(
      { DB: db.asD1(), GEMINI_API_KEY: "k" },
      { trigger: "cron", base: "https://losupe.com", fetchImpl: dead },
    );
    expect(r.notes[0]?.ok).toBe(false);
    expect(r.notes[0]?.error).toMatch(/patrocinador/);
    const err = db.calls.find((c) => c.sql.includes("UPDATE assignments SET error"));
    expect(String(err?.params[1])).toMatch(/patrocinador/);
  });
  it("sin encargos ni candidatos: no hay nada que hacer", async () => {
    const db = makeDb({ queue: false });
    const r = await runPipeline(
      { DB: db.asD1(), GEMINI_API_KEY: "k" },
      { trigger: "cron", base: "https://losupe.com", fetchImpl: geminiOk },
    );
    expect(r.status).toBe("skipped");
    expect(r.reason).toBe("nothing_to_do");
  });
  it("robotStatus resume llaves, tope, cola y última corrida", async () => {
    const db = makeDb();
    const s = await robotStatus({ DB: db.asD1(), GEMINI_API_KEY: "k" });
    expect(s.keys.gemini).toBe(true);
    expect(s.missing).toContain("ADMIN_PASSWORD");
    expect(s.queue.queued).toBe(1);
    expect(s.queue.nextSponsor).toBe("Empresa");
    expect(s.lastRun).toBeNull();
  });
});

describe("cola y alternancia", () => {
  it("alterna encargo ↔ universal y cae a lo que haya", async () => {
    const mk = (last: string) =>
      new FakeD1((sql) => (sql.includes("FROM settings") ? [{ value: last }] : []));
    expect(
      await decideNextKind(mk("universal").asD1(), {
        sponsoredAvailable: true,
        universalAvailable: true,
      }),
    ).toBe("sponsored");
    expect(
      await decideNextKind(mk("sponsored").asD1(), {
        sponsoredAvailable: true,
        universalAvailable: true,
      }),
    ).toBe("universal");
    expect(
      await decideNextKind(mk("sponsored").asD1(), {
        sponsoredAvailable: true,
        universalAvailable: false,
      }),
    ).toBe("sponsored");
    expect(
      await decideNextKind(mk("universal").asD1(), {
        sponsoredAvailable: false,
        universalAvailable: true,
      }),
    ).toBe("universal");
    expect(
      await decideNextKind(mk("universal").asD1(), {
        sponsoredAvailable: false,
        universalAvailable: false,
      }),
    ).toBeNull();
  });
  it("nextQueuedAssignment junta el encargo con su patrocinador; queueSummary cuenta", async () => {
    const db = makeDb();
    const n = await nextQueuedAssignment(db.asD1(), new Date("2026-08-23T12:00:00Z"));
    expect(n?.titleIdea).toBe(assignmentRow.title_idea);
    expect(n?.sponsor.remaining).toBe(3);
    const q = await queueSummary(db.asD1());
    expect(q).toMatchObject({ sponsorsActive: 1, queued: 1, nextSponsor: "Empresa" });
  });
});
