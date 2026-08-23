# SEO y descubrimiento por IA — estado y checklist

Auditoría del 23 de agosto de 2026 sobre losupe.com en producción (Lighthouse móvil, isitagentready.com,
revisión manual de cabeceras, metadatos y datos estructurados). Cada punto dice qué se comprobó, cómo
quedó y cómo volver a comprobarlo.

## Resumen

| Área                           | Antes                                         | Después                                                                                                    |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Lighthouse SEO (móvil)         | 100                                           | 100                                                                                                        |
| Lighthouse rendimiento (móvil) | 72 (LCP 7,8 s por el video)                   | 77 (LCP 5,1 s); siguiente paso: imágenes responsivas en el bloque 2                                        |
| Lighthouse accesibilidad       | 97 (enlace de autor pequeño)                  | área táctil corregida                                                                                      |
| Lighthouse buenas prácticas    | 92 (CSP bloqueaba la analítica de Cloudflare) | 100                                                                                                        |
| isitagentready.com             | 20/100 — Nivel 1                              | **60/100 — Nivel 4 «Agent-Integrated»** (Discoverability 3/4, Content 1/1, Bot Access 2/2, API/Skills 3/8) |

## Checklist (✅ hecho · ❌ pendiente · ⚪ no aplica hoy)

### Google / buscadores

- ✅ Títulos, descripciones y canónicas por página y por idioma; `hreflang` es/en/x-default.
- ✅ Open Graph y Twitter Card con imagen (1200×630 en portada; imagen de la nota en artículos); `og:locale` y `og:locale:alternate`.
- ✅ JSON-LD: `NewsMediaOrganization`, `WebSite` + `SearchAction`, `NewsArticle`/`Article` con autor, editor, fechas e imagen, `BreadcrumbList`, `ProfilePage`/`Person` en páginas de autor.
- ✅ `sitemap.xml` con alternates por idioma (portadas, secciones, notas, páginas legales) y `news-sitemap.xml` (últimas 48 h).
- ✅ RSS por idioma con imágenes; `robots.txt` con sitemaps y host.
- ✅ Una sola `h1` por página; alt en imágenes; `lang` correcto; 404 reales (antes cualquier ruta desconocida devolvía la portada con 200 — soft-404 — corregido).
- ✅ Página en el idioma sin traducción: `noindex` + canónica al español (evita contenido duplicado).
- ✅ Páginas de confianza (E-E-A-T / Google News): Acerca, Política editorial, Privacidad, Términos, perfiles de autor con bio.
- ✅ Cabeceras de seguridad, HTTPS, HSTS; compresión Brotli; caché de estáticos (`/img`, `/video`, `/brand`).
- ✅ IndexNow: clave pública servida en `/<clave>.txt`; aviso automático al sembrar notas nuevas (el robot lo usará en cada publicación).
- ❌ Google Search Console y Bing Webmaster: hay que reclamar la propiedad (Richard, con su cuenta). Soporte listo para pegar el código de verificación como variable de entorno.
- ❌ Google News / Publisher Center: solicitud manual una vez haya historial de publicación (requiere contacto y política editorial → ya existen).
- ❌ Correo de contacto público del medio (Richard): lo piden Google News, las políticas y la página de contacto.
- ❌ Entidad legal del medio (qué empresa publica losupe) para Términos/Privacidad y JSON-LD de la organización.
- ❌ Redes sociales oficiales (`sameAs` en JSON-LD, `twitter:site`).
- ❌ Foto y bio ampliada de Magaly Molina (E-E-A-T).
- ⚠️ Back/forward cache: las páginas dinámicas llevan `no-store` por Next; no afecta a Google, se revisará en el bloque 3.

### Rendimiento (Core Web Vitals)

- ✅ Video del frente diferido: se carga después de `load`, no compite con el LCP; se omite con ahorro de datos o `prefers-reduced-motion`. Desde el 23/08 es el vuelo sobre Manhattan (`hero-v2.mp4`, 1,2 MB) con fuente móvil aparte (`hero-v2-m.mp4`, 0,4 MB).
- ✅ Buscador con sugerencias: la ruta `/datos/buscar` responde `X-Robots-Tag: noindex` y `max-age=60`; la página `/buscar` sigue indexable y funciona sin JavaScript.
- ✅ Fuentes solo `latin` y Newsreader en pesos fijos (700/800): menos KB.
- ✅ `width`/`height` en las imágenes de las notas (sin saltos de diseño); `loading="lazy"` fuera de pantalla; `fetchpriority="high"` en la imagen principal.
- ⚠️ Estáticos: `public/_headers` pide `max-age=86400`; YaDominios Cloud hoy no aplica ese archivo (responde `max-age=0`), pero su borde sí los cachea (`cf-cache-status: HIT`).
- ❌ Imágenes responsivas (`srcset`) para las tarjetas: se resuelve en el bloque 2 cuando el robot genere tamaños al guardar en R2.

### Descubrimiento por agentes de IA (isitagentready.com)

- ✅ `robots.txt` con **Content Signals** (`search=yes, ai-input=yes, ai-train=no`) y reglas explícitas para GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.
- ✅ **Markdown para agentes**: cualquier portada, sección, búsqueda o nota responde en Markdown con `Accept: text/markdown` (`Content-Type: text/markdown`, `x-markdown-tokens`, `Vary: Accept`).
- ✅ Cabecera **Link** (RFC 8288) en todas las páginas: `sitemap`, `llms-txt`, `api-catalog`, RSS y la versión Markdown.
- ✅ `/llms.txt` (descripción del medio, secciones, feeds, últimas notas).
- ✅ `/.well-known/api-catalog` (RFC 9727, linkset).
- ✅ `/.well-known/ai-catalog.json` (ARD) con consultas representativas.
- ✅ `/.well-known/agent-skills/index.json` + `SKILL.md` (cómo leer y buscar losupe).
- ✅ WebMCP: en navegadores con `navigator.modelContext`, el sitio expone `search_losupe`, `latest_losupe_stories` y `read_losupe_story`.
- ⚪ OAuth/OIDC, Protected Resource Metadata, auth.md: no aplican (no hay APIs protegidas).
- ⚪ MCP Server Card: cuando exista el servidor MCP de losupe (idea para el bloque 3).
- ⚪ DNS-AID (registros `_agents`): requiere un agente A2A y DNS firmado; no aplica hoy.
- ⚪ Web Bot Auth: es para operadores de bots, no para el medio.

## Cómo volver a medir

- Lighthouse: `npx lighthouse https://losupe.com/es --preset=desktop` (o móvil por defecto).
- Agentes: https://isitagentready.com/losupe.com
- Rich Results: https://search.google.com/test/rich-results?url=https://losupe.com/es
- Markdown: `curl -H "Accept: text/markdown" https://losupe.com/es`
