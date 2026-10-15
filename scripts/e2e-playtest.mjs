// Playtest automatizado de una partida completa de NEXORA con Playwright.
// Objetivo: jugar de verdad (no solo cargar la página), capturar screenshots
// de cada pantalla clave, grabar video, y verificar en consola que no haya
// errores y que el puntaje/ranking se comporten como se espera.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "/Users/pedro/PROJECT_2/docs/playtest";
const SHOTS_DIR = path.join(OUT_DIR, "screenshots");
const VIDEO_DIR = path.join(OUT_DIR, "video");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const BASE_URL = process.env.NEXORA_URL || "http://localhost:5190/";
const consoleErrors = [];
const pageErrors = [];
let shotIndex = 0;

async function shot(page, name) {
  shotIndex++;
  const file = path.join(SHOTS_DIR, `${String(shotIndex).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("shot:", file);
}

async function waitText(page, selector, timeout = 15000) {
  await page.waitForSelector(selector, { timeout });
}

async function jitterMoveAndKeys(page, ms, opts = {}) {
  const { moveMouse = true, keys = ["KeyW"] } = opts;
  const end = Date.now() + ms;
  let dir = 0;
  while (Date.now() < end) {
    if (moveMouse) {
      await page.mouse.move(640 + Math.sin(Date.now() / 500) * 120, 400 + Math.cos(Date.now() / 700) * 60);
    }
    const key = keys[dir % keys.length];
    await page.keyboard.down(key);
    await page.waitForTimeout(250);
    await page.keyboard.up(key);
    dir++;
    await page.waitForTimeout(80);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
    permissions: []
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  console.log("Navegando a", BASE_URL);
  await page.goto(BASE_URL, { waitUntil: "load" });

  await page.waitForFunction(() => document.getElementById("loading-screen")?.classList.contains("hidden"), { timeout: 20000 });
  await shot(page, "lobby");

  // --- Lobby ---
  await page.fill(".nickname-input", "TestNiña13");
  const reduceChip = page.locator(".toggle-chip", { hasText: "Alto contraste" });
  await reduceChip.click(); // probamos también el toggle de accesibilidad
  await shot(page, "lobby-filled");
  await page.locator(".lobby-card .btn", { hasText: "Jugar" }).click();

  // --- Character select ---
  await waitText(page, ".select-card");
  await shot(page, "character-select");
  await page.locator(".avatar-card").nth(1).click();
  await page.locator(".select-card .btn", { hasText: "Confirmar" }).click();

  // --- Roster intro ---
  await waitText(page, ".roster-grid");
  await shot(page, "roster-intro");
  await page.locator(".btn", { hasText: "Empezar la partida" }).click();

  async function playInstructionsAndCountdown(label) {
    await waitText(page, ".instructions-card");
    await shot(page, `instructions-${label}`);
    await page.locator(".instructions-card .btn", { hasText: "Listo" }).click();
    await page.waitForSelector(".countdown-num", { timeout: 8000 });
    await shot(page, `countdown-${label}`);
    await page.waitForSelector(".countdown-num", { state: "detached", timeout: 8000 });
  }

  async function waitResultsAndContinue(label, buttonTextIncludes) {
    await page.waitForSelector(".results-card .btn", { timeout: 20000, state: "visible" });
    await shot(page, `results-${label}`);
    const btn = page.locator(".results-card .btn");
    const text = (await btn.textContent()) ?? "";
    console.log(`results button text (${label}):`, text);
    await btn.click();
    void buttonTextIncludes;
  }

  // click en el canvas para activar pointer lock antes de cada minijuego
  async function clickCanvas() {
    await page.mouse.click(640, 400);
    await page.waitForTimeout(150);
  }

  // === Minijuego 1: Atrapa o Evita ===
  await playInstructionsAndCountdown("atrapa");
  await clickCanvas();
  await shot(page, "gameplay-atrapa-start");
  await jitterMoveAndKeys(page, 8000, { keys: ["KeyW", "KeyD", "KeyA", "KeyS"] });
  await shot(page, "gameplay-atrapa-mid");
  // dejamos correr el resto del tiempo (75s totales) moviendo cada tanto
  await jitterMoveAndKeys(page, 60000, { keys: ["KeyW", "KeyA", "KeyD"] });
  await jitterMoveAndKeys(page, 10000, { keys: ["KeyS", "KeyD"] });
  await waitResultsAndContinue("atrapa");

  // === Minijuego 2: Cazaengaños ===
  await playInstructionsAndCountdown("cazaenganos");
  await clickCanvas();
  await shot(page, "gameplay-cazaenganos-start");
  const shootEnd = Date.now() + 78000;
  let n = 0;
  while (Date.now() < shootEnd) {
    await page.mouse.move(500 + (n % 5) * 60, 350 + ((n * 37) % 140));
    await page.mouse.click(500 + (n % 5) * 60, 350 + ((n * 37) % 140));
    if (n % 6 === 0) {
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(200);
      await page.keyboard.up("KeyW");
    }
    n++;
    if (n === 10) await shot(page, "gameplay-cazaenganos-mid");
    await page.waitForTimeout(650);
  }
  await waitResultsAndContinue("cazaenganos");

  // === Minijuego 3: Bajo Presión ===
  await playInstructionsAndCountdown("bajopresion");
  await clickCanvas();
  await shot(page, "gameplay-bajopresion-start");
  const pressureEnd = Date.now() + 78000;
  let m = 0;
  while (Date.now() < pressureEnd) {
    const digit = ["Digit1", "Digit2", "Digit3"][m % 3];
    await page.keyboard.press(digit);
    await page.waitForTimeout(900);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1400);
    m++;
    if (m === 4) await shot(page, "gameplay-bajopresion-mid");
  }
  await waitResultsAndContinue("bajopresion");

  // === Final ===
  await page.waitForSelector(".results-card .btn", { timeout: 15000 });
  await shot(page, "final-ranking");
  await page.locator(".results-card .btn").click();

  await page.waitForSelector(".summary-card", { timeout: 15000 });
  await shot(page, "match-summary");

  const summaryText = await page.locator(".summary-card").innerText();
  console.log("--- RESUMEN FINAL ---");
  console.log(summaryText);

  await context.close();
  await browser.close();

  const report = {
    consoleErrors,
    pageErrors,
    summaryText
  };
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  console.log("console errors:", consoleErrors.length);
  console.log("page errors:", pageErrors.length);
  if (consoleErrors.length || pageErrors.length) {
    console.log(JSON.stringify({ consoleErrors, pageErrors }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("PLAYTEST FAILED:", err);
  process.exitCode = 1;
});
