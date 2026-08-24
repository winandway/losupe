import { describe, expect, it } from "vitest";
import {
  buildStoryNotice,
  mailConfigured,
  parseRecipients,
  sendMail,
  MAIL_ENDPOINT,
} from "@/lib/mail";
import { confirmSubscriber, subscribe, subscribeSchema, unsubscribe } from "@/lib/subscribers";
import { claimTick, MAX_INTENTOS_POR_FRANJA, TICK_KEY } from "@/lib/robot/heartbeat";
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

  it("EN SEGUNDO PLANO: responde sin esperar al correo (nadie se queda mirando la pantalla)", async () => {
    const db = new FakeD1(() => []);
    let resuelto = false;
    // Un servicio de correo lento: 1,5 s, como el que hacía esperar a la gente.
    const lento: typeof fetch = async () => {
      await new Promise((r) => setTimeout(r, 1500));
      resuelto = true;
      return new Response("{}", { status: 200 });
    };
    const pendientes: Promise<unknown>[] = [];
    const t0 = Date.now();
    const r = await subscribe(
      db.asD1(),
      ENV,
      "https://losupe.com",
      { email: "a@b.com", lang: "es" },
      lento,
      (p) => pendientes.push(p),
    );
    // La respuesta llega YA, con el correo todavía en camino.
    expect(r).toEqual({ ok: true, state: "pending" });
    expect(Date.now() - t0).toBeLessThan(500);
    expect(resuelto).toBe(false);
    // Y el alta ya está guardada: el correo saldrá, pero la persona no espera por él.
    expect(db.calls.some((c) => c.sql.startsWith("INSERT INTO subscribers"))).toBe(true);
    await Promise.all(pendientes);
    expect(resuelto).toBe(true);
  });

  it("si el correo falla en segundo plano, queda anotado (no se pierde en silencio)", async () => {
    const db = new FakeD1(() => []);
    const roto: typeof fetch = async () => new Response("nope", { status: 500 });
    const pendientes: Promise<unknown>[] = [];
    await subscribe(
      db.asD1(),
      ENV,
      "https://losupe.com",
      { email: "a@b.com", lang: "es" },
      roto,
      (p) => pendientes.push(p),
    );
    await Promise.all(pendientes);
    const apunte = db.calls.find((c) => c.sql.includes("mail_error"));
    expect(apunte).toBeTruthy();
    expect(String(apunte?.params[1])).toContain("rejected");
  });

  it("sin segundo plano se comporta como siempre: espera y avisa del fallo", async () => {
    const db = new FakeD1(() => []);
    const roto: typeof fetch = async () => new Response("nope", { status: 500 });
    const r = await subscribe(
      db.asD1(),
      ENV,
      "https://losupe.com",
      { email: "a@b.com", lang: "es" },
      roto,
    );
    expect(r).toMatchObject({ ok: false, reason: "mail" });
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

describe("piloto automático por franjas", () => {
  // Horas reales, en UTC, de la zona del Este: 12:30 PM (dentro de la franja de mediodía) y
  // 1:08 AM (la madrugada donde salieron las notas del 24 ago 2026).
  const MEDIODIA = new Date("2026-08-24T16:30:00Z");
  const MADRUGADA = new Date("2026-08-24T05:08:00Z");

  function db(paused: string, changes = 1) {
    const calls: { sql: string; params: unknown[] }[] = [];
    return {
      calls,
      d1: {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            first: async () => {
              calls.push({ sql, params });
              return { value: "" };
            },
            run: async () => {
              calls.push({ sql, params });
              return { meta: { changes: sql.startsWith("UPDATE settings") ? changes : 1 } };
            },
          }),
          first: async () => (sql.includes("robot_paused") ? { value: paused } : { value: "" }),
        }),
      } as unknown as D1Database,
    };
  }

  it("no corre si el robot está en pausa", async () => {
    expect(await claimTick(db("1").d1, MEDIODIA)).toEqual({ run: false, reason: "paused" });
  });

  it("DE MADRUGADA NO CORRE, aunque no se haya publicado nada", async () => {
    expect(await claimTick(db("0").d1, MADRUGADA)).toEqual({
      run: false,
      reason: "fuera_de_horario",
    });
  });

  it("corre en su franja y deja apuntado el turno del día", async () => {
    const { d1, calls } = db("0", 1);
    const r = await claimTick(d1, MEDIODIA);
    expect(r).toEqual({ run: true, franja: "mediodia", marca: "2026-08-24:mediodia" });
    const update = calls.find((c) => c.sql.startsWith("UPDATE settings"));
    expect(update?.params[0]).toBe(TICK_KEY);
    expect(update?.params[1]).toBe("2026-08-24:mediodia");
  });

  it("solo una visita gana el turno: la segunda encuentra la marca puesta", async () => {
    expect(await claimTick(db("0", 0).d1, MEDIODIA)).toEqual({
      run: false,
      reason: "turno_hecho",
    });
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

describe("una corrida cortada no se lleva la nota del turno", () => {
  const MEDIODIA = new Date("2026-08-24T16:30:00Z");

  /** Base falsa que devuelve una marca de turno ya puesta y el estado de la última corrida. */
  function db(marca: string, estadoUltima: string, changes = 1) {
    const calls: { sql: string; params: unknown[] }[] = [];
    return {
      calls,
      d1: {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            first: async () => {
              calls.push({ sql, params });
              return { value: marca };
            },
            run: async () => {
              calls.push({ sql, params });
              return { meta: { changes: sql.startsWith("UPDATE settings") ? changes : 1 } };
            },
          }),
          first: async () =>
            sql.includes("robot_paused")
              ? { value: "0" }
              : sql.includes("FROM runs")
                ? { status: estadoUltima }
                : { value: marca },
        }),
      } as unknown as D1Database,
    };
  }

  it("si la corrida del turno se cortó, se vuelve a intentar en la misma franja", async () => {
    const r = await claimTick(db("2026-08-24:mediodia", "error").d1, MEDIODIA);
    expect(r).toEqual({ run: true, franja: "mediodia", marca: "2026-08-24:mediodia#2" });
  });

  it("si la corrida del turno salió bien, no se repite", async () => {
    expect(await claimTick(db("2026-08-24:mediodia", "done").d1, MEDIODIA)).toEqual({
      run: false,
      reason: "turno_hecho",
    });
  });

  it("no se reintenta sin fin: llegado el tope, se acabó la franja", async () => {
    expect(await claimTick(db("2026-08-24:mediodia#2", "error").d1, MEDIODIA)).toMatchObject({
      run: true,
      marca: "2026-08-24:mediodia#3",
    });
    expect(await claimTick(db("2026-08-24:mediodia#4", "error").d1, MEDIODIA)).toMatchObject({
      run: true,
      marca: "2026-08-24:mediodia#5",
    });
    expect(
      await claimTick(db(`2026-08-24:mediodia#${MAX_INTENTOS_POR_FRANJA}`, "error").d1, MEDIODIA),
    ).toEqual({ run: false, reason: "turno_hecho" });
  });

  it("un turno de OTRA franja no cuenta como intento de esta", async () => {
    expect(await claimTick(db("2026-08-24:manana#3", "error").d1, MEDIODIA)).toMatchObject({
      run: true,
      marca: "2026-08-24:mediodia",
    });
  });
});
