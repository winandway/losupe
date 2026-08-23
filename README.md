# losupe.com

Portal de noticias bilingüe (español / inglés) con un **robot redactor propio** que cada mañana lee
fuentes, elige temas, redacta notas nuevas, las ilustra y las publica. Todo vive dentro de
**YaDominios Cloud** (worker + base D1 + archivos R2 + cron), sin n8n ni servicios intermedios.

Nace de **MundosCrypto** (portal de criptomonedas): su archivo de noticias se conserva en la
sección Cripto.

| Pieza               | Tecnología                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Sitio               | Next.js 16 (App Router) + Tailwind 4, empaquetado con OpenNext                             |
| Plataforma          | YaDominios Cloud (`env.DB` D1, `env.BUCKET` R2, `env.ASSETS`, crons)                       |
| Idiomas             | `/es/...` y `/en/...` con selector de banderas y respaldo al español                       |
| Robot               | `GET /__scheduled` (programador de YaDominios) → `src/lib/robot/`                          |
| Base autogestionada | El worker crea el esquema y siembra las noticias heredadas solo; estado en `GET /__health` |
| Pruebas             | Vitest + Testing Library + msw (unitarias) · Playwright (humo e2e)                         |
| Calidad/seguridad   | TypeScript estricto, ESLint + plugin security, gitleaks, CI                                |

## Mapa del repo

```
schema.sql                 Esquema D1 idempotente (se incrusta en el worker; también lo corre YaDominios)
seed/legacy-mundoscrypto.sql  Noticias heredadas (se incrustan y se siembran solas una vez)
seed/content/*.mjs         Notas editoriales puntuales (ES/EN) que se publican al hacer push
scripts/embed-schema.mjs   Genera src/lib/schema-sql.ts y src/lib/seed-content.ts (antes de cada build)
worker.ts                  Worker de producción: envuelve Next (OpenNext), garantiza la base,
                           redirige por idioma y agrega /__health y /__scheduled
yadominios.json            Config que se publica (crons, flags)
wrangler.jsonc             Bindings locales para next dev / preview
src/app/[lang]/...         Portada, sección, artículo, autor, buscar, acerca, rss.xml, 404
src/app/{robots,sitemap}.ts, news-sitemap.xml/   SEO
src/i18n/                  Diccionarios ES/EN (mismas claves, hay prueba que lo exige)
src/lib/                   secciones, rutas, consultas D1, HTML, fechas, RSS, SEO, robot
src/components/            Header, Footer, LangSwitcher, ArticleCard, ...
scripts/                   import-mundoscrypto.ts · db-local.sh · db-remote-import.ts
tests/unit, tests/e2e      Pruebas
docs/                      Plan (PDF) y tutorial de publicación
```

## Comandos

```bash
npm install
npm run db:local        # crea/actualiza la base D1 local con esquema + noticias heredadas
npm run dev             # http://localhost:3000 (next dev con bindings locales)
npm run preview         # build OpenNext + wrangler dev en :8787 (igual que producción)
npm run verify          # tipos + lint + pruebas con cobertura + build + audit + gitleaks
npm run test:e2e        # prueba de humo contra el preview (:8787)
```

## Publicación

`git push` a `main` → el Action `build-para-yadominios-cloud` compila y deja el sitio en la rama
`yapanel-build` → YaDominios Cloud (conectado a esa rama) republica solo.
Paso a paso con croquis: [docs/publicar-en-yadominios.md](docs/publicar-en-yadominios.md).

## Marca y frente

- Video del frente: `public/video/hero.mp4` (franja 3:1, 1600×533, 12 s en bucle sin corte, 1.8 MB) y póster
  `hero-poster.jpg`. Origen: Mixkit «Aerial view of the glass corporate buildings of a big city»
  (licencia Mixkit Free, sin atribución obligatoria), recortado y comprimido con ffmpeg.
- Autores: `equipo-losupe` (redacción), `kevin-rondon` (archivo de MundosCrypto) y **`magaly-molina`**
  (firma por defecto de lo nuevo: `settings.default_author`).
- Esquema versionado por huella: si `schema.sql` cambia, el worker lo reaplica solo
  (`settings.schema_hash`), así que agregar un autor o una columna es editar `schema.sql` y publicar.

## Publicar una nota a mano (sin panel todavía)

1. Crea `seed/content/AAAA-MM-DD-tema.mjs` copiando `seed/content/2026-08-23-mercatren.mjs` (artículo + `i18n.es` + `i18n.en`, imágenes en `public/img/notas/...`).
2. `npm run schema:embed` y `git push`. El worker la siembra en la primera visita (marca por huella: si editas la nota y vuelves a publicar, se actualiza).
3. Comprueba en `/__health` que la semilla aparece con `seeded: true`.

En el bloque 2 el robot y el panel escriben directo en la base; este camino queda para notas puntuales.

## Variables de entorno

Ver `.env.example`. Ninguna es obligatoria para arrancar. `CRON_SECRET` permite disparar el robot
a mano: `GET /__scheduled?key=<CRON_SECRET>`.

## Bloques de trabajo

1. **Cimientos y portal** — repo, blindaje, base, portal bilingüe, migración de MundosCrypto. ✅
2. **Robot redactor** — fuentes → curaduría → redacción ES/EN → imagen → revisión → publicar.
3. **Google y posicionamiento** — Publisher Center, IndexNow, perfiles de autor, Core Web Vitals.
4. **Suscriptores y boletín** — registro, confirmación, boletín cada 4 días.

Plan completo: [docs/plan-losupe-2026-08-22.pdf](docs/plan-losupe-2026-08-22.pdf).

---

© 2026 losupe.com | All rights reserved. Developed by [Windoce LLC](https://windoce.com)

## Capturas (bloque 1)

| Portada (móvil)                          | Nota (móvil)                          | Portada (escritorio)                          |
| ---------------------------------------- | ------------------------------------- | --------------------------------------------- |
| ![](docs/img/capturas/portada-movil.png) | ![](docs/img/capturas/nota-movil.png) | ![](docs/img/capturas/portada-escritorio.png) |
