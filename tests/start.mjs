// New game at the homestead: several viewpoints + state dump.
export default async function (page, h) {
  const t0 = Date.now();
  await page.goto('file://' + process.cwd() + '/dist/index.html?play=1&auto=1&seed=1337', { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  h.log('ready', ((Date.now() - t0) / 1000).toFixed(1));
  await page.waitForFunction(() => window.__frames >= 6, null, { timeout: 240000 });
  const info = await page.evaluate(() => {
    const g = window.__game; const hp = g.worldgen.homestead(); const c = g.playerCar;
    const items = [...g.items.items].map((e) => ({ id: e.def.id, k: e.part?.kind, d: +Math.hypot(e.wx - (g.player.feet.x + g.physics.originX), e.wz - (g.player.feet.z + g.physics.originZ)).toFixed(1), body: !!e.body, y: +e.wy.toFixed(2) }));
    return { home: [hp.x.toFixed(1), hp.z.toFixed(1), hp.ry.toFixed(2)], feet: g.player.feet.toArray().map((v) => +v.toFixed(2)), car: c.position.toArray().map((v) => +v.toFixed(2)), carUp: +c.visual.root.up.y.toFixed(2), items, ui: g.ui.state, fps: g.stats.fps.toFixed(1), tris: g.stats.tris, calls: g.stats.calls, hint: document.getElementById('hint')?.textContent };
  });
  h.log(JSON.stringify(info));
  await h.shot('start_0');
  const views = [
    'g.player.yaw += 1.2; g.player.pitch = -0.1',
    'g.player.yaw += 1.6; g.player.pitch = -0.05',
    'g.player.yaw += 1.8; g.player.pitch = -0.15',
  ];
  let n = 1;
  for (const v of views) {
    await page.evaluate((code) => { const g = window.__game; eval(code); }, v);
    const f0 = await page.evaluate(() => window.__frames);
    await page.waitForFunction((f) => window.__frames >= f + 2, f0, { timeout: 120000 });
    await h.shot('start_' + n++);
  }
  const car = await page.evaluate(() => { const g = window.__game; const c = g.playerCar; return { pos: c.position.toArray().map((v) => +v.toFixed(2)), speed: c.speed, parts: Object.keys(c.parts).length }; });
  h.log(JSON.stringify(car));
}
