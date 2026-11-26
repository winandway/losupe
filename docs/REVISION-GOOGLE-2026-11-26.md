# Revisión de Google — 26 de noviembre de 2026

> Pedido de Richard: «revisa qué ha pasado con el posicionamiento en Google Noticias… si todo el
> trabajo que hemos realizado valió la pena o hay que hacer cambios. Revisa en qué posición estamos».
> Todo lo de abajo está **medido hoy** en Search Console con la cuenta de Richard y con peticiones
> reales al sitio. Nada es de memoria. Compara contra el informe del 10 de noviembre.

## 1. La respuesta corta

**No estamos en Google Noticias. Cero impresiones en tres meses.** Y no hay un trámite pendiente:
desde marzo de 2025 Google Noticias no tiene solicitud ni sello de aprobación — se entra si Google
indexa las notas. Nuestra publicación existe y `losupe.com` está verificada; de ahí no falta nada.

**Lo que falla no es técnico, es el contenido.** Google rastrea nuestras notas a los uno o dos días
de publicarlas y decide **no indexarlas**. Y las que ya tenía indexadas las está sacando.

## 2. Los números, y cómo se movieron

| Qué                                    | 22 oct | 10 nov | **26 nov**                      |
| -------------------------------------- | ------ | ------ | ------------------------------- |
| Páginas indexadas                      | 236    | 153    | **63**                          |
| Páginas sin indexar                    | 457    | 708    | **790**                         |
| Rastreada, actualmente sin indexar     | —      | 214    | **313**                         |
| Descubierta, sin indexar               | —      | 184    | 182                             |
| Página con redirección                 | —      | 142    | 145                             |
| Duplicada, Google eligió otra canónica | 129    | 136    | **116** (baja: se está curando) |
| Excluida por «noindex»                 | —      | 24     | 26                              |

**Búsqueda web**

| Ventana                             | Clics  | Impresiones | Posición media |
| ----------------------------------- | ------ | ----------- | -------------- |
| 28 días al 21 sep (aviso de Google) | **30** | —           | —              |
| 28 días al 10 nov                   | 1      | 19          | 18,1           |
| **28 días al 24 nov**               | **2**  | **14**      | 15,4           |
| 3 meses (25 ago – 24 nov)           | 43     | 1.720       | 21,1           |

Las 1.720 impresiones de tres meses son casi todas de antes del 28 de octubre: en los últimos 28 días
quedan **catorce**. El tráfico cayó un 93 % desde septiembre.

**Google Noticias:** 0 clics y 0 impresiones en tres meses. El informe existe (Google reconoce la
propiedad), pero nunca nos ha mostrado ahí. Búsqueda en vivo hoy en `news.google.com` por
`site:losupe.com`: **un solo resultado, la portada**. Igual que el 10 de noviembre.

**Vídeos:** 1 descubierto, 0 indexados.

## 3. Lo que sí mejoró (el trabajo de noviembre sirvió)

- **El ritmo está arreglado.** El candado 60 funcionó: ayer se publicaron 13 notas y hoy, a mediodía,
  van 4. El mapa de noticias, que el 7 de noviembre le ofrecía a Google **dos** notas en 48 horas,
  hoy le ofrece **veinte**.
- **Google volvió a rastrear.** Las notas del 23 y 24 de noviembre están rastreadas. No nos ignora.
- **Las duplicadas bajan solas**, como se previó (136 → 116). El arreglo del selector de idioma
  (candado 58) está haciendo efecto.
- **Nada técnico está roto.** Comprobado hoy, uno por uno: `http://` redirige con 301 a `https://`;
  la portada en inglés responde 200 con su canónica propia y `index, follow`; **no hay ninguna acción
  manual ni problema de seguridad**; los seis mensajes de Search Console son rutinarios y de agosto y
  septiembre.

## 4. El diagnóstico, sin adornos

**313 páginas «rastreadas, actualmente sin indexar», y subiendo.** Ese motivo no es un fallo que se
arregle con código: es el veredicto de Google sobre el valor de la página. La ve, la lee entera, y
decide que no merece estar en el índice.

Las que pone de ejemplo dicen exactamente de qué tipo son:

- `…/en/artists/eliseo-alberto-8-curiosities-75-years-after-his-birth`
- `…/en/artists/9-curiosities-about-james-lipton-100-years-after-his-birth`
- `…/es/ventas/10-datos-curiosos-sobre-mercados-y-ferias-que-van-mas-alla-de-la-compraventa`
- `…/en/economy/how-countries-secure-international-financial-backing-and-why-it-matters`

Efemérides, listas de curiosidades y explicaciones genéricas. **Y la mitad de lo que publicamos es
justo eso**: el robot tiene `evergreenRatio` en 0,5 y las efemérides encendidas.

El perfil del sitio —muchas notas al día, escritas por una máquina, la mitad sin noticia detrás, y la
otra mitad resumiendo lo que ya contaron otros medios— encaja punto por punto con lo que Google
describe en su política de **abuso de contenido a gran escala**. No hay penalización manual: es el
algoritmo tratándonos con desconfianza. Por eso tampoco relee los mapas: el de noticias no lo lee
desde el **7 de noviembre**, el general desde el **29 de octubre**.

Y hay una prueba más, al revés: lo único que llegó a traer impresiones fueron notas con **nombre
propio y dato concreto** («rob james-collier» 53, «david coverdale edad» 26, «ecopetrol 75 años» 16).
No el relleno.

## 5. Qué hay que cambiar (recomendación firme)

**Menos notas y con algo que nadie más tenga.** En este orden:

1. **Apagar las efemérides y las listas de curiosidades.** Son el grueso de las 313 rechazadas y son
   la mitad de la producción. Mientras sigan saliendo, le estamos confirmando a Google lo que ya
   piensa de nosotros. `evergreenRatio` a 0 y `efemerides` en falso.
2. **Bajar el cupo de once notas al día a tres o cuatro**, todas de actualidad con fuente nombrada.
   El volumen dejó de ser la palanca el día que Google dejó de indexar; ahora juega en contra.
3. **El segmento de delivery es el camino correcto y hay que apoyarse en él.** Es lo único donde
   tenemos lo que ningún otro sitio tiene: información de primera mano. La nota de Venezuela que
   dictó Richard —ciudades abiertas, preparadores, la marca de motos— es exactamente el tipo de
   material que Google sí indexa, porque no existe en ningún otro lado.
4. **Limpiar el archivo.** Setecientas páginas que Google mira y descarta son setecientas señales en
   contra. Las efemérides y las listas que nunca se indexaron se retiran del mapa y se marcan
   `noindex`, o se fusionan en pocas páginas buenas.
5. **Volver a medir el 10 de diciembre.** Lo que hay que ver subir es una sola cosa: las páginas
   indexadas. Si el número deja de caer, el cambio sirvió.

Lo que **no** hay que tocar: nada del arreglo técnico. Está bien y no es la causa.

## 6. Dónde mira Richard esto mismo

- Google Noticias: `https://search.google.com/search-console/performance/google-news?resource_id=sc-domain%3Alosupe.com`
- Páginas indexadas y motivos: `https://search.google.com/search-console/index?resource_id=sc-domain%3Alosupe.com`
- Rendimiento en búsqueda: `https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Alosupe.com`
