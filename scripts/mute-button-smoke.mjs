import { chromium } from "playwright";
const url = process.env.NEXORA_URL || "http://localhost:5190/";
const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loading-screen")?.classList.contains("hidden"), { timeout: 20000 });
await page.waitForSelector(".lobby-card");

const btn = page.locator(".corner-controls .icon-btn");
await btn.waitFor({ state: "visible", timeout: 5000 });
const before = await btn.textContent();
await btn.click();
const afterMute = await btn.textContent();
const ariaAfter = await btn.getAttribute("aria-pressed");
await btn.click();
const afterUnmute = await btn.textContent();

console.log("mute icon before:", before, "| after mute:", afterMute, "(aria-pressed:", ariaAfter, ") | after unmute:", afterUnmute);

// confirmar que sigue visible tras cambiar de pantalla (vive fuera de #ui-root)
await page.fill(".nickname-input", "MuteTest");
await page.locator(".lobby-card .btn", { hasText: "Jugar" }).click();
await page.waitForSelector(".select-card");
const stillThere = await page.locator(".corner-controls .icon-btn").isVisible();
console.log("mute button survives screen transition:", stillThere);

await page.screenshot({ path: "/Users/pedro/PROJECT_2/docs/playtest/screenshots/00-mute-button.png" });

console.log("errors:", errors.length, errors);
await browser.close();
if (errors.length || before === afterMute || afterMute === afterUnmute || !stillThere) process.exitCode = 1;
