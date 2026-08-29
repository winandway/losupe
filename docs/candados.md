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
- **Segundo intento (mismo día):** la primera versión hacía el trabajo dentro del `waitUntil` de la
  visita y **la corrida se cortó a medias** (quedó «en marcha» para siempre). Escribir una nota tarda
  entre 30 y 90 segundos y no cabe en la petición de un lector. Arreglado así:
  1. El latido **no** hace el trabajo: pide `GET /__scheduled` a su propio sitio, que corre en una
     **invocación aparte con su propio presupuesto de tiempo**. Si la visita se corta, la corrida ya
     arrancó por su cuenta.
  2. Esa llamada interna se firma con un **secreto que el sitio se genera solo** y guarda en la base
     (`settings.robot_tick_token`), así el piloto automático no depende de configurar nada.
  3. `closeStaleRuns()` cierra como error las corridas que llevan más de 15 minutos «en marcha»: el
     panel muestra lo que de verdad pasó y el turno se puede reintentar.
- **Qué NO tocar:** no quites el latido «porque el cron ya va» (son dos caminos a propósito); no
  hagas el trabajo dentro del `waitUntil` de una visita; y no dejes corridas sin cerrar.

## 13. Un patrocinador no puede inundar la portada (ritmo de 2 por semana, una cada 3 días)

- **Cómo se vio (24 ago 2026):** Richard: _«usted lanzó en menos de 4 horas 2 de YaDominios… una
  nota se debe lanzar cada 3 días, no puedes lanzar mucho porque eso ya es spam»_. Y tenía razón:
  el robot alternaba una nota patrocinada con una universal, pero **nada le impedía sacar dos del
  mismo cliente el mismo día** si le tocaban dos turnos. Para el lector eso se lee como publicidad
  disfrazada; para el cliente, se le quema la campaña en una tarde.
- **Cuál era la causa real:** la cola (`nextQueuedAssignment`) solo miraba si el encargo estaba
  `queued` y si el patrocinador estaba activo. No miraba **cuándo publicó la última** ni **cuántas
  lleva esta semana**.
- **Qué se hizo exactamente** (`src/lib/robot/queue.ts`):
  1. Dos frenos nuevos dentro de la misma consulta SQL que elige el encargo, así el robot **no puede
     saltárselos por otro camino**:
     - `NOT EXISTS (… published_at > hace 72 h)` → separación mínima entre notas del mismo cliente.
     - `COUNT(… published_at > hace 7 días) < tope` → tope semanal (2).
  2. Ajustables desde el panel: `settings.sponsor_min_gap_hours` (72) y
     `settings.sponsor_max_per_week` (2).
  3. `sponsorNextSlot()` para que el panel diga en palabras cuándo puede salir la siguiente:
     «ya puede salir», «a partir del …» o «tope semanal alcanzado».
  4. **Bug encontrado por la propia prueba:** si el ajuste no existía en la base, `Number("")` daba
     **0** y el freno quedaba desactivado sin avisar. Ahora un valor vacío o con basura cae en el
     valor por defecto; el `0` solo vale si está escrito a propósito.
- **Candado:** `tests/unit/ritmo-patrocinadores.test.ts` — comprueba los valores por defecto, que un
  ajuste vacío/negativo **no** desactive el freno, que la consulta lleve de verdad las condiciones y
  los parámetros de tiempo, y las cuatro respuestas de `sponsorNextSlot` (espera, ya puede, tope de
  semana, nunca publicó).
- **Cómo se comprueba que sigue funcionando:** en el panel, `Encargos → ficha de un patrocinador`
  tiene que mostrar el aviso de ritmo. Con una nota publicada hoy, el robot **no** debe elegir otra
  de ese mismo cliente: en la corrida siguiente le toca una universal.
- **Qué NO tocar:** no bajes el tope «para probar» ni pongas la separación en 0 en producción; y no
  muevas los frenos a JavaScript después de la consulta — van dentro del SQL para que no haya forma
  de elegir un encargo que no toca.

## 14. Una sola forma de escribir la hora en la base (`datetime('now')` está prohibido)

- **Cómo se encontró (24 ago 2026):** no lo reportó nadie. Salió investigando por qué el freno de
  los patrocinadores parecía no aplicar en producción (era otra cosa: el sitio todavía servía el
  código anterior). Al leer las consultas apareció esto:
  - `datetime('now')` de SQLite guarda `2026-08-24 08:00:00` — con **espacio**, sin **Z**.
  - JavaScript guarda `2026-08-24T08:00:00.000Z` — con **T** y con **Z**.
  - SQLite compara esas dos como **texto**, y el espacio vale menos que la «T»:
    `'2026-08-24 08:00:00' > '2026-08-24T02:00:00.000Z'` da **falso**. Una nota de las 8 de la mañana
    parece más vieja que un corte de las 2.
- **Por qué es peligroso de verdad:** no da error, no aparece en ningún registro, no rompe nada
  visible. Solo **deja de proteger**. Y se esconde: cuando el corte cae en otro día (una separación
  de 3 días) la comparación acierta por casualidad, porque la parte de la fecha ya difiere. El daño
  aparece cuando el corte cae el **mismo día** — por ejemplo, si en el panel se pone la separación
  de los patrocinadores en 6 horas. Ahí el freno se apaga solo y el cliente saca dos notas seguidas.
- **Qué se hizo exactamente:**
  1. `src/lib/sql-time.ts` con `SQL_NOW` = `strftime('%Y-%m-%dT%H:%M:%fZ','now')` — la hora en el
     MISMO formato que `toISOString()`. **Todo** el código pasó a usarla (16 sitios).
  2. `laterThan()` compara con `julianday()`, que entiende los dos formatos. Se usa en los frenos que
     protegen dinero o reputación, para que un formato raro no pueda apagarlos en silencio.
  3. `parseSqlDate()` para leer fechas de la base en JavaScript: `Date.parse('2026-08-24 08:00:00')`
     interpreta esa forma como hora **local**, no UTC, y la cuenta se corre varias horas.
  4. Reparación idempotente al final de `schema.sql`: las filas ya escritas con espacio pasan al
     formato único (`substr(col, 11, 1) = ' '` → `replace(col,' ','T') || 'Z'`).
- **Candado:** `tests/unit/fechas-sqlite.test.ts`, contra **SQLite de verdad** (`node:sqlite`, con el
  puente `tests/unit/sqlite-d1.ts`). La D1 falsa no sirve para esto: responde lo que la prueba le
  diga y nunca ejecuta el SQL — por eso el fallo habría pasado igual. Incluye una prueba que revisa
  el código fuente y se pone roja si alguien vuelve a colar un `datetime('now')`.
- **Comprobado en rojo:** quitando `julianday()` de la consulta, la prueba «CASO QUE MUERDE:
  separación corta (6 h)» falla con `expected { id: 'a2' } to be null` — o sea, el patrocinador
  saca la segunda nota. Con el arreglo puesto, 10/10 en verde.
- **El CI necesita Node 24.** `node:sqlite` solo es estable a partir de Node 24; con Node 22 la
  prueba ni arranca (`Cannot bundle Node.js built-in "node:sqlite"`) y el candado más importante del
  proyecto se quedaba sin correr en GitHub, aunque en la máquina pasara. `verify.yml` usa la misma
  versión que se usa para desarrollar. Probar con otra versión es probar otra cosa.
- **Qué NO tocar:** no vuelvas a `datetime('now')` «porque es más corto»; no compares fechas como
  texto en una consulta que proteja algo; cuando lo que se prueba es la CONSULTA, usa `SqliteD1`,
  no `FakeD1`; y no bajes el Node del CI por debajo de 24 ni excluyas esta prueba «porque falla en
  el servidor»: lo que falla es la versión, no la prueba.

## 15. El diario publicaba de madrugada (franjas horarias y una firma por franja)

- **Cómo se vio (24 ago 2026, 12:49 PM hora de Michigan):** Richard entró al mediodía, actualizó y
  no había nada nuevo. El robot estaba encendido, con publicación automática, y la cuota del día
  marcaba **3 de 3**. Las tres notas habían salido a las **11:35 PM, 12:49 AM y 1:08 AM** — de
  madrugada, cuando no hay nadie leyendo, y las tres firmadas casi seguidas.
- **Cuál era la causa real (dos fallos que se sumaban):**
  1. **El día se contaba en UTC.** El día UTC cambia a las 8 de la noche hora del Este. En cuanto
     cambiaba, la cuota diaria se ponía a cero y el robot tenía permiso para disparar.
  2. **El latido solo miraba el reloj de cocina, no la hora:** «¿pasó una hora desde la última
     corrida?». Nunca preguntaba _qué hora es_. Entre las dos cosas, la noche era el mejor momento
     para publicar: cuota libre y ningún freno.
- **Qué se hizo exactamente:**
  1. `src/lib/robot/franjas.ts` — tres franjas fijas en hora del Este (`America/New_York`):
     **7:00 mañana, 12:00 mediodía, 17:00 tarde**, con ventana de tolerancia de 3 horas por si
     nadie visita el sitio a la hora en punto. Elegidas con los picos de lectura de los medios
     (Pew: 66 % lee noticias entre 5 y 9 PM y 56 % antes de las 8 AM; Public Radio Biz Lab: picos a
     primera hora, 9 AM, mediodía y 5 PM; Sprout Social 2026: pico general 11 AM–6 PM hora local).
  2. `claimTick` solo entrega el turno **dentro** de una franja, y la marca que guarda es el turno
     concreto del día local (`2026-08-24:mediodia`), no una hora suelta. Fuera de horario devuelve
     `fuera_de_horario` aunque falten notas: **los turnos atrasados NO se acumulan**, porque
     acumularlos es justo lo que llenaba la madrugada.
  3. `robotNotesToday` cuenta por **día del Este** (`rangoDelDiaLocal`), comparando el instante UTC
     guardado contra el rango real del día, no el texto de la fecha.
  4. **Una firma por franja** (`rankWriters`): quien ya publicó hoy pasa al final de la cola, por
     delante incluso de la especialidad. Son tres notas y tres personas: una cada uno. Palabras de
     Richard: _«no sale que una sola persona escribió tantas cosas en un día, nadie tiene esa
     capacidad»_. Solo se repite si todo el equipo ya publicó.
  5. El cron dispara las dos horas UTC posibles de cada franja (verano e invierno). No hay riesgo de
     nota doble: el segundo disparo encuentra el turno ya marcado.
  6. **Reintento dentro de la franja** (añadido el mismo día, tras ver una corrida cortarse a media
     escritura): si la corrida del turno termina en error, el turno se puede volver a reclamar hasta
     tres veces DENTRO de su ventana, marcando `2026-08-24:mediodia#2`. Sin esto, un corte del
     worker se llevaba por delante la nota del turno y nadie se enteraba hasta ver el hueco en la
     portada — el fallo en silencio de siempre. Reintentar dentro de la franja no es acumular
     turnos: pasada la ventana, se pierde igual.
- **Candado:** `tests/unit/franjas.test.ts` (con las tres horas reales del fallo como caso de
  prueba) y los bloques «piloto automático por franjas» y «una corrida cortada no se lleva la nota
  del turno» de `tests/unit/correo-boletin.test.ts`; la rotación, en `tests/unit/autores.test.ts`
  → «una firma por franja».
- **Comprobado en rojo:** quitando el `if (!franja) return …` de `claimTick`, la prueba «DE
  MADRUGADA NO CORRE» falla. Con el arreglo puesto, todo en verde.
- **Qué NO tocar:** no vuelvas a contar el día con `toISOString().slice(0,10)` — eso es UTC y aquí
  el día es el del Este; no dejes que un turno perdido se recupere fuera de su ventana; y no pongas
  una franja de madrugada «para aprovechar la cuota»: la cuota no es una meta, los lectores sí.

## 16. Que no suene a IA: se mide la densidad, no se prohíben palabras

- **Cómo se vio (24 ago 2026):** Richard leyó un titular nuestro — «La resiliencia de la economía
  de EE. UU.» — y lo dijo claro: _«que no busque ni ponga palabras de IA… "resiliencia" es una
  palabra típica de AI. Eso no quiere decir que van a vetar esa palabra, si tiene que saber
  agregarla en un lugar que sea más humano»_.
- **Cuál era la causa real:** al redactor se le pedía «humano» en el prompt y volvía igual. Una
  instrucción sin medición no se cumple sola. Y la respuesta fácil —una lista negra— habría sido
  peor: «resiliencia» es la palabra correcta cuando el informe del Fondo Monetario habla de
  resiliencia. Lo que delata a una máquina no es una palabra: es el montón.
- **Qué se hizo exactamente:**
  1. `src/lib/robot/tics-ia.ts` mide **densidad**: muletillas por cada 1000 palabras, con un tope
     holgado (`MAX_TICS_POR_MIL = 3`). Una pasa; cinco en un párrafo, no. Dos listas, español e
     inglés, comparadas sobre texto sin tildes ni mayúsculas.
  2. Si se pasa, el borrador se rechaza igual que cuando copia una fuente, y el reintento le dice
     **qué palabras** lo delataron y que el problema es la cantidad, no el término.
  3. En el prompt, una sección nueva con los tics más típicos en los dos idiomas y la regla:
     concreto antes que abstracto, frases de largos distintos, nada de cerrar con «En resumen».
- **Candado:** `tests/unit/tics-ia.test.ts`. Incluye el caso exacto que pidió Richard: una nota con
  «resiliencia» **una vez** pasa sin problema; la misma nota con siete muletillas amontonadas se
  rechaza.
- **Qué NO tocar:** no conviertas esto en una lista negra («que nunca escriba resiliencia»), porque
  entonces la nota queda peor; y no subas el tope para que pasen más notas — si un borrador no pasa,
  el problema es el borrador.

## 17. El robot moría a media nota: presupuesto de CPU y trabajo repetido

- **Cómo se vio (24 ago 2026):** después de poner las franjas, **dos corridas seguidas** se quedaron
  «en marcha» para siempre y el guardián de corridas colgadas las cerró a los 15 minutos. El gasto
  del día no se movía ni un centavo, así que el robot no estaba trabajando lento: estaba **muerto**.
  Sin error, sin registro, sin nota. El fallo en silencio de manual.
- **PRIMERO, UNA HIPÓTESIS QUE RESULTÓ FALSA — y por qué se deja escrita.** Se supuso que el
  culpable era la CPU: `copyRatio` reconstruía el índice de fragmentos de todas las fuentes en cada
  comprobación (cuatro veces con reintento). Suena caro, y **se midió**: 6 páginas de 8.000 palabras
  → **34 ms antes, 9 ms después**. Cuatro veces mejor y **completamente irrelevante** frente a un
  presupuesto de 30 segundos. La optimización se queda porque es gratis y correcta, pero **no era la
  causa**. La lección: medir antes de dar por buena una explicación que suena bien.
- **La causa real:** el paso donde muere es `write`, y lo que cambió ese día fue que el detector de
  muletillas añadió un motivo más de rechazo. Cada rechazo dispara **otra llamada al modelo** dentro
  de la misma invocación: dos llamadas de hasta 90 s en vez de una. Antes de ese cambio la corrida
  terminaba en 34 segundos; después, no llegaba. El presupuesto que se agota no es de cálculo, es de
  **duración de la invocación**.
- **De paso apareció otra causa, esta sí de configuración:** el cron de verdad vive en
  `yadominios.json`, no en `wrangler.jsonc` (ese solo vale para desarrollo). Se habían cambiado las
  horas en el archivo equivocado y la plataforma seguía disparando el horario viejo.
- **Qué se hizo exactamente:**
  1. **Una sola llamada al modelo por invocación** (`retries` por defecto a 0). El reintento no
     desaparece: sube un piso. El turno de la franja ya se puede volver a reclamar hasta tres veces
     (candado 15), y **cada reclamo es una invocación nueva con su propio presupuesto**. Un intento
     por invocación es más robusto que dos en la misma. Quien quiera el reintento interno lo sigue
     pidiendo con `retries: 1`.
  2. `sourceShingles()` calcula el índice de las fuentes una vez por corrida; `copyRatioContra()`
     compara contra él. No era la causa, pero es trabajo que no hay que hacer cuatro veces.
  3. `limits.cpu_ms = 300000` en `yadominios.json` y en `wrangler.jsonc`, por si acaso.
  4. Las horas del cron, corregidas en `yadominios.json`, que es el que manda.
- **Candado:** en `tests/unit/franjas.test.ts`, «la configuración de la plataforma va con las
  franjas»: lee `yadominios.json` de verdad y exige las horas de las tres franjas y un presupuesto
  de CPU suficiente. Si alguien vuelve a cambiar solo el archivo de desarrollo, se pone rojo.
- **Cómo se comprueba que sigue funcionando:** `GET https://losupe.com/__health` → `robot.lastRun`
  tiene que terminar en `done` en menos de dos minutos, y `robot.budget.spentTodayUsd` tiene que
  subir. Una corrida que se queda en `running` más de cinco minutos es este fallo otra vez.
- **Qué NO tocar:** no subas `retries` en la corrida del robot «para que salga a la primera» — eso
  es exactamente lo que la mataba; no cambies el cron solo en `wrangler.jsonc`; y si una corrida
  muere, mira el **gasto** antes de suponer que estaba trabajando: si no sube, no está lenta, está
  muerta. Y antes de arreglar por corazonada, **mide**: aquí la corazonada costó un despliegue.

## 18. El robot escribía de lo que fuera: el clasificador era un cajón de sastre

- **Cómo se vio (24 ago 2026):** al enseñar en `/__health` el paso de cada corrida (candado 17)
  apareció el tema que el robot estaba escribiendo cuando murió: **«Source: CB Trevon Diggs signing
  1-year deal with Seahawks»** — un fichaje de fútbol americano. losupe no tiene sección de
  deportes. Llevaba tiempo pudiendo pasar y nadie lo había visto.
- **Cuál era la causa real:** `classifyTrend` estaba escrita al revés. Rechazaba una lista de temas
  (deportes, apuestas, sucesos) y **todo lo demás pasaba**, cayendo en «artistas» como cajón de
  sastre (`return "artistas"`). Ese titular no decía «NFL» ni «football», así que ninguna regla de
  rechazo lo vio. El criterio de publicación acababa siendo _«lo que no supe rechazar»_, y las
  tendencias de Google traen de todo.
- **Qué se hizo exactamente:**
  1. **Lista blanca, no lista negra:** si no encaja en ninguna de nuestras cinco secciones,
     `classifyTrend` devuelve `null` y no se publica.
  2. «Artistas y tendencias» tiene ahora **su propia regla** (música, cine, series, premios,
     streaming, moda, virales, libros) en vez de ser el cajón donde caía lo desconocido.
  3. Al filtro de deportes se le añadieron las palabras de fichajes y plantillas (`signing`,
     `traded to`, `roster`, `quarterback`, `fichaje`, `entrenador`…), que es por donde se coló.
  4. **Y se le quitó un falso positivo:** «mundial» a secas mataba la _gira mundial_ de una
     cantante y la _economía mundial_. Ahora dice `copa mundial` / `mundial de fútbol` / `world cup`.
- **Candado:** en `tests/unit/robot-trends-video.test.ts`, «el clasificador es una lista blanca» —
  con el titular real de los Seahawks como caso — y «el filtro de deportes no puede llevarse por
  delante temas buenos», que vigila los falsos positivos en los dos sentidos.
- **Qué NO tocar:** no vuelvas a poner un `return "artistas"` al final de `classifyTrend`; el
  descarte es lo correcto. Y al añadir una palabra al filtro de deportes, escribe antes la prueba
  del tema BUENO que esa palabra podría llevarse por delante.

## 19. El formulario del boletín se quedaba dos segundos mudo

- **Cómo se vio (24 ago 2026):** Richard, mirando el sitio como un lector cualquiera: _«se queda
  pensando… uno tiene que darle clic, clic. La gente piensa que eso no funciona»_. Al pulsar
  «Quiero recibirlas» no pasaba **nada** en pantalla durante unos dos segundos.
- **Cuál era la causa real (dos capas):**
  1. **El servidor esperaba al correo.** La ruta guardaba el alta, **esperaba a que el servicio de
     correo mandara la confirmación** y solo entonces respondía. Ese viaje son uno o dos segundos.
  2. **El formulario era una entrega normal:** al responder, el navegador **recargaba la página
     entera** y saltaba al ancla. Entre una cosa y otra, dos segundos de pantalla quieta y ninguna
     señal de que el botón hubiera hecho algo.
- **Por qué importa de verdad:** el que se suscribe es un lector nuevo, el momento más frágil que
  hay. Si cree que está roto, pulsa otra vez (dos altas, dos correos) o se va. Un formulario que no
  contesta al instante es un formulario que pierde gente.
- **Qué se hizo exactamente:**
  1. **El correo sale por detrás** (`waitUntil`): se guarda el alta, se responde YA y la
     confirmación se manda en segundo plano. Si el envío falla, **no se pierde**: el motivo queda
     anotado en `subscribers.mail_error` (columna nueva).
  2. **`BoletinForm` avisa en el instante del clic**: el botón pasa a «Enviando…», queda
     deshabilitado (adiós al doble clic) y la respuesta aparece **sin recargar la página**.
  3. La ruta responde JSON cuando se lo piden (`Accept: application/json`) y sigue respondiendo con
     la redirección de siempre cuando no. **Sin JavaScript el formulario sigue funcionando igual**:
     esto se añadió encima, no en lugar de.
- **Candado:** en `tests/unit/correo-boletin.test.ts` — «EN SEGUNDO PLANO: responde sin esperar al
  correo» usa un servicio de correo de 1,5 s y exige que la respuesta llegue en menos de 500 ms con
  el envío todavía en marcha; «si el correo falla en segundo plano, queda anotado» comprueba que el
  motivo se guarda. En el navegador: a los 250 ms el botón ya dice «Enviando…» y está deshabilitado.
- **Qué NO tocar:** no vuelvas a esperar al servicio de correo dentro de la respuesta; no quites el
  `action`/`method` del formulario (es lo que lo mantiene vivo sin JavaScript); y si el envío pasa a
  segundo plano en algún otro sitio, **deja siempre dónde se anota el fallo** — un correo que no
  sale y no deja rastro es peor que uno que falla a la vista.

## 20. UN SOLO TEMA PARALIZÓ EL DIARIO TODO EL DÍA

- **Cómo se vio (24 ago 2026):** seis corridas seguidas —los tres intentos de la franja del mediodía
  y los tres de la tarde— murieron en el paso `write`, y **el gasto del día no subió ni un centavo**.
  El diario se quedó sin publicar en toda la jornada. Al enseñar el tema de cada corrida (candado 17)
  se vio que las seis estaban escribiendo **exactamente lo mismo**: «Source: CB Trevon Diggs signing
  1-year deal with Seahawks».
- **Cuál era la causa real, y es de diseño:** `pickCandidate` elegía siempre el candidato con más
  puntaje y estado `new`. Si la corrida se moría antes de marcarlo, el candidato **seguía en `new`**
  y volvía a salir elegido en la corrida siguiente. Un tema que falla se convertía en un bucle
  perfecto: se elige, mata la corrida, sigue pendiente, se vuelve a elegir. Para siempre.
- **Y un segundo fallo encima:** el filtro de temas (candado 18) se arregló ese mismo día, pero se
  aplica **al descubrir**. El fichaje de los Seahawks ya estaba guardado, así que el arreglo no lo
  tocó. _Arreglar la puerta no sirve de nada si lo que entró mal se queda dentro._
- **Qué se hizo exactamente:**
  1. **Contador de intentos por tema** (`candidates.attempts`). Se apunta **antes** de trabajar, así
     que aunque el worker muera a media escritura el intento queda contado. Un tema que falla tres
     veces se aparta (`MAX_INTENTOS_CANDIDATO`) y el diario sigue publicando. Este es el candado de
     verdad: **protege pase lo que pase**, sea cual sea la causa del fallo.
  2. `limpiarCandidatosFueraDeTema()` corre al principio de cada corrida y aparta los temas
     guardados que hoy no publicaríamos. Usa **solo la lista de rechazo**, nunca la lista blanca: los
     candidatos de nuestras fuentes RSS son legítimos aunque su titular no lleve palabras clave.
  3. `MAX_INTENTOS_POR_FRANJA` de 3 a **5**. Un tema envenenado se comió los tres intentos de dos
     franjas seguidas; con cinco, un arreglo publicado a media tarde todavía llega a tiempo.
- **Candado:** en `tests/unit/robot-trends-video.test.ts`, «un tema envenenado no puede paralizar el
  diario» (con el titular real, y comprobando que no se lleva por delante temas legítimos); en
  `tests/unit/franjas.test.ts`, el tope de intentos por franja.
- **La lección que vale para todo el proyecto:** cuando algo se elige en bucle —un candidato, un
  encargo, una tarea de una cola— **el intento se apunta antes de trabajar, no después**. Si se
  apunta después, cualquier muerte a media faena reinicia el bucle, y el sistema se queda dando
  vueltas sin que salte ninguna alarma.
- **Qué NO tocar:** no quites el `attempts + 1` de antes del trabajo ni lo muevas al final; no
  apliques la lista blanca a los candidatos guardados (te llevas por delante los RSS buenos); y si un
  tema se aparta, que se vea en el panel — apartar en silencio es cómo empezó todo esto.

## 21. LA CAUSA DE FONDO: la corrida moría porque colgaba quien la llamaba

- **Cómo se vio (24 ago 2026):** once corridas seguidas muertas en el paso `write`, **sin gastar un
  centavo**, con temas distintos (o sea, no era el tema) y después de haber arreglado la CPU, el
  número de llamadas al modelo, el filtro de temas y el candidato envenenado. El diario no publicó
  en todo el día.
- **Cuál era la causa real:** `/__scheduled` hacía `await runScheduled(...)` **dentro de la
  respuesta HTTP**. Es decir, la petición se quedaba abierta los 30 a 90 segundos que tarda escribir
  una nota bilingüe. ¿Y quién la llamaba? El latido, desde el `waitUntil` de la visita de **un lector
  cualquiera**. Cuando a esa visita se le acababa su tiempo, **cancelaba la petición y con ella
  moría la invocación que estaba escribiendo**: sin excepción, sin error registrado, sin gasto y sin
  rastro. La corrida se quedaba «en marcha» hasta que `closeStaleRuns` la cerraba 15 minutos después.
- **Por qué costó tanto encontrarlo:** funcionaba por los pelos. Antes de ese día la corrida tardaba
  34 segundos y cabía justo en el tiempo que le sobraba a la visita. Cualquier cosa que la alargara
  un poco —un prompt más largo, un rechazo más— la sacaba del margen. Por eso parecía que la habían
  roto los cambios de ese día: en realidad solo destaparon una fragilidad que llevaba ahí desde el
  principio.
- **Qué se hizo exactamente:** `/__scheduled` **responde 202 «arrancada» en milisegundos** y hace el
  trabajo en el `waitUntil` de SU PROPIA invocación, que tiene su propio presupuesto y de la que ya
  no cuelga nadie. El latido solo dispara. Con `?wait=1` se puede seguir esperando el resultado
  completo para diagnosticar a mano.
- **Candado:** en `tests/unit/franjas.test.ts`, «la corrida no depende de quien la llama»: exige el
  202 en menos de 500 ms y que el trabajo quede en `waitUntil`. Si alguien vuelve a poner el `await`
  dentro de la respuesta, la prueba se pone roja.
- **Cómo se comprueba que sigue funcionando:** `curl -s -o /dev/null -w "%{http_code} %{time_total}"
"https://losupe.com/__scheduled?key=..."` tiene que dar **202** en menos de un segundo. Si tarda
  30 segundos o más, alguien volvió a esperar el trabajo dentro de la respuesta.
- **La lección, que vale para cualquier tarea larga:** un trabajo de minutos **nunca** se hace
  dentro de una respuesta HTTP que otro está esperando, y menos si ese otro es una visita de un
  lector. Se responde «recibido» y se trabaja aparte. Y ojo con el diagnóstico: aquí se arreglaron
  cuatro cosas reales (todas mejoras que se quedan) antes de dar con esta, porque **el síntoma
  —«muere escribiendo»— apuntaba al que escribe, no al que llama**.
- **Qué NO tocar:** no vuelvas a poner `await runScheduled(...)` en la respuesta de `/__scheduled`;
  no hagas el trabajo del robot dentro del `waitUntil` de una visita; y cuando algo muera sin dejar
  error ni gasto, sospecha de **quién lo estaba esperando** antes que de lo que estaba haciendo.

## 22. El panel no decía que estaba trabajando (y una nota se tiraba por tres caracteres)

- **Cómo se vio (24 ago 2026):** Richard pulsando «Ejecutar ahora»: _«no se queda, no dice una
  rueda girando ni alguna cosa. Hay algo que sucede en segundo plano, pero no lo muestra. Entonces
  uno da clic, clic, clic y no hace nada. Eso es un bug»_.
- **Cuál era la causa:** los formularios del panel son entregas normales al servidor. Escribir una
  nota tarda entre 30 y 90 segundos, y en todo ese rato la pantalla se quedaba **exactamente igual**.
- **Qué se hizo:** `AvisoDeEnvio` se monta una sola vez en el armazón del panel y escucha el envío
  de **cualquier** formulario que haya dentro. Se hizo así, y no tocando los veintitrés formularios
  uno a uno, para que los que se añadan mañana queden cubiertos solos.
  - **El aviso se dibuja FUERA del árbol de React, y eso es lo importante.** El primer intento
    cambiaba el texto del botón a «Trabajando…» y **no funcionaba**: React lo restauraba al volver a
    pintar. Los elementos los crea el propio componente en `document.body`, donde nadie los pisa.
  - Tres señales a la vez: barra que se mueve arriba, cartel con lo que tarda, y una capa por encima
    que impide el clic, clic, clic. Con red de seguridad a los 2 minutos por si la respuesta no llega.
- **Y en la misma tanda, el error que destapó ese botón:** la corrida terminó bien (33 segundos, ya
  sin morirse) pero devolvió _«El borrador no cumple el formato (es.meta_description: Too big:
  expected string to have <=180 characters)»_. Una nota entera —dos idiomas, 1.100 palabras, ya
  pagada— a la basura **por tres caracteres de más en un campo que solo leen los buscadores**.
  - `ajustarMetadatos()` recorta ahora lo que se puede recortar (meta descripción, meta título,
    entradilla, textos de la imagen, número de etiquetas), cortando por palabra entera. **El titular
    y el cuerpo siguen siendo estrictos: eso lo lee la gente.**
  - Y se devolvió el reintento del redactor a 1. Se había quitado esa tarde creyendo que la corrida
    moría por tardar; resultó ser otra cosa (candado 21) y, ya arreglada, una corrida entera tarda
    33 segundos: caben dos llamadas de sobra.
- **Candado:** en `tests/e2e/smoke.spec.ts`, «al pulsar un botón se nota que está trabajando»
  comprueba el aviso **en el mismo instante del envío** (sin esperar a la red: en local la respuesta
  llega en milisegundos y esperar no probaría nada). En `tests/unit/robot-core.test.ts`, «un campo de
  metadatos fuera de medida se RECORTA, no tira la nota» y su pareja, que el cuerpo sigue estricto.
- **Qué NO tocar:** no vuelvas a dar el aviso cambiando el DOM que React controla; no recortes el
  titular ni el cuerpo; y si añades un formulario al panel, no hace falta que hagas nada — ya está
  cubierto.

## 23. Lo que Google Noticias exige de un medio (transparencia y autoría)

- **De dónde sale (24 ago 2026):** una revisión de losupe.com contra las directrices de Google
  Noticias señaló que faltaban las señales que un medio serio tiene que dar antes de que lo acepten:
  no había página de contacto, no se decía quién edita el medio, y las firmas —aunque enlazaban a su
  perfil— no traían nada que Google pudiera cruzar para comprobar que detrás hay una persona real.
- **Por qué importa de verdad:** no es cosmética. Google Noticias **penaliza la opacidad**, y la
  actualización de E-E-A-T pesa la autoridad de quien firma. Un medio sin contacto visible ni autores
  verificables no entra, por buenas que sean las notas.
- **Qué se hizo exactamente:**
  1. **Página de contacto** (`/es/contacto`, `/en/contact`) con correo visible, quién edita el medio
     (Windoce LLC), para qué escribirnos y un formulario que llega de verdad a la redacción. Lleva
     `ContactPage` en JSON-LD, respuesta inmediata (el correo sale por detrás) y trampa para robots.
  2. **Autoría verificable:** columnas nuevas en `authors` (`linkedin_url`, `x_url`,
     `public_email`, `expertise_es/en`), mostradas en el perfil y **publicadas como `sameAs`** en el
     JSON-LD, que es literalmente cómo Google cruza una firma con una persona. La especialidad de
     cada quien manda sobre la lista genérica del medio en `knowsAbout`.
  3. **Contacto visible desde cualquier página**: en el pie y en el menú, en los dos idiomas, y en
     `sitemap.xml`.
  4. **Frescura de la portada:** convivían notas de hoy con archivo de diciembre del año anterior.
     Ahora lo reciente manda arriba y lo de más de 30 días baja a su franja, «Del archivo», dicha con
     todas las letras. Para el robot, un diario que parece parado no es un diario.
- **Un fallo de seguridad que destapó la prueba:** el asunto del correo de contacto no se limpiaba.
  Un salto de línea ahí permite **inyectar cabeceras** —incluida una copia oculta a un tercero—, que
  es un truco viejo y conocido contra los formularios. `limpiarCabecera()` lo corta.
- **Candado:** `tests/unit/google-noticias.test.ts` (rutas institucionales, validación del
  formulario, `reply_to`, trampa de robots, escapado, y `sameAs` presente o ausente según haya
  perfiles) y, en `tests/e2e/smoke.spec.ts`, «transparencia visible desde cualquier página» y «la
  portada no mezcla lo de hoy con el archivo viejo».
- **Qué NO tocar:** no quites el enlace de contacto del pie ni la mención de quién edita el medio; no
  inventes perfiles de redes que no existan (un `sameAs` falso es peor que ninguno); y no vuelvas a
  mezclar el archivo con la actualidad en la portada.
- **Lo que falta y NO es trabajo de código:** el alta en Google Publisher Center, el correo de
  contacto definitivo (hoy `contacto@losupe.com`, ajustable en `settings.contact_email`) y los
  perfiles reales de LinkedIn/X del equipo. Esos datos son de Richard: no se inventan.

## 24. La mesa de redacción: el diario ya no solo reacciona

- **De dónde sale (24 ago 2026):** Richard, después de leer una nota bien escrita pero anodina:
  _«deberíamos tener un cerebro, que sería como el gerente que prepara todo antes de llegar a la IA
  que escribe… el que manda al redactor»_. Y puso los ejemplos: los diez años sin Juan Gabriel que
  no publicamos, «10 curiosidades sobre las ventas por internet», «los 10 errores más grandes de las
  empresas chinas».
- **Cuál era el problema real:** el robot **solo reaccionaba**. Escribía lo que trajera el RSS y, si
  las fuentes no lo mencionaban, para nosotros no existía. Un diario así no tiene criterio propio:
  tiene un lector de titulares ajenos.
- **Qué se hizo:**
  1. `src/lib/robot/mesa.ts` — el jefe de redacción. Antes de escribir nada decide el género del
     turno: **actualidad** (RSS y tendencias), **pieza propia** (curiosidades, errores, guía) o
     **efeméride**. El reparto se ajusta en el panel y es **estable, sin azar**: la misma situación
     da la misma decisión, que es lo que permite probarlo.
  2. `src/lib/robot/ideas.ts` — el banco de ideas: más de cincuenta piezas por sección, con las
     plantillas que pidió Richard y el tema de cada una. No repite un tema ya publicado.
  3. `src/lib/robot/efemerides.ts` — qué se cumple hoy, desde Wikipedia (abierta, gratis y
     **citable**). Solo se usan los aniversarios **redondos**: «hace 37 años» no le importa a nadie,
     «diez años sin Juan Gabriel» sí. Una efeméride redonda **manda** sobre el reparto, porque solo
     se puede contar ese día.
  4. `buildPiezaPropiaPrompt()` — una lista de diez curiosidades no se escribe como una noticia.
- **EL RIESGO DE ESTE GÉNERO, y cómo se cierra:** una lista de curiosidades es exactamente donde una
  IA se pone a inventar datos que suenan bien. Por eso una idea del banco **no es una nota**: es un
  encargo que pasa por la misma investigación y las mismas fuentes citadas que todo lo demás. Se
  buscan artículos reales, se leen, y si no hay material **no se escribe**. El prompt lo dice con
  todas las letras: _«si el material no da para diez puntos, escribe los que sí puedas documentar y
  ajusta el titular. Siete comprobadas valen más que diez inventadas»_.
- **Candado:** `tests/unit/mesa.test.ts` — el banco de ideas (incluidos los titulares exactos que
  pidió Richard), el caso «10 años sin Juan Gabriel», que una efeméride **sin fuente no se usa**, que
  si Wikipedia se cae el diario sigue, y que el reparto es estable y respeta el ajuste.
- **Qué NO tocar:** no dejes que una pieza propia se escriba sin fuentes leídas —es el único freno
  contra los datos inventados—; no metas azar en el reparto (deja de ser comprobable); y no uses
  aniversarios que no sean redondos, que es la diferencia entre una nota que se comparte y relleno.

## 25. Ni una foto nuestra en Google Imágenes

- **Cómo se vio (24 ago 2026):** Richard buscó «losupe» en Google Imágenes y **no salió ni una foto
  nuestra**. Su lectura: _«no está indexando las imágenes de nuestras noticias porque no son
  nuestras»_. Medio acertada — la causa principal era otra, y más tonta.
- **Las tres causas, por orden de importancia:**
  1. **El sitemap no llevaba ni una imagen.** Ninguna. Google no tenía por dónde encontrarlas: no
     basta con que la foto esté en la página, hay que declararla. Esta era la grande.
  2. **Los nombres de archivo se comían las tildes.** El slug se hacía a mano con
     `replace(/[^a-z0-9]+/g, "-")`, así que «guía para empresas» quedaba en `gu-a-para-empresas`. El
     nombre del archivo es una señal de Google Imágenes, y así no dice nada. Ahora usa `slugify()`,
     que las transcribe.
  3. **Las fotos eran de banco.** Aquí Richard tenía razón: una foto de Pexels la tienen otros mil
     sitios y no nos posiciona. El orden ya era el correcto (imagen propia primero, banco de
     respaldo), pero sin `FAL_KEY` nunca llega a la primera opción.
- **Y el pie de foto**, que faltaba entero: el redactor entrega ahora `image_caption_es/en` y se
  muestra bajo la imagen, con el crédito detrás en pequeño. No es cosmética — un pie de foto es de
  lo más leído de una página y es lo que hace que una foto se vea de diario y no pegada.
- **LO QUE NO SE HIZO, Y POR QUÉ.** Richard pidió firmar las fotos con nombres de fotógrafos
  inventados, para dar «realismo psicológico». No se hizo: atribuir una imagen generada a una
  persona que no existe es una atribución falsa, y **Google News la penaliza expresamente** — sería
  jugarse el alta en Publisher Center, que es justo el trámite siguiente. Se consigue lo mismo,
  y de verdad, con un buen pie de foto y el crédito del propio medio.
- **Candado:** `tests/unit/imagenes-seo.test.ts` (tildes en el nombre, el pie en el esquema del
  redactor) y, en el e2e, «las imágenes de las notas están en el sitemap».
- **Cómo se comprueba:** `curl -s https://losupe.com/sitemap.xml | grep -c "image:loc"` tiene que
  dar más de cero.
- **Qué NO tocar:** no quites las imágenes del sitemap; no vuelvas a armar el nombre del archivo a
  mano; y no pongas nombres de fotógrafos que no existan.

## 26. Dos días sin publicar: un JSON con saltos de línea y un reloj que no era reloj

- **Cómo se vio (25 ago 2026, 9:13 AM):** Richard: _«ya son las 9:13 y no veo que se lanzó ninguna
  noticia, ya tenemos hoy 2 días fallando»_. Cierto: el 24 salieron tres notas de madrugada y el 25
  no salió ninguna.
- **Dos fallos distintos, encadenados.**

### A) El JSON venía completo y aun así no se podía leer

- **Qué decía el error** (gracias al arreglo del candado que lo hizo hablar): _«Gemini devolvió un
  JSON inválido (motivo del modelo: STOP, 15107 caracteres). Termina en: …"video_keywords": [] }»_.
  Es decir: el modelo **no se cortó** —terminó por su cuenta— y el JSON **cerraba bien**.
- **La causa:** dentro del HTML de la nota venían **saltos de línea de verdad**. El formato JSON
  exige que dentro de unas comillas vaya `\n` escrito, no un salto real. Es un descuido clásico de
  los modelos y no hay forma de pedirle que no lo cometa.
- **El arreglo:** `repararJson()` recorre el texto sabiendo si está dentro o fuera de unas comillas
  y escapa solo los caracteres de control de dentro. Se intenta el `JSON.parse` normal primero y,
  si falla, se repara — **sin gastar otra llamada al modelo**.
- **Lo que hizo posible encontrarlo:** el error explícito del candado anterior. La misma
  investigación, con el mensaje mudo de antes, costó una tarde entera; con el mensaje nuevo, un
  minuto. **Un error que no explica nada es una hora de trabajo escondida.**

### B) El robot no tenía reloj

- **Cómo despertaba hasta ahora:** el cron de la plataforma (que **no se ha disparado ni una vez**)
  y el «latido», que aprovecha las visitas al sitio. A las siete de la mañana en un diario nuevo no
  entra nadie, así que no había quien lo despertara.
- **El arreglo:** `.github/workflows/robot.yml`. GitHub dispara a su hora pase lo que pase, y llama
  con `?wait=1`, así que **espera a que la nota termine de escribirse**. Eso importa: con la
  respuesta inmediata el worker se queda sin quien lo espere y puede morir a media faena (candado
  21); con un cliente esperando de verdad, llega hasta el final. Y si la corrida falla, el trabajo
  se pone en rojo en GitHub, que es donde se ve.
- **Comprobado antes de publicarlo:** una llamada a mano a `/__scheduled?wait=1` completó en **48
  segundos** y devolvió el detalle del error. El camino funciona.
- **Qué NO tocar:** no quites el `wait=1` del workflow (sin él, nadie espera al worker); no
  confíes el diario a las visitas; y si el robot deja de publicar, mira **la pestaña Actions** antes
  que nada: ahora el fallo se ve ahí.

## 27. «A los suscriptores no llegó nada» — y estaba bien, pero no se veía

- **Cómo se vio (25 ago 2026):** Richard: _«las notificaciones a windoce1@gmail.com llegaron pero
  solo a ese correo, a los otros usuarios que estaban inscritos no llegó nada»_.
- **Qué pasaba de verdad:** había **2 suscriptores pendientes y 0 confirmados**, sin **ni un** fallo
  de envío. O sea: el correo de confirmación **sí les llegó**, pero no tocaron el botón. Con doble
  confirmación eso significa que no reciben nada — y es lo correcto, porque impide que alguien
  apunte a otro sin permiso. Pero era **invisible**: desde fuera parecía que el sistema no enviaba.
- **La lección:** un comportamiento correcto que no se puede ver **es indistinguible de un fallo**.
  Costó una petición de arreglo para algo que no estaba roto.
- **Qué se hizo:**
  1. `/__health` y el panel muestran los suscriptores **por estado** (confirmados, sin confirmar,
     dados de baja, con fallo de envío). Solo cuentas, ningún correo.
  2. **Recordatorio de confirmación** (`recordarConfirmacion`): a quien lleva 20 horas sin confirmar
     se le manda **uno solo**, y queda marcado. Insistir más es la forma más rápida de acabar en la
     carpeta de spam, que es peor que no mandar nada. Se marca **aunque el envío falle**: uno y no
     más.
  3. Va dentro de la corrida del robot, que ya se ejecuta tres veces al día: no hacía falta otro
     reloj para algo que manda un correo de vez en cuando.
- **Candado:** en `tests/unit/correo-boletin.test.ts`, «recordatorio a quien se apuntó y no
  confirmó»: solo pendientes, solo una vez, y sin correo configurado no explota.
- **Qué NO tocar:** no quites la doble confirmación «para que lleguen más» — es lo que separa un
  boletín de una lista de spam; y no mandes más de un recordatorio.

## 28. Las piezas propias salían demasiado cortas

- **Cómo se vio (25 ago 2026):** la franja de la tarde se perdió entera. El error, ya explícito:
  **«El borrador en es es muy corto (342 palabras)»**, cinco veces seguidas.
- **La causa:** el encargo de una pieza propia (curiosidades, errores, guía) **no decía nada del
  largo**. El modelo entendía «lista de diez puntos» y entregaba diez frases sueltas. Una nota del
  diario son 700-1.100 palabras; 342 no llegan ni al mínimo.
- **Qué se hizo:** el encargo pide el largo con todas las letras y explica por qué —_«una lista de
  diez puntos con dos líneas cada uno no es una nota, es un tuit largo»_—; y si aun así sale corta,
  el reintento **nombra el problema real** («el cuerpo era DEMASIADO CORTO») en vez del aviso
  genérico de formato, que hablaba de largos de campos y no ayudaba en nada.
- **Candado:** en `tests/unit/mesa.test.ts`, «una pieza propia es una nota, no un resumen».
- **Qué NO tocar:** no bajes el mínimo de palabras para que pasen más notas — el problema es la
  nota, no el listón.

## 29. Contador de lectores propio: solo personas, sin rastrear a nadie

- **De dónde sale (25 ago 2026):** Richard: _«un contador de lectores reales que yo pueda ver desde
  qué país me visitan, pero que sean reales, no quiero que cuenten los bots… y que el contador solo
  lo pueda ver yo»_.
- **CÓMO SE SEPARA UN LECTOR DE UN ROBOT**, que es lo único que hace útil un contador:
  1. **La visita la confirma el navegador.** No se cuenta al servir la página: se cuenta cuando el
     navegador ejecuta el sensor desde la propia pantalla (`/datos/visita`). Los rastreadores, los
     que copian sitios y casi todos los robots piden el HTML y se van sin ejecutar nada. **Este es
     el filtro que de verdad decide.**
  2. **Lista de robots conocidos** por si alguno sí ejecuta código. Segunda red, no la primera.
  3. Solo cuenta mientras la pestaña está **a la vista**: una pestaña olvidada no es un lector.
- **PRIVACIDAD, Y NO ES UN ADORNO.** No se guarda **ninguna dirección IP** ni nada que identifique a
  una persona, y **no se usan cookies** — por eso el sitio no necesita el cartel de aceptar cookies.
  Para contar personas distintas se usa una huella que mezcla datos técnicos **con la fecha** y pasa
  por una función que no se puede deshacer: la misma persona da otra huella mañana, así que sirve
  para contar y **no para seguir a nadie**. El detalle se borra solo a los 120 días, desde la misma
  corrida del robot (no hacía falta otro reloj).
- **Solo lo ve el dueño:** vive en `/panel/lectores`, detrás de la contraseña del panel. Hay una
  prueba que entra sin sesión y exige que mande a la pantalla de entrar.
- **Candado:** `tests/unit/lectores.test.ts` — que los robots no cuentan, que una persona sí, que la
  IP **no aparece en ninguno de los valores que se guardan**, y que la huella cambia de un día para
  otro. En el e2e: que el sensor dispara desde el navegador y que el tablero está protegido.
- **Qué NO tocar:** no cuentes la visita en el servidor «para no perder ninguna» — ahí es donde
  entran los robots y el contador deja de servir; no guardes la IP ni pongas cookies (además de
  estar mal, obligaría a poner el cartel de cookies); y no alargues el historial sin motivo.

## 30. Blindaje de los formularios: solo personas

- **Cómo se vio (25 ago 2026):** entró por el formulario de contacto un correo de spam de un tal
  «Cyrus Havens» vendiendo indexación en Google. Richard: _«que solo humanos puedan mandar
  información, nada de robots, bloquéalos a todos con sistemas de seguridad robustos»_.
- **CUATRO CAPAS, y el orden importa.** Las tres primeras **no dependen de ningún servicio ajeno ni
  de ninguna llave**: si mañana se cae el proveedor de la cuarta, el formulario sigue protegido.
  1. **Pase firmado.** La página entrega un pase con su hora dentro, firmado por nosotros (HMAC).
     Quien manda un POST directo —que es como trabaja casi todo el spam— no lo tiene. Y caduca, así
     que no se puede guardar y reutilizar mil veces.
  2. **Tiempo mínimo.** Un robot rellena y envía en milisegundos. **Y no es el mismo número para
     todos:** el boletín es UN campo que el navegador autocompleta (1,5 s), «publica tu noticia»
     tiene siete campos (3 s). Poner el listón alto en el corto sería echar a lectores de verdad,
     que es peor que un spam.
  3. **Límite por dirección:** cinco envíos por hora.
  4. **Turnstile de Cloudflare**, comprobado **en el servidor** (el recuadro del navegador solo lo
     pide; cualquiera puede saltárselo y hablarle directo a la dirección del formulario). Se enciende
     sola cuando estén las llaves; sin ellas **no bloquea a nadie**.
- **Y la trampa** (un campo escondido que una persona no ve) en los tres formularios.
- **Al robot se le responde como a una persona.** Si se le dice «rechazado», aprende qué probar
  después. Se le devuelve «gracias» y no se guarda nada.
- **Si Cloudflare no responde, se deja pasar.** Detrás siguen las otras tres capas; tumbar el
  formulario de todos los lectores por un mal minuto de un servicio ajeno no compensa.
- **Lo destapó una prueba:** el e2e de «publica tu noticia» empezó a fallar porque Playwright
  rellenaba en menos de 3 segundos. Eso mismo le puede pasar a una persona con autocompletado — de
  ahí el umbral distinto por formulario. **Una prueba en rojo evitó echar a usuarios de verdad.**
- **Candado:** `tests/unit/anti-bots.test.ts` (11 pruebas: pase inventado, POST directo, relleno
  instantáneo, pase caducado, límite por hora, y que sin llaves Turnstile no bloquee) y, en el e2e,
  «los formularios públicos rechazan un envío de robot», que comprueba además que el pase y la
  trampa están en **los tres** formularios.
- **Qué NO tocar:** no quites el pase de un formulario nuevo (cópialo de los que ya lo tienen); no
  subas el tiempo mínimo sin mirar cuántos campos tiene el formulario; y no le digas nunca al robot
  por qué fue rechazado.

## 31. Tráfico con historial: qué leyeron, por dónde llegaron y cuánto tiempo

- **De dónde sale (25 ago 2026):** Richard, tras ver el contador: _«¿ese contador guarda el
  historial? Cuántas personas entraron este mes, el mes pasado, esta semana, la pasada, hoy, ayer…
  qué noticia leyeron, por dónde llegaron y cuánto tiempo estuvieron leyendo»_.
- **Qué había y qué faltaba.** El contador ya guardaba fecha, ruta, país y referente de cada visita
  — el historial estaba. Faltaban tres cosas: **el tiempo de lectura**, la **clasificación del
  origen** y una pantalla para consultarlo por periodos.
- **EL CAMBIO DE FONDO: una fila por LECTURA, no por aviso.** Antes cada aviso del sensor insertaba
  una fila, así que una persona leyendo diez minutos contaba como cinco visitas. Ahora la clave es
  (día + persona + página): el primer aviso crea la lectura y los siguientes **suman tiempo** sobre
  la misma fila (`ON CONFLICT … segundos = segundos + ?`). Dos ventajas: el tiempo de lectura se
  puede sumar de verdad, y la cuenta de lectores deja de inflarse con los avisos periódicos.
- **El tiempo solo cuenta con la pestaña a la vista.** El sensor reinicia su reloj al volver de otra
  pestaña, así que el rato que alguien tuvo la nota olvidada en segundo plano no se cuenta como
  lectura. Y un aviso no puede sumar más de tres minutos (`MAX_SEGUNDOS_POR_AVISO`): una pestaña que
  devuelva un número absurdo no ensucia las medias.
- **Por dónde llegan:** buscadores, redes, otros sitios o directo. Es la pregunta que de verdad dice
  si el trabajo de posicionamiento sirve — no es lo mismo que Google te mande gente a que entren
  escribiendo la dirección.
- **Los seis periodos**, cada uno comparado con su anterior comparable (hoy/ayer, 7 días/7 días
  anteriores, 30/30), con la flecha de subida o bajada.
- **Candado:** en `tests/unit/lectores.test.ts` → «historial de tráfico»: que la lectura se
  ACTUALIZA en vez de duplicarse, que el tiempo se suma, que un aviso absurdo se recorta, que el
  origen se clasifica bien y que los porcentajes de variación salen correctos. En el e2e: que la
  sección tiene los seis periodos y las cuatro preguntas, y que sigue detrás de la contraseña.
- **Qué NO tocar:** no vuelvas a insertar una fila por cada aviso del sensor (se infla todo y se
  pierde el tiempo de lectura); no cuentes el tiempo con la pestaña oculta; y esto sigue sin Google
  Analytics, sin cookies y sin guardar direcciones IP — es lo que permite no poner cartel de
  cookies.

## 32. Siete notas seguidas de curiosidades y cero de actualidad

- **Cómo se vio (28 ago 2026):** Richard: _«losupe se quedó con el tema de las curiosidades… pero no
  podemos dejar por fuera la actualidad, política, música, IA. Hubo un par de noticias y luego saltó
  a curiosidades y se quedó ahí»_. Los datos le daban la razón: **siete notas seguidas** de
  curiosidades y efemérides, cero de actualidad desde el 24 de agosto.
- **CAUSA 1, y es aritmética.** `elegirGenero` hacía `notasHoy % 10 < Math.round(ratio * 10)`. Con
  `ratio = 0.4` el umbral es 4, y con **tres notas al día** el contador vale 0, 1 y 2 — los tres
  menores que 4. Así que **siempre** salía «propia». El reparto 40/60 se pensó sobre diez notas
  seguidas, pero el contador **se reinicia cada día en cero** y nunca llegaba al umbral. Un
  porcentaje calculado sobre un contador que se reinicia es frágil por diseño.
- **CAUSA 2, que lo agravaba.** `if (reglas.efemerides && hayEfemerideRedonda) return "efemeride"`
  iba **antes que cualquier otra cosa**. Y hay aniversarios redondos casi a diario, así que se
  llevaba por delante hasta los huecos que hubieran sido de actualidad.
- **EL ARREGLO: una escaleta, no un porcentaje.** Una redacción no reparte con porcentajes: reparte
  con una escaleta, y cada franja tiene su género asignado de antemano.

  | Franja   | Hora (Este) | Género       |
  | -------- | ----------- | ------------ |
  | Mañana   | 7:00        | Actualidad   |
  | Mediodía | 12:00       | Curiosidades |
  | Tarde    | 17:00       | Actualidad   |
  | Noche    | 21:00       | Curiosidades |

  Cuatro notas al día: **2 y 2**, exacto, previsible y comprobable de un vistazo.

- **Y la efeméride deja de mandar:** solo puede ocupar un hueco de curiosidades. Un «diez años sin»
  es una nota estupenda, pero no puede comerse la actualidad del día.
- **Si toca actualidad y no hay material, se escribe una propia** y queda anotado: nunca se pierde
  una nota por no tener candidato del género que tocaba.
- **A mano, fuera de franja**, se alterna por posición del día (par actualidad, impar curiosidades),
  que da el mismo reparto.
- **Candado:** en `tests/unit/mesa.test.ts` → «la escaleta manda»: el día completo da
  `[actualidad, efeméride, actualidad, efeméride]` **incluso con efeméride disponible**, y hay una
  prueba dedicada a que una efeméride no pueda comerse la actualidad. En `franjas.test.ts`, que son
  cuatro franjas con dos de cada género.
- **Qué NO tocar:** no vuelvas a repartir géneros con un porcentaje sobre un contador que se
  reinicia; no pongas la efeméride antes que la escaleta; y si añades una franja, dale su género —
  la prueba exige que haya el mismo número de cada uno.

## 33. Rankings y récords: la franja de la noche deja de repetir

- **De dónde sale (28 ago 2026):** Richard buscó en Google «cuál es el producto más vendido del
  mundo», se encontró con que son el arroz y el trigo, y dijo: _«las dos franjas de curiosidades son
  lo mismo. Cambiemos una por algo con más enganche… qué es lo que más se vende en Estados Unidos,
  qué consume la generación Z, cuál es el país que bebe más licor»_.
- **Qué se hizo:** un género nuevo, `ranking`, y la franja de las 21:00 pasa a pedirlo. Las dos
  franjas propias del día dejan de ser lo mismo: **mediodía curiosidades, noche rankings**. Hay una
  prueba que exige que las dos franjas propias tengan subgénero distinto.
- **EL TITULAR ENGANCHA POR EL TEMA, NO POR EL ADJETIVO.** Es la parte que importa y la que se puede
  hacer mal muy fácil. «El producto más vendido del mundo lleva 2.000 años ganando» se lee solo; «la
  respuesta te sorprenderá» hace que no te lean nunca más — y a Google Noticias tampoco le gusta.
  Por eso el encargo le pide **contestar la pregunta en la primera frase, sin suspense**: quien entra
  quiere el dato, no que se lo escondan. Lo interesante viene después: por qué es así, desde cuándo,
  y qué matiz tiene (una cosa es lo más vendido en unidades y otra en dinero).
- **Candado:** en `tests/unit/mesa.test.ts` → «rankings»: que los temas que pidió Richard estén en el
  banco, que **ningún titular** del banco lleve «sorprenderá», «increíble», signos de admiración ni
  gritos en mayúsculas, que la noche pida rankings y el mediodía no, y que el encargo pida el dato
  sin rodeos.
- **Qué NO tocar:** no metas titulares de suspense vacío «para que enganche más» — el precio es que
  dejen de creerte; y si añades una franja propia, dale su subgénero, que la prueba lo exige.

## 34. El reloj de GitHub se retrasa: se compensa con frecuencia

- **Cómo se vio (29 ago 2026), en un sondeo del sistema:** la nota de rankings de las 21:00 no salió
  y el turno marcaba `noche#5` — los cinco intentos gastados. Al mirar el historial del workflow
  apareció el motivo real, y no era del código.
- **El dato:** el reloj estaba programado a ocho horas exactas al día (11:05, 12:05, 16:05, 17:05,
  21:05, 22:05, 01:05, 02:05 UTC). Los disparos que **de verdad llegaron**: 00:27, 05:10, 20:56,
  00:36, 19:09, 16:51, 13:04, 11:35… Ni uno a su hora. **De ocho disparos diarios llegaban uno o
  dos**, con horas de desfase. Los cron de GitHub Actions no garantizan puntualidad y se retrasan
  mucho en horas de carga.
- **Por qué importaba:** cuando el reloj fiable no llegaba, la nota dependía del «latido» (las
  visitas al sitio), que hace el trabajo en un `waitUntil` y se corta a media escritura. Es decir:
  el camino bueno faltaba y quedaba el frágil.
- **El arreglo, y es de sentido común:** si la herramienta no es puntual, **se compensa con
  frecuencia**. El reloj dispara ahora **cada hora** (`7 * * * *`). Cada ventana de tres horas recibe
  varios intentos y basta con que llegue uno.
- **No hay riesgo de nota doble:** fuera de franja no se publica, y el turno se apunta por franja y
  día local, así que los disparos de más encuentran el turno hecho y se van en milisegundos. El
  repositorio es público, así que estas ejecuciones no cuestan nada.
- **Candado:** en `tests/unit/franjas.test.ts` se lee el workflow y se exige `cron: "7 * * * *"`.
- **Qué NO tocar:** no vuelvas a poner el reloj «solo en las horas de las franjas» — es lo que
  parecía correcto y no funciona; y no confíes la publicación al latido, que es un respaldo, no el
  camino principal.

## 35. Una foto de 427 KB para pintarla a 142 píxeles

- **Cómo se vio (29 ago 2026), midiendo la portada en el navegador:** el recurso más pesado de toda
  la página no era el video del encabezado (431 KB) sino **una foto de nota: 1880×1253 y 427 KB**.
  Y se mostraba a **142×80 píxeles** en una tarjeta. Trece veces más grande de lo necesario, en cada
  visita y en cada tarjeta. La portada pesaba 1,2 MB.
- **La causa:** a Pexels se le pedía siempre `large2x`, que es la versión más grande que tiene, y se
  guardaba tal cual. Nadie miró nunca a qué tamaño se iba a mostrar.
- **Qué se hizo, sin añadir ninguna librería:** Pexels sirve la imagen al tamaño que se le pida por
  la propia dirección (`?auto=compress&cs=tinysrgb&w=…`), así que el robot pide y guarda **dos
  tallas**: 1600 px para abrir la nota y 640 px para las tarjetas. Las tarjetas usan la pequeña; el
  encabezado usa `srcset` para que cada pantalla pida lo que necesita.
- **Y las notas viejas no se rompen:** si se pide una miniatura que no existe, el servidor devuelve
  la grande. Sin eso, todo lo publicado antes de este cambio se habría visto roto.
- **Candado:** en `tests/unit/imagenes-seo.test.ts` → «peso de las imágenes»: que a Pexels se le pida
  el ancho concreto, que la talla de tarjeta sea menor que la grande, que a un proveedor ajeno no se
  le inventen parámetros, y que el nombre de la miniatura sea previsible.
- **Qué NO tocar:** no vuelvas a pedir `large2x` a secas; no quites el respaldo del servidor (rompe
  el archivo entero); y antes de guardar una imagen, pregúntate a qué tamaño se va a ver.

## 36. El boletín de resumen: un correo cada cuatro días, no cuatro al día

- **Por qué hacía falta:** hasta ahora salía un aviso por **cada** nota publicada. Para el equipo
  está bien; para un lector son **cuatro correos al día**, que es la vía más rápida a que te marquen
  como spam y pierdas el buzón para siempre.
- **Qué es el boletín:** un solo correo cada cuatro días con lo mejor, con su foto, sus entradillas y
  su enlace de baja. Es el formato que la gente abre entera y reenvía, y **el único canal de lectores
  que no depende de Google ni de ninguna red**: si mañana cambia un algoritmo, esta lista sigue
  siendo nuestra.
- **Detalles que importan y son fáciles de hacer mal:**
  1. **Sin suscriptores confirmados NO se marca como enviado.** Si se marcara, el primer boletín de
     verdad tardaría cuatro días más en salir. Hay una prueba que lo vigila.
  2. **Si el servicio de correo rechaza (por ejemplo, el tope diario del plan), se para.** Insistir
     con el servicio diciendo que no es la forma de quemar la reputación del dominio.
  3. Las notas se ordenan por **lectores reales** y, si aún no hay datos, por fecha.
  4. Sale desde la propia corrida del robot: no hacía falta otro reloj para algo que va cada cuatro
     días.
- **Candado:** `tests/unit/boletin.test.ts` — el ritmo, que no salga dos veces seguidas, que se pueda
  apagar, que no se pueda colar código por el titular de una nota, y los tres casos de «no se manda».
- **Qué NO tocar:** no bajes los días «para mandar más» (se paga en bajas y en spam); no marques el
  boletín como enviado si no salió; y no insistas cuando el servicio de correo rechaza.

## 37. El widget para otros sitios: dónde se pinta y por qué no es un marco

- **Qué es (idea nº 5 del plan de ingresos, de Richard):** una línea de código que cualquier web pega
  y muestra nuestras últimas notas. Nos trae tres cosas a la vez: **visitas** de gente que no nos
  conocía, **enlaces desde otros dominios** —que es lo que más pesa en el posicionamiento— y marca.
- **Se sirve como JavaScript, no como marco (`iframe`), a propósito.** Un marco no aporta ni un
  enlace al posicionamiento y muchos sitios lo bloquean. Esto escribe enlaces de verdad en la página
  que lo incrusta, de los que Google sigue.
- **DÓNDE SE PINTA, que es donde estuvo el problema.** Tres intentos, en orden: (1) un hueco
  `data-losupe-aqui` que haya puesto quien nos incrusta, (2) justo donde está el script, (3) al final
  de la página. La tercera no es un capricho: **muchos sitios ponen los scripts en la cabecera** —
  Next.js lo hace solo—, y ahí un `div` no se ve. Sin ese respaldo el widget se pintaba **dentro del
  `<head>`** y no aparecía nada.
- **Y espera a que exista la página.** Con `async` en la cabecera el script puede ejecutarse **antes**
  de que exista el resto del documento, así que si no encuentra dónde pintar, espera a que cargue.
- **Los titulares se escapan.** Van dentro de un JavaScript que corre en la web **de otro**: escapar
  mal sería meterle un agujero de seguridad a quien confía en nosotros.
- **La vista previa de nuestra propia página es un caso aparte.** React vuelve a pintar el contenedor
  al hidratar y se lleva por delante lo que el widget escribió (error 418). Por eso la vista previa
  lo carga **después** de que React termine, con `VistaPreviaWidget`. Quien nos incruste no necesita
  nada de eso.
- **Candado:** `tests/unit/widget.test.ts` y, en el e2e, «el widget se puede pegar en cualquier web»:
  que se sirva como JavaScript, que cualquiera pueda pedirlo (`Access-Control-Allow-Origin: *`), que
  lleve enlaces de verdad y que **no** toque cookies ni almacenamiento en la web ajena.
- **Qué NO tocar:** no lo conviertas en un marco (pierde todo el valor de posicionamiento); no
  quites el respaldo de pintar al final de la página; y nunca metas cookies ni rastreo en código que
  corre en el sitio de otro.

## 38. Patrocinio de sección: se vende sin quemar el medio

- **Qué es (idea nº 3 del plan de ingresos):** una marca acompaña una sección entera durante un
  tiempo. Su nombre, su logo y su frase salen en la portada de esa sección. **No se escribe ninguna
  nota** — eso son los encargos, que van aparte y salen marcados como contenido patrocinado.
- **DOS REGLAS QUE NO SE NEGOCIAN,** y son las que permiten vender esto sin perder el medio:
  1. **Se dice que es publicidad, a la vista.** Etiqueta delante, fondo distinto del contenido y el
     enlace marcado con `rel="sponsored"`, que es lo que Google espera encontrar. Un patrocinio
     disimulado es exactamente lo que hace que Google Noticias eche a un medio — y que un lector deje
     de creerte, que es peor.
  2. **No toca el contenido.** El robot **no sabe** quién patrocina una sección y no escribe distinto
     por ello. La franja lo dice con todas las letras: «el patrocinio no influye en lo que
     publicamos».
- **Y si algo falla, la sección se ve igual:** si la base no responde, `patrocinadorDeSeccion`
  devuelve `null` en vez de lanzar. Un anuncio jamás puede tumbar una página de contenido.
- **Un fallo que dejó rastro:** al añadir las cuatro columnas nuevas, el `UPDATE` quedó pidiendo 16
  parámetros y pasando 12, y guardar un patrocinador empezó a fallar en silencio (la ruta se caía y
  no redirigía). Lo cazó el e2e del panel. **Al añadir una columna hay que tocar los DOS sitios**:
  el `INSERT` y el `UPDATE`.
- **Candado:** `tests/unit/patrocinio.test.ts` — que la consulta exija patrocinador activo y fecha
  vigente, que la frase salga en el idioma que toca, y que sin base no explote. En el e2e, que los
  campos estén en la ficha del panel.
- **Qué NO tocar:** no quites la etiqueta de «Patrocinado» ni el `rel="sponsored"`; no le pases al
  robot quién patrocina una sección; y no dejes que un fallo del anuncio pueda romper la página.
