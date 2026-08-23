import { sanitizeHtml } from "@/lib/html";

/** Contenido HTML de una nota (propio, ya revisado) con limpieza mínima al renderizar. */
export function Prose({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
  );
}
