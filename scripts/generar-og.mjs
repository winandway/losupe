/**
 * Genera las tarjetas sociales (PNG) de cada sección, en `public/og/`.
 *
 * ¿Por qué PNG y no el SVG que ya dibujamos? Porque WhatsApp, Facebook y X **no pintan SVG** en la
 * vista previa de un enlace. Sin un PNG, una nota sin foto se comparte sin imagen: un renglón de
 * texto gris que nadie toca. Y compartir por WhatsApp es justo por donde llega la gente.
 *
 * Se generan una sola vez, no en cada visita: son cinco archivos, uno por sección, con su color y
 * su símbolo. El titular no va dentro porque WhatsApp ya lo escribe al lado del recuadro.
 *
 * Se corre a mano cuando cambie el diseño:  node scripts/generar-og.mjs
 * Necesita Playwright, que ya está instalado para las pruebas. No añade ninguna dependencia.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const SECCIONES = [
  { id: "economia", nombre: "Economía", color: "#2EE6A6", onColor: "#0B1F3A", simbolo: "moneda" },
  {
    id: "ventas",
    nombre: "Ventas y motivación",
    color: "#FFD60A",
    onColor: "#0B1F3A",
    simbolo: "tienda",
  },
  {
    id: "tecnologia",
    nombre: "Tecnología e IA",
    color: "#3B82F6",
    onColor: "#FFFFFF",
    simbolo: "chip",
  },
  { id: "cripto", nombre: "Cripto", color: "#FB923C", onColor: "#0B1F3A", simbolo: "moneda" },
  {
    id: "artistas",
    nombre: "Artistas y tendencias",
    color: "#FF5A5F",
    onColor: "#FFFFFF",
    simbolo: "musica",
  },
];

const SIMBOLOS = {
  moneda: `<circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" stroke-width="13"/>
    <line x1="100" y1="42" x2="100" y2="158" stroke="currentColor" stroke-width="11" stroke-linecap="round"/>
    <path d="M126 72H88a19 19 0 000 38h24a19 19 0 010 38H74" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>`,
  tienda: `<path d="M28 76h144l-12 92H40z" fill="none" stroke="currentColor" stroke-width="12" stroke-linejoin="round"/>
    <path d="M72 76V52a28 28 0 0156 0v24" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>`,
  chip: `<rect x="52" y="52" width="96" height="96" rx="12" fill="none" stroke="currentColor" stroke-width="12"/>
    <rect x="82" y="82" width="36" height="36" rx="5" fill="currentColor"/>
    <g stroke="currentColor" stroke-width="11" stroke-linecap="round">
      <line x1="76" y1="52" x2="76" y2="22"/><line x1="124" y1="52" x2="124" y2="22"/>
      <line x1="76" y1="148" x2="76" y2="178"/><line x1="124" y1="148" x2="124" y2="178"/>
      <line x1="52" y1="76" x2="22" y2="76"/><line x1="52" y1="124" x2="22" y2="124"/>
      <line x1="148" y1="76" x2="178" y2="76"/><line x1="148" y1="124" x2="178" y2="124"/>
    </g>`,
  musica: `<circle cx="60" cy="146" r="28" fill="none" stroke="currentColor" stroke-width="12"/>
    <circle cx="150" cy="126" r="24" fill="none" stroke="currentColor" stroke-width="12"/>
    <path d="M88 146V44l86-18v100" fill="none" stroke="currentColor" stroke-width="12" stroke-linejoin="round"/>`,
};

function pagina(s) {
  return `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;background:#FBF9F4;display:flex;align-items:center;font-family:Georgia,serif;position:relative;overflow:hidden">
  <div style="position:absolute;inset:0 auto 0 0;width:470px;background:linear-gradient(135deg,${s.color}4D,${s.color}0F)"></div>
  <div style="position:absolute;left:466px;top:0;bottom:0;width:4px;background:${s.color}"></div>
  <svg width="200" height="200" viewBox="0 0 200 200" style="position:absolute;left:135px;top:215px;color:#0B1F3A">${SIMBOLOS[s.simbolo]}</svg>
  <div style="position:absolute;left:530px;top:0;bottom:0;right:60px;display:flex;flex-direction:column;justify-content:center">
    <div style="display:inline-block;align-self:flex-start;background:${s.color};color:${s.onColor};border-radius:22px;padding:9px 20px;font-family:system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:1.6px">${s.nombre.toUpperCase()}</div>
    <div style="margin-top:26px;font-size:62px;font-weight:700;color:#0B1F3A;line-height:1.12">losupe<span style="color:${s.color}">.</span>com</div>
    <div style="margin-top:16px;font-family:system-ui,sans-serif;font-size:27px;color:#0B1F3A;opacity:.6">Lo que pasa, explicado.</div>
  </div>
</div></body></html>`;
}

const navegador = await chromium.launch();
const pestana = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
await mkdir("public/og", { recursive: true });
for (const s of SECCIONES) {
  await pestana.setContent(pagina(s));
  await writeFile(`public/og/${s.id}.png`, await pestana.screenshot({ type: "png" }));
  console.log(`✓ public/og/${s.id}.png`);
}
await navegador.close();
