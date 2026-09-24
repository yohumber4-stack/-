// usage: node tests/run.mjs tests/view.mjs --q "t=10&z=300" --name view
export default async function (page, h) {
  const i = process.argv.indexOf('--q'); const q = i > 0 ? process.argv[i + 1] : '';
  const n = process.argv.indexOf('--name'); const name = n > 0 ? process.argv[n + 1] : 'view';
  const f = process.argv.indexOf('--frames'); const frames = f > 0 ? Number(process.argv[f + 1]) : 3;
  await page.goto('file://' + process.cwd() + '/dist/index.html?' + q, { waitUntil: 'commit', timeout: 180000 });
  await page.waitForFunction((fr) => window.__frames >= fr, frames, { timeout: 180000 });
  await h.shot(name);
}
