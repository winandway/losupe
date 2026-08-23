import { decodeEntities } from "./html";

/**
 * Convierte el HTML sencillo de nuestras notas (p, h2-h4, listas, strong, em, a, figure/img,
 * blockquote) a Markdown limpio para agentes de IA (Accept: text/markdown).
 */
export function htmlToMarkdown(html: string): string {
  let md = html;
  // Quitar lo que no aporta.
  md = md.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  md = md.replace(/<!--[\s\S]*?-->/g, "");
  // Figuras con imagen y pie (se procesa el bloque y luego sus partes, sin regex anidadas).
  md = md.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (_m, body: string) => {
    const src = /<img[^>]*src="([^"]*)"/i.exec(body)?.[1] ?? "";
    const alt = /<img[^>]*alt="([^"]*)"/i.exec(body)?.[1] ?? "";
    const cap = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(body)?.[1];
    if (!src) return `\n\n${inline(body)}\n\n`;
    return `\n\n![${stripTags(alt)}](${src})${cap ? `\n\n*${stripTags(cap)}*` : ""}\n\n`;
  });
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "\n\n![$2]($1)\n\n");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "\n\n![]($1)\n\n");
  // Encabezados.
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, t: string) => `\n\n## ${inline(t)}\n\n`);
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, t: string) => `\n\n## ${inline(t)}\n\n`);
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, t: string) => `\n\n### ${inline(t)}\n\n`);
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_m, t: string) => `\n\n#### ${inline(t)}\n\n`);
  // Listas.
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, body: string) => {
    const items = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(
      (x) => `- ${inline(x[1] ?? "")}`,
    );
    return `\n\n${items.join("\n")}\n\n`;
  });
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, body: string) => {
    const items = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(
      (x, i) => `${i + 1}. ${inline(x[1] ?? "")}`,
    );
    return `\n\n${items.join("\n")}\n\n`;
  });
  // Citas y párrafos.
  md = md.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_m, t: string) => `\n\n> ${inline(t).replace(/\n+/g, " ")}\n\n`,
  );
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, t: string) => `\n\n${inline(t)}\n\n`);
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");
  // Lo que quede de etiquetas, afuera.
  md = inline(md);
  return md
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** Convierte marcas en línea (negrita, cursiva, enlaces, código) y quita el resto. */
function inline(s: string): string {
  let t = s;
  t = t.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  t = t.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  t = t.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  t = t.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, text: string) => {
      const label = stripTags(text);
      return label ? `[${label}](${href})` : href;
    },
  );
  t = t.replace(/<[^>]+>/g, "");
  return decodeEntities(t)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type MarkdownArticle = {
  title: string;
  excerpt: string;
  contentHtml: string;
  authorName: string;
  publishedAt: string;
  updatedAt: string;
  sectionName: string;
  url: string;
  imageUrl?: string | null;
  sources: { title: string; url: string }[];
  tags: string[];
  aiAssisted: boolean;
  lang: "es" | "en";
};

/** Documento Markdown completo de una nota, con su cabecera de metadatos. */
export function articleToMarkdown(a: MarkdownArticle, brand = "losupe"): string {
  const es = a.lang === "es";
  const lines = [
    `# ${a.title}`,
    "",
    `> ${a.excerpt}`,
    "",
    `- ${es ? "Medio" : "Publisher"}: ${brand}`,
    `- ${es ? "Sección" : "Section"}: ${a.sectionName}`,
    `- ${es ? "Autora" : "Author"}: ${a.authorName}`,
    `- ${es ? "Publicado" : "Published"}: ${a.publishedAt}`,
    `- ${es ? "Actualizado" : "Updated"}: ${a.updatedAt}`,
    `- URL: ${a.url}`,
    `- ${es ? "Idioma" : "Language"}: ${a.lang}`,
    ...(a.tags.length ? [`- ${es ? "Temas" : "Topics"}: ${a.tags.join(", ")}`] : []),
    ...(a.aiAssisted
      ? [
          `- ${
            es
              ? "Nota: redacción asistida por inteligencia artificial, revisada por el equipo editorial."
              : "Note: written with help from artificial intelligence and reviewed by the editorial team."
          }`,
        ]
      : []),
    "",
  ];
  if (a.imageUrl) lines.push(`![${a.title}](${a.imageUrl})`, "");
  lines.push(htmlToMarkdown(a.contentHtml), "");
  if (a.sources.length) {
    lines.push(`## ${es ? "Fuentes" : "Sources"}`, "");
    for (const s of a.sources) lines.push(`- [${s.title || s.url}](${s.url})`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export type MarkdownListItem = { title: string; url: string; excerpt?: string; date?: string };

export function listToMarkdown(title: string, intro: string, items: MarkdownListItem[]): string {
  const lines = [`# ${title}`, "", intro, ""];
  for (const it of items) {
    lines.push(`- [${it.title}](${it.url})${it.date ? ` — ${it.date.slice(0, 10)}` : ""}`);
    if (it.excerpt) lines.push(`  ${it.excerpt}`);
  }
  return lines.join("\n").trim() + "\n";
}
