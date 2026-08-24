# Plan editorial de losupe.com — cómo funciona el diario (23 ago 2026)

> Responde a la pregunta de Richard: cuántas notas salen, de qué, de dónde salen las tendencias y
> cómo funciona todo. También dice en qué punto del plan de arranque estamos. Versión en PDF
> horizontal: `plan-editorial-2026-08-23.pdf`.

## 1. Dónde estamos en el plan de arranque (4 bloques)

| Bloque                       | Qué era                                                                 | Estado                                                                                |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Cimientos y portal        | Sitio bilingüe, base, noticias heredadas, buscador, diseño              | **Hecho** (22–23 ago).                                                                |
| 2. Robot redactor + encargos | Fuentes, redacción ES/EN, imágenes, revisión, panel, notas patrocinadas | **Hecho en código y en producción**; en **fase de prueba** con las llaves ya puestas. |
| 3. Google y posicionamiento  | Search Console, Publisher Center, autores (E-E-A-T), velocidad          | **Siguiente**, en cuanto salgan las primeras notas revisadas.                         |
| 4. Suscriptores y boletín    | Registro, confirmación, boletín cada 4 días                             | Después del 3.                                                                        |

## 2. Cuántas notas y de qué (propuesta en marcha)

- **3 notas al día**, una por franja, en hora del Este de EE. UU. Cupo por sección: **Economía 2 ·
  Ventas y motivación 1 · Tecnología e IA 1 · Cripto 1 · Artistas y tendencias 1**. Cada nota sale
  en español e inglés.

### A qué hora sale cada una (y por qué)

| Franja       | Hora del Este | Por qué                                                                      |
| ------------ | ------------- | ---------------------------------------------------------------------------- |
| **Mañana**   | 7:00          | El 56 % de los lectores mira noticias antes de las 8, y otra vez a las 9     |
| **Mediodía** | 12:00         | Pico del almuerzo, uno de los tres picos claros de un sitio de noticias      |
| **Tarde**    | 17:00         | Salida del trabajo, justo antes del rato de más tráfico de internet (7–9 PM) |

Cada franja aguanta 3 horas: si a las 7 en punto no entra nadie al sitio, la nota sale con la
primera visita de la mañana. Pasada la ventana, ese turno se pierde — a propósito, para que no se
junten dos notas seguidas ni salga nada de madrugada.

**Una firma por franja.** Las tres notas del día las escriben tres personas distintas: quien ya
firmó hoy pasa al final de la cola. Que una sola persona firme tres notas en un día no se lo cree
nadie.

Fuentes de los horarios: [Pew Research](https://www.pewresearch.org/journalism/2016/05/05/3-users-spend-more-time-with-content-in-the-morning-or-late-at-night/),
[Public Radio Biz Lab](https://bizlab.wbur.org/2020/01/what-your-time-of-day-traffic-patterns-reveal-about-your-site/)
y [Sprout Social 2026](https://sproutsocial.com/insights/best-times-to-post-on-social-media/).

- **Mitad duraderas, mitad de actualidad** al arranque (50/50). Las duraderas son guías («cómo…»,
  «5 consejos…», «qué significa…», comparativas, preguntas frecuentes) que siguen trayendo visitas
  dentro de un año; las de actualidad son noticias y tendencias del día para Google News, Discover y
  las IA que leen la web. Se ajusta desde el panel (Inicio → Ajustes → «Porcentaje de notas
  duraderas»).
- **Por qué 6 y no 30:** Google castiga desde 2024 el «contenido a escala» sin revisión humana y
  premia la experiencia real del autor (E-E-A-T). Seis notas revisadas y firmadas por Magaly valen
  más que treinta sin mirar. Cuando Search Console muestre que indexa y posiciona bien (30 días),
  subimos a 10 y luego a 12–15.
- **Encargos (patrocinados):** entran en el mismo cupo, alternando con las universales. Si un mes hay
  muchos encargos, se sube el cupo diario para que las universales no se apaguen (la publicidad nunca
  debe superar al contenido, regla de Google News).

## 3. De dónde salen los temas (tendencias y fuentes)

1. **Google Trends** (RSS público de «lo más buscado hoy» en EE. UU., en español y en inglés): el
   robot lo lee en cada corrida, **descarta** deportes, apuestas y sucesos, **clasifica** cada
   tendencia en una sección (economía, ventas, tecnología e IA, cripto, artistas) y toma el artículo
   de la **fuente más confiable** que explica esa tendencia (Reuters antes que un blog). Estas entran
   con puntaje alto: es lo que la gente está buscando hoy.
2. **Bing Noticias por tema** (RSS sin llave): economía, emprendimiento, IA, artistas; trae medios
   mezclados y el robot prefiere los de confianza.
3. **RSS de medios** de cada sección: CoinDesk, Cointelegraph ES, The Verge, Google AI blog,
   Entrepreneur, Billboard… (se administran en Panel → Fuentes).
4. **Brave News** (con la llave `BRAVE_API_KEY`): búsqueda de noticias por palabras clave para
   ampliar material cuando una tendencia lo necesite.
5. **Lista de medios de confianza** (`src/lib/robot/trusted-sources.ts`): The New York Times, The
   Wall Street Journal, Reuters, AP, Bloomberg, CNBC, BBC, El País, la Reserva Federal, el IRS…
   Cuando una noticia sale en treinta sitios, el robot se apoya en uno de estos y **lo nombra**.

## 4. Cómo se escribe cada nota

- **Voz humana**: cálida, cercana, relajada, sin frialdad corporativa ni grandilocuencia. Tono
  «pensar en grande con los pies en la tierra». Español neutro de EE. UU.; el inglés se escribe de
  nuevo, nativo.
- **Fuente siempre nombrada en la frase**: «según The New York Times», «como reportó Reuters», con
  enlace. El titular y el enfoque son nuestros; la información viene de donde la leímos y se dice.
  Nada inventado; cifras atribuidas. En los encargos la fuente es la empresa y nosotros («según
  Mercatren», «la compañía explica en su sitio»).
- **Originalidad comprobada**: el sistema rechaza borradores que copien fragmentos de las fuentes.
- **Firma**: Magaly Molina (editora). Cada nota tiene que estar a la altura de su firma; por eso al
  arranque **todo pasa por revisión** en el panel antes de publicarse.
- **Imagen y video**: foto de archivo de Pexels (gratis, con crédito) o Seedream 4 si se activa
  fal.ai; **video corto de Pexels** solo cuando suma (guías, lugares, productos, música), nunca en
  temas delicados. Va después del primer párrafo con su crédito.
- **Qué NO hace**: deportes y apuestas, sucesos violentos, salud/medicina como consejo, política
  partidista. Si un tema no cabe en las cinco secciones, no entra.

## 5. Los temas que más venden y no se vencen (para las guías duraderas)

De lo que más busca la gente en EE. UU. (finanzas personales, IA, compras/negocio, entretenimiento)
y de lo que encaja con losupe, estas son las **series fijas** que el robot prioriza cuando le toca
una guía:

| Sección               | Series duraderas (ejemplos de titulares)                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Economía              | «Cómo declarar impuestos si trabajas por tu cuenta», «Qué significa la tasa de la Fed para tu tarjeta», «Cómo enviar remesas pagando menos», «Seguro Social: qué cambia este año» |
| Ventas y motivación   | «5 maneras de vender en línea sin bodega», «Cómo fijar precios sin perder clientes», «Ingresos extra realistas en 2026», «Qué aprender de [empresa] para tu negocio»              |
| Tecnología e IA       | «Cómo usar ChatGPT/Gemini/Claude para [tarea]», «Las mejores herramientas de IA gratis para…», «Qué es [término] explicado en claro», «Cómo proteger tus cuentas»                 |
| Cripto                | «Cómo comprar bitcoin paso a paso», «Qué es una stablecoin», «Impuestos cripto en EE. UU.», «Errores de principiante con billeteras»                                              |
| Artistas y tendencias | «Quién es [artista] y por qué todos lo buscan», «Los estrenos del mes», «Cómo funciona la música en streaming», «Lo más buscado de la semana, explicado»                          |

## 6. Ritmo de crecimiento

| Fase         | Cuándo     | Qué                                                                                                   |
| ------------ | ---------- | ----------------------------------------------------------------------------------------------------- |
| 1. Prueba    | Ahora      | Richard corre las primeras notas, las lee y publica a mano. Ajustamos tono y fuentes.                 |
| 2. Rodaje    | Semana 1–4 | 6/día, revisión manual; Search Console y Publisher Center; foto y bio de Magaly; medir qué se indexa. |
| 3. Velocidad | Mes 2      | Subir a 10/día; publicación automática para universales con revisión por muestreo; encargos activos.  |
| 4. Escala    | Mes 3+     | 12–15/día, boletín cada 4 días, más fuentes y series.                                                 |

## 7. Qué hace falta de Richard (en orden)

1. Probar las primeras notas (panel) y decirme qué tono/qué temas ajustar.
2. Confirmar los números de arriba (6/día, 50/50, cupos por sección) o pedir otros: se cambian en
   Panel → Ajustes y en la base (`sections.notes_per_day`).
3. Para el bloque 3: entrar a Google Search Console con su cuenta, agregar `losupe.com` y pasarme el
   código de verificación (método «etiqueta HTML»); lo mismo en Bing Webmaster; foto y bio de Magaly.
4. Lista real de patrocinadores (nombre, sitio, notas contratadas, ideas) para encolar.
