// Smoke test rápido del BUILD de producción: carga, espera a que desaparezca
// la pantalla de carga, llega al lobby, y confirma que no hay errores de
// consola. No juega la partida completa (eso ya se valida contra dev server).
import { chromium } from "playwright";

const url = process.env.NEXORA_URL || "http://localhost:4199/";
const errors = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loading-screen")?.classList.contains("hidden"), { timeout: 20000 });
await page.waitForSelector(".lobby-card", { timeout: 10000 });
await page.screenshot({ path: "/Users/pedro/PROJECT_2/docs/playtest/screenshots/00-build-smoke-lobby.png" });

// probamos también selección de personaje para asegurarnos que los assets (texturas) cargan bien en el build
await page.fill(".nickname-input", "Smoke");
await page.locator(".lobby-card .btn", { hasText: "Jugar" }).click();
await page.waitForSelector(".select-card", { timeout: 10000 });
await page.locator(".select-card .btn", { hasText: "Confirmar" }).click();
await page.waitForSelector(".roster-grid", { timeout: 10000 });
await page.screenshot({ path: "/Users/pedro/PROJECT_2/docs/playtest/screenshots/00-build-smoke-roster.png" });

console.log("console errors:", errors.length, errors);
console.log("page errors:", pageErrors.length, pageErrors);

await browser.close();
if (errors.length || pageErrors.length) process.exitCode = 1;
