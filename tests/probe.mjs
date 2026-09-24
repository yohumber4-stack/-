// usage: node tests/run.mjs tests/probe.mjs --q "auto=1" --name probe --frames 8 --js "expr" [--hideui]
export default async function (page, h) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const q = arg('q', 'auto=1'), name = arg('name', 'probe'), frames = Number(arg('frames', 8));
  await page.goto('file://' + process.cwd() + '/dist/index.html?' + q, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  await page.waitForFunction((fr) => window.__frames >= fr, frames, { timeout: 240000 });
  const steps = [];
  for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === '--js') steps.push(process.argv[i + 1]);
  if (process.argv.includes('--hideui')) await page.evaluate(() => (document.getElementById('ui').style.display = 'none'));
  let n = 0;
  for (const js of steps) {
    const r = await page.evaluate(js);
    if (r !== undefined) h.log(typeof r === 'string' ? r : JSON.stringify(r));
    const f0 = await page.evaluate(() => window.__frames);
    await page.waitForFunction((f) => window.__frames >= f + 2, f0, { timeout: 120000 });
    if (process.argv.includes('--each')) await h.shot(name + '_' + n++);
  }
  await h.shot(name);
}
