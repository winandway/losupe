import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".open-next", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "src/i18n/**", "src/components/**", "src/env.ts"],
      exclude: [
        "src/lib/db.ts",
        "src/lib/schema-sql.ts",
        "src/lib/seed-content.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
      ],
      // Umbral mínimo. Solo sube, nunca baja.
      thresholds: {
        lines: 76,
        statements: 74,
        functions: 73,
        branches: 64,
        // Y AL 90 % TODO LO QUE TOCA DINERO, DATOS PERSONALES O LA PUERTA. La regla de la casa
        // manda esto y aquí se hace cumplir: quien toque uno de estos archivos sin su prueba,
        // rompe el build. No es una recomendación escrita en un documento, es un semáforo.
        "src/lib/orders.ts": { lines: 90, statements: 90 },
        "src/lib/subscribers.ts": { lines: 90, statements: 90 },
        "src/lib/lectores.ts": { lines: 90, statements: 90 },
        "src/lib/trafico.ts": { lines: 90, statements: 90 },
        "src/lib/anti-bots.ts": { lines: 90, statements: 90 },
        "src/lib/patrocinio.ts": { lines: 90, statements: 90 },
        "src/lib/robot/budget.ts": { lines: 90, statements: 90 },
        "src/lib/robot/model-guard.ts": { lines: 90, statements: 90 },
      },
    },
  },
});
