import { describe, expect, it } from "vitest";
import {
  buildStoryNotice,
  mailConfigured,
  parseRecipients,
  sendMail,
  MAIL_ENDPOINT,
} from "@/lib/mail";
import { confirmSubscriber, subscribe, subscribeSchema, unsubscribe } from "@/lib/subscribers";
import { claimTick, TICK_KEY } from "@/lib/robot/heartbeat";
import {
  buildManualPrompt,
  buildTranslatePrompt,
  manualSchema,
  parseSourceLines,
} from "@/lib/robot/manual";
import { FakeD1 } from "./fake-d1";

const ENV = { YAD_SITE: "losupe", YAD_TOKEN: "t0ken", MAIL_FROM: "avisos@losupe.com" };

describe("correo del sitio (YaDominios)", () => {
  it("sabe cuándo está configurado y limpia la lista de destinatarios", () => {
    expect(mailConfigured(ENV)).toBe(true);
    expect(mailConfigured({ YAD_SITE: "x" })).toBe(false);
    expect(parseRecipients("A@B.com, a@b.com\notro@casa.co ; malo@ , sinarroba")).toEqual([
      "a@b.com",
      "otro@casa.co",
    ]);
    expect(parseRecipients(null)).toEqual([]);
  });

  it("envía al endpoint correcto con el token del sitio y avisa si falla", async () => {
    let body: Record<string, unknown> = {};
    const ok: typeof fetch = async (input, init) => {
      expect(String(input)).toBe(MAIL_ENDPOINT);
      body = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    };
    const r = await sendMail(ENV, { to: ["uno@x.com", "UNO@x.com"], subject: "s", text: "t" }, ok);
    expect(r).toEqual({ ok: true, sent: 1 });
    expect(body.sitio).toBe("losupe");
    expect(body.token).toBe("t0ken");
    expect(body.from).toMatchObject({ address: "avisos@losupe.com" });

    const rechazo: typeof fetch = async () => new Response("tope diario", { status: 429 });
    const malo = await sendMail(ENV, { to: ["a@b.com"], subject: "s", text: "t" }, rechazo);
    expect(malo).toMatchObject({ ok: false, reason: "rejected" });
    expect(await sendMail({}, { to: ["a@b.com"], subject: "s", text: "t" })).toMatchObject({
      ok: false,
      reason: "not_configured",
    });
    expect(await sendMail(ENV, { to: [], subject: "s", text: "t" })).toMatchObject({
      reason: "no_recipients",
    });
  });

  it("el aviso lleva título, entradilla y enlace, y escapa el HTML", () => {
    const a = buildStoryNotice({
      title: 'Bitcoin <b>sube</b> & "rompe"',
      excerpt: "Resumen",
      url: "https://losupe.com/es/cripto/x",
      section: "Cripto",
      author: "Pedro Llerena",
      unsubscribeUrl: "https://losupe.com/datos/boletin?baja=abc",
    });
    expect(a.subject).toContain("Bitcoin");
    expect(a.text).toContain("https://losupe.com/es/cripto/x");
    expect(a.html).toContain("&lt;b&gt;");
    expect(a.html).not.toContain("<b>sube</b>");
    expect(a.html).toContain("darse de baja");
    const sinBaja = buildStoryNotice({
      title: "T",
      excerpt: "E",
      url: "u",
      section: "S",
      author: "A",
    });
    expect(sinBaja.html).not.toContain("darse de baja");
  });
});

describe("suscriptores (doble confirmación)", () => {
  it("valida el correo antes de guardar nada", () => {
    expect(subscribeSchema.safeParse({ email: "a@b.com", lang: "es" }).success).toBe(true);
    expect(subscribeSchema.safeParse({ email: "no-es-correo" }).success).toBe(false);
  });

  it("da de alta como pendiente y manda el correo de confirmación", async () => {
    const db = new FakeD1((sql) => (sql.includes("SELECT status FROM subscribers") ? [] : []));
    const fetchImpl: typeof fetch = async () => new Response("{}", { status: 200 });
    const r = await subscribe(
      db.asD1(),
      ENV,
      "https://losupe.com",
      { email: "A@B.com", lang: "es" },
      fetchImpl,
    );
    expect(r).toEqual({ ok: true, state: "pending" });
    const insert = db.calls.find((c) => c.sql.startsWith("INSERT INTO subscribers"));
    expect(insert?.params[1]).toBe("a@b.com");
    expect(String(insert?.params[3])).toHaveLength(40);
  });

  it("si ya estaba confirmado no vuelve a escribir ni a mandar correo", async () => {
    const db = new FakeD1((sql) =>
      sql.includes("SELECT status FROM subscribers") ? [{ status: "confirmed" }] : [],
    );
    let enviados = 0;
    const fetchImpl: typeof fetch = async () => {
      enviados += 1;
      return new Response("{}");
    };
    expect(
      await subscribe(
        db.asD1(),
        ENV,
        "https://losupe.com",
        { email: "a@b.com", lang: "es" },
        fetchImpl,
      ),
    ).toEqual({
      ok: true,
      state: "already",
    });
    expect(enviados).toBe(0);
  });

  it("confirmar y darse de baja responden si el enlace sirvió", async () => {
    const ok = new FakeD1(() => []);
    (ok as unknown as { responder: unknown }).responder = () => [];
    const conCambio = {
      prepare: () => ({
        bind: () => ({ run: async () => ({ meta: { changes: 1 } }), first: async () => null }),
      }),
    } as unknown as D1Database;
    expect(await confirmSubscriber(conCambio, "tok")).toBe(true);
    expect(await unsubscribe(conCambio, "tok")).toBe(true);
    const sinCambio = {
      prepare: () => ({
        bind: () => ({ run: async () => ({ meta: { changes: 0 } }), first: async () => null }),
      }),
    } as unknown as D1Database;
    expect(await confirmSubscriber(sinCambio, "tok")).toBe(false);
    expect(await unsubscribe(sinCambio, "tok")).toBe(false);
  });
});

describe("piloto automático por tráfico", () => {
  function db(paused: string, last: string, changes = 1, runStatus = "done") {
    const calls: { sql: string; params: unknown[] }[] = [];
    const responde = (sql: string) => {
      if (sql.includes("robot_paused")) return { value: paused };
      if (sql.includes("robot_tick_minutes")) return { value: "" };
      if (sql.includes("FROM runs")) return { status: runStatus };
      return { value: last };
    };
    return {
      calls,
      d1: {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            first: async () => {
              calls.push({ sql, params });
              return responde(sql);
            },
            run: async () => {
              calls.push({ sql, params });
              return { meta: { changes: sql.startsWith("UPDATE settings") ? changes : 1 } };
            },
          }),
          first: async () => responde(sql),
        }),
      } as unknown as D1Database,
    };
  }

  it("no corre si el robot está en pausa", async () => {
    const { d1 } = db("1", "");
    expect(await claimTick(d1)).toEqual({ run: false, reason: "paused" });
  });

  it("no corre si la última fue hace poco (solo una petición gana el turno)", async () => {
    const { d1 } = db("0", new Date().toISOString(), 0);
    expect(await claimTick(d1)).toEqual({ run: false, reason: "too_soon" });
  });

  it("corre si pasó el intervalo, y deja la marca nueva", async () => {
    const antigua = new Date(Date.now() - 5 * 3600_000).toISOString();
    const { d1, calls } = db("0", antigua, 1);
    const r = await claimTick(d1);
    expect(r.run).toBe(true);
    const update = calls.find((c) => c.sql.startsWith("UPDATE settings"));
    expect(update?.params[0]).toBe(TICK_KEY);
  });

  it("si la corrida anterior falló, reintenta mucho antes (15 min en vez de 60)", async () => {
    const haceMedia = new Date(Date.now() - 30 * 60_000).toISOString();
    // Con la anterior en «done» todavía no toca…
    expect((await claimTick(db("0", haceMedia, 0, "done").d1)).run).toBe(false);
    // …pero si quedó en error, sí.
    expect((await claimTick(db("0", haceMedia, 1, "error").d1)).run).toBe(true);
  });

  it("sin base no explota", async () => {
    expect(await claimTick(undefined)).toEqual({ run: false, reason: "no_db" });
  });
});

describe("escribir una nota a mano", () => {
  const base = {
    modo: "ia" as const,
    titulo: "Una nota escrita por la redacción",
    cuerpo: "x".repeat(60),
    sectionId: "economia",
    kind: "news" as const,
    fuentes: "",
    autorId: "",
    publicar: "no" as const,
  };

  it("valida lo mínimo: titular y cuerpo con sustancia", () => {
    expect(manualSchema.safeParse(base).success).toBe(true);
    expect(manualSchema.safeParse({ ...base, titulo: "corto" }).success).toBe(false);
    expect(manualSchema.safeParse({ ...base, cuerpo: "poco" }).success).toBe(false);
    expect(manualSchema.safeParse({ ...base, sectionId: "inventada" }).success).toBe(false);
  });

  it("lee las fuentes escritas a mano", () => {
    expect(
      parseSourceLines("https://www.reuters.com/x  Reuters\nno-es-url\nhttps://elpais.com/y"),
    ).toEqual([
      { title: "Reuters", url: "https://www.reuters.com/x" },
      { title: "elpais.com", url: "https://elpais.com/y" },
    ]);
  });

  it("el prompt de «la escribe la IA» manda el material y prohíbe inventar fuentes", () => {
    const p = buildManualPrompt(base, []);
    expect(p).toContain("Una nota escrita por la redacción");
    expect(p).toContain("no inventes ninguna");
    const conFuentes = buildManualPrompt(base, [
      { title: "Reuters", url: "https://reuters.com/x" },
    ]);
    expect(conFuentes).toContain("https://reuters.com/x");
  });

  it("el prompt de «ya la escribí yo» pide respetar el texto", () => {
    const p = buildTranslatePrompt({ ...base, modo: "propio" });
    expect(p).toContain("NO reescribas el fondo");
    expect(p).toContain("versión en inglés");
  });
});

describe("recuperación de corridas cortadas y llamada interna", () => {
  it("una corrida colgada se cierra como error, y la sana no se toca", async () => {
    const { closeStaleRuns } = await import("@/lib/robot/heartbeat");
    let sql = "";
    let params: unknown[] = [];
    const db = {
      prepare: (s: string) => ({
        bind: (...p: unknown[]) => {
          sql = s;
          params = p;
          return { run: async () => ({ meta: { changes: 1 } }) };
        },
      }),
    } as unknown as D1Database;
    expect(await closeStaleRuns(db, 15)).toBe(1);
    expect(sql).toContain("status = 'running'");
    expect(sql).toContain("started_at < ?1");
    expect(String(params[0]) < new Date().toISOString()).toBe(true);
    // Si la base falla, no explota
    const rota = {
      prepare: () => {
        throw new Error("sin base");
      },
    } as unknown as D1Database;
    expect(await closeStaleRuns(rota)).toBe(0);
  });

  it("el secreto interno se crea una sola vez y se reutiliza", async () => {
    const { getTickToken } = await import("@/lib/robot/heartbeat");
    let guardado: string | null = null;
    const db = {
      prepare: (s: string) => ({
        bind: (...p: unknown[]) => ({
          first: async () => (guardado ? { value: guardado } : null),
          run: async () => {
            if (s.startsWith("INSERT OR REPLACE")) guardado = String(p[1]);
            return { meta: { changes: 1 } };
          },
        }),
      }),
    } as unknown as D1Database;
    const uno = await getTickToken(db);
    expect(uno).toHaveLength(44);
    expect(await getTickToken(db)).toBe(uno);
  });
});
