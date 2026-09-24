// usage: node tests/run.mjs tests/boot.mjs --q "auto=1" --name menu --frames 30 [--eval "js"]
export default async function (page, h) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const q = arg('q', 'auto=1'), name = arg('name', 'boot'), frames = Number(arg('frames', 20));
  const t0 = Date.now();
  await page.goto('file://' + process.cwd() + '/dist/index.html?' + q, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  h.log('ready in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  await page.waitForFunction((fr) => window.__frames >= fr, frames, { timeout: 240000 });
  const ev = arg('eval', '');
  if (ev) h.log('eval', JSON.stringify(await page.evaluate(ev)));
  const st = await page.evaluate(() => { const g = window.__game; return { mode: g.mode, ui: g.ui.state, fps: +g.stats.fps.toFixed(1), calls: g.stats.calls, tris: g.stats.tris, cars: g.cars.length, pois: g.worldgen.built.size, items: g.items.items.size, t: g.env.time.toFixed(2) }; });
  h.log(JSON.stringify(st));
  await h.shot(name);
}
