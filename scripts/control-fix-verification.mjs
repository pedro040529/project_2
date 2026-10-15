// Verificación exhaustiva del fix de controles (izquierda/derecha invertidos
// + controles sin pointer lock). Produce:
//  - tabla de desplazamiento medido por tecla, en 2 orientaciones de cámara,
//    en los 3 minijuegos donde aplica movimiento (Atrapa o Evita, Cazaengaños,
//    Bajo Presión)
//  - test de diagonales (velocidad constante)
//  - test de disparo preciso (clickear un objetivo puntual y confirmar que
//    fue ESE el destruido)
//  - una partida completa jugada de verdad por el "humano" (sin ningún click
//    de activación de pointer lock), verificando que el puntaje final no sea
//    bajo/negativo por culpa de los controles
//  - capturas antes/después de A y de D
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "/Users/pedro/PROJECT_2/docs/playtest";
const SHOTS_DIR = path.join(OUT_DIR, "screenshots-controlfix");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const BASE_URL = process.env.NEXORA_URL || "http://localhost:5190/";
const results = { directional: [], diagonal: [], shooting: [], errors: [], pageErrors: [] };
let FAIL = false;

function fail(msg) {
  FAIL = true;
  console.error("❌ FALLO:", msg);
}

function ok(msg) {
  console.log("✅", msg);
}

async function screenPos(page, id) {
  return page.evaluate((pid) => window.__nexoraDebug?.getScreenPos(pid) ?? null, id);
}
async function worldPos(page, id) {
  return page.evaluate((pid) => window.__nexoraDebug?.getWorldPos(pid) ?? null, id);
}
async function cameraYaw(page) {
  return page.evaluate(() => window.__nexoraDebug?.getCameraYaw() ?? null);
}

/**
 * OJO: la cámara del juego sigue al personaje cada frame (lookAt inmediato),
 * así que proyectar al humano contra la cámara EN VIVO antes/después de
 * moverse siempre da ~el mismo punto (se re-centra sola) — eso NO mide nada
 * sobre izquierda/derecha, solo confirma que la cámara sigue funcionando.
 * Por eso cada medición CONGELA la cámara (snapshotCamera) al arrancar y
 * proyecta el antes/después contra ESA MISMA cámara fija — así "coordenadas
 * de pantalla" es una medida real y comparable, como pide el test.
 */
async function frozenScreenPos(page, id, token) {
  return page.evaluate(
    ({ pid, tok }) => window.__nexoraDebug?.getScreenPosFrozen(pid, tok) ?? null,
    { pid: id, tok: token }
  );
}
let snapshotCounter = 0;
async function snapshotCamera(page) {
  const token = `snap_${snapshotCounter++}`;
  const okSnap = await page.evaluate((tok) => window.__nexoraDebug?.snapshotCamera(tok) ?? false, token);
  if (!okSnap) throw new Error("No se pudo congelar la cámara para medir (debug hook no listo)");
  return token;
}

/** Mueve el mouse un pelín (delta real no-cero) para resetear el idle-timer
 * del auto-follow de cámara: así la suite direccional prueba una cámara
 * ESTABLE (orientación fija) en vez de que la cámara se reacomode sola a
 * mitad de una medición individual. El auto-follow en sí se prueba aparte. */
async function touchMouse(page) {
  const p = await page.evaluate(() => ({ x: window.__lastMouseX ?? 640, y: window.__lastMouseY ?? 400 }));
  await page.mouse.move(p.x + 3, p.y, { steps: 1 });
  await page.mouse.move(p.x, p.y, { steps: 1 });
  await page.evaluate(({ x, y }) => { window.__lastMouseX = x; window.__lastMouseY = y; }, p);
}

async function pressAndMeasure(page, code, holdMs = 450) {
  await touchMouse(page);
  const token = await snapshotCamera(page); // cámara fija para TODA esta medición
  const before = await frozenScreenPos(page, "human", token);
  const beforeWorld = await worldPos(page, "human");
  await page.keyboard.down(code);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(code);
  await page.waitForTimeout(120); // asentar física (la cámara puede seguir moviéndose, no importa: seguimos proyectando contra la MISMA cámara congelada)
  const after = await frozenScreenPos(page, "human", token);
  const afterWorld = await worldPos(page, "human");
  return {
    dxScreen: after.x - before.x,
    dyScreen: after.y - before.y,
    dWorld: Math.hypot(afterWorld.x - beforeWorld.x, afterWorld.z - beforeWorld.z),
    before,
    after
  };
}

async function rotateCameraBy(page, totalPixels) {
  const steps = 12;
  await page.mouse.move(640, 400);
  for (let i = 0; i < steps; i++) {
    await page.mouse.move(640 + (totalPixels / steps) * (i + 1), 400, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(100);
}

async function directionalSuite(page, minigameLabel, orientationLabel) {
  const SCREEN_THRESH = 8; // px mínimos para considerar "se movió" con claridad
  const cases = [
    { code: "KeyA", axis: "x", sign: -1, desc: "A = izquierda de pantalla (x disminuye)" },
    { code: "ArrowLeft", axis: "x", sign: -1, desc: "← = izquierda de pantalla (x disminuye)" },
    { code: "KeyD", axis: "x", sign: 1, desc: "D = derecha de pantalla (x aumenta)" },
    { code: "ArrowRight", axis: "x", sign: 1, desc: "→ = derecha de pantalla (x aumenta)" },
    { code: "KeyW", axis: "y", sign: -1, desc: "W = arriba en pantalla / se aleja (y disminuye)" },
    { code: "ArrowUp", axis: "y", sign: -1, desc: "↑ = arriba en pantalla / se aleja (y disminuye)" },
    { code: "KeyS", axis: "y", sign: 1, desc: "S = abajo en pantalla / se acerca (y aumenta)" },
    { code: "ArrowDown", axis: "y", sign: 1, desc: "↓ = abajo en pantalla / se acerca (y aumenta)" }
  ];

  for (const c of cases) {
    const m = await pressAndMeasure(page, c.code);
    const delta = c.axis === "x" ? m.dxScreen : m.dyScreen;
    const passed = Math.sign(delta) === c.sign && Math.abs(delta) >= SCREEN_THRESH;
    const row = {
      minigame: minigameLabel,
      orientation: orientationLabel,
      key: c.code,
      esperado: c.desc,
      dxScreenPx: Math.round(m.dxScreen),
      dyScreenPx: Math.round(m.dyScreen),
      worldDist: Number(m.dWorld.toFixed(2)),
      resultado: passed ? "PASA" : "FALLA"
    };
    results.directional.push(row);
    if (passed) ok(`[${minigameLabel}/${orientationLabel}] ${c.code}: ${row.esperado} → dx=${row.dxScreenPx}px dy=${row.dyScreenPx}px`);
    else fail(`[${minigameLabel}/${orientationLabel}] ${c.code}: ${row.esperado} → dx=${row.dxScreenPx}px dy=${row.dyScreenPx}px`);
  }
}

async function diagonalSuite(page, minigameLabel) {
  const straight = await pressAndMeasure(page, "KeyW", 500);
  await touchMouse(page);
  const before = await worldPos(page, "human");
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(120);
  const after = await worldPos(page, "human");
  const diagDist = Math.hypot(after.x - before.x, after.z - before.z);

  const ratio = diagDist / straight.dWorld;
  const withinTolerance = ratio > 0.8 && ratio < 1.25; // normalizado: no debería ser ~1.41x más rápido
  const row = {
    minigame: minigameLabel,
    straightDist: Number(straight.dWorld.toFixed(2)),
    diagonalDist: Number(diagDist.toFixed(2)),
    ratio: Number(ratio.toFixed(2)),
    resultado: withinTolerance ? "PASA" : "FALLA"
  };
  results.diagonal.push(row);
  if (withinTolerance) ok(`[${minigameLabel}] Diagonal W+D normalizada: recto=${row.straightDist} diagonal=${row.diagonalDist} (ratio ${row.ratio})`);
  else fail(`[${minigameLabel}] Diagonal W+D NO normalizada: recto=${row.straightDist} diagonal=${row.diagonalDist} (ratio ${row.ratio}, esperado ~1.0)`);
}

async function waitInstructionsAndCountdown(page, label) {
  await page.waitForSelector(".instructions-card", { timeout: 15000 });
  await page.locator(".instructions-card .btn", { hasText: "Listo" }).click();
  await page.waitForSelector(".countdown-num", { timeout: 8000 });
  await page.waitForSelector(".countdown-num", { state: "detached", timeout: 12000 });
  console.log(`--- arrancó ${label} ---`);
}

async function waitResultsAndContinue(page) {
  await page.waitForSelector(".results-card .btn", { timeout: 20000, state: "visible" });
  const btn = page.locator(".results-card .btn");
  await btn.click();
}

/** IA de "juego real" para Atrapa o Evita: persigue el label más cercano en pantalla usando SOLO WASD. */
async function chaseLabelsFor(page, ms, holdMs = 260) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const human = await screenPos(page, "human");
    if (!human) break;
    const target = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll(".world-label"));
      if (labels.length === 0) return null;
      const rects = labels.map((el) => el.getBoundingClientRect());
      // el más cercano al centro de pantalla (aprox. cerca del jugador)
      let best = rects[0];
      let bestD = Infinity;
      for (const r of rects) {
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(cx - 640, cy - 400);
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }
      return { x: best.left + best.width / 2, y: best.top + best.height / 2 };
    });
    if (!target) {
      await page.waitForTimeout(150);
      continue;
    }
    const dx = target.x - human.x;
    const dy = target.y - human.y;
    const keys = [];
    if (Math.abs(dx) > 25) keys.push(dx > 0 ? "KeyD" : "KeyA");
    if (Math.abs(dy) > 25) keys.push(dy > 0 ? "KeyS" : "KeyW");
    if (keys.length === 0) keys.push("KeyW");
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(holdMs);
    for (const k of keys) await page.keyboard.up(k);
  }
}

/** IA de "juego real" para Cazaengaños: apunta el mouse a un label y dispara. */
async function shootLabelsFor(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const target = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll(".world-label"));
      if (labels.length === 0) return null;
      const r = labels[Math.floor(Math.random() * labels.length)].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: labels[0].textContent };
    });
    if (!target) {
      await page.waitForTimeout(200);
      continue;
    }
    await page.mouse.move(target.x, target.y, { steps: 3 });
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(350);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") results.errors.push(m.text()); });
  page.on("pageerror", (e) => results.pageErrors.push(String(e)));

  await page.goto(BASE_URL, { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("loading-screen")?.classList.contains("hidden"), { timeout: 20000 });
  await page.waitForSelector(".lobby-card");
  await page.fill(".nickname-input", "ControlFix");
  await page.locator(".lobby-card .btn", { hasText: "Jugar" }).click();
  await page.waitForSelector(".select-card");
  await page.locator(".avatar-card").nth(0).click();
  await page.locator(".select-card .btn", { hasText: "Confirmar" }).click();
  await page.waitForSelector(".roster-grid");
  await page.waitForTimeout(700);
  await page.locator(".btn", { hasText: "Empezar la partida" }).click();

  // ===================== MINIJUEGO 1: ATRAPA O EVITA =====================
  await waitInstructionsAndCountdown(page, "Atrapa o Evita");
  await page.waitForTimeout(300);
  // Establece una posición de mouse conocida (Playwright arranca en 0,0):
  // de acá en más, touchMouse() hace jiggles chiquitos relativos a esto.
  await page.mouse.move(640, 400);
  await page.evaluate(() => { window.__lastMouseX = 640; window.__lastMouseY = 400; });
  await page.waitForTimeout(200);

  console.log("\n=== FASE 1: pruebas direccionales — orientación de cámara A (por defecto) ===");
  console.log("(la cámara sigue al personaje y se re-centra cada frame; por eso cada medición se hace contra una cámara CONGELADA en el instante inicial — ver frozenScreenPos)");
  await screenshotBefore(page, "A");
  const tokenA = await snapshotCamera(page);
  const beforeA = await frozenScreenPos(page, "human", tokenA);
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyA");
  await page.waitForTimeout(150);
  const afterA = await frozenScreenPos(page, "human", tokenA);
  await page.screenshot({ path: path.join(SHOTS_DIR, "02-after-A-moved-left.png") });
  console.log(`Captura antes/después de A (cámara congelada): x ${beforeA.x.toFixed(0)} → ${afterA.x.toFixed(0)} (Δ=${(afterA.x - beforeA.x).toFixed(0)}px, debe ser negativo)`);

  await touchMouse(page);
  const tokenD = await snapshotCamera(page);
  const beforeD = await frozenScreenPos(page, "human", tokenD);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(150);
  const afterD = await frozenScreenPos(page, "human", tokenD);
  await page.screenshot({ path: path.join(SHOTS_DIR, "03-after-D-moved-right.png") });
  console.log(`Captura antes/después de D (cámara congelada): x ${beforeD.x.toFixed(0)} → ${afterD.x.toFixed(0)} (Δ=${(afterD.x - beforeD.x).toFixed(0)}px, debe ser positivo)`);
  if (afterA.x - beforeA.x >= 0) fail("A no movió al personaje hacia la izquierda (cámara congelada)");
  else ok("A movió al personaje hacia la izquierda (cámara congelada)");
  if (afterD.x - beforeD.x <= 0) fail("D no movió al personaje hacia la derecha (cámara congelada)");
  else ok("D movió al personaje hacia la derecha (cámara congelada)");

  await directionalSuite(page, "AtrapaOEvita", "orientacionA");
  await diagonalSuite(page, "AtrapaOEvita");

  console.log("\n=== FASE 1b: pruebas direccionales — orientación de cámara B (rotada con el mouse) ===");
  const yawBefore = await cameraYaw(page);
  await rotateCameraBy(page, 420);
  const yawAfter = await cameraYaw(page);
  console.log(`yaw cámara: ${yawBefore?.toFixed(2)} → ${yawAfter?.toFixed(2)} rad (con el mouse SIN pointer lock)`);
  if (Math.abs((yawAfter ?? 0) - (yawBefore ?? 0)) < 0.05) fail("La cámara no giró con el mouse (debería, sin necesitar pointer lock)");
  else ok("La cámara giró con el mouse sin pointer lock");

  await directionalSuite(page, "AtrapaOEvita", "orientacionB");

  console.log("\n=== FASE 1c: el humano juega de verdad el resto de la ronda (persiguiendo recompensas) ===");
  await chaseLabelsFor(page, 62000);

  await waitResultsAndContinue(page);
  const humanScoreMG1 = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".ranking-row"));
    for (const r of rows) if (r.textContent?.includes("ControlFix")) return r.textContent;
    return null;
  });

  // ===================== MINIJUEGO 2: CAZAENGAÑOS =====================
  await waitInstructionsAndCountdown(page, "Cazaengaños");
  await page.waitForTimeout(500);

  await directionalSuite(page, "Cazaenganos", "orientacionA");

  console.log("\n=== FASE 2: disparo preciso a un objetivo puntual ===");
  await page.waitForTimeout(300);
  const targetInfo = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll(".world-label"));
    if (labels.length === 0) return null;
    const el = labels[0];
    const r = el.getBoundingClientRect();
    return { text: el.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (targetInfo) {
    const labelCountBefore = await page.evaluate(() => document.querySelectorAll(".world-label").length);
    await page.mouse.move(targetInfo.x, targetInfo.y, { steps: 5 });
    await page.waitForTimeout(80);
    await page.mouse.click(targetInfo.x, targetInfo.y);
    await page.waitForTimeout(250);
    const stillThere = await page.evaluate(
      (txt) => Array.from(document.querySelectorAll(".world-label")).some((el) => el.textContent === txt),
      targetInfo.text
    );
    const labelCountAfter = await page.evaluate(() => document.querySelectorAll(".world-label").length);
    const row = {
      objetivo: targetInfo.text?.slice(0, 60),
      clickEn: `${Math.round(targetInfo.x)},${Math.round(targetInfo.y)}`,
      etiquetasAntes: labelCountBefore,
      etiquetasDespues: labelCountAfter,
      objetivoDestruido: !stillThere,
      resultado: !stillThere && labelCountAfter === labelCountBefore - 1 ? "PASA" : "FALLA"
    };
    results.shooting.push(row);
    if (row.resultado === "PASA") ok(`Click preciso destruyó el objetivo correcto: "${row.objetivo}"`);
    else fail(`Click preciso NO destruyó el objetivo esperado: "${row.objetivo}" (seguía ahí=${stillThere}, labels ${labelCountBefore}→${labelCountAfter})`);
  } else {
    fail("No había ningún objetivo en pantalla para probar el disparo preciso");
  }

  console.log("\n=== FASE 2b: el humano juega de verdad el resto de Cazaengaños ===");
  await shootLabelsFor(page, 68000);

  await waitResultsAndContinue(page);
  const humanScoreMG2 = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".ranking-row"));
    for (const r of rows) if (r.textContent?.includes("ControlFix")) return r.textContent;
    return null;
  });

  // ===================== MINIJUEGO 3: BAJO PRESIÓN =====================
  await waitInstructionsAndCountdown(page, "Bajo Presión");
  await page.waitForTimeout(500);
  await directionalSuite(page, "BajoPresion", "orientacionA");

  console.log("\n=== FASE 3: el humano juega de verdad Bajo Presión (teclas 1-3 + E, y una vez click-a-rival) ===");
  const end = Date.now() + 68000;
  let tick = 0;
  while (Date.now() < end) {
    await page.keyboard.press(["Digit1", "Digit2", "Digit3"][tick % 3]);
    await page.waitForTimeout(700);
    if (tick % 4 === 0) {
      // probamos el nuevo "pasar con click sobre un rival"
      const rivalScreen = await page.evaluate(() => {
        const ids = window.__nexoraDebug?.listParticipantIds?.() ?? [];
        for (const id of ids) {
          if (id === "human") continue;
          const p = window.__nexoraDebug.getScreenPos(id);
          if (p) return p;
        }
        return null;
      });
      if (rivalScreen) {
        await page.mouse.move(rivalScreen.x, rivalScreen.y, { steps: 3 });
        await page.mouse.click(rivalScreen.x, rivalScreen.y);
      } else {
        await page.keyboard.press("KeyE");
      }
    } else {
      await page.keyboard.press("KeyE");
    }
    await page.waitForTimeout(900);
    tick++;
  }

  await waitResultsAndContinue(page);

  // ===================== FINAL =====================
  await page.waitForSelector(".results-card .btn", { timeout: 15000 });
  await page.screenshot({ path: path.join(SHOTS_DIR, "10-final-ranking.png") });
  const finalRankingText = await page.locator(".results-card").innerText();
  await page.locator(".results-card .btn").click();
  await page.waitForSelector(".summary-card", { timeout: 15000 });
  const summaryText = await page.locator(".summary-card").innerText();

  await context.close();
  await browser.close();

  console.log("\n\n================ TABLA DE PRUEBAS DIRECCIONALES ================");
  console.table(results.directional);
  console.log("\n================ DIAGONALES ================");
  console.table(results.diagonal);
  console.log("\n================ DISPARO PRECISO ================");
  console.table(results.shooting);
  console.log("\nPuntaje humano fin MG1 (Atrapa o Evita):", humanScoreMG1);
  console.log("Puntaje humano fin MG2 (Cazaengaños):", humanScoreMG2);
  console.log("\n--- RANKING FINAL ---\n", finalRankingText);
  console.log("\n--- RESUMEN ---\n", summaryText);
  console.log("\nconsole errors:", results.errors.length, results.errors);
  console.log("page errors:", results.pageErrors.length, results.pageErrors);

  fs.writeFileSync(
    path.join(OUT_DIR, "control-fix-report.json"),
    JSON.stringify({ ...results, humanScoreMG1, humanScoreMG2, finalRankingText, summaryText }, null, 2)
  );

  // Extrae el puntaje TOTAL final del humano del texto del ranking para el veredicto automático.
  const m = finalRankingText.match(/ControlFix\s+(-?\d+)\s*pts/);
  const finalHumanTotal = m ? parseInt(m[1], 10) : null;
  console.log("\nPuntaje TOTAL final del humano:", finalHumanTotal);

  if (results.errors.length > 0 || results.pageErrors.length > 0) {
    fail("Hubo errores de consola/página durante la partida");
  }
  if (finalHumanTotal === null) {
    fail("No se pudo leer el puntaje final del humano del ranking");
  } else if (finalHumanTotal < 300) {
    fail(`Puntaje final del humano sospechosamente bajo (${finalHumanTotal}) — podría indicar que los controles siguen fallando`);
  } else {
    ok(`Puntaje final del humano razonable: ${finalHumanTotal} pts`);
  }

  if (FAIL) {
    console.log("\n########## RESULTADO GLOBAL: FALLÓ ##########");
    process.exitCode = 1;
  } else {
    console.log("\n########## RESULTADO GLOBAL: TODO OK ##########");
  }
}

async function screenshotBefore(page, label) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `01-before-${label}.png`) });
}

main().catch((err) => {
  console.error("VERIFICATION SCRIPT CRASHED:", err);
  process.exitCode = 1;
});
