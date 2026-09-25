// Finale: three friends on the hill under a sky where their lights shine side by
// side. The moral, THE END, a cast roll — and the copycat, covered in goo, is now
// the one holding the COMING SOON sign.
import { hillWorld, SEA_Y } from '../world/hill.js';
import { r3d, actor, lanternW, worldLights, rgbf } from '../world/stage.js';
import { skyDome, seaPass } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, mix } from '../engine/core.js';
import { vignette, stars, rain, LightMap } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { char } from '../sprites/chars.js';
import { lanternP, emote } from '../sprites/props.js';
import { chipsBag } from '../sprites/extra.js';
import { title, woodSign } from '../props.js';
import { float, blink } from '../kit.js';

const CAST = [['clawd', 'CLAWD', {}], ['codex', 'CODEX', { face: 'happy' }], ['gemini', 'GEMINI', { eyes: 'happy', mouth: 'open' }], ['qwen', 'QWEN', { spy: true }], ['deepseek', 'DEEPSEEK', {}], ['kimi', 'KIMI', {}]];

export default {
  dur: 15,
  in: { type: 'black', dur: 0.8 },
  render(fb, t) {
    if (t < 5.6) return hill(fb, t);
    if (t < 10.4) return credits(fb, t);
    return postCredits(fb, t);
  },
};

function hill(fb, t) {
  const Wd = hillWorld(), P = Wd.plaza;
  const up = E.inOutSine(seg(t, 0, 5.6));
  r3d.camera([P[0] - 2, P[1] + 1.9, P[2] - 12], [P[0] - 2, P[1] + 4.6 + up * 1.2, P[2] + 8], 60);
  r3d.clear();
  const dome = skyDome(fb, r3d, t, { moon: [0.3, 0.5, 8] });
  seaPass(fb, r3d, t, SEA_Y + 0.5, { moonX: dome.moonX, far: dome.horizon });
  r3d.ambient = [0.26, 0.28, 0.46];
  r3d.sun = { dir: [0.35, 0.8, 0.45], color: [0.24, 0.27, 0.4] };
  r3d.points = worldLights(Wd.lights.map((L) => ({ ...L, r: 10 })), 1.5);
  r3d.drawMesh(fb, Wd.mesh);
  r3d.fog(fb, dome.horizon, 70, 230, 0.7);
  // their lights, side by side, and many small ones
  for (let i = 0; i < 14; i++) lanternW(fb, [P[0] - 22 + hash(i * 3) * 40, P[1] + 16 + hash(i * 7) * 10, P[2] + 30], { kind: ['claude', 'openai', 'plain', 'gem', 'whale', 'kimi'][i % 6], w: 10, t, lit: 0.7 });
  lanternW(fb, [P[0] - 2, P[1] + 15, P[2] + 20], { kind: 'gem', w: 34, label: 'GEMINI 4', t });
  lanternW(fb, [P[0] + 6, P[1] + 13, P[2] + 20], { kind: 'claude', w: 26, label: 'OPUS 5.5', t });
  lanternW(fb, [P[0] - 10, P[1] + 13.5, P[2] + 20], { kind: 'astra', w: 28, label: 'GPT-6 ASTRA', t });
  // shooting star
  const sk = seg(t, 2.0, 2.7);
  if (sk > 0 && sk < 1) for (let i = 0; i < 14; i++) fb.add(lerp(60, 200, sk) - i * 3, lerp(20, 70, sk) - i, 0xffffff, (1 - i / 14) * (1 - sk));
  // the three friends sitting together, seen from behind-ish, looking up
  actor(fb, [P[0] + 1.2, P[1], P[2] - 4], 'clawd', { eyes: t > 1.2 && t < 2.2 ? 'happy' : blink(t, 3) ? 'blink' : 'open', lookY: -1, lookX: -1, blush: 'big' }, { scale: 1, lift: 0.45 });
  actor(fb, [P[0] - 2, P[1] + 0.5 + float(t, 0.08, 2), P[2] - 4], 'gemini', { eyes: t > 1.2 && t < 2.6 ? 'happy' : 'open', mouth: t > 1.2 && t < 2.6 ? 'open' : 'smile', lookY: -1, blush: 'big' }, { scale: 1, groundY: P[1], lift: 0.55, glow: 0.1 });
  const xs = actor(fb, [P[0] - 5.2, P[1], P[2] - 4], 'codex', { face: 'smile' }, { scale: 1, lift: 0.45 });
  for (let i = 0; i < 20; i++) { const h1 = hash(i * 7 + 1), h2 = hash(i * 7 + 2); r3d.spark(fb, P[0] - 2 + Math.cos(t * (0.5 + h1) + i) * (4 + h2 * 8), P[1] + 1.5 + h2 * 5, P[2] - 3 + Math.sin(t * 0.6 + i) * 5, 0xd9ff7a, 0.7, 4); }
  r3d.outline(fb, 0.6);
  r3d.bloom(fb, 0.85, 3);
  const a1 = seg(t, 1.0, 2.0), a2 = seg(t, 2.6, 3.6);
  if (a1 > 0) text(fb, 'СВЕТ НЕЛЬЗЯ СКОПИРОВАТЬ.', 240, 30, mix(0x151d4a, 0xffffff, a1), { align: 'center', outline: mix(0x151d4a, 0x0a0e2a, a1), scale: 1 });
  if (a2 > 0) text(fb, 'ИМ МОЖНО ТОЛЬКО ПОДЕЛИТЬСЯ.', 240, 46, mix(0x151d4a, 0xffe6a8, a2), { align: 'center', outline: mix(0x151d4a, 0x0a0e2a, a2) });
  vignette(fb, 0.4);
  if (t > 5.1) fb.overlay(0x000000, seg(t, 5.1, 5.6));
}

function credits(fb, t) {
  const lt = t - 5.6;
  fb.clear(0x05060c);
  stars(fb, t, 102, 90, 0, 0, 480, 270, { alpha: 0.6 });
  const k = seg(lt, 0, 0.6);
  title(fb, 'КОНЕЦ', 240, 56, { scale: 5, top: 0xffffff, bottom: 0xbfd0ff, outline: 0x141a3a, alpha: k, dither: true });
  // cast roll: each character hops in with its name
  CAST.forEach(([n, name, o], i) => {
    const t0 = 0.9 + i * 0.35, kk = E.outBack(seg(lt, t0, t0 + 0.4));
    if (kk <= 0) return;
    const x = 50 + i * 76, y = 196 - (1 - kk) * 30;
    char(fb, n, x, y + (n === 'gemini' || n === 'deepseek' ? -4 : 0), { ...o, eyes: lt > 3.6 && n !== 'codex' ? 'happy' : o.eyes }, { scale: 1, alpha: clamp(kk), dither: true });
    text(fb, name, x, 206, mix(0x05060c, 0xc9d2f0, clamp(kk)), { font: 'small', align: 'center' });
  });
  const k2 = seg(lt, 3.2, 3.7);
  if (k2 > 0) text(fb, 'CONTEXT WINDOW PICTURES - 2026', 240, 232, mix(0x05060c, 0x8a93b8, k2), { font: 'small', align: 'center' });
  if (lt > 4.3) fb.overlay(0x000000, seg(lt, 4.3, 4.8));
}

function postCredits(fb, t) {
  const lt = t - 10.4;
  fb.gradV(0, 0, 480, 270, [0x06070f, 0x0c1020, 0x141828]);
  fb.rect(0, 220, 480, 50, 0x1a1c26);
  fb.rect(60, 60, 90, 160, 0x10121c); fb.rect(330, 40, 110, 180, 0x10121c);
  fb.rect(80, 90, 10, 14, 0x3a3020); fb.rect(360, 80, 10, 14, 0x3a3020);
  const sigh = lt > 2.0;
  char(fb, 'qwen', 240, 226, { eyes: sigh ? 'closed' : 'sad', mouth: sigh ? 'o' : 'frown', goo: 1, handL: -2, handR: -2 }, { scale: 2 });
  fb.rect(318, 150, 4, 72, 0x6d4a32);
  woodSign(fb, 320, 142, 'COMING SOON', { font: 'big' });
  if (sigh) { const k = seg(lt, 2.0, 2.8); fb.circle(282 + k * 14, 92 - k * 16, 3 + k * 4, 0x8a8a9a, 0.6 * (1 - k)); }
  const L = new LightMap().reset(0.55, 0.55, 0.7);
  L.light(240, 100, 150, 0xffe0b0, 0.6);
  L.apply(fb, 8);
  rain(fb, t, { n: 70, speed: 250, angle: 0.1, len: 5, ground: 270, alpha: 0.3 });
  vignette(fb, 0.5);
  if (lt > 3.9) fb.overlay(0x000000, seg(lt, 3.9, 4.5));
}
