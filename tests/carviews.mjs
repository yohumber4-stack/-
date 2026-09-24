// Multiple car views in one session: node tests/run.mjs tests/carviews.mjs --q "..." --views "name:yaw,dist,h,ty[,open][,inside]|..."
export default async function (page, h) {
  const i = process.argv.indexOf('--q'); const q = i > 0 ? process.argv[i + 1] : '';
  const v = process.argv.indexOf('--views'); const views = (v > 0 ? process.argv[v + 1] : 'front:35,6,1.5,0.6').split('|');
  await page.goto('file://' + process.cwd() + '/dist/index.html?' + q, { waitUntil: 'commit', timeout: 180000 });
  await page.waitForFunction(() => window.__frames >= 3, null, { timeout: 180000 });
  for (const view of views) {
    const [name, spec] = view.split(':');
    const [yaw, dist, hh, ty, open, inside, detach] = spec.split(',');
    await page.evaluate(([yaw, dist, hh, ty, open, inside, detach]) => {
      window.__open(open || '');
      if (detach) window.__detach(detach.replace(/\+/g, ','));
      window.__cam(Number(yaw), Number(dist), Number(hh), Number(ty || 0.6), inside === '1');
    }, [yaw, dist, hh, ty, (open || '').replace(/\+/g, ','), inside, detach]);
    const f0 = await page.evaluate(() => window.__frames);
    await page.waitForFunction((f) => window.__frames >= f + 2, f0, { timeout: 60000 });
    await h.shot(name);
  }
}
