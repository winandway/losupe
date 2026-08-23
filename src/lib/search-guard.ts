import { createSearchIndexGuard } from "./search";

/** Guardián del índice de búsqueda compartido por las rutas de Next (una instancia por worker). */
export const searchIndexGuard = createSearchIndexGuard();
