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

### 1. Nuestro producto nunca es el único de una pieza fija

Una pieza que se repite en toda la sección —un pie, una barra, una caja lateral— **no puede hablar
solo de lo nuestro**. Si va una ficha, va el directorio del sector: nuestro producto y al menos
**cinco competidores**, con las mismas casillas rellenas para todos.

Fue el fallo exacto del 25 de noviembre: al pie de «Delivery y logística» había una ficha sola, de
Divoox, con el título «Nuestra propia app de reparto». Era honesta y estaba declarada, y aun así le
decía a Google para qué existe la sección.

- **Dónde:** `src/lib/sector/directorio.ts` y `src/components/DirectorioDelSector.tsx`.

### 2. El orden lo decide un criterio neutro, y se escribe en la página

Nuestro producto no va primero por ser nuestro. El directorio va **de la empresa más grande a la más
nueva**, el criterio está impreso arriba, y por eso Divoox sale **la última**: es la verdad.

### 3. Las mismas casillas para todos, y lo que no se publica se dice

De cada empresa: qué es, dónde opera, qué paga el comercio y cómo cobra quien reparte. Si una no
publica su comisión, la ficha dice que no la publica — eso informa igual, y demuestra que la tabla no
está hecha para que gane uno. Nada de contar de la nuestra lo que no se cuenta de las demás.

### 4. Cada dato con su fuente y su fecha, a la vista

Cada ficha enseña de dónde salieron sus datos y cuándo se comprobaron. Un dato sin fuente en una
tabla donde estamos nosotros no es un descuido: parece un favor.

### 5. Los enlaces no se pasan autoridad

A lo nuestro, `rel="sponsored"`. A los competidores, `rel="nofollow"`. Ninguno de los dos pasa
autoridad, y el primero además le dice a Google quiénes somos antes de que lo averigüe solo.

### 6. El titular de una sección nunca lleva nuestro nombre ni «nuestro»

Ni en el encabezado, ni en el título de una pieza fija, ni en el nombre de la sección. La
transparencia va **dentro** de la ficha de nuestro producto, que es donde corresponde, no como
rótulo de todo lo que publicamos.

### 7. En una NOTA, nuestro producto se nombra solo si encaja, y nunca dice su etapa

Lo de siempre (candado 61): una mención como una empresa más, nunca en el titular de algo que no es
suyo, nunca como protagonista de lo que hizo otro, y el aviso de transparencia lo pone el código.
Desde el 25 de noviembre, además, en una nota del sector **no se dice en qué país o en qué etapa
está**: ni que ya opera ni que todavía no. Se nombra por lo que hace.

### 8. La sección de la casa es otra cosa, y se queda aparte

«Desde Windoce» es contenido de la casa, lo dice en cada nota, está fuera de Google Noticias y no se
mezcla con las secciones de periodismo. Esa separación es la que hace creíble todo lo demás
(candado 57).

---

## El candado

`tests/unit/segmento-delivery.test.tsx` se pone en rojo si el directorio se queda con menos de cinco
competidores, si nuestro producto pasa a ser el primero, si el título de la pieza lleva nuestro
nombre o la palabra «nuestra», si desaparece la línea de transparencia de su ficha, si un enlace deja
de ir marcado o si una ficha se queda sin fuente.

Antes de añadir cualquier pieza fija que hable de un producto del grupo, se lee este documento y se
contesta la pregunta de Richard: _¿esto parece un medio o parece un folleto?_
