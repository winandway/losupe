import { defineConfig, devices } from "@playwright/test";

// Prueba de humo de punta a punta contra el worker real (OpenNext + wrangler dev, puerto 8787)
// con la base D1 local ya sembrada (npm run db:local).
//
// El puerto se puede cambiar con E2E_PORT. Hace falta porque en esta máquina conviven varias
// sesiones de trabajo, y si otra ya tiene levantado un servidor en el 8787, `reuseExistingServer`
// correría estas pruebas CONTRA EL SERVIDOR DE OTRO PROYECTO y darían verde o rojo por motivos
// ajenos (17 sep 2026).
const PORT = Number(process.env.E2E_PORT ?? 8787);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    url: `${baseURL}/es`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
