# Candados de losupe.com

> Regla global: lo que se rompió y volvió a funcionar queda **trancado con candado** (una prueba que
> se pone en rojo si se reintroduce el error) y **documentado aquí** para que otra sesión, sin memoria,
> pueda repararlo sola. Antes de un rollback, un revert o una actualización grande de paquetes, se lee
> este archivo y se comprueba que cada candado sigue puesto.

Cómo comprobar todos a la vez:

```bash
cd /Users/windocellc/losupe.com && npm run verify && npm run test:e2e
```

---

## 1. Las sugerencias del buscador quedaban DEBAJO de la foto de la nota principal (celular)

- **Cómo se veía (23 ago 2026, celular de Richard, navegador con modo oscuro forzado):** al escribir en
  el buscador del frente, la lista de sugerencias aparecía pero la foto de la nota principal se pintaba
  por encima de ella; solo se leía la primera sugerencia.
- **Causa real:** la lista vivía DENTRO del hero (`position:absolute; z-index:50` dentro de la sección
  del video). Los navegadores que fuerzan modo oscuro meten `filter: invert(1) hue-rotate(180deg)` al
  hero y a las fotos (por eso las fotos se ven normales y el resto invertido). Un `filter` convierte al
  hero en un **contexto de apilamiento** cerrado: el `z-index:50` ya solo vale dentro del hero, y la
  foto de abajo (otro contexto, pintado después) queda encima. En Chrome/Safari normales no se notaba.
- **Qué se hizo:** `src/components/SearchBox.tsx`
  - Escritorio: la lista se pinta con `createPortal(list, document.body)` con `position:absolute`
    (coordenadas medidas desde la caja: `measure()`) y `z-[1000]`. Se vuelve a medir al hacer scroll o
    cambiar el tamaño. Ningún contenedor del hero puede taparla ni recortarla.
  - Celular (`max-width: 767px`, hook `useMediaQuery` en `src/lib/use-media.ts`): al tocar la caja se
    abre una **hoja a pantalla completa** (`role="dialog"`, `fixed inset-0 z-[1000]`, también en portal)
    con su propia caja, la lista y el botón de cerrar. En la página de resultados (`autoFocus`) no se
    abre sola.
  - El clic fuera cierra la lista, pero ignora clics dentro del portal (`listRef`).
- **Commit donde quedó funcionando:** el que acompaña a este documento (`feat: frente de celular tipo
diario…`, 23 ago 2026).
- **Candado (prueba en rojo comprobada):** `tests/e2e/smoke.spec.ts` → «buscador del frente: escribe y
  sugiere sin enviar». Antes de escribir, la prueba **inyecta el mismo `filter` del modo oscuro forzado**
  al hero y a las fotos; luego exige que (a) en escritorio la lista sea hija directa de `<body>` y (b)
  en escritorio y celular `document.elementFromPoint` en el centro de la primera sugerencia caiga dentro
  de la lista/hoja. Se comprobó que con la lista otra vez dentro del hero la prueba falla
  (`Expected "BODY" Received "DIV"` y las 9 opciones tapadas).
- **Qué NO tocar:** no devolver la lista al `<form>`; no quitar el portal «porque en mi navegador se ve
  bien»; no poner `overflow-hidden`, `transform` ni `filter` en ancestros de la caja pensando que no
  afecta (afecta al portal solo si se pone en `body`).

## 2. La barra fija (logo/menú en celular, botonera en escritorio) dejaba de verse al bajar

- **Cómo se veía:** al desplazar la página, la barra con el logo se iba con el contenido; en celular
  uno se quedaba sin marca a la vista (Richard sintió que «estaba dentro de Mercatren» al ver la foto
  de esa nota sin el logo arriba).
- **Causa real:** `position: sticky` solo pega **dentro de su padre**. Las barras estaban dentro de un
  `<header>` envolvente: en cuanto el `<header>` salía de la pantalla, las barras se iban con él.
- **Qué se hizo:** `src/components/Header.tsx` devuelve un fragmento: `<header>` (barra del logo,
  `sticky top-0 z-40` en celular, `md:static`) y `<Botonera>` (`md:sticky md:top-0 md:z-40`) son hijos
  DIRECTOS de `<body>` (el layout pone `<Header/>` justo dentro de `<body>`).
- **Candado:** `tests/e2e/smoke.spec.ts` → «celular: barra fija con logo, menú hamburguesa y
  secciones» baja 1200 px y exige que el enlace del logo siga `toBeInViewport()`.
- **Qué NO tocar:** no envolver `<Header/>` en un `<div>` ni en otro `<header>` en `layout.tsx`; no
  poner `overflow` en `<body>`/`<html>`.

## 3. Base de datos vacía en producción → 500 (23 ago 2026)

- **Cómo se veía:** `losupe.com/es` devolvía 500 recién publicado.
- **Causa:** el esquema no se había aplicado en la D1 del sitio (YaDominios no corre `schema.sql` solo).
- **Qué se hizo:** `worker.ts` + `src/lib/schema-guard.ts`: en la primera petición el worker aplica
  `schema.sql` (incrustado en `src/lib/schema-sql.ts` por `npm run schema:embed`) y siembra el contenido
  (`src/lib/seed-content.ts`), con huella en `settings.schema_hash` y marcas `seed:<id>:<hash>`. Todo
  idempotente (`IF NOT EXISTS`, `INSERT OR IGNORE`).
- **Candado:** `tests/unit/schema-guard.test.ts` y la e2e «/__health reporta la base en verde»
  (`/__health` → `ok:true`, `schema.hadTables`, semillas `seeded:true`).
- **Qué NO tocar:** no quitar el guardián «porque ya está creada la base»; no meter `;` dentro de
  textos en `schema.sql`; contenido largo va por semillas, no en `schema.sql`.

## 4. Índice de búsqueda (FTS5) vacío o ausente

- **Cómo se vería:** el buscador sin sugerencias o sin acentos/sinónimos.
- **Qué se hizo:** `schema.sql` crea `articles_fts`; `worker.ts` reconstruye el índice cuando cambia el
  esquema o entra una semilla (`rebuildSearchIndex`); `src/lib/search-guard.ts` lo rellena en la
  primera búsqueda si está vacío; si FTS fallara, `searchSmart` cae a `LIKE` con sinónimos.
- **Candado:** `tests/unit/search.test.ts` y la e2e «buscador: sugerencias, sinónimos y acentos»
  (`btc` → Bitcoin, `dolar` → dólares, `mer` → Mercatren, `q` vacío → 400).
- **Qué NO tocar:** la tokenización `unicode61 remove_diacritics 2`; las claves de `search.*` en
  `src/i18n/{es,en}.ts` deben existir en ambos idiomas (hay prueba de paridad).

## 5. El panel `/panel` no debe pasar por la redirección de idioma

- **Cómo se vio (23 ago 2026, en local):** `/panel/entrar` redirigía a `/en/panel/entrar` y salía la
  portada pública con 404 de Next; el login nunca cargaba.
- **Causa:** `src/lib/lang-redirect.ts` manda toda ruta sin `/es` o `/en` al idioma del navegador; el
  panel no lleva prefijo de idioma (usa cookie `panel_lang`).
- **Qué se hizo:** `/panel` está en `SKIP_PREFIXES` (junto con `/media/`, `/datos/`, `/__health`…).
- **Candado:** `tests/unit/agent.test.ts` → «las rutas de descubrimiento no se redirigen por idioma»
  incluye `/panel`, `/panel/entrar`, `/panel/accion/entrar`, `/media/...`, `/datos/buscar`; y la e2e
  «panel: sin sesión manda a entrar…».
- **Qué NO tocar:** no agregar páginas nuevas fuera de `[lang]` sin sumarlas a `SKIP_PREFIXES`.

## 6. Modelos de imagen caros: bloqueados en código

- **Por qué existe:** dos facturas desastrosas ($500+ y $200+) en otros proyectos por modelos caros.
- **Qué se hizo:** `src/lib/robot/model-guard.ts`: lista blanca (Seedream 4 $0.03, Flux Schnell,
  Pexels $0) con tope $0.05 por imagen, lista negra explícita (gpt-image, DALL·E, Imagen, Flux Pro,
  Ideogram v2/v3, Recraft, SD3, Midjourney…) y `assertImageModelAllowed()` delante de cada llamada en
  `images.ts`. Tope diario `settings.daily_budget_usd` con `assertBudget()` antes de cada nota.
- **Candado:** `tests/unit/robot-core.test.ts` → «bloqueo de modelos caros»: cada modelo de la lista
  negra lanza `ModelBlockedError`, uno desconocido también, y ningún modelo de la lista blanca supera
  el tope; `tests/unit/robot-pipeline.test.ts` → con el tope gastado la corrida se salta.
- **Qué NO tocar:** no agregar modelos a la lista blanca sin autorización escrita de Richard con el
  costo por imagen; no quitar el `assert` «porque el panel ya valida».

## 7. La barra lateral del panel no puede vivir dentro de un encabezado con `backdrop-blur`

- **Cómo se vio (23 ago 2026, al rediseñar el panel):** la barra lateral aparecía pintada pero los
  enlaces no se podían tocar: los clics los interceptaba el bloque del logo o el de abajo, y la
  navegación quedaba muerta.
- **Causa real (la misma familia del candado 1):** `backdrop-filter` (la clase `backdrop-blur`) en el
  encabezado convierte a ese encabezado en el **marco de referencia** de los elementos con
  `position: fixed` que estén dentro. La barra, que debía medir la altura de la pantalla, quedó
  encerrada en los ~60 px del encabezado y todo se solapó.
- **Qué se hizo:** `src/components/panel/PanelShell.tsx` pinta `<PanelSidebar>` **fuera** del
  `<header>`, como hijo directo del contenedor raíz; el encabezado usa fondo sólido (`bg-paper`) en
  vez de `backdrop-blur`; y el botón de menú de celular es `fixed` en la esquina, con el encabezado
  dejándole sitio (`pl-16`).
- **Candado:** `tests/e2e/smoke.spec.ts` → «panel: sin sesión manda a entrar…» navega **haciendo
  clic** en «Encargos» dentro de la barra lateral (en celular la abre antes) y comprueba
  `aria-current="page"`. Si la barra vuelve a quedar atrapada, el clic falla y la prueba se pone roja.
- **Qué NO tocar:** no metas `backdrop-blur`, `filter` ni `transform` en ancestros de algo `fixed`.
  Si hace falta el efecto, el elemento fijo se saca de ese subárbol (o se pinta en un portal).

## 8. El sitemap no puede caerse ni llegar «vacío» a Google

- **Cómo se vio (23 ago 2026):** Search Console mostró `https://losupe.com/sitemap.xml` con
  **«No se ha podido obtener»** y 0 páginas descubiertas.
- **Causa real:** el sitemap en sí estaba bien (XML válido, 57 URLs, robots lo declara). Google lo
  leyó **durante uno de los redespliegues del día** —ese día se publicó siete veces— y en esos
  segundos el sitio no responde. Riesgo de fondo: el sitemap se arma consultando la base, así que un
  fallo de la base devolvía **500** y Google lo habría marcado igual.
- **Qué se hizo:**
  1. `src/app/sitemap.ts`: si la base falla, **no revienta**: sale con las páginas fijas (portada,
     secciones, legales, «Publica tu noticia») y deja el fallo en el registro (`console.error`), no
     en silencio.
  2. Se agregaron `/es/publica` y `/en/publish`, que faltaban.
  3. `worker.ts`: `sitemap.xml`, `news-sitemap.xml`, `robots.txt` y `llms.txt` se sirven con
     `Cache-Control: public, max-age=600, stale-while-revalidate=86400` y **sin la cabecera `Vary`
     de Next** (`rsc, next-router-state-tree…`), que no pinta nada en un XML y confunde a las cachés
     y a algunos rastreadores.
- **Candado:** `tests/e2e/smoke.spec.ts` → «los mapas del sitio son válidos para Google»: 200,
  tipo XML, empieza por `<?xml`, sin URLs repetidas, sin `&` sin escapar, sin rutas bloqueadas por
  robots, con la portada, las secciones y las páginas de venta dentro, `max-age=600` y **sin `Vary`**;
  además comprueba el news-sitemap y que robots.txt declare los dos mapas.
- **Qué NO tocar:** que el sitemap nunca dependa de que la base responda para devolver 200. Si se
  agrega una página pública nueva, se agrega también aquí (la prueba lo exige para las de venta).
- **Nota operativa:** después de publicar varias veces seguidas conviene reenviar el sitemap en
  Search Console; Google reintenta solo, pero el reenvío acelera.

## 9. Añadir una columna a una tabla que ya existe

- **Cómo se vio (23 ago 2026):** al dar especialidades a los autores hizo falta una columna nueva
  (`authors.sections_json`). En SQLite `ALTER TABLE … ADD COLUMN` **no admite `IF NOT EXISTS`**: en la
  base local (y en producción, que ya tenía la tabla) la sentencia falla con «duplicate column name»
  y, al ir dentro del lote, **tumbaba el esquema entero**.
- **Qué se hizo:** `src/lib/schema-guard.ts` → `applySchema` separa los `ALTER TABLE` del resto y los
  ejecuta **uno a uno**, tolerando **solo** el error de columna duplicada; cualquier otro error se
  propaga (nada en silencio). Los ALTER van primero, porque lo que sigue puede necesitar la columna.
- **Candado:** `tests/unit/schema-guard.test.ts` → «si la columna ya existe, sigue adelante;
  cualquier otro error se propaga»: comprueba las dos ramas.
- **Qué NO tocar:** no metas un `ALTER TABLE` dentro del lote general; y no uses `try/catch` general
  para tragarte errores de esquema — solo el de columna duplicada.
- **Ojo:** `npx wrangler d1 execute --file schema.sql` **no pasa por el guardián** (ejecuta SQL crudo),
  así que en local fallará el ALTER si la columna ya está. Para pruebas locales, aplica el esquema sin
  esa línea o deja que el worker lo haga.

## 10. El orden del `schema.sql` importa en una base NUEVA

- **Cómo se vio (24 ago 2026):** el workflow `verify` de GitHub falló con
  `FOREIGN KEY constraint failed` al crear la base local desde cero. En producción no se notó porque
  allí las tablas ya tenían datos.
- **Causa real:** el bloque del patrocinador YaDominios (`sponsors` + `assignments`, que apuntan a
  `sections`) quedó **antes** del `INSERT OR IGNORE INTO sections`. En una base con secciones no pasa
  nada; en una base nueva, la clave foránea revienta y se cae todo el esquema.
- **Qué se hizo:** se movió ese bloque al final, después de los datos base. Orden correcto del
  archivo: **tablas → índices → `ALTER TABLE` (columnas nuevas) → datos base (secciones, autores,
  ajustes) → equipo de redacción → fuentes → patrocinadores y encargos**.
- **Candado (comprobado en rojo):** `tests/unit/schema-guard.test.ts` → «orden de dependencias del
  schema.sql»: exige que las tablas se creen antes de escribir, que **nada referencie una sección
  antes de que exista**, que el `ALTER` de `sections_json` vaya antes de usarla y que los `UPDATE` a
  autores vayan después de insertarlos. Se comprobó devolviendo el bloque a su sitio malo: la prueba
  falla. Corre en `npm run verify`, o sea, en el pre-push y en CI.
- **Qué NO tocar:** al agregar datos nuevos al `schema.sql`, ponlos **al final**; si referencian
  secciones o autores, nunca antes de los datos base.

## 11. El escáner de secretos apunta al código, no al artefacto compilado

- **Cómo se vio (24 ago 2026):** al hacer push, gitleaks se puso en rojo con **4 hallazgos** y el
  pre-push bloqueó la publicación (que es exactamente lo que debe hacer).
- **Qué eran:** `previewModeSigningKey` y `encryptionKey` dentro de `_worker.js`, el archivo
  **compilado** que vive en la rama de publicación `yapanel-build`. Next.js genera esos dos valores
  **al azar en cada compilación** para su «modo borrador», que este proyecto no usa. No son
  credenciales nuestras y no dan acceso a nada. Aparecieron porque se trajo esa rama al repositorio
  local con un `git fetch`.
- **Se comprobó lo importante:** en todo el historial **no hay ni una llave real** (Gemini, fal.ai,
  Pexels, Brave ni la contraseña de producción). Lo único que aparece es
  `ADMIN_PASSWORD=losupe-panel-local`, que es la contraseña **de pruebas** documentada en
  `.dev.vars.example` y que usa CI.
- **Qué se hizo:** `.gitleaks.toml` con `useDefault = true` (no se desactiva **ninguna** regla) y una
  lista de exclusión que solo saca del escaneo el artefacto compilado (`_worker.js`, `.open-next/`,
  `.dist-worker/`).
- **Candado comprobado en los dos sentidos:** con una llave de formato real
  (`AIzaSy…`) en `src/`, `gitleaks protect --staged` la detecta y **bloquea el commit**; con el código
  limpio pasa. También se verificó que sigue detectando claves de Google, Stripe y genéricas.
- **Qué NO tocar:** no añadas rutas de código fuente a la lista de exclusión, ni uses `--no-verify`
  para saltarte el hook. Si gitleaks se pone en rojo, primero se mira **qué** encontró.

## 12. El piloto automático no puede depender solo del cron de la plataforma

- **Cómo se vio (24 ago 2026):** Richard avisó de que el robot solo había publicado una nota. En
  `/__health` el robot estaba **encendido y con publicación automática**, pero la única corrida
  registrada era la **manual**: el cron de YaDominios no había disparado ni una vez en 7 horas.
- **Se comprobó:** el endpoint funciona (`GET /__scheduled` con la cabecera `x-yad-cron` corrió y
  publicó la nota de YaDominios), así que el fallo estaba en la invocación, no en el código.
- **Qué se hizo:**
  1. Cron con lista explícita (`0 11,13,15,17,19,21,23 * * *`) en vez de rango con paso
     (`11-23/2`), por si el planificador no soporta esa forma.
  2. **Latido por tráfico** (`src/lib/robot/heartbeat.ts`): en cada visita normal al sitio se mira si
     toca corrida y, si toca, se lanza en segundo plano con `ctx.waitUntil` (no se hace esperar al
     lector). Para que dos visitas a la vez no lancen dos corridas, el turno se gana con un UPDATE
     condicional (`WHERE value < límite`), que SQLite resuelve de forma atómica.
- **Candado:** `tests/unit/correo-boletin.test.ts` → «piloto automático por tráfico»: no corre en
  pausa, no corre si la última fue hace poco (solo una petición gana), corre si pasó el intervalo y
  no explota sin base.
- **Qué NO tocar:** no quites el latido «porque el cron ya va»; son dos caminos a propósito. Y no
  lances el robot fuera de `ctx.waitUntil`: el lector no debe esperar a que se escriba una nota.
