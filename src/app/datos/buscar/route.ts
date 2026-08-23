import { z } from "zod";
import { getDb } from "@/lib/db";
import { searchIndexGuard } from "@/lib/search-guard";
import { suggest } from "@/lib/search";
import { getSection } from "@/lib/sections";
import { articlePath } from "@/lib/urls";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(1).max(80),
  lang: z.enum(["es", "en"]).default("es"),
  limit: z.coerce.number().int().min(1).max(10).default(8),
});

export type SuggestItem = {
  id: string;
  title: string;
  url: string;
  section: string;
  sectionName: string;
  color: string;
  date: string;
  excerpt: string;
};

/** Sugerencias del buscador mientras se escribe: GET /datos/buscar?q=...&lang=es|en */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    lang: url.searchParams.get("lang") ?? "es",
    limit: url.searchParams.get("limit") ?? "8",
  });
  if (!parsed.success) {
    return Response.json({ items: [] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const { q, lang, limit } = parsed.data;
  const db = await getDb();
  await searchIndexGuard.ensure(db);
  const cards = await suggest(db, lang, q, limit);
  const items: SuggestItem[] = cards.map((a) => {
    const s = getSection(a.sectionId);
    return {
      id: a.id,
      title: a.title,
      url: articlePath(lang, a.sectionId, a.slug),
      section: a.sectionId,
      sectionName: s?.name[lang] ?? a.sectionId,
      color: s?.color ?? "#0B1F3A",
      date: a.publishedAt,
      excerpt: a.excerpt.length > 140 ? `${a.excerpt.slice(0, 137)}…` : a.excerpt,
    };
  });
  return Response.json(
    { q, lang, items },
    { headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } },
  );
}
