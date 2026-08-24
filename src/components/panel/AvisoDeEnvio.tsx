"use client";

import { useEffect } from "react";

/**
 * QUE SE NOTE QUE EL BOTÓN HIZO ALGO.
 *
 * Richard, 24 ago 2026, pulsando «Ejecutar ahora»: *«no se queda, no dice una rueda girando ni
 * alguna cosa. Hay algo que sucede en segundo plano, pero no lo muestra. Entonces uno da clic,
 * clic, clic y no hace nada. Eso es un bug»*. Tenía razón: escribir una nota tarda entre 30 y 90
 * segundos y el panel se quedaba exactamente igual todo ese rato.
 *
 * Se monta UNA vez en el armazón del panel y escucha el envío de **cualquier** formulario que haya
 * dentro. A propósito, en vez de tocar los veintitrés formularios uno a uno: los que se añadan
 * mañana quedan cubiertos solos, sin que nadie tenga que acordarse.
 *
 * **El aviso se dibuja FUERA del árbol de React, y eso también es a propósito.** El primer intento
 * cambiaba el texto del botón a «Trabajando…»; React lo restauraba al volver a pintar y el aviso no
 * llegaba a verse nunca. Estos elementos los crea este componente en `document.body`, así que nadie
 * los pisa: una barra que se mueve arriba y un cartel que dice cuánto puede tardar. La misma capa,
 * por encima de todo, impide el clic, clic, clic mientras tanto.
 */

const ID_AVISO = "panel-trabajando";

export function AvisoDeEnvio({ etiqueta, detalle }: { etiqueta: string; detalle: string }) {
  useEffect(() => {
    function alEnviar(e: Event) {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      // Solo los formularios que de verdad hacen algo en el servidor.
      if (!form.action.includes("/panel/accion/")) return;
      if (document.getElementById(ID_AVISO)) return;

      const capa = document.createElement("div");
      capa.id = ID_AVISO;
      capa.setAttribute("role", "progressbar");
      capa.setAttribute("aria-label", etiqueta);
      capa.style.cssText =
        "position:fixed;inset:0;z-index:3000;background:rgba(11,31,58,.28);display:flex;align-items:flex-start;justify-content:center;cursor:progress";

      const barra = document.createElement("div");
      barra.style.cssText =
        "position:absolute;top:0;left:0;right:0;height:4px;overflow:hidden;background:rgba(255,255,255,.35)";
      const luz = document.createElement("div");
      luz.style.cssText =
        "height:100%;width:35%;background:#FFD60A;animation:panel-trabajando 1.1s ease-in-out infinite";
      barra.appendChild(luz);

      const cartel = document.createElement("div");
      cartel.style.cssText =
        "margin-top:22vh;max-width:22rem;background:#fff;color:#0b1f3a;border-radius:16px;padding:20px 24px;text-align:center;box-shadow:0 12px 40px rgba(11,31,58,.25)";
      const titulo = document.createElement("p");
      titulo.textContent = etiqueta;
      titulo.style.cssText = "margin:0 0 6px;font-weight:800;font-size:16px";
      const texto = document.createElement("p");
      texto.textContent = detalle;
      texto.style.cssText = "margin:0;font-size:13px;color:#5b6b82;line-height:1.5";
      cartel.appendChild(titulo);
      cartel.appendChild(texto);

      const css = document.createElement("style");
      css.textContent =
        "@keyframes panel-trabajando{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}";

      capa.appendChild(css);
      capa.appendChild(barra);
      capa.appendChild(cartel);
      document.body.appendChild(capa);

      // Red de seguridad: si la respuesta no llega nunca (red caída), el panel no se queda
      // secuestrado para siempre.
      setTimeout(() => document.getElementById(ID_AVISO)?.remove(), 120_000);
    }

    document.addEventListener("submit", alEnviar);
    // Marca comprobable: sirve de candado en las pruebas y para ver de un vistazo si el aviso está
    // montado en una página del panel.
    document.body.dataset.avisoEnvio = "1";
    return () => {
      document.removeEventListener("submit", alEnviar);
      delete document.body.dataset.avisoEnvio;
      document.getElementById(ID_AVISO)?.remove();
    };
  }, [etiqueta, detalle]);

  return null;
}
