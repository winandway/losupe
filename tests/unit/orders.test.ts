import { describe, expect, it } from "vitest";
import {
  createOrder,
  getOrder,
  listOrders,
  orderSchema,
  orderToSponsor,
  ordersSummary,
  PLANS,
  setOrderStatus,
} from "@/lib/orders";
import type { Order } from "@/lib/orders";
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

const valid = {
  company: "Ferretería Bley",
  website: "https://bley.example.com",
  contactName: "Ana",
  email: "ana@bley.example.com",
  phone: "+1 305 555 0111",
  plan: "paquete",
  sectionId: "ventas",
  lang: "es",
  brief: "Vendemos materiales de construcción a toda Venezuela desde Estados Unidos.",
  ideas: "Cómo comprar materiales desde EE. UU. | enfoque familias\nQué garantías da la tienda",
};

describe("pedidos de la página pública", () => {
  it("valida el formulario: sitio web y correo obligatorios y con formato", () => {
    expect(orderSchema.safeParse(valid).success).toBe(true);
    expect(orderSchema.safeParse({ ...valid, website: "bley.com" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, email: "no-es-correo" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, company: "x" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, plan: "gratis" }).success).toBe(false);
  });

  it("guarda el pedido con el precio y las notas del paquete elegido", async () => {
    const db = new Db();
    const parsed = orderSchema.parse(valid);
    const id = await createOrder(db.asD1(), parsed, { ip: "1.2.3.4" });
    expect(id).toHaveLength(36);
    const call = db.calls.find((c) => c.sql.startsWith("INSERT INTO orders"));
    expect(call?.params[1]).toBe("Ferretería Bley");
    expect(call?.params[7]).toBe(PLANS.paquete.notes);
    expect(call?.params[8]).toBe(PLANS.paquete.priceUsd);
    expect(call?.params[13]).toBe("1.2.3.4");
  });

  it("convertir el pedido crea el patrocinador con sus notas y las ideas en cola", async () => {
    const db = new Db((sql) => {
      if (sql.includes("COALESCE(MAX(position)")) return [{ p: 0 }];
      return [];
    });
    const order: Order = {
      id: "11111111-1111-4111-8111-111111111111",
      company: "Ferretería Bley",
      website: "https://bley.example.com",
      contactName: "Ana",
      email: "ana@bley.example.com",
      phone: null,
      plan: "paquete",
      notesTotal: 4,
      priceUsd: 249,
      sectionId: "ventas",
      lang: "es",
      brief: "Materiales de construcción.",
      ideas: valid.ideas,
      status: "paid",
      sponsorId: null,
      createdAt: "2026-08-23T00:00:00Z",
    };
    const sponsorId = await orderToSponsor(db.asD1(), order);
    expect(sponsorId).toHaveLength(36);
    const sponsor = db.calls.find((c) => c.sql.startsWith("INSERT INTO sponsors"));
    expect(sponsor?.params[1]).toBe("Ferretería Bley");
    expect(sponsor?.params[7]).toBe(4);
    const assignments = db.calls.filter((c) => c.sql.startsWith("INSERT INTO assignments"));
    expect(assignments).toHaveLength(2);
    expect(assignments[0]?.params[3]).toBe("Cómo comprar materiales desde EE. UU.");
    expect(assignments[0]?.params[4]).toBe("enfoque familias");
    const link = db.calls.find((c) => c.sql.includes("UPDATE orders SET sponsor_id"));
    expect(link?.params[1]).toBe(sponsorId);
  });

  it("sin ideas escritas, deja una idea de arranque para que el robot investigue el sitio", async () => {
    const db = new Db((sql) => (sql.includes("COALESCE(MAX(position)") ? [{ p: 0 }] : []));
    await orderToSponsor(db.asD1(), {
      id: "22222222-2222-4222-8222-222222222222",
      company: "Panadería Luz",
      website: "https://luz.example.com",
      contactName: null,
      email: "hola@luz.example.com",
      phone: null,
      plan: "basica",
      notesTotal: 1,
      priceUsd: 79,
      sectionId: null,
      lang: "es",
      brief: null,
      ideas: null,
      status: "paid",
      sponsorId: null,
      createdAt: "2026-08-23T00:00:00Z",
    });
    const assignments = db.calls.filter((c) => c.sql.startsWith("INSERT INTO assignments"));
    expect(assignments).toHaveLength(1);
    expect(String(assignments[0]?.params[3])).toContain("Panadería Luz");
  });

  it("el resumen cuenta pedidos y lo facturado", async () => {
    const db = new Db(() => [{ new_count: 2, paid: 1, queued: 3, revenue: 577 }]);
    expect(await ordersSummary(db.asD1())).toEqual({
      newCount: 2,
      paid: 1,
      queued: 3,
      revenueUsd: 577,
    });
  });
});

describe("EL DINERO NO VIENE DEL FORMULARIO (deuda cerrada el 29 ago 2026)", () => {
  it("el precio y el número de notas salen del catálogo, no de lo que mande el cliente", async () => {
    // Este es el riesgo de verdad de una página de venta abierta: alguien manda el formulario a
    // mano con price_usd = 1. El esquema ni siquiera acepta ese campo, y el precio se lee de PLANS.
    const conTrampa = orderSchema.safeParse({
      ...valid,
      plan: "anual",
      priceUsd: 1,
      notesTotal: 999,
      price_usd: 1,
      status: "paid",
    });
    expect(conTrampa.success).toBe(true);
    expect(conTrampa.success && "priceUsd" in conTrampa.data).toBe(false);

    const db = new Db();
    expect(conTrampa.success).toBe(true);
    if (!conTrampa.success) return;
    await createOrder(db.asD1(), conTrampa.data);
    const insert = db.calls.find((c) => c.sql.startsWith("INSERT INTO orders"))!;
    expect(insert.params).toContain(PLANS.anual.priceUsd);
    expect(insert.params).toContain(PLANS.anual.notes);
    expect(insert.params).not.toContain(1);
    expect(insert.params).not.toContain(999);
    // Y nace SIEMPRE como 'new'. Nadie se autodeclara pagado.
    expect(insert.sql).toContain("'new'");
  });

  it("un plan que no existe se rechaza; no se cuela con precio cero", () => {
    expect(orderSchema.safeParse({ ...valid, plan: "gratis" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, plan: "" }).success).toBe(false);
  });

  it("la IP del pedido se guarda aparte y nunca se pide al cliente", async () => {
    const db = new Db();
    await createOrder(db.asD1(), orderSchema.parse(valid), { ip: "203.0.113.9" });
    const insert = db.calls.find((c) => c.sql.startsWith("INSERT INTO orders"))!;
    expect(insert.params).toContain("203.0.113.9");
    // Sin IP no falla: un pedido sin ella se guarda igual.
    const db2 = new Db();
    await expect(createOrder(db2.asD1(), orderSchema.parse(valid))).resolves.toBeTruthy();
  });

  it("el resumen del panel solo cuenta como ingreso lo pagado, no lo que está por cobrar", async () => {
    const db = new FakeD1(() => [{ new_count: 3, paid: 2, queued: 1, revenue: 448 }]);
    const r = await ordersSummary(db.asD1());
    expect(r).toEqual({ newCount: 3, paid: 2, queued: 1, revenueUsd: 448 });
    // La consulta excluye a propósito los pedidos nuevos y los cancelados.
    const sql = db.calls[0]!.sql;
    expect(sql).toContain("status IN ('paid', 'queued', 'done')");
    expect(sql).not.toMatch(/revenue[\s\S]*'new'/);
  });

  it("una base vacía devuelve ceros, no NaN ni undefined en el dinero", async () => {
    const db = new FakeD1(() => []);
    expect(await ordersSummary(db.asD1())).toEqual({
      newCount: 0,
      paid: 0,
      queued: 0,
      revenueUsd: 0,
    });
  });

  it("al pasar un pedido a la cola, los encargos NUNCA pasan de lo pagado", async () => {
    const db = new Db();
    const pedido: Order = {
      id: "o1",
      company: "Ferretería Bley",
      website: "https://bley.example.com",
      contactName: "Ana",
      email: "ana@bley.example.com",
      phone: null,
      plan: "basica", // pagó UNA nota
      notesTotal: PLANS.basica.notes,
      priceUsd: PLANS.basica.priceUsd,
      sectionId: "ventas",
      lang: "es",
      brief: "Materiales de construcción.",
      // ...pero mandó ocho ideas
      ideas: Array.from({ length: 8 }, (_, i) => `Idea ${i + 1}`).join("\n"),
      status: "paid",
      sponsorId: null,
      createdAt: "2026-08-29T10:00:00.000Z",
    };
    await orderToSponsor(db.asD1(), pedido);
    const encargos = db.calls.filter((c) => c.sql.includes("INSERT INTO assignments"));
    const filas = encargos.reduce((n, c) => n + (c.sql.match(/\(\?/g)?.length ?? 1), 0);
    expect(filas).toBe(PLANS.basica.notes);
    // Y el pedido queda en cola con su patrocinador enlazado.
    expect(db.calls.some((c) => c.sql.includes("status = 'queued'"))).toBe(true);
  });

  it("un pedido sin ideas igual entra a la cola con una nota de arranque", async () => {
    const db = new Db();
    const pedido: Order = {
      id: "o2",
      company: "Tienda Norte",
      website: "https://norte.example.com",
      contactName: null,
      email: "hola@norte.example.com",
      phone: null,
      plan: "basica",
      notesTotal: 1,
      priceUsd: PLANS.basica.priceUsd,
      sectionId: null,
      lang: "en",
      brief: null,
      ideas: null,
      status: "paid",
      sponsorId: null,
      createdAt: "2026-08-29T10:00:00.000Z",
    };
    await expect(orderToSponsor(db.asD1(), pedido)).resolves.toBeTruthy();
    expect(db.calls.some((c) => c.sql.includes("INSERT INTO assignments"))).toBe(true);
  });
});

describe("leer y mover pedidos desde el panel", () => {
  const fila = {
    id: "o9",
    company: "Tienda Norte",
    website: "https://norte.example.com",
    contact_name: null,
    email: "hola@norte.example.com",
    phone: null,
    plan: "paquete",
    notes_total: 4,
    price_usd: 249,
    section_id: "ventas",
    lang: "en",
    brief: null,
    ideas: null,
    status: "paid",
    sponsor_id: null,
    created_at: "2026-08-29T10:00:00.000Z",
  };

  it("la lista pone delante lo que hay que atender: primero lo nuevo, después lo pagado", async () => {
    const db = new FakeD1(() => [fila]);
    const [p] = await listOrders(db.asD1());
    expect(p?.priceUsd).toBe(249);
    expect(p?.lang).toBe("en");
    const sql = db.calls[0]!.sql;
    expect(sql).toMatch(/'new' THEN 0[\s\S]*'paid' THEN 1[\s\S]*'queued' THEN 2/);
  });

  it("una fila con huecos no revienta: cae a los valores seguros", async () => {
    const db = new FakeD1(() => [
      { ...fila, plan: null, status: null, section_id: null, lang: "pt", price_usd: null },
    ]);
    const [p] = await listOrders(db.asD1());
    // Sin plan se asume el más barato y sin estado, el de entrada. Nunca «pagado» por descuido.
    expect(p?.plan).toBe("basica");
    expect(p?.status).toBe("new");
    expect(p?.sectionId).toBeNull();
    expect(p?.lang).toBe("es");
  });

  it("un pedido que no existe devuelve null, no un objeto a medias", async () => {
    expect(await getOrder(new FakeD1(() => []).asD1(), "no-existe")).toBeNull();
    expect(await getOrder(new FakeD1(() => [fila]).asD1(), "o9")).toMatchObject({ id: "o9" });
  });

  it("cambiar el estado toca ese pedido y solo ese", async () => {
    const db = new FakeD1();
    await setOrderStatus(db.asD1(), "o9", "done");
    const sql = db.calls[0]!.sql;
    expect(sql).toContain("WHERE id = ?1");
    expect(db.calls[0]!.params).toEqual(["o9", "done"]);
  });
});
