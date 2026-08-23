import { getDict, isLang } from "@/i18n";
import { getDb } from "@/lib/db";
import { listLatest } from "@/lib/queries";
import { buildRss } from "@/lib/rss";
import { getSection } from "@/lib/sections";
import { baseUrlFromRequest } from "@/lib/site";
import { absoluteUrl, articlePath, homePath, rssPath } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await ctx.params;
  if (!isLang(raw)) return new Response("Not found", { status: 404 });
  const lang = raw;
  const dict = getDict(lang);
  const base = baseUrlFromRequest(request);
  const db = await getDb();
  const items = await listLatest(db, lang, { limit: 30 });

  const xml = buildRss(
    {
      title: `${dict.brand.name} — ${dict.brand.tagline}`,
      link: absoluteUrl(base, homePath(lang)),
      description: dict.brand.description,
      language: dict.locale.toLowerCase(),
      selfUrl: absoluteUrl(base, rssPath(lang)),
      imageUrl: absoluteUrl(base, "/brand/logo-512.png"),
    },
    items.map((a) => ({
      title: a.title,
      link: absoluteUrl(base, articlePath(lang, a.sectionId, a.slug)),
      guid: absoluteUrl(base, articlePath(lang, a.sectionId, a.slug)),
      description: a.excerpt,
      pubDate: a.publishedAt,
      author: a.authorName,
      category: getSection(a.sectionId)?.name[lang],
      imageUrl: a.imageUrl ? absoluteUrl(base, a.imageUrl) : null,
    })),
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
