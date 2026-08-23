import { toRfc822 } from "./dates";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  author?: string;
  imageUrl?: string | null;
  category?: string;
};

export type FeedMeta = {
  title: string;
  link: string;
  description: string;
  language: string;
  selfUrl: string;
  imageUrl?: string;
};

export function buildRss(meta: FeedMeta, items: FeedItem[]): string {
  const head = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>${escapeXml(meta.title)}</title>
<link>${escapeXml(meta.link)}</link>
<description>${escapeXml(meta.description)}</description>
<language>${escapeXml(meta.language)}</language>
<atom:link href="${escapeXml(meta.selfUrl)}" rel="self" type="application/rss+xml"/>
<lastBuildDate>${toRfc822(new Date().toISOString())}</lastBuildDate>${
    meta.imageUrl
      ? `
<image><url>${escapeXml(meta.imageUrl)}</url><title>${escapeXml(meta.title)}</title><link>${escapeXml(meta.link)}</link></image>`
      : ""
  }`;
  const body = items
    .map(
      (it) => `
<item>
<title>${escapeXml(it.title)}</title>
<link>${escapeXml(it.link)}</link>
<guid isPermaLink="true">${escapeXml(it.guid)}</guid>
<pubDate>${toRfc822(it.pubDate)}</pubDate>${
        it.author ? `\n<dc:creator>${escapeXml(it.author)}</dc:creator>` : ""
      }${it.category ? `\n<category>${escapeXml(it.category)}</category>` : ""}
<description>${escapeXml(it.description)}</description>${
        it.imageUrl ? `\n<media:content url="${escapeXml(it.imageUrl)}" medium="image"/>` : ""
      }
</item>`,
    )
    .join("");
  return `${head}${body}
</channel>
</rss>
`;
}

export type NewsSitemapItem = {
  loc: string;
  title: string;
  publicationDate: string;
  language: string;
};

export function buildNewsSitemap(publicationName: string, items: NewsSitemapItem[]): string {
  const body = items
    .map(
      (it) => `
<url>
<loc>${escapeXml(it.loc)}</loc>
<news:news>
<news:publication><news:name>${escapeXml(publicationName)}</news:name><news:language>${escapeXml(it.language)}</news:language></news:publication>
<news:publication_date>${escapeXml(it.publicationDate)}</news:publication_date>
<news:title>${escapeXml(it.title)}</news:title>
</news:news>
</url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${body}
</urlset>
`;
}
