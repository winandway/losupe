#!/usr/bin/env bash
# Prepara la base D1 LOCAL (miniflare) con el esquema y los datos de MundosCrypto.
# No toca nada remoto. Se usa para `next dev`, `npm run preview` y las pruebas de humo.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ esquema"
npx wrangler d1 execute losupe --local --file=schema.sql >/dev/null

if [ -f seed/legacy-mundoscrypto.sql ]; then
  echo "→ noticias heredadas de MundosCrypto"
  npx wrangler d1 execute losupe --local --file=seed/legacy-mundoscrypto.sql >/dev/null
fi

npx wrangler d1 execute losupe --local --command "SELECT (SELECT COUNT(*) FROM articles) AS articulos, (SELECT COUNT(*) FROM authors) AS autores, (SELECT COUNT(*) FROM sections) AS secciones" --json | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d)[0].results[0];console.log(`✓ base local lista: ${r.articulos} artículos, ${r.autores} autores, ${r.secciones} secciones`)})'
