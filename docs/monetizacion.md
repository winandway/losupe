# Cómo losupe.com gana dinero — roadmap de las 10 ideas

> Acordado con Richard el 23 de agosto de 2026. Se ejecutan **de una en una**, de la más fácil a la
> más grande. Cada idea dice: qué es, qué hace falta, quién lo hace y cómo se cobra. El estado se
> actualiza aquí cada vez que se termina una.

## Regla de oro

Nada de construir las diez a la vez. Se termina una, se pone a facturar, y recién ahí la siguiente.
Todas se apoyan en lo que YA existe: un robot que investiga, redacta bilingüe, ilustra y publica.

---

## Fase A — Facturar desde el día cero

### 1. Comunicados autoservicio: «Publica tu noticia» ✅ **hecho (23 ago 2026)**

**Qué es.** Una página pública donde cualquier negocio pide su nota: llena su sitio web, qué quiere
contar y elige un paquete. El pedido entra solo al panel como patrocinador + encargo en cola; el
robot investiga su sitio y redacta la nota en español e inglés; Richard la revisa y la publica.

**Por qué vende.** Los servicios de comunicados de prensa en EE. UU. (PRNewswire, EIN, Business Wire)
cobran entre **$350 y $800 por un solo comunicado**, tardan días y lo publican en inglés. Aquí es
autoservicio, bilingüe, en una hora y a una fracción del precio.

**Dónde está.** `/es/publica` y `/en/publish` (enlazadas desde el pie y el menú). Los pedidos llegan
a **Panel → Pedidos**, con un botón que los convierte en patrocinador + encargos con un clic.

**Cómo se cobra hoy.** El pedido llega marcado «pendiente de pago»; Richard cobra por su medio
habitual (transferencia, Zelle, link de pago) y marca «pagado» en el panel. Cuando quiera cobro
automático con tarjeta, se conecta Stripe (hace falta su cuenta) y el pedido pagado entra solo.

**Precios sugeridos de lanzamiento** (los decide Richard; se cambian en la página):
Básica $79 · Destacada $149 · Paquete 4 notas $249 · Anual 12 notas $599.

### 2. Niveles de precio y «precio fundador» ⏳ siguiente

Reemplazar el precio único por Básica / Destacada / Paquete, y dejar el precio bajo actual como
**oferta de lanzamiento con fecha de fin**. Al cliente que compró barato no se le sube: se le pide
testimonio y se le da un beneficio de fundador. Trabajo: solo textos y tabla de precios.

### 3. Patrocinio de sección y de boletín ⏳

«Cripto, presentado por [empresa]» durante un mes: logo y frase en la cabecera de la sección y en
las notas de esa sección. No requiere producir nada nuevo: el robot ya llena la sección todos los
días. El boletín (bloque 4) lleva un patrocinador por edición.

### 4. Menciones dentro de las guías duraderas ⏳

Las guías («5 maneras de vender en línea») viven años. Un bloque de mención patrocinada dentro de la
guía, marcado como tal, más barato que una nota completa. Inventario que crece solo con cada guía.

---

## Fase B — Motor de crecimiento

### 5. Widget de noticias para sitios ajenos (idea de Richard) ⏳

Un bloque que cualquier página pega y le publica noticias frescas de su rubro, con aviso al dueño
cuando sale una. Suscripción mensual desde YaDominios Cloud. Cada widget enlaza a losupe: te pagan
por repartirte por Internet.

### 6. Boletín diario por WhatsApp ⏳

Resumen de 1 minuto donde de verdad vive el público. Gratis con patrocinador; de pago sin publicidad
y por temas. El robot ya escribe el resumen; falta el envío.

### 7. Radar de tendencias como SaaS (B2B) ⏳

El motor que ya lee Google Trends + medios, con otro vestido: tablero de «qué se busca esta semana en
tu industria», en español e inglés. Suscripción mensual; el cliente es la empresa, no el lector.

---

## Fase C — Las apuestas grandes

### 8. Sala de prensa como servicio (white label) ⏳

Todo negocio debería tener su propio periódico y ninguno lo tiene porque cuesta una redacción.
El mismo robot + panel montado en `noticias.suempresa.com`, con sus propios patrocinadores.
losupe deja de ser un periódico y pasa a ser la fábrica de miles.

### 9. Acceso premium para IA y agentes ⏳

El sitio ya se sirve en formato para agentes. El paso siguiente del mercado es que las IA paguen por
contenido confiable y fresco: API de notas y del radar por suscripción, con el lector humano gratis.

### 10. Shorts y audio automáticos ⏳

Cada nota convertida en video vertical de 20–30 s y en píldora de audio, para que trabaje en cinco
plataformas y traiga gente al sitio. Ver `docs/redes-y-video.md` para las APIs y costos.

---

## Estado

| #   | Idea                          | Estado    | Qué falta                                           |
| --- | ----------------------------- | --------- | --------------------------------------------------- |
| 1   | Comunicados autoservicio      | **Hecho** | Que Richard fije precios finales y pruebe un pedido |
| 2   | Niveles y precio fundador     | Siguiente | Decidir precios                                     |
| 3   | Patrocinio de sección/boletín | Pendiente | Depende del boletín (bloque 4)                      |
| 4   | Menciones en guías            | Pendiente | —                                                   |
| 5   | Widget para sitios            | Pendiente | —                                                   |
| 6   | Boletín por WhatsApp          | Pendiente | Proveedor de envío                                  |
| 7   | Radar SaaS                    | Pendiente | —                                                   |
| 8   | Sala de prensa white label    | Pendiente | —                                                   |
| 9   | Acceso premium para IA        | Pendiente | —                                                   |
| 10  | Shorts y audio                | Pendiente | Llaves de voz/render (ver docs/redes-y-video.md)    |
