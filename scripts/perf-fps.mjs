// Mide FPS del menú y del primer desafío contra el build (render por software: sirve para comparar, no como valor absoluto).
// Uso: NEXORA_URL="http://localhost:4199/?q=medium" node scripts/perf-fps.mjs
import { chromium } from "playwright";

const url = process.env.NEXORA_URL || "http://localhost:4199/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
const measure = (ms) =>
  page.evaluate(
    (dur) =>
      new Promise((resolve) => {
        let n = 0;
        let max = 0;
        let last = performance.now();
        const t0 = last;
        const f = () => {
          const now = performance.now();
          max = Math.max(max, now - last);
          last = now;
          n++;
          if (now - t0 > dur) resolve({ fps: +(n / (dur / 1000)).toFixed(1), maxFrameMs: +max.toFixed(1) });
          else requestAnimationFrame(f);
        };
        f();
      }),
    ms
  );
await page.goto(url);
await page.locator(".lobby-card").waitFor({ timeout: 40000 });
await page.waitForTimeout(1500);
const menu = await measure(3000);
await page.fill(".nickname-input", "Pedro");
await page.getByRole("button", { name: /Jugar/ }).click();
await page.getByRole("button", { name: "Confirmar", exact: true }).click();
await page.getByRole("button", { name: "Comenzar competencia" }).waitFor();
await page.waitForTimeout(3500);
const roster = await measure(3000);
await page.getByRole("button", { name: "Comenzar competencia" }).click();
await page.getByRole("button", { name: "Listo", exact: true }).click();
await page.locator(".hud-timer").waitFor();
await page.waitForTimeout(3000);
const atrapa = await measure(6000);
console.log(JSON.stringify({ url, menu, roster, atrapa, errs }));
await browser.close();
