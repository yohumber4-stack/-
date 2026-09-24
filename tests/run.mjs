// Headless browser harness: node tests/run.mjs <scenario.mjs> [--w 1280 --h 720] [--url base]
// A scenario exports `default async function (page, h)`; h = { shot(name), wait(ms), log, url }.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const scenarioPath = argv.find((a) => a.endsWith('.mjs'));
const W = Number(opt('w', 1280)), H = Number(opt('h', 720));
const base = opt('url', 'http://localhost:3000/');
const outDir = path.resolve(opt('out', '.hoplite/artifacts'));
fs.mkdirSync(outDir, { recursive: true });

const chromeDir = path.join(os.homedir(), '.agent-browser/browsers');
const chromeVer = fs.readdirSync(chromeDir).find((d) => d.startsWith('chrome'));
const executablePath = path.join(chromeDir, chromeVer, 'chrome');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-gpu-rasterization',
    '--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { const t = `[${m.type()}] ${m.text()}`; logs.push(t); if (m.type() === 'error' || m.type() === 'warning' || process.env.VERBOSE) console.log(t); });
page.on('pageerror', (e) => { const t = `[pageerror] ${e.message}\n${e.stack || ''}`; logs.push(t); console.log(t); });
const h = {
  url: base,
  wait: (ms) => page.waitForTimeout(ms),
  shot: async (name) => { const p = path.join(outDir, name.endsWith('.png') ? name : name + '.png'); await page.screenshot({ path: p }); console.log('[shot]', p); return p; },
  log: (...a) => console.log('[scenario]', ...a),
  logs,
};
const t0 = Date.now();
try {
  const mod = await import(path.resolve(scenarioPath));
  await mod.default(page, h);
} catch (e) {
  console.log('[harness error]', e && e.stack || e);
  process.exitCode = 1;
} finally {
  console.log(`[harness] done in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${logs.length} console lines`);
  await browser.close();
}
