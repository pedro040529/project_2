// Competencia completa automatizada contra el build (npm run build && vite preview --port 4199).
// Recorre: menú → ajustes → personalización → presentación → 3 desafíos con resultados → ranking final
// → volver al menú → segunda competencia (verifica que apariencia y reinicio de puntajes funcionen).
// Usa ?ts=0.12 para acortar las rondas. Capturas en docs/playtest/redesign/.
import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";

const BASE = (process.env.NEXORA_URL || "http://localhost:4199/") + "?ts=0.12&q=low";
const out = new URL("../docs/playtest/redesign/", import.meta.url);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: new URL(n + ".png", out).pathname });
const results = { checks: {}, rounds: [] };
const num = (t) => Number(String(t).replace(/[^\d\-−+]/g, "").replace("−", "-"));

async function readTable() {
  return page.locator(".rank-row:not(.rank-head)").evaluateAll((rows) =>
    rows.map((r) => {
      const cells = [...r.querySelectorAll("span")].map((s) => s.textContent.trim());
      return { rank: cells[0], who: cells[1], cells: cells.slice(2), me: r.classList.contains("me") };
    })
  );
}

async function playRound(index) {
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  await page.locator(".hud-timer").waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await shot(`0${index + 3}-juego`);
  const stats = { humanTurns: 0, explosions: 0, stabilized: 0 };
  let lastText = "";
  let hadOptions = false;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    if (await page.locator(".results-panel .btn.primary").isVisible().catch(() => false)) break;
    if (index === 0) {
      await page.keyboard.down("w");
      await page.waitForTimeout(250);
      await page.keyboard.up("w");
      await page.keyboard.down("d");
      await page.waitForTimeout(250);
      await page.keyboard.up("d");
    } else if (index === 1) {
      await page.mouse.click(640, 360);
      await page.waitForTimeout(400);
    } else {
      const btns = await page.locator(".decision-btn:not([disabled])").count().catch(() => 0);
      if (btns === 3 && !hadOptions) {
        hadOptions = true;
        stats.humanTurns++;
        if (stats.humanTurns === 1) await shot("05-pregunta");
        await page.keyboard.press(String(1 + (stats.humanTurns % 3)));
      }
      if (btns === 0) hadOptions = false;
      const text = (await page.locator(".decision-panel").innerText().catch(() => "")).replace(/\s+/g, " ");
      if (text !== lastText) {
        if (text.includes("explotó")) stats.explosions++;
        if (text.includes("estabilizó")) stats.stabilized++;
        lastText = text;
      }
      await page.waitForTimeout(100);
    }
  }
  await page.locator(".results-panel .btn.primary").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(1800);
  await shot(`0${index + 6}-resultados`);
  const rows = await readTable();
  const labels = await page.locator(".world-label.stage-tag").allInnerTexts();
  results.rounds.push({ ...stats, rows, podiumLabels: labels.filter((l) => /pts/.test(l)) });
  return rows;
}

try {
  await page.goto(BASE);
  await page.locator(".lobby-card").waitFor({ timeout: 40000 });
  await page.waitForTimeout(1500);
  await shot("01-menu");

  // Ajustes reales: el volumen se guarda
  await page.getByRole("button", { name: /Configuración/ }).click();
  await page.locator(".settings-card").waitFor();
  await page.locator(".settings-range").first().fill("0.3");
  await page.locator(".settings-select").selectOption("medium");
  await shot("02-ajustes");
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nexora_settings")));
  assert.equal(saved.volume, 0.3);
  assert.equal(saved.quality, "medium");
  results.checks.settingsPersist = true;

  await page.fill(".nickname-input", "Pedro");
  await page.getByRole("button", { name: /Jugar/ }).click();
  await page.locator(".customize-card").waitFor();
  await page.getByLabel("Rojo", { exact: true }).click();
  await page.getByRole("button", { name: "Gafas" }).click();
  await page.getByRole("button", { name: "Capa" }).click();
  await page.waitForTimeout(1500);
  await shot("03-personalizacion");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByRole("button", { name: "Comenzar competencia" }).waitFor();
  await page.waitForTimeout(3200);
  await shot("04-presentacion");
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("nexora_profile")));
  assert.deepEqual(profile.appearance, { color: "rojo", head: "glasses", extra: "cape" });
  results.checks.appearanceSaved = true;
  const tags = await page.locator(".world-label.stage-tag").allInnerTexts();
  assert(tags.join(" ").includes("Pedro") && tags.join(" ").includes("Nova") && tags.join(" ").includes("Kiro") && tags.join(" ").includes("Pixel"));
  results.checks.rosterShowsFour = true;
  await page.getByRole("button", { name: "Comenzar competencia" }).click();

  let accumulated = new Map();
  for (let r = 0; r < 3; r++) {
    console.log("desafío", r + 1);
    const rows = await playRound(r);
    // consistencia: orden descendente y acumulado = anterior + este desafío
    const scores = rows.map((x) => num(x.cells[0]));
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "tabla ordenada por puntaje");
    for (const row of rows) {
      const name = row.who.replace(" (tú)", "");
      const total = num(row.cells[1]);
      assert.equal(total, (accumulated.get(name) ?? 0) + num(row.cells[0]), `acumulado de ${name}`);
      accumulated.set(name, total);
    }
    // el podio muestra exactamente los mismos puntajes que la tabla
    const labels = results.rounds[r].podiumLabels.join(" | ");
    for (const row of rows) {
      const name = row.who.replace(" (tú)", "");
      assert(labels.includes(`${name} · ${num(row.cells[0])} pts`), `podio: ${name} ${row.cells[0]} → ${labels}`);
    }
    assert(rows.some((x) => x.me), "el jugador humano está resaltado");
    results.checks[`round${r + 1}Consistent`] = true;
    await page.locator(".results-panel .btn.primary").click();
  }

  await page.locator(".final-screen").waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot("09-ranking-final");
  const final = await readTable();
  for (const row of final) {
    const parts = row.cells.slice(0, 3).map(num);
    const total = num(row.cells[3]);
    assert.equal(parts.reduce((a, b) => a + b, 0), total, `suma de ${row.who}`);
    assert.equal(total, accumulated.get(row.who.replace(" (tú)", "")), `total final de ${row.who}`);
  }
  assert.equal(final.length, 4);
  results.final = final;
  results.checks.finalSumsCorrect = true;
  assert((await page.locator(".winner-banner").innerText()).length > 5);

  // volver al menú
  await page.getByRole("button", { name: "Volver al menú" }).click();
  await page.locator(".lobby-card").waitFor({ timeout: 20000 });
  results.checks.backToMenu = true;

  // segunda competencia: la apariencia se conserva y los puntajes parten de cero
  await page.getByRole("button", { name: /Jugar/ }).click();
  await page.locator(".customize-card").waitFor();
  assert.equal(await page.getByLabel("Rojo", { exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("button", { name: "Gafas" }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByRole("button", { name: "Comenzar competencia" }).click();
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  await page.locator(".hud-ranking").waitFor({ timeout: 30000 });
  const scores = (await page.locator(".hud-ranking-row").allInnerTexts()).map((t) => Number(t.trim().split(/\s+/).pop()));
  assert(scores.length === 4);
  results.checks.secondMatchStartsClean = scores.every((s) => Math.abs(s) <= 200);
  results.checks.appearanceKeptAfterMenu = true;
} catch (e) {
  results.failure = String(e);
}
results.errors = errors;
fs.writeFileSync(new URL("report.json", out), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exitCode = results.failure || errors.length ? 1 : 0;
