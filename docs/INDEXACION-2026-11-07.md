# Por qué Google no guardaba las notas de Losupe — diagnóstico y arreglo (7 nov 2026)

> Meta: que Google indexe las notas. Punto de partida (Search Console, propiedad de dominio
> losupe.com): **236 indexadas y 457 sin indexar.** Ojo: el informe de páginas de Search Console
> tenía fecha de **22 oct 2026**; todo lo que se cambió después todavía no se refleja ahí.

## 1. Lo que se encontró, motivo por motivo

| Motivo en Search Console                       | Páginas | Qué es en realidad                                                                                                                                                                                                                          | ¿Culpa nuestra hoy?                                                |
| ---------------------------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Duplicada: Google eligió otra canónica         |     138 | **129** son direcciones con `www.` (63) o con `http://` (66), rastreadas **antes del 17 sep**, cuando el diario respondía completo en cuatro direcciones. Las otras 9 son direcciones buenas donde Google sigue prefiriendo la copia `www`. | No (arreglado el 17 sep, candado 53). Se cura sola al re-rastrear. |
| Rastreada, actualmente sin indexar             |     126 | Notas reales (sobre todo Economía, Artistas y Cripto), dos páginas de autor, `/en/crypto?page=2`, el `manifest` y los RSS.                                                                                                                  | En parte (ver 3).                                                  |
| Página con redirección                         |     141 | 91 son `www`/`http` (correcto que redirijan). **45 son del propio dominio**: la nota con el slug del otro idioma, p. ej. `/es/economia/<slug-en-inglés>`.                                                                                   | **Sí — arreglado hoy.**                                            |
| Excluida por `noindex`                         |      24 | Copias en español servidas bajo `/en/crypto/…` cuando la nota no está traducida.                                                                                                                                                            | **Sí — arreglado hoy** (ya no se enlazan).                         |
| Descubierta, sin indexar                       |      20 | Google las conoce y aún no las visita (sitio nuevo, presupuesto de rastreo bajo).                                                                                                                                                           | Mejora sola al quitar el ruido de arriba.                          |
| 404                                            |       5 | Dos notas con slug viejo, y `/$` y `/&` (texto suelto que Google leyó como enlace).                                                                                                                                                         | No es grave.                                                       |
| Bloqueada por robots / otro 4xx / sin canónica |       3 | La plantilla del buscador (`/en/search?q={search_term_string}`), correcto que esté bloqueada.                                                                                                                                               | No.                                                                |

### La prueba más clara de la canónica

Inspección de la portada en inglés (`https://losupe.com/en`, rastreada el 19 oct):

- Canónica declarada por nosotros: `https://losupe.com/en`
- **Canónica elegida por Google: `https://www.losupe.com/en`**

Es decir: Google se quedó con la copia `www` que guardó en agosto y septiembre. Hoy esa copia
responde **301** a `https://losupe.com/en` (comprobado). Cuando Google la vuelva a visitar, cambia
de bando. No hay nada más que tocar en el código para esto; lo que acelera es pedir indexación de
las direcciones buenas (ver 4).

### El mapa del sitio está limpio

Se pidieron las **535** direcciones del mapa con el agente de Google: las 535 responden **200**,
cada una es su propia canónica y ninguna lleva `noindex`. El mapa de noticias lleva solo las notas de
las últimas 48 horas, como pide Google, y deja fuera «Desde Windoce» a propósito.

## 2. Lo que se cambió (candado 58)

1. **El selector de idioma de cada nota** armaba la dirección del otro idioma cambiando el prefijo pero
   conservando el slug. Google seguía ese enlace en cada nota y caía en una redirección (nota
   traducida) o en una copia con `noindex` (nota sin traducir). Ahora usa la traducción que la
   página declara en su `hreflang`; si no la hay, lleva a la sección del otro idioma.
2. **Los listados en inglés** (portada, secciones, autores, relacionadas, RSS, widget) mostraban notas
   en español cuando no había traducción, con enlace a la copia `noindex`. Ahora en inglés solo se
   lista lo que existe en inglés, y la paginación cuenta igual (se acabaron las `?page=2` vacías).
3. La copia en español bajo `/en/` **sigue existiendo** para quien llegue por un enlace viejo, con su
   aviso y sin indexarse.

Pruebas: `tests/unit/indexacion.test.ts` y un e2e «candado 58», comprobados en rojo con tres
mutaciones. Detalle técnico en `docs/candados.md`, entrada 58.

## 3. Lo que el código no arregla: por qué Google rastrea y no guarda

Con un sitio de tres meses, Google guarda poco y elige. Lo que más pesa en contra hoy:

- **Muchas notas «de siempre» y no noticias:** guías genéricas («cuando tu empresa reestructura…»)
  y efemérides en serie («7 curiosidades a 100 años de su nacimiento»). Google ve miles iguales en
  la red y no le aportan nada nuevo. Las que entran son las que cuentan algo de hoy con fuente propia.
- **Poco volumen de noticias frescas:** el 7 nov el mapa de noticias tenía **dos** notas (cuatro
  direcciones) en 48 horas. Google Noticias quiere un flujo diario constante de noticias.
- **Pocos enlaces que lleguen de fuera:** el pendiente de enlazar losupe.com desde mercatren.com,
  windoce.com y yadominios.com sigue siendo lo que más ayudaría.

Recomendación (decisión de Richard, no se tocó): bajar las efemérides y las guías genéricas y subir
las noticias del día con fuente nombrada.

## 4. Qué mirar en Search Console dentro de una semana (14 nov 2026)

1. **Indexación → Páginas:** que la fecha de «Última actualización» sea posterior al 7 nov. Si no,
   todavía no hay datos nuevos y no se saca ninguna conclusión.
2. **«Página con redirección» y «Excluida por noindex»:** tienen que dejar de crecer. Las 45
   redirecciones propias y las 24 copias no deben volver a aparecer con fecha de rastreo posterior
   al 7 nov.
3. **«Duplicada: Google eligió otra canónica»:** tiene que bajar a medida que Google re-visite las
   `www`/`http`. Inspeccionar `https://losupe.com/en`: la canónica elegida por Google debe pasar a
   ser la misma que la declarada.
4. **Indexadas:** tiene que subir de 236.
5. **Sitemaps:** que `sitemap.xml` tenga «Última lectura» reciente (el 29 oct fue la última).
6. **Google Noticias:** buscar `site:losupe.com` en la pestaña Noticias; ver si aparece alguna nota
   además de la portada.

Se pidió indexación a mano (cupo diario de Google) de la portada en inglés y de notas recientes el
7 nov 2026; ver la lista en la bitácora de abajo.

## 5. Bitácora

- 7 nov 2026 — diagnóstico con Search Console (solo lectura), arreglo del candado 58, publicado.
