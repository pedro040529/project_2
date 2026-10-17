// Partida completa automatizada contra el build (npm run build && vite preview --port 4199).
// Recorre los 3 minijuegos, mide la circulación del orbe en Bajo Presión, verifica
// ranking final y que se pueda reiniciar. Capturas en docs/playtest/redesign/.
import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";

const URL_BASE = process.env.NEXORA_URL || "http://localhost:4199/";
const out = new URL("../docs/playtest/redesign/", import.meta.url);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: new URL(n + ".png", out).pathname });
const results = { rounds: {} };

async function startMatch() {
  await page.goto(URL_BASE);
  await page.locator(".lobby-card").waitFor({ timeout: 30000 });
  await page.fill(".nickname-input", "Pedro");
  await page.getByRole("button", { name: /Jugar/ }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByRole("button", { name: "Empezar la partida" }).click();
}

async function playRound(index) {
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  await page.locator(".hud-timer").waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot(`0${index + 1}-juego`);
  const stats = { humanTurns: 0, explosions: 0, feedback: 0 };
  let lastText = "";
  let hadOptions = false;
  const deadline = Date.now() + 420000;
  while (Date.now() < deadline) {
    if (await page.locator(".results-card .btn").isVisible().catch(() => false)) break;
    if (index === 0) {
      await page.keyboard.down("w");
      await page.waitForTimeout(300);
      await page.keyboard.up("w");
      await page.keyboard.down("d");
      await page.waitForTimeout(300);
      await page.keyboard.up("d");
    } else if (index === 1) {
      await page.mouse.click(400, 250);
      await page.waitForTimeout(500);
    } else {
      const panel = page.locator(".decision-panel");
      const text = (await panel.innerText().catch(() => "")).replace(/\s+/g, " ");
      const btns = await page.locator(".decision-btn").count().catch(() => 0);
      if (btns === 3 && !hadOptions) {
        hadOptions = true;
        stats.humanTurns++;
        if (stats.humanTurns === 1) await shot("03-pregunta");
        await page.keyboard.press(String(1 + (stats.humanTurns % 3)));
      }
      if (btns === 0) hadOptions = false;
      if (text !== lastText) {
        if (text.includes("explotó")) stats.explosions++;
        if (text.includes("Buena decisión") || text.includes("Cuidado") || text.includes("segura")) stats.feedback++;
        lastText = text;
      }
      await page.waitForTimeout(120);
    }
  }
  await page.locator(".results-card .btn").waitFor({ state: "visible", timeout: 60000 });
  results.rounds[index] = { ...stats, text: (await page.locator(".results-card").innerText()).slice(0, 200) };
  await shot(`0${index + 4}-resultados`);
  await page.locator(".results-card .btn").click();
}

try {
  await startMatch();
  for (let r = 0; r < 3; r++) {
    console.log("round", r + 1);
    await playRound(r);
  }
  await page.waitForTimeout(1500);
  await shot("07-final");
  results.final = (await page.locator("body").innerText()).slice(0, 400);
  // reinicio
  const again = page.getByRole("button", { name: /otra vez|Jugar de nuevo|Reiniciar|Volver/i }).first();
  for (let i = 0; i < 4 && !(await page.getByRole("button", { name: "Empezar la partida" }).count()); i++) {
    const b = page.locator("button").filter({ hasText: /otra partida|Ver tu resumen|Continuar/i }).first();
    if (await b.count()) await b.click();
    await page.waitForTimeout(800);
  }
  results.restarted = (await page.getByRole("button", { name: "Empezar la partida" }).count()) > 0;
  void again;
} catch (e) {
  results.failure = String(e);
}
results.errors = errors;
fs.writeFileSync(new URL("report.json", out), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exitCode = results.failure || errors.length ? 1 : 0;
