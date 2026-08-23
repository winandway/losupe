import type { Lang } from "./config";
import { es, type Dict } from "./es";
import { en } from "./en";

export type { Dict } from "./es";
export * from "./config";

export function getDict(lang: Lang): Dict {
  return lang === "en" ? en : es;
}
