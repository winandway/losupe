// Ayudante de las notas «Desde Windoce» sembradas desde el repo (seed/content/*-casa-*.mjs).
//
// El aviso y el enlace final se escriben AQUÍ igual, letra por letra, que en src/lib/casa/aviso.ts
// y src/lib/casa/paso-diario.ts. Una prueba (tests/unit/casa.test.ts) compara cada semilla con el
// aviso del código: si alguien cambia uno y no el otro, se pone en rojo (candado 57).

const ETIQUETA = { es: "Contenido de la casa:", en: "Brand content:" };

function textoAviso(nombre, lang, relacion) {
  if (relacion) return `${relacion[lang]}.`;
  return lang === "es"
    ? `Losupe y ${nombre} son de Windoce LLC.`
    : `Losupe and ${nombre} are part of Windoce LLC.`;
}

export function aviso(nombre, lang, relacion) {
  return `<p class="aviso-casa"><strong>${ETIQUETA[lang]}</strong> ${textoAviso(nombre, lang, relacion)}</p>`;
}

export function enlace(nombre, url, lang) {
  const texto =
    lang === "es" ? `Más información en la página de ${nombre}` : `Learn more on ${nombre}'s site`;
  return `<p><a href="${url}" target="_blank" rel="sponsored noopener">${texto}</a>.</p>`;
}

/**
 * Arma la nota completa. Queda en `review`: no sale hasta que Richard la apruebe en el panel, y
 * después el robot la publica en su día (una de la casa por día).
 */
export function notaCasa({ id, orden, product_id, nombre, url, imagen, formato, relacion, es, en, redes }) {
  const creada = new Date(Date.UTC(2026, 10, 7, 12, orden, 0)).toISOString();
  const lado = (t, lang) => ({
    slug: t.slug,
    title: t.title,
    excerpt: t.excerpt,
    meta_title: t.meta_title,
    meta_description: t.meta_description,
    tags: t.tags,
    content_html: `${aviso(nombre, lang, relacion)}\n${t.body.trim()}\n${enlace(nombre, url, lang)}`,
  });
  return {
    id,
    casa: { product_id, format: formato, redes },
    article: {
      id: `art-${id}`,
      section_id: "windoce",
      author_id: "equipo-losupe",
      status: "review",
      kind: "evergreen",
      origin: "casa",
      image_url: imagen,
      image_alt_es: `${nombre}: imagen oficial del producto`,
      image_alt_en: `${nombre}: official product image`,
      image_credit: `© ${nombre}`,
      ai_assisted: 1,
      published_at: null,
      created_at: creada,
      updated_at: creada,
      sources: [{ title: nombre, url }],
    },
    i18n: { es: lado(es, "es"), en: lado(en, "en") },
  };
}
