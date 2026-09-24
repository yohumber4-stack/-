// Environment tour: night + enemies, sandstorm, rain, station POI.
export default async function (page, h) {
  await page.goto('file://' + process.cwd() + '/dist/index.html?play=1&auto=1&seed=1337&pr=0.75&z=900', { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  await page.waitForFunction(() => window.__frames >= 3, null, { timeout: 400000 });
  const step = async (name, code, frames = 3) => {
    const r = await page.evaluate((c) => { const g = window.__game; return eval(c); }, code);
    const f0 = await page.evaluate(() => window.__frames);
    await page.waitForFunction((f) => window.__frames >= f + frames, f0, { timeout: 400000 });
    h.log(name, JSON.stringify(r ?? null));
    if (name) await h.shot('w_' + name);
  };
  await step('day', `g.player.yaw = Math.PI; g.player.pitch = -0.05; [g.env.time, g.stats.fps]`);
  await step('night', `g.env.time = 22.5; g.env.update(0.01, 0.01); g.env.maybeUpdateEnv(0, true); const c = g.playerCar; c.lights = 2; c.setIgnition(true); const T = g.player.camera.position.constructor; const f = g.player.feet; g.enemies.spawn('rabbit', new T(f.x + 1.5, f.y, f.z - 6)); g.enemies.spawn('husk', new T(f.x - 2, f.y, f.z - 9)); g.player.yaw = 0; g.interaction.flashOn = true; g.interaction.toggleFlash && 0; g.enemies.list.length`, 6);
  await step('storm', `g.env.time = 13; g.env.setWeather('sandstorm', 0.01); g.env.update(0.02, 0.02); g.env.maybeUpdateEnv(0, true); g.enemies.clear(); g.player.yaw = Math.PI; [g.env.cur.sand, g.env.cur.fog]`, 8);
  await step('rain', `g.env.time = 16; g.env.setWeather('rain', 0.01); g.env.update(0.02, 0.02); g.env.maybeUpdateEnv(0, true); [g.env.cur.rain]`, 8);
  await step('dusk', `g.env.time = 19.1; g.env.setWeather('cloudy', 0.01); g.env.update(0.02, 0.02); g.env.maybeUpdateEnv(0, true); g.enterCar(g.playerCar, 'driver'); g.player.carPitch = -0.15; null`, 8);
}
