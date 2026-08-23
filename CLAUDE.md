@AGENTS.md

# losupe.com — reglas del proyecto

## Perímetro (lo único que esta sesión puede tocar)

- **Carpeta:** `/Users/windocellc/losupe.com`. Ninguna otra.
- **Repositorio:** `github.com/winandway/losupe` (público). Rama de trabajo `main`; rama de
  publicación `yapanel-build` (la escribe el Action; jamás se edita a mano).
- **Plataforma:** YaDominios Cloud, sitio `losupe` (`losupe.sitios.dev` → `losupe.com`). La base
  D1 y el R2 son los del sitio. **No hay recursos en cuentas directas de Cloudflare** para este
  proyecto y no se crean.
- **Datos heredados:** MundosCrypto (`~/mudoscrypto-vscode/elpatron`) es solo fuente de lectura
  (CSV exportado + imágenes públicas). Su Supabase **no se toca**.
- Llaves de IA (Gemini, fal.ai, Pexels, Brave), `ADMIN_PASSWORD` del panel, Turnstile y `CRON_SECRET`
  entran como variables de entorno del sitio en el panel de YaDominios; nunca en el repo. Nombres
  exactos en `.env.example`.

## Reglas de este proyecto

- Bilingüe siempre: todo texto visible vive en `src/i18n/{es,en}.ts` con las mismas claves (hay
  una prueba que lo exige). El inglés se escribe como nativo, no traducción literal.
- Nada de rutas `/api/` (chocan con estáticos en YaDominios). Rutas de backend: `/__scheduled`,
  `/__health`, `/media/...` (R2), `/datos/...`, y el panel en `/panel/...` (acciones en
  `/panel/accion/...`). Todas están excluidas de la redirección de idioma (`lang-redirect.ts`).
- `schema.sql` es idempotente (`IF NOT EXISTS`, `INSERT OR IGNORE`) y **sin punto y coma dentro de
  textos**. Contenido largo va por `scripts/db-remote-import.ts`, no en `schema.sql`.
- Contenido: nunca copiar; el robot cita fuentes (`sources_json`) y marca `ai_assisted`;
  `sanitizeHtml` al guardar y al mostrar.
- Imágenes: Seedream 4 (fal.ai) o Flux Schnell (Workers AI REST) o Pexels con crédito. Modelos
  caros bloqueados; cuentas prepago; tope diario en `settings.daily_budget_usd`.
- Publicar = `git push` a `main` → Action → `yapanel-build`. Un solo push por bloque, con
  `npm run verify` y `npm run test:e2e` en verde y capturas en móvil (375 px) antes.
- Documentación al día en `README.md` y `docs/` con cada cambio.
- **Candados:** lo que se rompió y se arregló vive en [`docs/candados.md`](docs/candados.md) (causa,
  arreglo, prueba que lo fija, qué no tocar). Se lee ANTES de cualquier rollback/revert/actualización
  grande y se añade una entrada cada vez que algo roto vuelve a funcionar.

## Bloques

1. Cimientos y portal — hecho (22 ago 2026).
2. Robot redactor + encargos — hecho en código (23 ago 2026): panel `/panel`, cola de patrocinadores,
   pipeline Gemini/Seedream/Pexels, candados de costo. Falta que Richard ponga las llaves. Tutorial:
   `docs/robot-y-encargos.md`.
3. Google y posicionamiento — Publisher Center, IndexNow, autores, Core Web Vitals.
4. Suscriptores y boletín — registro, confirmación, boletín cada 4 días (Resend).
