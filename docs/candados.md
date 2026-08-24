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
