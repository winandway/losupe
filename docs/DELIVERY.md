# Delivery y logística — el segmento diario

> Pedido de Richard el 25 de noviembre de 2026: «vamos a dar la bienvenida a nuestro nuevo segmento
> de delivery, de comida, de viajes, de logística… un día una empresa, otro día otra, y otro día
> Divoox… que Google no sienta que es un SEO especial de Divoox».

## 1. Qué es y qué no es

**Es periodismo del sector.** Cómo funciona el reparto de comida y de paquetes en el mundo: DoorDash,
Uber Eats, Instacart, Rappi, Deliveroo, Glovo, iFood, PedidosYa, los bloques de Amazon Flex, los
drones, las cocinas fantasma, la última milla. Qué cobra cada app a un restaurante, qué gana de
verdad un repartidor, cómo se abre una ciudad, y cómo se vive todo eso país por país.

**No es el folleto de Divoox.** Un segmento que solo hablara de nuestro producto no lo guardaría
Google, y con razón. Divoox entra cuando es noticia dentro del tema o cuando toca compararlo con el
resto, y **siempre con su línea de transparencia**, que pone el código.

**Sale tres veces al día**, a las 10, a las 15 y a las 21 hora del Este. La firma **Pedro Llerena**,
con su perfil público enlazado.

## 2. La regla que sostiene todo esto

Losupe es de Windoce LLC. Divoox también. Escribir del sector del delivery siendo dueño de una app de
delivery solo se sostiene de una forma: **diciéndolo**. Y decirlo no puede depender de que alguien se
acuerde.

- **En el perfil del autor.** La biografía de Pedro Llerena dice que es el fundador de Windoce LLC,
  dueña de Losupe y de Divoox. Su LinkedIn va en `sameAs`, que es como Google comprueba que detrás de
  una firma hay una persona real.
- **En cada nota que lo nombre.** `src/lib/casa/aviso.ts` detecta el nombre de cualquier producto del
  grupo en el titular, la entradilla o el cuerpo, y **pone la línea él solo** antes de publicar:
  «Transparencia: Divoox es de Windoce LLC, la empresa dueña de Losupe. Lo contamos como contamos a
  cualquier otra empresa del sector.» En español y en inglés.
- **Y no se puede quitar.** `assertTransparencia` impide publicar una nota que nombre un producto del
  grupo sin esa línea. Candado 61, comprobado en rojo con cinco mutaciones.

Esto no es prudencia excesiva: la política de Google Noticias saca de sus superficies al medio que
presenta contenido propio o patrocinado como independiente. Lo mismo exige la FTC para la publicidad
nativa.

### La diferencia con «Desde Windoce»

|                        | Delivery y logística                                    | Desde Windoce                     |
| ---------------------- | ------------------------------------------------------- | --------------------------------- |
| Qué es                 | Noticias del sector                                     | Contenido de la casa              |
| Quién manda en la nota | La noticia                                              | El producto                       |
| Aviso                  | «Transparencia: …» solo si nombra un producto del grupo | «Contenido de la casa: …» siempre |
| Google Noticias        | Entra                                                   | No entra, a propósito             |

Una nota **sobre Divoox** va a «Desde Windoce». Una nota **del sector donde Divoox aparece** va a
Delivery, con su línea.

## 2 bis. Dónde aparece Divoox, en concreto

No es casualidad ni depende de que el redactor se acuerde. Son tres sitios, y los tres están en
código:

1. **El redactor sabe que existe.** En cada encargo de una nota de delivery va la ficha de Divoox con
   lo que su página sostiene, y la instrucción de nombrarlo **solo cuando encaje**: una comparativa
   de apps de la región, una nota sobre Venezuela o América Latina, una sobre comisiones o sobre lo
   que gana un repartidor. Si no encaja, no lo menciona: una mención forzada se nota y resta. Nunca
   en el titular de algo que hizo otra empresa, y nunca un dato que no esté en la ficha.
2. **Su ficha va al pie de la sección**, siempre, en las dos portadas de idioma: qué es, para quién
   es, cuatro datos comprobados con su fecha y el enlace, marcado `rel="sponsored"`. Encabezada por
   «Nuestra propia app de reparto» y la frase que lo dice sin rodeos: Losupe es de Windoce, y Windoce
   también es dueña de esta app.
3. **Está en la rotación de temas** del segmento, como una empresa más de la lista, junto a DoorDash
   y a Rappi.

Y encima de todo eso, la línea de transparencia automática del punto 2. Un medio que esconde de
quién es se lo come Google; uno que lo pone arriba y escribe del sector entero con el mismo rasero
gana autoridad **y** le da a su producto el sitio donde la gente lo conoce. Eso es lo que estamos
haciendo.

## 3. El plan editorial

La rotación la hace el propio sistema con los temas de `src/lib/robot/ideas.ts`, sección `delivery`:

- **Las empresas, una por día:** DoorDash, Uber Eats, Instacart, Rappi, Amazon Flex, Deliveroo,
  Glovo, iFood, PedidosYa, DiDi Food, Wolt, Grubhub.
- **Cómo funciona cada cosa:** las comisiones, la propina, los bloques, la última milla, el código de
  recogida, qué pasa cuando un producto se agota, cómo se abre una ciudad.
- **País por país:** Estados Unidos, México, Colombia, Venezuela, Perú, Chile, Argentina, Brasil.
- **Y los rankings:** las apps más usadas en cada país, las comisiones comparadas, las ciudades donde
  más se pide.

Las notas de actualidad salen de nueve fuentes propias del sector, todas comprobadas vivas el 25 de
noviembre de 2026: Food On Demand, Restaurant Dive, Supply Chain Dive, Modern Retail, TechCrunch
Transportation y cuatro búsquedas de Google News (apps de reparto, última milla y trabajo por
encargo, reparto a domicilio en español, y logística en América Latina).

## 4. Lo que se puede decir de Divoox, y lo que no

Lo que se cuenta sale de lo que dice su propia página, leída el 25 de noviembre de 2026:

- App de reparto de comida con tres aplicaciones: clientes, repartidores y restaurantes.
- Comisiones para restaurantes de 7,5 %, 12,5 % y 15 % según el plan, sin contratos de permanencia.
- El repartidor ve el pago, la distancia y el punto de recogida antes de aceptar, y se queda con el
  100 % de la propina.
- **Divoox Flex:** el software de logística de última milla para empresas (registro de paquetes,
  etiqueta con código QR y plus code, confirmación del destinatario por WhatsApp, rutas y prueba de
  entrega con foto).
- Cada ciudad abre con una franquicia local.
- En Venezuela, su página dice **«próximamente»**, y nombra Caracas, Maracaibo y Valencia como
  primeras ciudades.

**Lo que NO se escribe:** nada que la página no sostenga. Ni número de usuarios, ni pedidos, ni
ciudades ya funcionando, ni comparaciones de las que no haya fuente. El plan de largo plazo (ser la
red de reparto de paquetes de otras empresas) **no se publica como un hecho**: hasta que exista, es
un plan.

> **Ojo, 25 nov 2026:** la página pública de Venezuela dice «coming soon» y Richard avisó de que van
> a quitarlo porque ya abrieron. Mientras diga eso, las notas no pueden afirmar lo contrario; y en
> cuanto deje de decirlo, tampoco pueden seguir diciendo que no opera.
>
> **Eso ya no depende de que nadie se acuerde.** La ficha declara una frase que vigila
> (`vigilar: { url, frase, siDesaparece }`) y el robot la comprueba en cada corrida: si «Coming soon»
> desaparece de esa página, la ficha queda **vencida**, sale en `/__health` y el redactor deja de
> recibir sus datos hasta que una persona relea la página y actualice la ficha. Decir de menos de
> nuestro propio producto es el mismo error que decir de más. Si la página no responde, no se
> concluye nada: una caída de red no es un cambio de contenido.

## 4 bis. El fallo del día del estreno (25 nov 2026)

El turno de delivery llegó, buscó una noticia del sector, no encontró ninguna y publicó **una de
bolsa**. La cola estaba vacía de su tema.

La causa no era el segmento: el robot **lee seis fuentes por corrida**, rotando entre las veintinueve
que hay, para no comerse el tiempo de la corrida leyéndolas todas. A las nueve fuentes nuevas no les
había tocado turno todavía. Un turno que tiene sección asignada necesita material de ESA sección, y
el único momento de conseguirlo es justo antes de escribir.

Arreglado para todas las secciones con turno, no solo para delivery: `discoverCandidates` acepta la
sección del turno y **lee sus fuentes primero**; el resto sigue rotando detrás para que ninguna se
quede sin leer nunca. Prueba en `tests/unit/segmento-delivery.test.tsx`, comprobada en rojo.

## 5. Qué se quitó para hacerle sitio

El turno de las 21 era de «rankings» (una pieza propia, genérica). Los rankings y las efemérides son
justo lo que Google rastrea y no guarda — quedó medido en el informe de indexación del 7 de noviembre
—, así que ese hueco pasó a delivery. El día sigue teniendo once notas: no se le carga más trabajo al
robot.
