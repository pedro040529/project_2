// Smoke test en Firefox (motor Gecko) contra el dev server, en paralelo al
// playtest completo en Chromium — confirma que corre en un segundo motor.
import { firefox } from "playwright";

const url = process.env.NEXORA_URL || "http://localhost:5190/";
const errors = [];
const pageErrors = [];

const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loading-screen")?.classList.contains("hidden"), { timeout: 20000 });
await page.waitForSelector(".lobby-card", { timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "/Users/pedro/PROJECT_2/docs/playtest/screenshots/00-firefox-lobby.png" });

await page.fill(".nickname-input", "Firefox");
await page.locator(".lobby-card .btn", { hasText: "Jugar" }).click();
await page.waitForSelector(".select-card", { timeout: 10000 });
await page.locator(".avatar-card").nth(2).click();
await page.locator(".select-card .btn", { hasText: "Confirmar" }).click();
await page.waitForSelector(".roster-grid", { timeout: 10000 });
await page.waitForTimeout(900);
await page.screenshot({ path: "/Users/pedro/PROJECT_2/docs/playtest/screenshots/00-firefox-roster.png" });
await page.locator(".btn", { hasText: "Empezar la partida" }).click();
await page.waitForSelector(".instructions-card", { timeout: 10000 });
await page.screenshot({ path: "/Users/pedro/PROJECT_2/docs/playtest/screenshots/00-firefox-instructions.png" });
await page.locator(".instructions-card .btn", { hasText: "Listo" }).click();
await page.waitForSelector(".countdown-num", { timeout: 8000 });
await page.waitForSelector(".countdown-num", { state: "detached", timeout: 8000 });
await page.mouse.click(640, 400);
await page.keyboard.down("KeyW");
await page.waitForTimeout(1500);
await page.keyboard.up("KeyW");
await page.waitForTimeout(1500);
await page.screenshot({ path: "/Users/pedro/PROJECT_2/docs/playtest/screenshots/00-firefox-gameplay.png" });

console.log("FIREFOX console errors:", errors.length, errors);
console.log("FIREFOX page errors:", pageErrors.length, pageErrors);

await browser.close();
if (errors.length || pageErrors.length) process.exitCode = 1;
