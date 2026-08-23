import { z } from "zod";

// Variables de entorno validadas al arrancar. Si algo está mal formado, falla aquí y no en producción.
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.replace(/\/$/, "") : undefined)),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse({ NEXT_PUBLIC_SITE_URL: source.NEXT_PUBLIC_SITE_URL });
  if (!result.success) {
    throw new Error(`Variables de entorno inválidas: ${result.error.message}`);
  }
  return result.data;
}

export const env: Env = parseEnv({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL });
