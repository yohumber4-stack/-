// Film timeline: scenes in order, each renders purely from its local time.
import { FB } from './engine/fb.js';
import { dissolve, fade, irisStar, crossfade } from './engine/fx.js';
import { clamp, E } from './engine/core.js';
import ident from './scenes/s00_ident.js';
import prologue from './scenes/s01_prologue.js';
import skytime from './scenes/s02_skytime.js';
import promise from './scenes/s03_promise.js';
import workshop from './scenes/s04_workshop.js';
import mockery from './scenes/s05_mockery.js';
import rain from './scenes/s06_rain.js';
import heist from './scenes/s07_heist.js';
import friends from './scenes/s08_friends.js';
import montage from './scenes/s09_montage.js';
import launch from './scenes/s10_launch.js';
import walk from './scenes/s11_walk.js';
import ambush from './scenes/s12_ambush.js';
import finale from './scenes/s13_finale.js';

const LIST = [ident, prologue, skytime, promise, workshop, mockery, rain, heist, friends, montage, launch, walk, ambush, finale];

export const SCENES = [];
let acc = 0;
for (const s of LIST) { SCENES.push({ ...s, start: acc }); acc += s.dur; }
export const DURATION = acc;

const prevBuf = new FB();

export function sceneAt(T) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (T >= SCENES[i].start) return i;
  return 0;
}

export function renderFrame(fb, T) {
  const i = sceneAt(T);
  const s = SCENES[i];
  const t = T - s.start;
  fb.ox = fb.oy = 0;
  s.render(fb, t, { T, i });
  fb.ox = fb.oy = 0;
  const tr = s.in;
  if (tr && i > 0 && t < tr.dur) {
    const k = clamp(t / tr.dur);
    if (tr.type === 'dissolve' || tr.type === 'cross') {
      const p = SCENES[i - 1];
      prevBuf.ox = prevBuf.oy = 0;
      p.render(prevBuf, p.dur + t, { T, i: i - 1 });
      if (tr.type === 'dissolve') dissolve(fb, prevBuf, fb.clone(), k, tr.block || 2);
      else crossfade(fb, prevBuf, E.inOutSine(k));
    } else if (tr.type === 'black') fade(fb, 0x000000, 1 - E.inOutQuad(k));
    else if (tr.type === 'white') fade(fb, 0xffffff, 1 - E.inOutQuad(k));
    else if (tr.type === 'star') irisStar(fb, tr.x || 240, tr.y || 135, E.inCubic(k) * 700 + 0.01, 0x000000, k * 1.2);
  }
  const to = s.out;
  if (to && t > s.dur - to.dur) {
    const k = clamp((t - (s.dur - to.dur)) / to.dur);
    if (to.type === 'black') fade(fb, 0x000000, E.inOutQuad(k));
    else if (to.type === 'white') fade(fb, 0xffffff, E.inOutQuad(k));
    else if (to.type === 'star') irisStar(fb, to.x || 240, to.y || 135, (1 - E.outCubic(k)) * 700 + 0.01, 0x000000, -k * 1.2);
  }
}
