/** Convierte un texto en slug de URL: sin acentos, minúsculas, guiones, máximo 90 caracteres. */
export function slugify(text: string, maxLength = 90): string {
  const base = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= maxLength) return base;
  const cut = base.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, "");
}

/** Valida que un slug venga limpio (solo letras, números y guiones). */
export function isValidSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > 120) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  return !slug.startsWith("-") && !slug.endsWith("-") && !slug.includes("--");
}
