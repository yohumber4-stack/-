// Friendship. Clawd steps out, sees the mess and a soaked, grey Gemini. An
// umbrella. By the fireplace: a blanket and a bag of "TPU" chips in Google colours
// (Claude really does run on Google TPUs) — Gemini laughs, and its blue ray gets
// its colour back. Codex arrives with the thief's fedora. Three friends.
import { yardWorld } from '../world/yard.js';
import { livingroomWorld, LR } from '../world/livingroom.js';
import { r3d, actor, billboard, worldLights, rgbf } from '../world/stage.js';
import { skyDome } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, step } from '../engine/core.js';
import { vignette, rain } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { emote } from '../sprites/props.js';
import { decoy, distillery } from '../sprites/heist.js';
import { umbrella, blanket, chipsBag, chip, fedora } from '../sprites/extra.js';
import { hop, float, blink, bounce } from '../kit.js';

const NIGHT = [0x3a4280, 0x242c62, 0x141a44, 0x0a0e2a];

export default {
  dur: 14,
  render(fb, t) {
    if (t < 6.8) return outside(fb, t);
    return inside(fb, t);
  },
};

function outside(fb, t) {
  const Wd = yardWorld();
  const close = t >= 3.4;
  if (!close) r3d.camera([50, 5.5, 14.5], [47.5, 2.6, 28], 54);
  else r3d.camera([46.5, 2.7, 19.5], [46.4, 2.9, 30], 54);
  r3d.clear();
  skyDome(fb, r3d, t, { stops: NIGHT, stars: 150, span: 0.6 });
  r3d.ambient = [0.42, 0.44, 0.62];
  r3d.sun = { dir: [-0.3, 0.8, -0.5], color: [0.25, 0.3, 0.5] };
  r3d.points = worldLights(Wd.lights, 1.3);
  r3d.points.push({ p: [47.5, 3, 28.5], c: rgbf(0xffc27a, 1.6), r: 12 });
  r3d.points.push({ p: [51, 5, 28.8], c: rgbf(0xfff0b0, 1.4), r: 12 });
  r3d.drawMesh(fb, Wd.mesh); r3d.drawMesh(fb, Wd.litMesh); r3d.drawMesh(fb, Wd.lampOn);
  r3d.fog(fb, 0x141a3a, 40, 120, 0.5);
  // open doorway (warm light)
  billboard(fb, [47.5, 1, 29.9], (L, x, y) => { L.rect(x - 16, y - 50, 32, 50, 0xffc27a); L.rect(x - 16, y - 50, 32, 3, 0xffe0b0); }, { bias: -0.2 });
  if (!close) {
    // the mess: toppled copies and the broken still
    [56.5, 59.5, 62.5].forEach((qx, i) => billboard(fb, [qx, 1, 26.5], (L, x, y) => decoy(L, x, y, i, 1), { bias: 0.3 }));
    const k = E.inOutSine(seg(t, 0.3, 1.2));
    const cs = actor(fb, [lerp(47.5, 49, k), 1, lerp(29.5, 27, k)], 'clawd', { acc: 'nightcap', eyes: t < 1.4 ? 'blink' : t < 2.3 ? 'wide' : 'open', lookX: t > 1.4 && t < 2.3 ? -1 : 1, mouth: t > 1.4 && t < 2.3 ? 'o' : 'flat' }, { scale: 1, lift: 0.55 });
    if (cs && t > 1.4 && t < 2.3) emote(fb, 'q', cs.x - 4, cs.y - 60, { scale: 2 });
    const gs = actor(fb, [44.3, 1.4 + float(t, 0.06, 2), 26.5], 'gemini', { eyes: t > 2.3 ? 'sad' : 'open', mouth: 'flat', grey: 0.55, handR: t < 2.4 ? -10 : 6, handL: 6, lookX: t < 2.4 ? -1 : 1 }, { scale: 1, groundY: 1, lift: 0.55 });
    if (gs) for (let i = 0; i < 4; i++) { const d = (t * 3 + hash(i)) % 1; fb.rect(gs.x - 16 + hash(i * 3) * 32, gs.y - 44 + d * 40, 1, 2, 0xbfe6ff); }
  } else {
    const lt = t - 3.4, open = E.outBack(seg(lt, 0.4, 0.8));
    const cs = actor(fb, [47.6, 1, 27.4], 'clawd', { acc: 'nightcap', eyes: lt > 1.8 ? 'happy' : 'open', lookX: -1, mouth: lt > 1.8 ? 'smile' : 'flat', armR: -12, blush: lt > 1.8 ? 'big' : true }, { scale: 2, lift: 0.6, shadow: false });
    if (cs) umbrella(fb, cs.x + 30, cs.y - 40, { r: 66, open: Math.max(0.25, open), tilt: -1.5 });
    const gs = actor(fb, [45.2, 1.3 + float(t, 0.05, 1.6), 27.2], 'gemini', { eyes: lt < 1.0 ? 'sad' : lt < 2.4 ? 'teary' : 'open', mouth: lt > 2.4 ? 'smile' : 'flat', grey: 0.5 - 0.1 * seg(lt, 2.4, 3.2), lookY: lt > 1.0 ? -1 : 0, lookX: lt > 1.0 ? 1 : 0, blush: lt > 2.6 ? 'big' : true }, { scale: 2, lift: 0.6, shadow: false });
    if (gs && lt > 2.6) emote(fb, 'heart', gs.x + 36, gs.y - 118 - (lt - 2.6) * 10, { scale: 2 });
  }
  r3d.outline(fb, 0.6);
  r3d.bloom(fb, 0.6, 3);
  // rain everywhere except under the umbrella
  if (close) { rain(fb, t, { n: 120, speed: 320, angle: 0.12, len: 7, ground: 270, alpha: 0.4, x0: 0, w: 130 }); rain(fb, t + 3, { n: 80, speed: 320, angle: 0.12, len: 7, ground: 270, alpha: 0.4, x0: 390, w: 90 }); }
  else rain(fb, t, { n: 140, speed: 300, angle: 0.15, len: 5, ground: 270, alpha: 0.35 });
  vignette(fb, 0.45);
}

function inside(fb, t) {
  const lt = t - 6.8;
  const Wd = livingroomWorld();
  r3d.camera([15 + Math.sin(t * 0.2) * 0.3, 6.2, -2.5], [15.5, 3.4, 12], 54);
  r3d.clear();
  fb.clear(0x0c0a10);
  r3d.ambient = [0.4, 0.33, 0.32];
  r3d.sun = { dir: [0.1, 0.5, -0.85], color: [0.15, 0.17, 0.3] };
  r3d.points = [];
  for (const L of Wd.lights) { const f = L.fire ? 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.1) : 1; r3d.points.push({ p: L.p, c: rgbf(L.c, 1.5 * f * (L.k || 1)), r: L.r }); }
  r3d.drawMesh(fb, Wd.mesh);
  r3d.drawMesh(fb, Wd.fireMesh, {}, { emit: 0.85 + 0.15 * Math.sin(t * 12) });
  // rain beyond the window
  const wp = r3d.project(8, 8.5, 19);
  if (wp) for (let i = 0; i < 26; i++) { const x = wp[0] - 40 + hash(i) * 80, y = wp[1] - 30 + ((hash(i * 3) * 60 + t * 90) % 60); fb.line(x, y, x - 1, y + 3, 0x6a7aa8); }
  const laugh = lt > 2.1;
  const blue = laugh ? E.outCubic(seg(lt, 2.2, 2.8)) : 0;
  const gs = actor(fb, [20, 3.2 + float(t, 0.05, 2) + (laugh && lt < 3.6 ? bounce(lt, 0.3, 0.2, 2.1) : 0), 9.5], 'gemini', {
    eyes: lt < 1.3 ? 'open' : lt < 2.1 ? 'wide' : laugh && lt < 3.8 ? 'happy' : blink(t, 2) ? 'blink' : 'open', mouth: laugh && lt < 3.8 ? 'laugh' : 'smile', grey: 0.45 * (1 - blue * 0.4),
    rays: { b: 0.3 + blue * 0.7, r: 0.35, y: 0.35, g: 0.35 }, blush: laugh ? 'big' : true, lookX: lt > 4.2 ? -1 : lt > 0.6 ? 1 : 0, handL: laugh && lt < 3.4 ? -10 : 4, handR: 4,
  }, { scale: 1, groundY: 1, lift: 0.5, glow: 0.05 + blue * 0.2 });
  if (gs) blanket(fb, gs.x, gs.y + 5, 56, 17);
  if (gs && laugh && lt < 3.2) { for (let i = 0; i < 10; i++) { const a = i * 0.63 + lt * 3, r = 10 + seg(lt, 2.2, 3.2) * 30; fb.add(gs.x + 18 + Math.cos(a) * r, gs.y - 28 + Math.sin(a) * r * 0.8, i % 2 ? 0xffffff : 0x7fb0ff, 1); } }
  const offer = E.inOutSine(seg(lt, 0.4, 1.0));
  const cs = actor(fb, [13.2, 1, 8.5], 'clawd', { eyes: laugh && lt < 4 ? 'happy' : blink(t, 6) ? 'blink' : 'open', mouth: laugh && lt < 4 ? 'laugh' : 'smile', lookX: -1, armL: offer > 0.2 && lt < 2.6 ? -8 : 0, blush: laugh ? 'big' : true }, { scale: 1, lift: 0.5 });
  if (cs && lt < 3.0) chipsBag(fb, lerp(cs.x - 30, cs.x - 46, offer), cs.y - 18 - offer * 10, 1.5);
  if (gs && lt > 1.4 && lt < 3.2) chip(fb, gs.x - 4, gs.y - 22);
  if (gs && lt > 1.6 && lt < 2.2) for (let i = 0; i < 4; i++) fb.rect(gs.x - 8 + hash(i) * 10, gs.y - 20 + ((lt * 30 + i * 5) % 12), 1, 1, 0xf0cc68);
  // knock, Codex enters with the fedora
  if (lt > 3.9 && lt < 4.8) text(fb, 'ТУК-ТУК', 420, 70 + Math.round(Math.sin(lt * 30)), 0xffffff, { align: 'center', outline: 0x1a1a2a });
  if (lt > 4.4) {
    const k = E.outCubic(seg(lt, 4.4, 5.4));
    const xs = actor(fb, [lerp(1.5, 7.5, k), 1, lerp(6, 8.5, k)], 'codex', { face: step(lt, [[0, 'wow'], [5.4, 'check'], [6.2, 'heart']]), armL: lt < 5.8 ? 'up' : undefined, armR: lt > 5.8 ? 'up' : undefined }, { scale: 1, lift: 0.5, dy: -Math.round(float(t, 1.5, 2)) });
    if (xs && lt < 5.8) fedora(fb, xs.x - 26, xs.y - 64, 1);
    if (xs && lt > 6.2) { for (let i = 0; i < 3; i++) emote(fb, 'heart', lerp(xs.x, gs ? gs.x : xs.x, 0.5) + (i - 1) * 40, xs.y - 90 - ((lt * 18 + i * 9) % 20), { scale: 2 }); }
  }
  r3d.outline(fb, 0.6);
  r3d.bloom(fb, 0.55, 3);
  const fp = r3d.project(21.5, 2.5, 16); if (fp) fb.glow(fp[0], fp[1], 40, 0xff9040, 0.3);
  vignette(fb, 0.42);
}
