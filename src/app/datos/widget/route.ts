import { getDb } from "@/lib/db";
import { listLatest } from "@/lib/queries";
import { getSection, isSectionId } from "@/lib/sections";
import { baseUrlFromRequest } from "@/lib/site";
import { absoluteUrl, articlePath } from "@/lib/urls";
import { toLang } from "@/i18n";

export const dynamic = "force-dynamic";

/**
 * GET /datos/widget — nuestras últimas notas, para que otro sitio las muestre.
 *
 * Idea de Richard (nº 5 del plan de ingresos): un trozo de código que cualquier web pega y muestra
 * lo último de losupe. Nos trae tres cosas a la vez: **visitas** de gente que no nos conocía,
 * **enlaces** desde otros dominios (que es lo que más pesa en el posicionamiento) y **marca**.
 *
 * Se sirve como JavaScript en vez de como marco (`iframe`) a propósito: un marco no aporta enlaces
 * al posicionamiento y muchos sitios lo bloquean. Esto escribe HTML de verdad en la página que lo
 * incrusta, con enlaces normales que Google sigue.
 *
 * No lleva cookies, no rastrea a nadie y no pide ninguna llave: cuanto más fácil de pegar, en más
 * sitios acaba.
 */

const CACHE = "public, max-age=900, s-maxage=900, stale-while-revalidate=3600";

function escapar(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = toLang(url.searchParams.get("lang") ?? "es");
  const seccion = url.searchParams.get("seccion");
  const limite = Math.min(Math.max(Number(url.searchParams.get("n")) || 5, 1), 10);
  const tema = url.searchParams.get("tema") === "oscuro" ? "oscuro" : "claro";
  const base = baseUrlFromRequest(request);

  let notas: { title: string; url: string; seccion: string; imagen: string | null }[] = [];
  try {
    const db = await getDb();
    const lista = await listLatest(db, lang, {
      limit: limite,
      ...(seccion && isSectionId(seccion) ? { sectionId: seccion } : {}),
    });
    notas = lista.map((a) => ({
      title: a.title,
      url: absoluteUrl(base, articlePath(lang, a.sectionId, a.slug)),
      seccion: getSection(a.sectionId)?.name[lang] ?? a.sectionId,
      imagen: a.imageUrl ? absoluteUrl(base, a.imageUrl) : null,
    }));
  } catch {
    // Sin base, el widget no pinta nada en vez de romper la página de quien nos incrusta.
  }

  const colores =
    tema === "oscuro"
      ? { fondo: "#0b1f3a", texto: "#ffffff", suave: "#9fb3c8", linea: "rgba(255,255,255,.14)" }
      : { fondo: "#ffffff", texto: "#0b1f3a", suave: "#5b6b82", linea: "#e6e2d6" };

  const js = `(function () {
  var d = document;
  var s = d.currentScript || d.querySelector('script[src*="/datos/widget"]');
  // DÓNDE SE PINTA. Por orden: (1) un hueco que haya puesto quien nos incrusta, (2) justo donde
  // está el script, (3) al final de la página. La tercera opción no es un capricho: muchos sitios
  // ponen los scripts en la cabecera —Next.js lo hace solo— y ahí un div no se ve. Sin este
  // respaldo, el widget se pintaba dentro del <head> y no aparecía nada (visto el 29 ago 2026).
  var hueco = d.querySelector("[data-losupe-aqui]");
  var anclaEnCuerpo = s && s.parentNode && s.parentNode.nodeName !== "HEAD" ? s : null;
  var host = d.createElement("div");
  var notas = ${JSON.stringify(notas.map((n) => ({ t: escapar(n.title), u: n.url, s: escapar(n.seccion), i: n.imagen })))};
  var C = ${JSON.stringify(colores)};
  host.setAttribute("data-losupe", "1");
  host.style.cssText = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:" + C.fondo + ";color:" + C.texto + ";border:1px solid " + C.linea + ";border-radius:16px;padding:16px;max-width:420px";
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 12px"><a href="${base}/${lang}" target="_blank" rel="noopener" style="font-weight:800;font-size:15px;color:' + C.texto + ';text-decoration:none">losupe<span style="color:#FFD60A">.</span>com</a><span style="font-size:11px;color:' + C.suave + '">${lang === "en" ? "Latest" : "Lo último"}</span></div>';
  for (var i = 0; i < notas.length; i++) {
    var n = notas[i];
    html += '<a href="' + n.u + '" target="_blank" rel="noopener" style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:' + (i ? "1px solid " + C.linea : "none") + ';text-decoration:none;color:' + C.texto + '">' +
      (n.i ? '<img src="' + n.i + '" alt="" width="56" height="56" loading="lazy" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex:0 0 auto">' : "") +
      '<span style="min-width:0"><span style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:' + C.suave + '">' + n.s + '</span>' +
      '<span style="display:block;font-size:14px;line-height:1.35;font-weight:600">' + n.t + '</span></span></a>';
  }
  host.innerHTML = html;

  function pintar() {
    // El hueco se busca otra vez aquí: si el script va en la cabecera con async, puede ejecutarse
    // ANTES de que exista el resto de la página, y entonces la primera búsqueda no encuentra nada.
    var destino = d.querySelector("[data-losupe-aqui]") || anclaEnCuerpo;
    if (destino && destino.hasAttribute && destino.hasAttribute("data-losupe-aqui")) {
      destino.appendChild(host);
    } else if (destino && destino.parentNode) {
      destino.parentNode.insertBefore(host, destino);
    } else if (d.body) {
      d.body.appendChild(host);
    }
  }

  if (hueco || anclaEnCuerpo || d.readyState !== "loading") pintar();
  else d.addEventListener("DOMContentLoaded", pintar);
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": CACHE,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
