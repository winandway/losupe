/** Conversión de los textos del panel a datos (una idea por línea, URLs sueltas). */

/** Una idea por línea; tras `|` va la indicación o enfoque de esa nota. Se ignoran numeraciones. */
export function parseIdeas(text: string): { titleIdea: string; brief: string | null }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^\d+[.)]\s*/, ""))
    .filter((l) => l.length >= 3)
    .map((l) => {
      const [title, ...rest] = l.split("|");
      const brief = rest.join("|").trim();
      return {
        titleIdea: (title ?? "").trim().slice(0, 300),
        brief: brief ? brief.slice(0, 2000) : null,
      };
    })
    .filter((i) => i.titleIdea.length >= 3);
}

/** URLs http(s) separadas por espacios o líneas (máximo 10). */
export function parseUrls(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\/\S+$/i.test(u))
    .slice(0, 10);
}
