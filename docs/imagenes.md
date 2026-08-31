# Las imágenes del diario: en qué orden se elige y por qué

La miniatura decide si alguien lee la nota o pasa de largo. En una portada de celular el pulgar baja
rápido, y lo que lo frena es la imagen, no el titular. Por eso **ninguna nota se publica sin nada en
ese hueco**.

## El orden de la casa

Se prueba en este orden y se para en la primera que salga bien:

1. **Imagen propia generada** (Seedream 4 vía fal.ai, ~$0,03). Es la mejor cuando el tema es una
   idea, un concepto o una escena que no existe fotografiada. Necesita `FAL_KEY`.
2. **Foto real de Pexels**, con crédito visible. Es la que toca cuando el tema **es una cosa real**:
   una persona, un lugar, un edificio, un suceso, un artista, historia. Una foto de verdad da
   credibilidad que un dibujo no da. Necesita `PEXELS_API_KEY`.
3. **Portada dibujada por nosotros.** Siempre funciona, no cuesta nada y no depende de ninguna llave.
   Es la red que impide que quede un hueco vacío.

Los modelos de imagen caros están **bloqueados en código** (`src/lib/robot/model-guard.ts`) y no
corren ni como respaldo. Si el modelo barato falla, se cae a Pexels y luego a la portada dibujada.

## La portada dibujada

Vive en `src/lib/portadas.ts` y se sirve en `/media/portada/<id>.svg`. No es un adorno: **dibuja el
tema**. Lee el titular y elige el símbolo que le corresponde.

| Si el titular habla de…                    | Sale                                 |
| ------------------------------------------ | ------------------------------------ |
| cuentas cerradas, bloqueadas, congeladas   | una tarjeta bancaria tachada en rojo |
| algo prohibido, vetado, rechazado          | el círculo de prohibido              |
| un bulo, una estafa, un desastre, víctimas | el triángulo de alerta               |
| una demanda, una multa, una ley            | una balanza                          |
| algo que se desploma / algo que sube       | la flecha correspondiente            |
| inteligencia artificial, tecnología        | un chip                              |
| dinero, dólar, cripto, bancos              | una moneda                           |
| una lista o un ranking                     | tres renglones numerados             |
| gente, inmigrantes, trabajo                | dos figuras                          |
| aniversarios, «diez años sin…»             | un reloj                             |
| música, artistas                           | dos notas                            |
| tiendas, comercio, vender                  | un carrito                           |

Si el titular no da ninguna pista, sale el símbolo de su sección. Nunca queda vacío.

### Son DOS versiones, y la diferencia importa

- **`/media/portada/<id>.svg`** — 1200×630, con el titular escrito dentro. Es la que **viaja sola**:
  Google, una red social, un enlace pegado en cualquier sitio. Ahí no hay nada más que la acompañe,
  así que tiene que decir de qué va.
- **`/media/portada/<id>-mini.svg`** — solo el símbolo, sin una letra. Es la de las tarjetas del
  sitio, donde la imagen se pinta a unos 140 píxeles **con el titular al lado**. Ahí el texto de
  dentro no se lee y encima compite con el de fuera.

Se probó con las dos y se ve en pantalla: meter el titular en la miniatura ensucia la tarjeta.

## Compartir por WhatsApp: hace falta PNG

**WhatsApp, Facebook y X no pintan SVG** en la vista previa de un enlace. Una nota sin foto se
compartía como un renglón de texto gris que nadie toca — y por WhatsApp es justo por donde llega la
gente.

Por eso hay una tarjeta **PNG por sección** en `public/og/`, con su color y su símbolo. Se generan
una sola vez con:

```bash
node scripts/generar-og.mjs
```

Usa Playwright, que ya está instalado para las pruebas: no añade ninguna dependencia. Solo hay que
volver a correrlo si se cambia el diseño o se añade una sección.

## Qué comprobar si algo se ve mal

1. Abre `https://losupe.com/es/economia` en el celular. Ninguna tarjeta puede tener un hueco vacío.
2. Abre la portada suelta: `https://losupe.com/media/portada/<id>.svg`. Tiene que verse el símbolo,
   el titular entero (sin salirse por la derecha) y la marca.
3. Pega el enlace de una nota en WhatsApp. Tiene que salir un recuadro con imagen.

## Qué NO tocar

- El símbolo se elige del titular, y **lo específico gana a lo genérico**: una nota de cuentas
  cerradas saca la tarjeta tachada, no la moneda de economía. Si se invierte ese orden, todas las
  portadas de una sección salen iguales y dejan de contar nada.
- El titular se parte **midiendo el ancho real**, no contando letras: «mmm» ocupa el triple que
  «lil». Contando letras se sale de la imagen (pasó a la primera).
- La miniatura **no lleva texto dibujado**. El titular sí va en el `aria-label`, y ahí se queda: es
  lo que lee alguien con lector de pantalla.
- El Open Graph apunta a **PNG**, nunca al SVG.
