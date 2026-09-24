// Physics driving test: starts the engine and runs scripted manoeuvres headlessly.
export default async function (page, h) {
  await page.goto('file://' + process.cwd() + '/dist/index.html?tq=1&t=11&z=300&incar=1', { waitUntil: 'commit', timeout: 180000 });
  await page.waitForFunction(() => window.__frames >= 2, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const g = window.__game; const car = g.playerCar;
    const log = {};
    log.settle = g.simulate(2, {}, 1);
    car.setIgnition(true); car.setCrank(true);
    let t = 0; while (!car.running && t < 6) { g.simulate(0.1, {}, 10); t += 0.1; }
    car.setCrank(false);
    log.startTime = t; log.running = car.running;
    car.handbrake = false;
    log.accel = g.simulate(20, { throttle: 1 }, 1);
    log.cruiseTurn = g.simulate(6, { throttle: 0.6, steer: 0.4 }, 1);
    log.brake = g.simulate(5, { brake: 1 }, 1);
    log.reverse = g.simulate(4, { brake: 1 }, 1);
    log.offroad = g.simulate(8, { throttle: 1, steer: 0.7 }, 1);
    return log;
  });
  for (const [k, v] of Object.entries(r)) h.log(k, JSON.stringify(v));
  await h.shot('drive_end');
}
