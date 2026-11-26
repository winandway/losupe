# Siguiente paquete: la cadencia del segmento y la nota de Venezuela

> Dictado por Richard el 26 de noviembre de 2026, al final de una sesión que ya estaba muy larga.
> Se arranca en una sesión nueva, en esta misma carpeta. Es lo único que hay que hacer.

## 0. Quitar la sección «Desde Windoce» del sitio (lo PRIMERO de todo)

Orden de Richard, el 26 de noviembre: _«esto elimínalo. Eso yo lo pedí, pero interno: tener en cuenta
nuestros proyectos para hablar de ellos cada vez que tengamos cosas nuevas y crear tutoriales de
ellos, pero no para ponerlo así, porque aquí nos estamos delatando también»_.

La idea original sigue viva, pero cambia de sitio: **cuando un producto nuestro lanza algo, eso es
una noticia del sector y va en su sección** (punto 1 de este documento), no en una sección con
nuestro nombre. Una sección llamada «Desde Windoce» en el menú de un diario es el mismo escaparate
que el directorio y la etiqueta, en grande.

Qué hay que hacer, con cuidado porque la sección está indexada:

1. Apagar la sección en `src/lib/sections.ts` y en `schema.sql` (`active = 0`), para que salga del
   menú, del pie, del mapa del sitio, del RSS, del MCP y de los listados.
2. **Las direcciones viejas no se pueden quedar en 404.** `/es/desde-windoce` y `/en/from-windoce`
   estaban en el mapa y Google ya las vio: redirección 301 a la portada (o a la sección que
   corresponda), igual que se hizo en el candado 58. Las notas que ya salieron, lo mismo.
3. Archivar las notas de esa sección (`status = 'archived'`), **sin borrar datos**.
4. Parar el paso diario de la casa (`src/lib/casa/paso-diario.ts`) y su turno en la escaleta, y
   retirar el resto de la maquinaria que quede muerta (fichas, aviso de la casa, `house_notes`),
   dejando el candado 57 anotado como superado en `docs/candados.md`.
5. Las siete notas que esperaban el visto bueno de Richard dejan de esperarlo: se archivan. Su
   contenido sirve de material para las notas del sector cuando toque.
6. Comprobar en vivo que no queda ni un enlace a la sección y que las direcciones viejas redirigen.

Candado: una prueba que falla si la sección vuelve a aparecer en el menú, en el mapa del sitio o en
el RSS, y otra que falla si una dirección vieja de la sección devuelve 404 en vez de redirigir.

## 1. La cadencia de «Delivery y logística»

Hoy el segmento rota temas uno por día. Con veintiséis empresas, nosotros saldríamos cada veintiséis
días. Palabras de Richard: _«eso no es un SEO, no es un posicionamiento, no estamos haciendo nada»_.

**La regla que pidió:** tres notas al día, y así se reparten:

- **Dos son las noticias más relevantes del día** de cualquiera de las empresas del sector, elegidas
  por relevancia real (lo que lanzaron, lo que cambiaron, lo que les prohibieron), no por rotación.
- **La tercera puede ser nuestra**, cuando hay material. Un día salen tres del resto, otro día
  nosotros y dos más. Nunca más de una nuestra al día, y nunca dos días seguidos si no hay noticia.

**De dónde sale el material nuestro, sin que nadie lo cargue a mano:** `https://divoox.com/sitemap.xml`
publica hoy 614 direcciones, con un árbol `/docs/...` grande. El `lastmod` no sirve (se regenera con
cada compilación, hoy marca todo con la fecha de hoy), pero **una dirección que antes no existía sí
es señal**: una página de documentación nueva es una función nueva. Guardar la lista vista en una
tabla pequeña, comparar en cada corrida, y lo nuevo es el candidato del día. La primera vez se siembra
entera y no se publica nada (si no, saldrían 614 notas). Con su presupuesto de escrituras medido.

Candado: una prueba que falla si en un día salen dos notas nuestras en la sección, y otra que falla si
la primera vuelta publica las 614.

## 2. La nota de Venezuela (la siguiente que sale, dictada por Richard)

Es noticia del sector, no contenido de la casa: va en **Delivery y logística**, firmada por Pedro
Llerena, **sin ningún aviso de propiedad** (candado 65). Lo que él dictó, palabra por palabra en
sustancia:

- Divoox **ya está operando en Venezuela**, ciudad por ciudad, y va **seguro aunque lento**, que es
  lo importante.
- Ciudades donde ya hay gente trabajando: **El Vigía, Tucaní, Santa Bárbara del Zulia**. Arrancando
  en **Barquisimeto**, y en camino **Valera, Valencia y Caracas**.
- Hay **preparadores**: personas encargadas de dar charlas y enseñar a los usuarios.
- Y una noticia propia: **Divoox prepara su propia marca de motos para los mototaxistas**. Richard:
  _«no es que esperar que se haga para hacerlo. ¿Para qué? Ya se puede hacer»_. Se cuenta como lo que
  es: un plan anunciado por la empresa, con esas palabras, no como algo que ya está a la venta.

**Antes de escribirla hay que tocar la ficha** (`src/lib/casa/productos.ts`): su `cuidado` prohíbe hoy
decir en qué etapa está en cada país, y su `vigilar` busca «Coming soon» en la página de Venezuela.
Esa prohibición nació cuando la fuente era solo la página web. **Ahora la fuente es la empresa, por
boca de su dueño, el 26 de noviembre de 2026**, y eso se escribe así en la ficha: las ciudades, con su
fecha y atribuidas a la empresa. Lo que sigue prohibido es inventar cifras: nada de número de
repartidores, de pedidos ni de restaurantes.

## 3. Lo que ya quedó hecho hoy (no rehacer)

- Candado 64: ninguna pieza fija nombra un producto del grupo. Fuera el directorio del sector y fuera
  la parrilla de fichas de «Desde Windoce».
- Candado 65: ninguna nota de periodismo lleva aviso de propiedad. Se declara en la política editorial
  y en el pie del medio.
- El sector abierto a veintiséis empresas y tres fuentes nuevas.
- Reglas: [`SEO-IMPARCIALIDAD.md`](SEO-IMPARCIALIDAD.md) y [`DELIVERY.md`](DELIVERY.md).
