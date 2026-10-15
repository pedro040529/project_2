// Verifica visualmente los pedidos del último feedback: lobby más vistoso
// (vitrina 3D), sin toggles de accesibilidad, blaster + balas en
// Cazaengaños, objetivos separados, ritmo de NPC más lento, y una partida
// completa sin errores.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "/Users/pedro/PROJECT_2/docs/playtest";
const SHOTS_DIR = path.join(OUT_DIR, "screenshots-feedback");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
const BASE_URL = process.env.NEXORA_URL || "http://localhost:5191/";
const errors = [];
const pageErrors = [];

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
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(BASE_URL, { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("loading-screen")?.classList.contains("hidden"), { timeout: 20000 });
  await page.waitForSelector(".lobby-card");
  await page.waitForTimeout(1200); // deja terminar animaciones de entrada + ver la vitrina 3D girando
  await page.screenshot({ path: path.join(SHOTS_DIR, "01-lobby-new.png") });

  // confirma que los toggles de accesibilidad ya NO están
  const toggleCount = await page.locator(".toggle-chip").count();
  console.log("toggle-chip visibles en lobby (debe ser 0):", toggleCount);

  await page.fill(".nickname-input", "Feedback");
  // el botón "Jugar" tiene una animación de pulso infinita (a propósito, para
  // llamar la atención) — Playwright nunca lo ve "estable", así que forzamos el click.
  await page.locator(".lobby-card .btn", { hasText: "Jugar" }).click({ force: true });
  await page.waitForSelector(".select-card");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS_DIR, "02-select-new.png") });
  await page.locator(".avatar-card").nth(0).click();
  await page.locator(".select-card .btn", { hasText: "Confirmar" }).click();
  await page.waitForSelector(".roster-grid");
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS_DIR, "03-roster-new.png") });
  await page.locator(".btn", { hasText: "Empezar la partida" }).click();

  await waitInstructionsAndCountdown(page, "Atrapa o Evita");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS_DIR, "04-atrapa-anim.png") });

  // dejamos correr Atrapa o Evita completo, moviendo un poco
  const end1 = Date.now() + 74000;
  let n = 0;
  while (Date.now() < end1) {
    const k = ["KeyW", "KeyA", "KeyD", "KeyS"][n % 4];
    await page.keyboard.down(k);
    await page.waitForTimeout(280);
    await page.keyboard.up(k);
    n++;
  }
  await page.waitForSelector(".results-card .btn", { timeout: 20000, state: "visible" });
  await page.locator(".results-card .btn").click();

  await waitInstructionsAndCountdown(page, "Cazaengaños");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOTS_DIR, "05-cazaenganos-guns.png") });

  // capturamos posiciones de los objetivos para verificar separación
  const targetPositions = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".world-label")).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent };
    });
  });
  console.log("objetivos en pantalla:", targetPositions.length);
  let minDist = Infinity;
  for (let i = 0; i < targetPositions.length; i++) {
    for (let j = i + 1; j < targetPositions.length; j++) {
      const d = Math.hypot(targetPositions[i].x - targetPositions[j].x, targetPositions[i].y - targetPositions[j].y);
      minDist = Math.min(minDist, d);
    }
  }
  console.log("distancia mínima en pantalla entre objetivos (px):", minDist.toFixed(0));

  // medimos cuánto tarda un NPC en disparar desde que aparece un objetivo (ritmo más humano)
  const t0 = Date.now();
  const initialCount = targetPositions.length;
  let firstChangeMs = null;
  while (Date.now() - t0 < 6000) {
    const count = await page.evaluate(() => document.querySelectorAll(".world-label").length);
    if (count !== initialCount) {
      firstChangeMs = Date.now() - t0;
      break;
    }
    await page.waitForTimeout(100);
  }
  console.log("ms hasta el primer cambio de objetivos (referencia de ritmo NPC):", firstChangeMs);

  // dejamos correr el resto disparando con el cursor visible
  const end2 = Date.now() + 74000;
  while (Date.now() < end2) {
    const targets = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".world-label")).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })
    );
    if (targets.length > 0) {
      const t = targets[Math.floor(Math.random() * targets.length)];
      await page.mouse.move(t.x, t.y, { steps: 3 });
      await page.mouse.click(t.x, t.y);
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(SHOTS_DIR, "06-cazaenganos-tracer.png") });
  await page.waitForSelector(".results-card .btn", { timeout: 20000, state: "visible" });
  await page.locator(".results-card .btn").click();

  await waitInstructionsAndCountdown(page, "Bajo Presión");
  const end3 = Date.now() + 74000;
  let tick = 0;
  while (Date.now() < end3) {
    await page.keyboard.press(["Digit1", "Digit2", "Digit3"][tick % 3]);
    await page.waitForTimeout(800);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1200);
    tick++;
  }
  await page.waitForSelector(".results-card .btn", { timeout: 20000, state: "visible" });
  await page.locator(".results-card .btn").click();

  await page.waitForSelector(".results-card .btn", { timeout: 15000 });
  await page.screenshot({ path: path.join(SHOTS_DIR, "07-final-ranking.png") });
  const finalText = await page.locator(".results-card").innerText();
  await page.locator(".results-card .btn").click();
  await page.waitForSelector(".summary-card", { timeout: 15000 });
  const summaryText = await page.locator(".summary-card").innerText();

  await browser.close();

  console.log("\n--- RANKING FINAL ---\n", finalText);
  console.log("\n--- RESUMEN ---\n", summaryText);
  console.log("\nconsole errors:", errors.length, errors);
  console.log("page errors:", pageErrors.length, pageErrors);

  fs.writeFileSync(
    path.join(OUT_DIR, "feedback-report.json"),
    JSON.stringify({ toggleCount, targetPositions, minDist, firstChangeMs, errors, pageErrors, finalText, summaryText }, null, 2)
  );

  if (errors.length || pageErrors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("FEEDBACK VERIFICATION CRASHED:", err);
  process.exitCode = 1;
});
