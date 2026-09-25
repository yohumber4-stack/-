// The night heist. Qwen lines up cardboard "customers" at Clawd's ASK hatch;
// sleepy Clawd answers them all, and every glowing answer flies into Qwen's
// distillery. Gemini sees it, hesitates... and rings the bell, flooding the
// yard with light. The decoys topple, Qwen flees.
import { E, seg, clamp, lerp, hash, mix, key } from '../engine/core.js';
import { vignette, LightMap, rain, stars, smoke, speedLines } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { cloud } from '../bg.js';
import { distiller, decoy, woodSign, thought, claudeSpark } from '../props.js';
import { cottage, fence } from '../world/cottage.js';
import { gemini } from '../chars/gemini.js';
import { qwen } from '../chars/qwen.js';
import { whale } from '../chars/extras.js';
import { float, hop, eyesB } from '../kit.js';

const GY = 232, HX = 290;
const QUEUE = [404, 382, 360, 338, 316, 294];

function yard(fb, t, flare) {
  fb.gradV(0, 0, 480, 150, [0x070a1a, 0x121838, 0x1e2650]);
  stars(fb, t, 71, 60, 0, 0, 480, 80, { alpha: 0.5 });
  fb.glow(420, 34, 30, 0xbfd0ff, 0.25);
  for (let i = 0; i < 5; i++) cloud(fb, ((i * 130 + t * 6) % 640) - 80, 26 + (i % 2) * 20, 130, 0x1a2140, 0x131830, i + 21, 0.9);
  fb.rect(0, 150, 480, 82, 0x151a2c);
  for (let x = 0; x < 480; x += 40) fb.poly([x, 160, x + 20, 144 + (x % 80 ? 4 : 0), x + 40, 160], 0x10142a);
  fence(fb, 0, HX - 10, 216, 0x4a4050);
  fb.rect(0, GY, 480, 38, 0x2a2a34);
  for (let x = 0; x < 480; x += 14) fb.rect(x + ((x / 14) % 2) * 7, GY + 6, 10, 1, 0x34343f);
}

export default {
  dur: 16,
  in: { type: 'black', dur: 0.6 },
  render(fb, t) {
    if (t >= 3.0 && t < 5.0) return qwenInsert(fb, t);
    if (t >= 5.0 && t < 9.0) return barrelShot(fb, t);
    const flare = seg(t, 9.7, 10.0) * (1 - 0.6 * seg(t, 12.5, 14.5));
    yard(fb, t, flare);
    const lamp = seg(t, 14.2, 14.5);
    const bellSwing = t > 9.4 && t < 11.2 ? Math.sin((t - 9.4) * 18) * (1 - seg(t, 10.4, 11.2)) : 0;
    const hatchOpen = t > 1.5 && t < 9.7 ? 0.5 + 0.5 * Math.sin(t * 10) : 0;
    const C = cottage(fb, HX, GY, { t, lamp, writing: t > 1.5 && t < 9.7, bellSwing, hatch: hatchOpen });

    // the distillery
    const broken = seg(t, 13.1, 13.3);
    const bottles = t < 13.0 ? Math.min(4, 1 + Math.floor((t - 1.5) / 1.4)) : 0;
    distiller(fb, 60, GY, t, { broken, bottles, liquid: 0xffa060, out: 0x9d7bff });
    if (broken > 0) { smoke(fb, t, 13.2, 90, GY - 6, { n: 6, color: 0x9d7bff, size: 6 }); }
    const funnel = [74, GY - 34];
    fb.poly([funnel[0] - 8, funnel[1] - 8, funnel[0] + 8, funnel[1] - 8, funnel[0] + 2, funnel[1] + 2, funnel[0] - 2, funnel[1] + 2], broken ? 0x6a6a74 : 0x9aa0b0);

    // decoys slide into the queue on a rope, then topple like dominoes when the light hits
    const slide = E.outCubic(seg(t, 0.0, 1.6));
    QUEUE.forEach((qx, i) => {
      const x = lerp(qx - 260, qx, slide);
      const fall = seg(t, 10.0 + i * 0.12, 10.35 + i * 0.12);
      decoy(fb, x, GY + 2, { variant: i, fall });
    });
    if (slide >= 1 && t < 10) woodSign(fb, 262, GY - 26, '...×25 000', { font: 'small', post: 20, color: 0x8a6a4a, ink: 0xfff0d0 });

    // question notes go in, glowing answers arc into the funnel
    if (t > 1.5 && t < 9.7) {
      const period = Math.max(0.35, 0.9 - (t - 1.5) * 0.09);
      const n = Math.floor((t - 1.5) / period);
      for (let k = n - 2; k <= n; k++) {
        if (k < 0) continue;
        const lt = (t - 1.5 - k * period) / period;
        if (lt < 0 || lt > 2) continue;
        if (lt < 0.5) { const q = lt / 0.5; const px = lerp(QUEUE[0], C.hatch[0], q), py = lerp(GY - 28, C.hatch[1], q) - Math.sin(q * Math.PI) * 10; fb.rect(px - 2, py - 2, 5, 4, 0xf4f4f4); text(fb, '?', px, py - 2, 0x3a3a50, { font: 'small', align: 'center' }); }
        else {
          const q = (lt - 0.5) / 1.5;
          const px = lerp(C.hatch[0], funnel[0], q), py = lerp(C.hatch[1], funnel[1] - 6, q) - Math.sin(q * Math.PI) * 70;
          for (let tr = 1; tr <= 4; tr++) { const q2 = Math.max(0, q - tr * 0.03); const tx = lerp(C.hatch[0], funnel[0], q2), ty = lerp(C.hatch[1], funnel[1] - 6, q2) - Math.sin(q2 * Math.PI) * 70; fb.add(tx, ty, 0xffa36b, 0.5 - tr * 0.1); }
          fb.glow(px, py, 12, 0xffa36b, 0.8, 4);
          fb.rect(px - 4, py - 3, 9, 7, 0xffe2c8); fb.rect(px - 4, py - 3, 9, 1, 0xffffff); claudeSpark(fb, px, py, 2, 0xd97757);
        }
      }
    }

    // Qwen at the lever
    let qx = 150, qo = { u: 1, spy: true, eyes: 'shifty', look: 1, arms: ['down', 'hold'], t };
    if (t < 9.7) { qo.arms = Math.sin(t * 6) > 0 ? ['hold', 'down'] : ['down', 'hold']; if (bottles >= 3) qo.mouth = 'smirk'; }
    else if (t < 13.0) { qo.mouth = 'open'; qo.sweat = true; qo.fur = 1; qo.arms = 'up'; qx += Math.sin(t * 50) * 1; }
    else {
      const k = E.inQuad(seg(t, 13.0, 14.0));
      qx = lerp(150, -40, k); qo.walk = t * 6; qo.mouth = 'open'; qo.arms = 'flail'; qo.hat = false; qo.lean = -1;
      speedLines(fb, t, GY - 30, GY - 4, 0xffffff, 0.25, 8, -1);
    }
    if (qx > -30) qwen(fb, qx, GY + 1, qo);
    // fedora flies off and lands on the ground
    if (t > 13.3) {
      const k = seg(t, 13.3, 13.9);
      const hx = lerp(150, 176, k), hy = lerp(GY - 34, GY - 4, E.outBounce(k)) - Math.sin(k * Math.PI) * 20;
      fb.rect(hx - 8, hy + 2, 16, 2, 0x3f3530); fb.rect(hx - 5, hy - 3, 10, 5, 0x3f3530); fb.rect(hx - 5, hy, 10, 1, 0x8c2f39);
    }

    // Gemini: zips to the bell and flares
    if (t > 9.0) {
      const k = E.outCubic(seg(t, 9.0, 9.45));
      const gx = lerp(-30, C.bell[0] - 18, k), gy = lerp(200, C.bell[1] + 18, k) + float(t, 1, 3);
      if (k < 1) speedLines(fb, t, gy - 10, gy + 10, 0xffffff, 0.4, 8, 1);
      const pointing = t > 13.4;
      gemini(fb, gx, gy, { size: 40, sat: 0.35 + 0.4 * flare, bright: flare * 0.35, eyes: pointing ? 'determined' : 'determined', mouth: t > 9.5 && t < 10.6 ? 'open' : 'flat', armR: t < 10.6 ? 0.8 + Math.sin(t * 20) * 0.4 : 0, armL: pointing ? 0.6 : 0, look: pointing ? -1 : 1 });
      if (t > 9.5 && t < 10.9) {
        const a = Math.floor(t * 4) % 2 ? 1 : 0.6;
        text(fb, 'ДИНЬ!', C.bell[0] + 8, C.bell[1] - 26 + (Math.floor(t * 4) % 2) * 3, mix(0x303040, 0xffe08a, a), { scale: 2, outline: 0x1a1a2a });
      }
    }

    // lighting
    const L = new LightMap().reset(0.42 + flare * 0.9, 0.44 + flare * 0.9, 0.62 + flare * 0.8);
    L.light(C.hatch[0], C.hatch[1], 70, 0xffc27a, 0.9 * (hatchOpen * 0.5 + 0.5) * (t < 9.7 ? 1 : 0.3));
    L.light(80, GY - 14, 60, 0xffa060, broken ? 0.2 : 0.8);
    L.light(C.win[0], C.win[1], 50, 0xffc27a, 0.3 + lamp * 1.0);
    if (lamp > 0) L.light(C.lamp[0], C.lamp[1], 90, 0xfff0b0, lamp);
    if (flare > 0) L.light(C.bell[0] - 18, C.bell[1] + 18, 420, 0xf4f8ff, 1.2 * flare);
    L.apply(fb, 9);
    if (flare > 0) { fb.glow(C.bell[0] - 18, C.bell[1] + 18, 60 * flare, 0xffffff, 0.8 * flare, 6); if (t < 10.05) fb.overlay(0xffffff, seg(t, 9.7, 9.8) * (1 - seg(t, 9.8, 10.05)) * 0.8); }
    rain(fb, t, { n: 90, speed: 280, angle: 0.15, len: 5, ground: GY + 30, alpha: 0.35 });
    vignette(fb, 0.45);
  },
};

// insert: Qwen at the distillery, rubbing his paws as the bottles fill
function qwenInsert(fb, t) {
  const lt = t - 3;
  fb.gradV(0, 0, 480, 270, [0x0a0e20, 0x151a30, 0x1e2236]);
  fence(fb, 0, 480, 200, 0x3a3444);
  fb.rect(0, 236, 480, 34, 0x24242e);
  // big flask, coil and bottles
  const fx = 300, fy = 170;
  fb.rect(fx - 70, 232, 200, 5, 0x5a4636);
  fb.circle(fx, fy, 34, 0xbfe3f0); fb.circle(fx, fy, 29, 0xff9a50);
  for (let i = 0; i < 10; i++) { const b = (lt * 1.4 + hash(i)) % 1; fb.circle(fx - 20 + hash(i * 3) * 40, fy + 20 - b * 44, 1 + (i % 2), 0xffe0c0); }
  fb.rect(fx - 6, fy - 70, 12, 40, 0xbfe3f0);
  fb.poly([fx - 26, fy - 96, fx + 26, fy - 96, fx + 7, fy - 70, fx - 7, fy - 70], 0x9aa0b0);
  for (let i = 0; i < 5; i++) fb.ring(fx + 70, fy - 30 + i * 14, 10, 0x9fc9d8, 2);
  fb.line(fx + 6, fy - 64, fx + 70, fy - 44, 0xbfe3f0);
  for (let i = 0; i < 3; i++) {
    const bx = fx + 100 + i * 26, level = Math.min(1, Math.max(0, (lt - i * 0.5) / 1.2));
    fb.rect(bx, 196, 20, 36, 0x2a2a3a); fb.rect(bx + 2, 198 + 32 * (1 - level), 16, 32 * level, 0x9d7bff); fb.rect(bx + 6, 186, 8, 10, 0x2a2a3a);
    fb.rect(bx + 1, 208, 18, 9, 0xf3f3f7); text(fb, 'QWEN', bx + 10, 210, 0x615ced, { font: 'small', align: 'center' });
    fb.glow(bx + 10, 214, 22, 0x9d7bff, 0.5 * level);
  }
  // glowing answers dropping into the funnel
  for (let k = 0; k < 3; k++) {
    const q = (lt * 1.3 + k / 3) % 1;
    const px = lerp(500, fx, q), py = lerp(-10, fy - 90, q) - Math.sin(q * Math.PI) * 30;
    fb.glow(px, py, 14, 0xffa36b, 0.8); fb.rect(px - 6, py - 4, 12, 9, 0xffe2c8); claudeSpark(fb, px, py, 3, 0xd97757);
  }
  qwen(fb, 120, 262, { u: 4, spy: true, eyes: 'shifty', look: 1, mouth: lt > 0.6 ? 'smirk' : 'none', arms: Math.floor(lt * 8) % 2 ? ['hold', 'hold'] : ['sneak', 'sneak'] });
  const L = new LightMap().reset(0.45, 0.45, 0.62);
  L.light(fx, fy, 220, 0xffa060, 0.9);
  L.light(fx + 126, 214, 120, 0x9d7bff, 0.6);
  L.apply(fb, 9);
  rain(fb, t, { n: 70, speed: 280, angle: 0.15, len: 6, ground: 270, alpha: 0.3 });
  vignette(fb, 0.5);
}

// Gemini peeking from behind a barrel across the street, finding its courage
function barrelShot(fb, t) {
  const lt = t - 5;
  fb.gradV(0, 0, 480, 270, [0x070a1a, 0x10162e, 0x1a2036]);
  // distant yard: tiny queue and the glowing arc of answers
  fb.rect(0, 150, 480, 120, 0x141828);
  fb.poly([60, 150, 110, 120, 160, 150], 0x7a3a24); fb.rect(66, 150, 88, 30, 0x5a5048); fb.rect(132, 158, 10, 8, 0xffc27a);
  for (let i = 0; i < 6; i++) fb.rect(130 - i * 9, 168, 5, 12, 0x8a7050);
  for (let k = 0; k < 4; k++) { const q = ((lt * 0.9 + k / 4) % 1); const px = lerp(137, 30, q), py = lerp(162, 172, q) - Math.sin(q * Math.PI) * 30; fb.glow(px, py, 4, 0xffa36b, 0.8); }
  fb.glow(26, 176, 14, 0x9d7bff, 0.6);
  // cobblestones
  for (let y = 190; y < 270; y += 8) for (let x = ((y / 8) % 2) * 10; x < 480; x += 20) fb.rect(x, y, 18, 6, 0x1e2232);
  // the big barrel in the foreground
  const bx = 300, by = 262;
  fb.rect(bx, by - 96, 110, 96, 0x6a4630); fb.rect(bx - 6, by - 84, 122, 72, 0x7a5236);
  fb.rect(bx - 6, by - 78, 122, 4, 0x3a3a44); fb.rect(bx - 6, by - 26, 122, 4, 0x3a3a44);
  for (let k = 1; k < 5; k++) fb.rect(bx + k * 22, by - 94, 2, 92, 0x5a3a26);
  // Gemini peeks: forward, back, a memory of laughter, then courage
  const peek = key(lt, [[0, 0], [0.5, 1], [1.4, 1], [1.8, 1.4], [2.1, 0.8], [3.2, 0.6], [3.6, 1.2]]);
  const gx = bx - 4 - peek * 28, gy = 176 + float(t, 1, 2);
  const brave = lt > 3.4;
  gemini(fb, gx, gy, {
    size: 70, t, sat: 0.35 + (brave ? 0.25 * seg(lt, 3.4, 3.9) : 0), bright: brave ? 0.25 * seg(lt, 3.4, 3.9) : 0,
    eyes: lt < 1.4 ? 'wide' : lt < 3.0 ? (lt > 1.6 && lt < 2.9 ? 'sad' : 'wide') : lt < 3.4 ? 'closed' : 'determined',
    mouth: lt < 1.4 ? 'open' : lt < 3.0 ? 'frown' : 'flat', look: lt < 1.0 ? -1 : lt < 1.3 ? 1 : -1, droop: lt > 1.6 && lt < 3.0 ? 0.4 : 0,
    squash: lt > 3.0 && lt < 3.4 ? Math.sin((lt - 3.0) * 20) * 0.15 : 0,
  });
  if (lt > 1.6 && lt < 2.9) {
    thought(fb, gx - 150, 40, 110, 64, gx - 30, gy - 30);
    whale(fb, gx - 104, 96, { u: 1, eyes: 'laugh', mouth: 'laugh', t });
    text(fb, 'ХА-ХА', gx - 64, 62, 0x2a2a3a, { font: 'big' });
  }
  if (brave) for (let i = 0; i < 4; i++) { const a = t * 3 + i * 1.57; fb.set(gx + Math.cos(a) * 44, gy + Math.sin(a) * 30, 0xffffff); }
  const L = new LightMap().reset(0.5, 0.52, 0.7);
  L.light(100, 150, 120, 0xffa36b, 0.5);
  L.light(gx, gy, 90, 0xdfe8ff, brave ? 0.6 : 0.15);
  L.apply(fb, 8);
  rain(fb, t, { n: 110, speed: 300, angle: 0.15, len: 6, ground: 270, alpha: 0.35 });
  vignette(fb, 0.5);
}
