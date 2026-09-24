// Persistent headless session controlled over HTTP, so one slow software-GL boot serves many checks.
//   node tests/live.mjs [--port 9333] [--w 1280 --h 720]
//   curl -s localhost:9333/open --data 'play=1&auto=1&seed=1337'     (load dist/index.html?<query>)
//   curl -s localhost:9333/eval --data 'return g.stats'               (g = window.__game)
//   curl -s localhost:9333/frames?n=3                                 (wait n rendered frames)
//   curl -s localhost:9333/shot?name=foo                              (.hoplite/artifacts/foo.png)
//   curl -s localhost:9333/logs                                       (console lines since last call)
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const port = Number(opt('port', 9333));
const W = Number(opt('w', 1280)), H = Number(opt('h', 720));
const outDir = path.resolve('.hoplite/artifacts');
fs.mkdirSync(outDir, { recursive: true });

const chromeDir = path.join(os.homedir(), '.agent-browser/browsers');
const executablePath = path.join(chromeDir, fs.readdirSync(chromeDir).find((d) => d.startsWith('chrome')), 'chrome');
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-gpu-rasterization',
    '--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
let logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

const frames = () => page.evaluate(() => window.__frames || 0);
async function waitFrames(n) {
  const f0 = await frames();
  await page.waitForFunction((f) => (window.__frames || 0) >= f, f0 + n, { timeout: 600000, polling: 100 });
}

const body = (req) => new Promise((res) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => res(s)); });

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, v) => { res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' }); res.end(typeof v === 'string' ? v : JSON.stringify(v, null, 1)); };
  try {
    const b = await body(req);
    switch (u.pathname) {
      case '/open': {
        const t0 = Date.now();
        await page.goto('file://' + process.cwd() + '/dist/index.html?' + b.trim(), { waitUntil: 'commit', timeout: 600000 });
        await page.waitForFunction(() => window.__ready, null, { timeout: 600000, polling: 250 });
        await page.waitForFunction(() => (window.__frames || 0) >= 3, null, { timeout: 600000, polling: 250 });
        return send(200, `ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
      case '/eval': {
        const r = await page.evaluate(`(async () => { const g = window.__game; ${b} })()`);
        return send(200, r === undefined ? 'ok' : r);
      }
      case '/frames':
        await waitFrames(Number(u.searchParams.get('n') || 2));
        return send(200, 'ok');
      case '/shot': {
        const p = path.join(outDir, (u.searchParams.get('name') || 'live') + '.png');
        await page.screenshot({ path: p });
        return send(200, p);
      }
      case '/key': {
        const k = u.searchParams.get('k'), mode = u.searchParams.get('m') || 'press';
        if (mode === 'down') await page.keyboard.down(k); else if (mode === 'up') await page.keyboard.up(k); else await page.keyboard.press(k);
        return send(200, 'ok');
      }
      case '/click': {
        const x = Number(u.searchParams.get('x')), y = Number(u.searchParams.get('y'));
        await page.mouse.click(x, y);
        return send(200, 'ok');
      }
      case '/logs': { const l = logs; logs = []; return send(200, l.join('\n')); }
      case '/quit': send(200, 'bye'); await browser.close(); process.exit(0);
      default: return send(404, 'unknown');
    }
  } catch (e) {
    send(500, String(e && e.stack || e));
  }
}).listen(port, '127.0.0.1', () => console.log(`[live] control on http://127.0.0.1:${port}`));
