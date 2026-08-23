/**
 * Carga un archivo .sql (una sentencia por línea) en la base D1 del sitio en YaDominios Cloud
 * usando la API HTTP del panel. Se usa UNA vez para subir las noticias heredadas.
 *
 *   YADOMINIOS_SITE=losupe YADOMINIOS_SITE_TOKEN=<token> npx tsx scripts/db-remote-import.ts seed/legacy-mundoscrypto.sql
 *
 * El token sale del panel (tarjeta del sitio → "Ver token"). Nunca se guarda en el repo.
 * Documentación: https://yadominios.com/docs/publicar-en-yadominios-cloud
 */
import { readFileSync } from "node:fs";

const ENDPOINT = "https://yapanel.yadominios.com/api/hosting/db/query";

const file = process.argv[2];
const sitio = process.env.YADOMINIOS_SITE;
const token = process.env.YADOMINIOS_SITE_TOKEN;
if (!file || !sitio || !token) {
  console.error(
    "Uso: YADOMINIOS_SITE=<sitio> YADOMINIOS_SITE_TOKEN=<token> tsx scripts/db-remote-import.ts <archivo.sql>",
  );
  process.exit(1);
}

const statements = readFileSync(file, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("--"));

let ok = 0;
let failed = 0;
for (const [i, sql] of statements.entries()) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sitio, token, sql, params: [] }),
  });
  if (res.ok) {
    ok++;
  } else {
    failed++;
    console.error(`✗ sentencia ${i + 1}: HTTP ${res.status} ${await res.text()}`);
    if (res.status === 401) {
      console.error("Token inválido o vencido: genera uno nuevo en el panel.");
      process.exit(1);
    }
  }
  if ((i + 1) % 10 === 0) console.log(`… ${i + 1}/${statements.length}`);
}
console.log(`✓ ${ok} sentencias aplicadas, ${failed} con error`);
process.exit(failed > 0 ? 2 : 0);
