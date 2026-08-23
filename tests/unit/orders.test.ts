import { describe, expect, it } from "vitest";
import { createOrder, orderSchema, orderToSponsor, ordersSummary, PLANS } from "@/lib/orders";
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
