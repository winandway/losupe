import { rutaMiniatura } from "@/lib/robot/images";

/**
 * LA IMAGEN QUE SE VE AL COMPARTIR UN ENLACE (WhatsApp, Facebook, X, LinkedIn).
 *
 * Es la **miniatura**, no la foto grande. Lo vio Richard el 17 sep 2026: al pegar el enlace de una
 * nota en WhatsApp salía el logo de losupe en vez de la foto. La foto grande de esa nota pesaba
 * 2,67 MB, y **WhatsApp no descarga vistas previas de más de unos 300 KB**: se rinde y pone el icono
 * del sitio. Sin foto en la vista previa, casi nadie toca el enlace.
 *
 * La miniatura mide 640 px de ancho —por encima de los 600 que piden Facebook y LinkedIn para la
 * tarjeta grande— y pesa entre 20 y 70 KB. Se ve igual de bien y llega siempre.
 *
 * Sin foto, la tarjeta PNG de la sección (`public/og/`), porque ninguna de estas redes pinta SVG.
 */
export function imagenSocial(article: { imageUrl: string | null; sectionId: string }): string {
  if (!article.imageUrl) return `/og/${article.sectionId}.png`;
  return rutaMiniatura(article.imageUrl);
}
