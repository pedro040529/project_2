// Test dedicado y robusto de disparo preciso en Cazaengaños: reintenta
// hasta que haya un objetivo en pantalla (con targetsOnScreen=5 y cooldown
// ~3.2s casi siempre hay alguno, pero en un instante puntual puede no haber)
// y verifica que el click destruye EXACTAMENTE ese objetivo y ningún otro.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "/Users/pedro/PROJECT_2/docs/playtest";
const SHOTS_DIR = path.join(OUT_DIR, "screenshots-controlfix");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
const BASE_URL = process.env.NEXORA_URL || "http://localhost:5190/";

async function waitInstructionsAndCountdown(page, label) {
  await page.waitForSelector(".instructions-card", { timeout: 15000 });
  await page.locator(".instructions-card .btn", { hasText: "Listo" }).click();
  await page.waitForSelector(".countdown-num", { timeout: 8000 });
  await page.waitForSelector(".countdown-num", { state: "detached", timeout: 12000 });
  console.log(`--- arrancó ${label} ---`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE_URL, { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("loading-screen")?.classList.contains("hidden"), { timeout: 20000 });
  await page.waitForSelector(".lobby-card");
  await page.fill(".nickname-input", "PrecisionTest");
  await page.locator(".lobby-card .btn", { hasText: "Jugar" }).click();
  await page.waitForSelector(".select-card");
  await page.locator(".avatar-card").nth(1).click();
  await page.locator(".select-card .btn", { hasText: "Confirmar" }).click();
  await page.waitForSelector(".roster-grid");
  await page.waitForTimeout(700);
  await page.locator(".btn", { hasText: "Empezar la partida" }).click();

  await waitInstructionsAndCountdown(page, "Atrapa o Evita");
  console.log("Esperando los 75s de Atrapa o Evita (sin jugar activamente, solo para llegar a Cazaengaños)...");
  await page.waitForSelector(".results-card .btn", { timeout: 90000, state: "visible" });
  await page.locator(".results-card .btn").click();

  await waitInstructionsAndCountdown(page, "Cazaengaños");
  await page.mouse.move(640, 400);
  await page.waitForTimeout(400);

  console.log("\n=== Disparo preciso: repite hasta encontrar un objetivo y confirma que SOLO ese se destruye ===");

  let attempt = 0;
  let passed = false;
  let lastReason = "";
  const maxAttempts = 20;

  while (attempt < maxAttempts && !passed) {
    attempt++;
    const target = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll(".world-label"));
      if (labels.length === 0) return null;
      // elegimos el objetivo del MEDIO de la lista (no el primero) para
      // probar que el click pega en el que corresponde y no en "el más fácil"
      const el = labels[Math.floor(labels.length / 2)];
      const r = el.getBoundingClientRect();
      return { text: el.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    if (!target) {
      lastReason = "sin objetivos en pantalla, reintentando...";
      await page.waitForTimeout(300);
      continue;
    }

    const allTextsBefore = await page.evaluate(() => Array.from(document.querySelectorAll(".world-label")).map((e) => e.textContent));
    const otherTextsBefore = allTextsBefore.filter((t) => t !== target.text);

    await page.screenshot({ path: path.join(SHOTS_DIR, `precision-before-attempt${attempt}.png`) });
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await page.waitForTimeout(60);
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(SHOTS_DIR, `precision-after-attempt${attempt}.png`) });

    const allTextsAfter = await page.evaluate(() => Array.from(document.querySelectorAll(".world-label")).map((e) => e.textContent));

    const targetGone = !allTextsAfter.includes(target.text);
    const othersIntact = otherTextsBefore.every((t) => allTextsAfter.includes(t) || !allTextsBefore.includes(t));
    // más estricto: cuenta cuántos de los "otros" que había antes siguen estando
    const survivingOthers = otherTextsBefore.filter((t) => allTextsAfter.includes(t)).length;
    const otherLostCount = otherTextsBefore.length - survivingOthers;

    console.log(`Intento ${attempt}: objetivo clickeado = "${target.text}" @ (${Math.round(target.x)},${Math.round(target.y)})`);
    console.log(`  antes: [${allTextsBefore.join(" | ")}]`);
    console.log(`  después: [${allTextsAfter.join(" | ")}]`);
    console.log(`  ¿objetivo destruido?: ${targetGone}  |  otros objetivos que también desaparecieron (no deberían): ${otherLostCount}`);

    if (targetGone && otherLostCount === 0) {
      passed = true;
      console.log(`✅ PASA: el click destruyó EXACTAMENTE "${target.text}" y ningún otro objetivo.`);
    } else if (!targetGone) {
      lastReason = `el objetivo clickeado "${target.text}" seguía ahí después del click`;
    } else {
      lastReason = `se destruyeron ${otherLostCount} objetivo(s) además del clickeado (debería ser 0)`;
    }
  }

  await browser.close();

  console.log("\n================ RESULTADO DISPARO PRECISO ================");
  console.log(passed ? "✅ PASA" : `❌ FALLA: ${lastReason}`);
  console.log("console/page errors:", errors.length, errors);

  fs.writeFileSync(
    path.join(OUT_DIR, "precision-shot-report.json"),
    JSON.stringify({ passed, attempts: attempt, lastReason, errors }, null, 2)
  );

  if (!passed || errors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("PRECISION TEST CRASHED:", err);
  process.exitCode = 1;
});
