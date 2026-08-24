import { z } from "zod";
import type { Lang } from "@/i18n/config";
import type { SectionId } from "@/lib/sections";
import { SECTIONS } from "@/lib/sections";
import { addAssignments, createSponsor } from "@/lib/robot/queue";
import { parseIdeas } from "@/lib/panel/forms";
import { SQL_NOW } from "./sql-time";

/**
 * Pedidos de la página pública «Publica tu noticia» (comunicados autoservicio): el negocio pide su
 * nota, el pedido entra al panel y con un clic se convierte en patrocinador + encargos en la cola.
 */

export const PLANS = {
  basica: { notes: 1, priceUsd: 79 },
  destacada: { notes: 1, priceUsd: 149 },
  paquete: { notes: 4, priceUsd: 249 },
  anual: { notes: 12, priceUsd: 599 },
} as const;
export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as [PlanId, ...PlanId[]];

export type OrderStatus = "new" | "paid" | "queued" | "done" | "canceled";

const sectionIds = SECTIONS.map((s) => s.id) as [string, ...string[]];

export const orderSchema = z.object({
  company: z.string().trim().min(2).max(120),
  website: z.string().trim().url().max(300),
  contactName: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  plan: z.enum(PLAN_IDS),
  sectionId: z.enum(sectionIds).optional(),
  lang: z.enum(["es", "en"]).default("es"),
  brief: z.string().trim().max(4000).optional().default(""),
  ideas: z.string().trim().max(4000).optional().default(""),
});
export type OrderInput = z.infer<typeof orderSchema>;

export type Order = {
  id: string;
  company: string;
  website: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  plan: PlanId;
  notesTotal: number;
  priceUsd: number;
  sectionId: SectionId | null;
  lang: Lang;
  brief: string | null;
  ideas: string | null;
  status: OrderStatus;
  sponsorId: string | null;
  createdAt: string;
};

type OrderRow = {
  id: string;
  company: string;
  website: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  plan: string;
  notes_total: number;
  price_usd: number;
  section_id: string | null;
  lang: string;
  brief: string | null;
  ideas: string | null;
  status: string;
  sponsor_id: string | null;
  created_at: string;
};

function mapOrder(r: OrderRow): Order {
  return {
    id: r.id,
    company: r.company,
    website: r.website,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    plan: (r.plan as PlanId) ?? "basica",
    notesTotal: Number(r.notes_total),
    priceUsd: Number(r.price_usd),
    sectionId: (r.section_id as SectionId | null) ?? null,
    lang: r.lang === "en" ? "en" : "es",
    brief: r.brief,
    ideas: r.ideas,
    status: (r.status as OrderStatus) ?? "new",
    sponsorId: r.sponsor_id,
    createdAt: r.created_at,
  };
}

export async function createOrder(
  db: D1Database,
  input: OrderInput,
  meta: { ip?: string } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  const plan = PLANS[input.plan];
  await db
    .prepare(
      `INSERT INTO orders (id, company, website, contact_name, email, phone, plan, notes_total, price_usd, section_id, lang, brief, ideas, status, ip)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'new', ?14)`,
    )
    .bind(
      id,
      input.company,
      input.website,
      input.contactName || null,
      input.email,
      input.phone || null,
      input.plan,
      plan.notes,
      plan.priceUsd,
      input.sectionId ?? null,
      input.lang,
      input.brief || null,
      input.ideas || null,
      meta.ip ?? null,
    )
    .run();
  return id;
}

export async function listOrders(db: D1Database, limit = 60): Promise<Order[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM orders ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'paid' THEN 1 WHEN 'queued' THEN 2 ELSE 3 END, created_at DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<OrderRow>();
  return results.map(mapOrder);
}

export async function getOrder(db: D1Database, id: string): Promise<Order | null> {
  const row = await db.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first<OrderRow>();
  return row ? mapOrder(row) : null;
}

export async function setOrderStatus(
  db: D1Database,
  id: string,
  status: OrderStatus,
): Promise<void> {
  await db
    .prepare(`UPDATE orders SET status = ?2, updated_at = ${SQL_NOW} WHERE id = ?1`)
    .bind(id, status)
    .run();
}

/**
 * Convierte un pedido en patrocinador + encargos en la cola del robot. Si el cliente no escribió
 * ideas de titular, queda una sola idea genérica que el robot afina leyendo su sitio.
 */
export async function orderToSponsor(db: D1Database, order: Order): Promise<string> {
  const sponsorId = await createSponsor(db, {
    name: order.company,
    website: order.website,
    contactName: order.contactName,
    contactEmail: order.email,
    brief: order.brief,
    sectionId: order.sectionId,
    notesTotal: order.notesTotal,
    status: "active",
    internalNotes: `Pedido ${order.id} · plan ${order.plan} · $${order.priceUsd}`,
  });
  const ideas = parseIdeas(order.ideas ?? "");
  const list =
    ideas.length > 0
      ? ideas.slice(0, order.notesTotal)
      : [{ titleIdea: `Qué es ${order.company} y a quién le sirve`, brief: order.brief ?? null }];
  await addAssignments(
    db,
    sponsorId,
    list.map((i) => ({ ...i, sectionId: order.sectionId ?? null })),
  );
  await db
    .prepare(
      `UPDATE orders SET sponsor_id = ?2, status = 'queued', updated_at = ${SQL_NOW} WHERE id = ?1`,
    )
    .bind(order.id, sponsorId)
    .run();
  return sponsorId;
}

export type OrdersSummary = { newCount: number; paid: number; queued: number; revenueUsd: number };

export async function ordersSummary(db: D1Database): Promise<OrdersSummary> {
  const row = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'queued', 'done') THEN price_usd ELSE 0 END), 0) AS revenue
       FROM orders`,
    )
    .first<{ new_count: number; paid: number; queued: number; revenue: number }>();
  return {
    newCount: Number(row?.new_count ?? 0),
    paid: Number(row?.paid ?? 0),
    queued: Number(row?.queued ?? 0),
    revenueUsd: Number(row?.revenue ?? 0),
  };
}
