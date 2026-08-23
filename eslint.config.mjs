import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import pluginSecurity from "eslint-plugin-security";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  pluginSecurity.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      // Servimos imágenes con <img> a propósito: en Workers no hay optimizador de next/image.
      "@next/next/no-img-element": "off",
      // Las rutas de archivos vienen de constantes del repo, no de entrada del usuario.
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-object-injection": "off",
      // worker.ts importa ./.open-next/worker.js, que solo existe después del build.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description", minimumDescriptionLength: 10 },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "cloudflare-env.d.ts",
    ".open-next/**",
    ".dist-worker/**",
    ".wrangler/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "public/**",
    "src/lib/schema-sql.ts",
    "src/lib/seed-content.ts",
    "seed/**",
  ]),
]);

export default eslintConfig;
