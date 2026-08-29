# Redes sociales: cómo se enciende cada una

Cada nota que publica el diario se anuncia sola en las redes que estén encendidas. **Todo el código
está escrito, probado y enchufado. Lo único que falta es pegar las llaves.**

La red que no tenga sus llaves no molesta ni falla: sencillamente se salta. Se puede encender una,
dos o las cuatro, en cualquier orden y en cualquier momento, sin volver a publicar el sitio.

## Dónde se ve si está encendida

Dos sitios, los dos ya funcionando:

- **El panel**, en la tarjeta «Redes sociales» de `https://losupe.com/panel`. Un punto verde por
  cada red encendida, y de las apagadas dice **el nombre exacto de la variable que falta**.
- **La revisión de salud**, en `https://losupe.com/__health`, en el apartado `redes`.

Ninguno de los dos enseña jamás el valor de una llave: solo el nombre de la que falta. Hay una
prueba que lo comprueba, porque `/__health` es público.

## Las cuatro redes, y por qué esas

Se eligieron las cuatro que se pueden encender **hoy**, sin esperar la aprobación de nadie y sin
pagar. X (Twitter) e Instagram se quedaron fuera a propósito: la primera cobra por publicar desde un
programa y la segunda solo lo permite con una cuenta de empresa aprobada. Cuando estén, se añaden
con el mismo molde — un archivo en `src/lib/redes/` y una línea en la lista.

| Red      | Cuánto cuesta | Hay que esperar aprobación  | Caben |
| -------- | ------------- | --------------------------- | ----- |
| Telegram | Gratis        | No                          | 4096  |
| Bluesky  | Gratis        | No                          | 300   |
| Mastodon | Gratis        | No                          | 500   |
| Facebook | Gratis        | **Sí**, la revisión de Meta | 5000  |

### Telegram — la más fácil de todas

1. En Telegram, escríbele a **@BotFather** y manda `/newbot`. Te pide un nombre y un usuario que
   acabe en `bot`. Al terminar te da un token largo: ese es `TELEGRAM_BOT_TOKEN`.
2. Crea el canal del diario (o usa el que ya haya), entra en sus ajustes → Administradores → Añadir
   administrador, y busca el bot que acabas de crear. Dale permiso de **publicar mensajes**.
3. `TELEGRAM_CHAT_ID` es `@elnombredelcanal` si el canal es público.

### Bluesky

1. Entra a la cuenta del diario → Ajustes → Privacidad y seguridad → **Contraseñas de aplicación** →
   Añadir. Le pones un nombre («losupe») y te da una contraseña con guiones.
2. `BLUESKY_IDENTIFIER` es el usuario completo (por ejemplo `losupe.bsky.social`) y
   `BLUESKY_APP_PASSWORD` es esa contraseña.

Una contraseña de aplicación **no es** la contraseña de la cuenta: se puede anular cuando quieras sin
cambiar nada más, y quien la tenga no puede entrar a la cuenta ni cambiarla.

### Mastodon

1. En el servidor donde esté la cuenta: Preferencias → Desarrollo → **Nueva aplicación**. Marca el
   permiso de escritura (`write:statuses`) y guarda.
2. `MASTODON_HOST` es el servidor (`mastodon.social` vale, con o sin `https://`) y `MASTODON_TOKEN`
   es el «token de acceso» que aparece al abrir la aplicación creada.

### Facebook — la única que hace esperar

Publicar en una **página** (no en un perfil) necesita el permiso `pages_manage_posts`, y ese permiso
lo revisa Meta a mano. El código ya está: cuando el permiso esté aprobado, se pegan
`FACEBOOK_PAGE_ID` (el id de la página) y `FACEBOOK_PAGE_TOKEN` (un token de página de larga
duración) y empieza a publicar sin tocar nada más.

## Dónde se pegan las llaves

**YaDominios Cloud → tarjeta del sitio `losupe` → Variables de entorno.** Una casilla por variable,
con el nombre exacto de la tabla de arriba. Después se guarda y se republica el sitio.

Nunca en el repositorio, nunca en un archivo del proyecto. Los nombres (sin valores) están en
`.env.example`.

## Qué se publica exactamente

El post se arma en tres piezas: **titular**, **gancho** (la entradilla, recortada) y **enlace**, más
un par de etiquetas según la sección. Cuando no cabe todo, el orden de sacrificio es siempre el
mismo y protege lo que importa:

1. Se van las etiquetas.
2. Se acorta el gancho.
3. **El titular y el enlace no se tocan jamás.** Un post sin enlace es un post inútil.

En Bluesky, además, el enlace se marca a mano con un «facet» que dice en qué bytes empieza y acaba.
Ese detalle importa: si se contaran letras en vez de bytes, un titular con tildes desplazaría la
marca y el enlace saldría como texto muerto. Hay una prueba que lo fija.

## Qué pasa si una red falla

Tres reglas, y ninguna es negociable:

1. **Nunca frena la publicación.** La nota ya está en el sitio cuando esto corre. Que Telegram esté
   caído no puede tumbar nada.
2. **El fallo se ve.** Queda escrito en la tabla `social_posts` con su motivo y sale en el panel, en
   «Últimos anuncios», en rojo. Nada de tragarse el error en silencio.
3. **Nunca dos veces la misma nota en la misma red.** Lo garantiza la propia tabla.

Un error de llave (401) no se reintenta, porque reintentar solo gasta. Un servidor caído (500) o un
límite alcanzado (429) sí quedan marcados como reintentables.

## Cómo se comprueba que quedó bien

1. Entra a `https://losupe.com/panel` y mira la tarjeta «Redes sociales»: la red que acabas de
   configurar tiene que tener el punto **verde** y decir «encendida».
2. Pulsa **«Ejecutar ahora (1 nota)»** en la tarjeta de estado.
3. En un minuto, la nota tiene que aparecer en el canal o el perfil. En el panel, abajo de la misma
   tarjeta, sale la línea del anuncio con su punto verde.
4. Si sale en rojo, el motivo está escrito ahí mismo, en palabras.
