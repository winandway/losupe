import { connection } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Base D1 del sitio (env.DB). Fuerza render dinámico: nada se prerenderiza con datos viejos. */
export async function getDb(): Promise<D1Database> {
  await connection();
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}
