import { z } from "zod";
import { sessionFromRequest } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";
import { getOrder, orderToSponsor, setOrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";

const schema = z.object({ op: z.enum(["paid", "queue", "cancel"]), id: z.string().uuid() });

function back(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** POST /panel/accion/pedidos — marcar pagado, mandar a la cola del robot o cancelar. */
export async function POST(request: Request) {
  const env = await panelEnv();
  if (!(await sessionFromRequest(env.DB, request))) return back("/panel/entrar");
  const form = await request.formData();
  const parsed = schema.safeParse({ op: form.get("op"), id: form.get("id") });
  if (!parsed.success) return back("/panel/pedidos?error=invalid");
  const order = await getOrder(env.DB, parsed.data.id);
  if (!order) return back("/panel/pedidos?error=invalid");
  if (parsed.data.op === "paid") {
    await setOrderStatus(env.DB, order.id, "paid");
    return back("/panel/pedidos?ok=markedPaid");
  }
  if (parsed.data.op === "cancel") {
    await setOrderStatus(env.DB, order.id, "canceled");
    return back("/panel/pedidos?ok=canceled");
  }
  const sponsorId = await orderToSponsor(env.DB, order);
  return back(`/panel/encargos/${sponsorId}?ok=created`);
}
