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
