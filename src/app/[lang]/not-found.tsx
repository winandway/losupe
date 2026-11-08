import { lang as rootLang } from "next/root-params";
import { PaginaNoEncontrada } from "@/components/PaginaNoEncontrada";
import { toLang } from "@/i18n";

// OJO (candado 59): Next 16 manda esta 404 como un cascarón vacío que se pinta con JavaScript
// cuando `notFound()` sale antes del primer pedazo de HTML. El worker la cambia por /[lang]/error-404,
// que sí viene hecha desde el servidor. Esta sigue sirviendo para la navegación dentro del sitio.
export default async function NotFound() {
  return <PaginaNoEncontrada lang={toLang(await rootLang())} />;
}
