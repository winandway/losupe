import { LANGS, type Lang } from "@/i18n/config";
import { buildLlmsTxt, type LlmsArticle } from "@/lib/agent-discovery";
import { getDb } from "@/lib/db";
import { listLatest } from "@/lib/queries";
import { baseUrlFromRequest } from "@/lib/site";
import { absoluteUrl, articlePath } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const base = baseUrlFromRequest(request);
  const db = await getDb();
  const latest = {} as Record<Lang, LlmsArticle[]>;
  for (const lang of LANGS) {
    const items = await listLatest(db, lang, { limit: 20 });
    latest[lang] = items
      .filter((a) => !a.fallback)
      .map((a) => ({
        title: a.title,
        url: absoluteUrl(base, articlePath(lang, a.sectionId, a.slug)),
        excerpt: a.excerpt,
        date: a.publishedAt,
      }));
  }
  return new Response(buildLlmsTxt(base, latest), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
