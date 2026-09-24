// Homestead garage walkthrough: door, battery, hood, install, fuel, start, drive out.
export default async function (page, h) {
  await page.goto('file://' + process.cwd() + '/dist/index.html?play=1&auto=1&seed=1337&pr=0.75' + (process.env.Q || ''), { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  await page.waitForFunction(() => window.__frames >= 4, null, { timeout: 240000 });
  await page.evaluate(() => {
    const g = window.__game; const T = g.player.camera.position.constructor;
    const hp = g.worldgen.homestead();
    window.P = (x, y, z) => new T(x, y, z).applyAxisAngle(new T(0, 1, 0), hp.ry).add(new T(hp.x - g.physics.originX, hp.y, hp.z - g.physics.originZ));
    window.lookAt = (p) => { const c = g.player.camera.position; const d = p.clone().sub(c); g.player.yaw = Math.atan2(-d.x, -d.z); g.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
    window.tp = (x, z, y = 0) => { const p = window.P(x, 0, z); p.y = hp.y + y + 0.02; g.player.teleport(p); };
    window.state = () => { const ia = g.interaction; return { target: ia.target, hand: ia.hand && ia.hand.def.id, car: { run: g.playerCar.running, rpm: Math.round(g.playerCar.rpm), fuel: g.playerCar.fuelTotal.toFixed(1), batt: !!g.playerCar.parts.battery, pos: g.playerCar.position.toArray().map((v) => +v.toFixed(2)) } }; };
  });
  const step = async (name, code, frames = 3) => {
    const r = await page.evaluate((c) => { const g = window.__game; return eval(c); }, code);
    const f0 = await page.evaluate(() => window.__frames);
    await page.waitForFunction((f) => window.__frames >= f + frames, f0, { timeout: 400000 });
    const st = await page.evaluate(() => window.state());
    h.log(name, JSON.stringify(r ?? null), JSON.stringify(st));
    if (name) await h.shot('g_' + name);
  };
  await step('outside', `tp(-8, 8.5); lookAt(P(-8, 1.6, 4)); g.worldgen.built.get(g.worldgen.homestead().key).doors.map(d => d.def.kind + ':' + d.def.x.toFixed(1) + ',' + d.def.z.toFixed(1))`);
  await step('dooraim', `lookAt(P(-8, 1.2, 5.2)); null`);
  await step('', `const bp = g.worldgen.built.get(g.worldgen.homestead().key); let n = 0; for (const d of bp.doors) { const wp = new d.pivot.position.constructor(); d.pivot.getWorldPosition(wp); if (wp.distanceTo(P(-8,1,5)) < 4) { g.worldgen.toggleDoor(d); n++; } } n`, 50);
  await step('opened', `tp(-8, 7.5); lookAt(P(-8, 0.8, 0)); null`);
  await step('bench', `tp(-8, -0.8); lookAt(P(-8.5, 1.1, -3.65)); null`);
  await step('take', `const b = [...g.items.items].find(e => e.part && e.part.kind === 'battery'); g.interaction.take(b); lookAt(P(-8, 0.6, 3)); b.def.id`, 6);
  await step('hood', `g.playerCar.toggleHinge('hood'); tp(-8, 4.9); lookAt(g.playerCar.localToWorld(new (g.player.camera.position.constructor)(0.3, 0.7, 1.4))); null`, 30);
  await step('install', `const c = g.playerCar; g.interaction.installPart(c, 'battery'); c.addFuel('petrol', 15); null`, 4);
  await step('seat', `g.playerCar.toggleHinge('hood'); g.enterCar(g.playerCar, 'driver'); g.player.carPitch = -0.2; null`, 30);
  await step('crank', `g.playerCar.setCrank(true); null`, 40);
  await step('running', `g.playerCar.setCrank(false); g.input.simKey('KeyW', true); null`, 60);
  await step('driving', `g.player.thirdPerson = true; null`, 40);
  await step('out', `g.input.simKey('KeyW', false); null`, 30);
}
