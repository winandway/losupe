# Cómo se habla de lo nuestro sin que Google nos sancione

> Dictada por Richard el 25 de noviembre de 2026, mirando el pie de la sección de delivery. Sus
> palabras: _«una ficha solo de esta, dentro del SEO, podría más bien perjudicarnos, porque entonces
> le estás diciendo a Google: mira, estamos haciendo todo esto, lo estamos haciendo es por Divoox…
> Nosotros mismos nos estamos delatando. Está demasiado claro nuestra intención y está dentro de
> delivery, que va a ser el rubro que estamos metiendo nosotros. Y no me parece justo… tenemos que
> ser parciales, porque si no, Google nos puede sancionar.»_

Losupe es un medio. Windoce LLC, su dueña, también es dueña de productos que compiten en los sectores
que el medio cubre — Divoox en delivery, y los demás en sus rubros. Eso no está prohibido: lo hacen
todos los grupos de comunicación del mundo. Lo que sí está penado es **usar la autoridad del medio
para posicionar el producto propio**, y es fácil hacerlo sin darse cuenta.

Este documento es la regla. Vale para TODA sección donde el grupo tenga un producto.

---

## Lo que dice Google, en sus propias políticas

No es opinión nuestra. Son políticas publicadas:

- **Abuso de la reputación de un sitio** (_site reputation abuse_). Publicar en un sitio con
  autoridad contenido cuyo fin principal es aprovechar esa autoridad para posicionar otra cosa.
  Google lo cuenta como spam y lo sanciona aunque el contenido esté bien escrito.
- **Páginas de afiliación pobres** (_thin affiliate pages_). Páginas cuyo propósito real es llevar al
  lector a un producto, sin aportar valor propio frente a lo que ya hay en el buscador.
- **Contenido escalado** (_scaled content abuse_). Producir muchas piezas con el fin principal de
  posicionar, no de servir a quien las lee. Un diario escrito por un robot está permanentemente a un
  paso de aquí: lo que nos salva es que cada pieza valga por sí sola.
- **Contenido para personas, no para buscadores**. La guía de Google se responde con preguntas, y
  hay una que es la nuestra: _«¿este contenido está hecho principalmente para atraer visitas desde
  los buscadores?»_. Si la respuesta honesta es sí, está mal hecho.
- **Enlaces marcados.** Un enlace a un producto propio o pagado lleva `rel="sponsored"`. Un enlace
  que no queremos respaldar con nuestra autoridad lleva `rel="nofollow"`. Dejar un enlace normal
  hacia lo propio es pasarse autoridad a uno mismo.

La prueba de fuego, y es la de Richard: **si un competidor mirara nuestra sección, ¿diría que es un
medio o diría que es el folleto de Divoox?** Si lo segundo, está mal, aunque cada frase sea verdad.

---

## Las reglas, y dónde están puestas en el código

### 1. En una sección de periodismo, NINGUNA pieza fija nombra un producto nuestro

Ni una ficha, ni un directorio, ni una tabla comparativa, ni una caja al pie o al lado. Nada que se
repita en toda la sección y que nos nombre.

Esto costó dos intentos. El 25 de noviembre, al pie de «Delivery y logística» había una ficha sola
de Divoox, con el título «Nuestra propia app de reparto». Se cambió por un directorio de seis
empresas, con la nuestra la última. El 26 Richard tumbó también el directorio, y con el argumento
correcto: _«no necesitamos tener una ficha de cada una de ellas… cualquier empresa puede ser
DoorDash. inDrive inventa un carro autónomo y lo lanza en Bolivia: eso es una noticia»_. Tenía
razón por partida doble:

- Una tabla **que escribimos nosotros**, con las casillas que elegimos nosotros, donde nos ponemos
  nosotros, no es imparcial porque haya cinco competidores. Es nuestra tabla.
- Y encima encierra un sector de decenas de empresas en seis, una de ellas la nuestra. Eso se ve.

Las fichas de los productos del grupo viven **solo en «Desde Windoce»**, que avisa en cada nota y
está fuera de Google Noticias a propósito. En las secciones de periodismo, nuestro producto aparece
cuando una noticia lo trae, y nada más.

- **Dónde:** `src/app/[lang]/[section]/page.tsx` (las fichas solo si `section.house`) y el candado 64
  en `tests/unit/segmento-delivery.test.tsx`, que recorre el código de todas las piezas fijas y se
  pone en rojo si una nombra un producto del grupo.

### 2. Y tampoco un TEMA sobre un producto nuestro en la rotación del sector

«Cómo funciona Divoox» dentro de la sección de delivery es un folleto, por muy bien escrita que esté
la pieza. El banco de temas del sector (`src/lib/robot/ideas.ts`) no tiene ni uno. Los lanzamientos
de nuestros productos van a «Desde Windoce», que es su sitio.

### 3. La transparencia es una línea de texto, nunca una etiqueta

Esta es la frontera fina, y hay que saber de qué lado se está:

- **Etiqueta = vanidad.** Un sello «DE LA CASA» al lado del nombre, en una vitrina, es presumir de
  dueño. Richard: _«me parece absurdo, me parece vanidoso»_. Se quitó.
- **Línea = obligación.** Un párrafo pequeño al principio de la nota que dice de quién es la
  empresa, igual que _The New York Times_ escribe «The Athletic, que pertenece a The New York Times
  Company» cada vez que la nombra. **Esa se queda, y no se toca.**

Quitarla no nos haría más imparciales: nos haría un medio que oculta un vínculo material. Es
exactamente lo que sanciona Google Noticias y lo que persigue la FTC en Estados Unidos, que es
nuestro mercado. La ventaja de que la ponga el código es que ya casi no se ve: solo aparece cuando
la noticia de verdad nombra a Divoox.

- **Dónde:** `src/lib/casa/aviso.ts` (`AVISO_RELACION`, `assertTransparencia`), candado 61.

### 4. Los enlaces no se pasan autoridad

A un producto del grupo, `rel="sponsored"`. A cualquier enlace que no queramos respaldar con nuestra
autoridad, `rel="nofollow"`. Un enlace normal hacia lo propio es pasarse autoridad a uno mismo.

### 5. El titular de una sección nunca lleva nuestro nombre ni «nuestro»

Ni en el encabezado, ni en el título de una pieza fija, ni en el nombre de la sección.

### 6. En una NOTA, nuestro producto se nombra solo si encaja, y nunca dice su etapa

Lo de siempre (candado 61): una mención como una empresa más, nunca en el titular de algo que no es
suyo, nunca como protagonista de lo que hizo otro. Y desde el 25 de noviembre, en una nota del
sector **no se dice en qué país o en qué etapa está**: ni que ya opera ni que todavía no. Se nombra
por lo que hace.

### 7. La sección de la casa es otra cosa, y se queda aparte

«Desde Windoce» es contenido de la casa, lo dice en cada nota, está fuera de Google Noticias y no se
mezcla con las secciones de periodismo. Esa separación es la que hace creíble todo lo demás
(candado 57).

### 8. La cobertura de un sector donde competimos se escribe ANCHA

Un sector contado con cinco empresas y sus comisiones es un sector elegido. Se cubre entero —las
grandes y las que vienen, Asia y América Latina, lo que lanzan y lo que les prohíben— y entonces
nuestro producto, cuando aparece, es una línea entre muchas. Esa es la imparcialidad de verdad: no
la declaración, el volumen.

---

## El candado

`tests/unit/segmento-delivery.test.tsx` se pone en rojo si una pieza fija de una sección de
periodismo nombra un producto del grupo, si vuelve el directorio del pie, si entra un tema sobre un
producto nuestro en la rotación del sector, si la rotación se estrecha, o si desaparece la línea de
transparencia de una nota que nos nombra. Comprobado en rojo con mutaciones las dos veces.

Antes de añadir cualquier pieza fija que hable de un producto del grupo, se lee este documento y se
contesta la pregunta de Richard: _¿esto parece un medio o parece un folleto?_
