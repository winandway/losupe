# Siguiente paquete: la cadencia del segmento y la nota de Venezuela

> Dictado por Richard el 26 de noviembre de 2026, al final de una sesión que ya estaba muy larga.
> Se arranca en una sesión nueva, en esta misma carpeta. Es lo único que hay que hacer.

## 1. La cadencia de «Delivery y logística» (lo primero)

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
