/**
 * Rutas viejas → nuevas (301). Cuando una nota cambia de slug (p. ej. se reescribe el titular), la
 * URL anterior ya pudo haberse compartido; aquí se deja el puente para que nadie caiga en un 404.
 */
export const LEGACY_PATHS: Readonly<Record<string, string>> = {
  "/es/ventas/pedro-llerena-lanza-mercatren-tienda-1-3-millones-de-productos-competir-amazon":
    "/es/ventas/un-venezolano-lanza-mercatren-tienda-en-linea-1-3-millones-de-productos-estados-unidos",
  "/en/sales/pedro-llerena-launches-mercatren-1-3-million-products-store-taking-on-amazon":
    "/en/sales/venezuelan-entrepreneur-launches-mercatren-online-store-1-3-million-products-united-states",
};

/** Devuelve la ruta nueva si `pathname` es una ruta vieja conocida (ignora la barra final). */
export function legacyRedirectTarget(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return LEGACY_PATHS[clean] ?? null;
}
