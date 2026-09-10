/**
 * Genera la versión pequeña (`-sm`) de las imágenes locales de las notas, en `public/img/notas/`.
 *
 * ¿Por qué hace falta? Porque una tarjeta de la portada se pinta a unos 142 píxeles de ancho en el
 * celular, y servir ahí la imagen de 1400 px es descargar treinta veces lo necesario (es el
 * candado 35). El robot ya guarda las dos tallas de sus fotos en R2; las imágenes que sembramos a
 * mano no pasaban por ahí y se quedaban sin miniatura.
 *
 * Se corre a mano cuando se añaden imágenes nuevas:  node scripts/generar-miniaturas.mjs
 * Es idempotente: la que ya existe y está al día no se vuelve a generar.
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const RAIZ = "public/img/notas";
const ANCHO = 640; // el mismo que usa el robot para sus miniaturas (ANCHO_TARJETA)

async function* imagenes(dir) {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) yield* imagenes(ruta);
    else if (/\.(jpg|jpeg|png|webp)$/i.test(entrada.name) && !/-sm\.[a-z]+$/i.test(entrada.name)) {
      yield ruta;
    }
  }
}

/** Las que quedan con miniatura, para que el código sepa cuáles puede pedir sin arriesgar un 404. */
const conMiniatura = [];
let hechas = 0;
let saltadas = 0;
for await (const original of imagenes(RAIZ)) {
  const pequena = original.replace(/\.(jpg|jpeg|png|webp)$/i, "-sm.$1");
  const alDia = await stat(pequena)
    .then(async (s) => s.mtimeMs >= (await stat(original)).mtimeMs)
    .catch(() => false);
  conMiniatura.push(`/${original.replace(/^public\//, "")}`);
  if (alDia) {
    saltadas += 1;
    continue;
  }
  const meta = await sharp(original).metadata();
  // Si ya es pequeña, se copia tal cual: agrandarla sería peor que dejarla.
  await sharp(original)
    .resize({ width: Math.min(ANCHO, meta.width ?? ANCHO), withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(pequena);
  hechas += 1;
  console.log(`✓ ${pequena}`);
}
// La lista se escribe en código, no se adivina en tiempo de ejecución: en el worker no hay disco
// que consultar, y una lista escrita a mano se desactualiza al primer descuido.
const destino = "src/lib/miniaturas-locales.ts";
await writeFile(
  destino,
  `// GENERADO POR scripts/generar-miniaturas.mjs — no editar a mano.
//
// Las imágenes locales que TIENEN su versión \`-sm\`. El código consulta esta lista antes de pedir
// una miniatura: en el worker no hay disco que mirar, y pedir una que no existe deja la tarjeta de
// la portada rota (fue el fallo del 10 sep 2026). Se regenera con \`npm run miniaturas\`.
export const CON_MINIATURA: ReadonlySet<string> = new Set(${JSON.stringify(conMiniatura.sort(), null, 2)});
`,
);
console.log(`\n${hechas} miniaturas generadas, ${saltadas} ya estaban al día.`);
console.log(`✓ ${destino} (${conMiniatura.length} imágenes con miniatura)`);
