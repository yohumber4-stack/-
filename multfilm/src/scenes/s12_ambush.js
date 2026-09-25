// The ambush. Qwen sneaks back with a bigger distiller for "sleeping" Clawd —
// but the Clawd in the hammock is an inflatable decoy. Eyes glow in the bushes;
// Codex hits Enter, a cage of curly braces drops, Gemini's spotlight blazes,
// the distiller backfires. Qwen panics and flees.
import { E, seg, clamp, lerp, hash, mix, key, step } from '../engine/core.js';
import { vignette, LightMap, stars, smoke, speedLines, drawFlies } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { cloud } from '../bg.js';
import { decoy, distiller } from '../props.js';
import { cottage, fence } from '../world/cottage.js';
import { gemini } from '../chars/gemini.js';
import { clawd } from '../chars/clawd.js';
import { codex } from '../chars/codex.js';
import { qwen } from '../chars/qwen.js';
import { float, hop, bounce, eyesB } from '../kit.js';

const GY = 236;

export default {
  dur: 15,
  in: { type: 'black', dur: 0.6 },
  out: { type: 'black', dur: 0.5 },
  render(fb, t) {
    const spot = seg(t, 7.4, 7.7) * (1 - 0.5 * seg(t, 11.5, 14));
    // night yard
    fb.gradV(0, 0, 480, 160, [0x080b1e, 0x141a3c, 0x222a56]);
    stars(fb, t, 91, 90, 0, 0, 480, 110);
    fb.circle(410, 40, 10, 0xfdf6d8); fb.glow(410, 40, 40, 0xbfd0ff, 0.3);
    for (let i = 0; i < 3; i++) cloud(fb, ((i * 190 + t * 4) % 700) - 100, 30 + i * 12, 120, 0x222a50, 0x1a2040, i + 51, 0.8);
    fb.rect(0, 160, 480, 76, 0x161b2e);
    cottage(fb, 300, GY - 6, { t, lamp: 0, sleeping: false });
    fence(fb, 0, 290, 222, 0x4a4050);
    fb.rect(0, GY - 6, 480, 40, 0x2a2e38);
    // hammock between two posts
    const hx0 = 120, hx1 = 240, hy = 192;
    fb.rect(hx0 - 2, hy - 20, 4, GY - hy + 14, 0x6d4a32); fb.rect(hx1 - 2, hy - 20, 4, GY - hy + 14, 0x6d4a32);
    for (let x = hx0; x <= hx1; x++) { const k = (x - hx0) / (hx1 - hx0); const y = hy - 14 + Math.sin(k * Math.PI) * 16; fb.rect(x, y, 1, 3, 0xd9c7a0); }
    // the decoy "Clawd" asleep in the hammock (deflates under suction)
    const deflate = seg(t, 4.2, 5.4);
    const dx = 180, dy = hy + 4;
    if (deflate < 1) clawd(fb, dx, dy, { u: 3, eyes: 'closed', hat: 'nightcap', squash: deflate * 1.8, tint: deflate > 0.3 ? 0x8a6a5a : undefined, tintK: deflate * 0.5 });
    else { fb.rect(dx - 24, dy - 4, 48, 4, 0xc8704c); fb.rect(dx - 10, dy - 6, 20, 2, 0x4b6cc9); }
    if (t < 4.2) for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; text(fb, 'Z', dx + 18 + k * 12, dy - 30 - k * 16, 0xffffff, { font: 'small' }); }
    if (t > 4.3 && t < 5.4) text(fb, 'ПФФФ', dx - 20, dy - 44, 0xffffff, { outline: 0x1a1a2a });

    // Qwen's big distiller on a cart with a hose and suction funnel
    const qArrive = E.inOutSine(seg(t, 0.2, 2.8));
    const cartX = lerp(-120, 20, qArrive);
    const broken = seg(t, 8.6, 8.8);
    distiller(fb, cartX, GY - 2, t, { broken, bottles: 3, liquid: t > 3.8 && t < 5.4 ? 0xffa060 : 0x6a5a8a });
    fb.rect(cartX, GY - 2, 60, 3, 0x3a3a44); fb.circle(cartX + 8, GY + 2, 3, 0x22222a); fb.circle(cartX + 52, GY + 2, 3, 0x22222a);
    // decoys trailing behind (they will topple)
    for (let i = 0; i < 4; i++) decoy(fb, cartX - 20 - i * 20, GY - 1, { variant: i + 2, fall: seg(t, 8.0 + i * 0.12, 8.35 + i * 0.12) });

    // Qwen
    let qx = lerp(-60, 150, E.inOutSine(seg(t, 0.4, 3.2))), qy = GY - 2, qo = { u: 2, spy: true, tiptoe: t < 3.2, walk: t < 3.2 ? t * 2 : undefined, eyes: 'shifty', look: t % 1.2 < 0.6 ? -1 : 1, arms: 'sneak', t };
    if (t > 3.2 && t < 4.2) { qo.arms = ['hold', 'down']; qo.mouth = 'smirk'; qo.look = 1; }
    if (t >= 4.2 && t < 7.4) { qo.arms = 'down'; qo.mouth = t > 5.0 ? 'o' : 'smirk'; qo.eyes = 'shifty'; qo.look = t > 5.6 ? 1 : 0; }
    if (t >= 7.4 && t < 11.2) { qo.glasses = t < 9.4; qo.eyes = 'scared'; qo.mouth = 'open'; qo.fur = 1; qo.sweat = true; qo.arms = 'up'; qx += Math.sin(t * 60) * 1; qy += hop(t, 9.6, 0.6, 34); }
    if (t >= 11.2) {
      const k = seg(t, 11.2, 14.5);
      qx = lerp(150, -60, E.inQuad(k)); qo.glasses = false; qo.hat = false; qo.eyes = 'scared'; qo.mouth = 'open'; qo.fur = 1; qo.arms = 'flail'; qo.walk = t * 7; qo.lean = -1;
      if (t > 12.6 && t < 13.2) { qy -= Math.sin(seg(t, 12.6, 13.2) * Math.PI) * 14; }
      speedLines(fb, t, GY - 50, GY - 4, 0xffffff, 0.3, 10, -1);
      smoke(fb, t, 11.3, qx + 18, GY - 4, { n: 8, color: 0x8a8a9a, size: 5, rise: 6, gap: 0.08 });
    }
    // hose from the distiller to the funnel on the hammock
    const fx = lerp(cartX + 40, dx, seg(t, 3.0, 3.8)), fy = lerp(GY - 30, dy - 22, seg(t, 3.0, 3.8));
    if (t > 2.6 && broken < 1) {
      for (let k = 0; k <= 20; k++) { const q = k / 20; fb.rect(lerp(cartX + 40, fx, q), lerp(GY - 30, fy, q) - Math.sin(q * Math.PI) * 20, 2, 2, 0x5a5a6a); }
      fb.poly([fx - 8, fy + 6, fx + 8, fy + 6, fx + 3, fy - 2, fx - 3, fy - 2], 0x9aa0b0);
    }
    if (broken > 0) {
      // backfire: purple goo splashes over Qwen
      const g = seg(t, 8.6, 9.2);
      for (let i = 0; i < 26; i++) { const a = hash(i) * Math.PI; const r = g * (20 + hash(i * 3) * 40); fb.circle(cartX + 40 + Math.cos(a) * r * 1.6, GY - 20 - Math.sin(a) * r + g * g * 20, 2, 0x9d5bff); }
    }
    qwen(fb, qx, qy, qo);
    if (t > 9.0 && t < 14.6) for (let i = 0; i < 7; i++) fb.circle(qx - 12 + hash(i) * 24, qy - 50 + hash(i * 5) * 44, 2, 0x9d5bff);
    if (t > 5.2 && t < 7.2) text(fb, '?', qx + 18, qy - 70 + Math.sin(t * 5), 0xffffff, { scale: 3, outline: 0x1a1a2a });
    if (t > 9.5 && t < 11.0) text(fb, '!!!', qx - 16, qy - 84, 0xffe08a, { scale: 2, outline: 0x1a1a2a });

    // the cage of curly braces
    const cage = E.outBounce(seg(t, 7.2, 7.7)) * (1 - E.inQuad(seg(t, 10.8, 11.2)));
    if (cage > 0) {
      const cy = lerp(-80, GY - 92, cage);
      text(fb, '{', 96, cy, 0x9cffd0, { scale: 12, font: 'small' });
      text(fb, '}', 176, cy, 0x9cffd0, { scale: 12, font: 'small' });
      for (let i = 0; i < 4; i++) fb.rect(128 + i * 12, cy + 6, 2, 50, 0x9cffd0, 0.8);
      fb.glow(150, cy + 30, 60, 0x9cffd0, 0.25);
    }

    // the real friends hiding in the bushes (right foreground)
    const reveal = t > 5.6;
    const burstOut = seg(t, 7.2, 7.6);
    const bxs = 380;
    if (burstOut < 1) {
      for (const [cx, r] of [[bxs - 50, 26], [bxs, 32], [bxs + 50, 28], [bxs + 90, 22]]) { fb.circle(cx, GY + 8, r, 0x1e4a2e); fb.circle(cx - 6, GY + 2, r * 0.6, 0x2a5a36); }
      if (reveal) {
        const a = seg(t, 5.6, 6.2);
        // Clawd's eyes, Codex's glowing screen, Gemini's glint
        fb.rect(bxs - 60, GY - 10, 3, 6, mix(0x1e4a2e, 0xffa36b, a)); fb.rect(bxs - 44, GY - 10, 3, 6, mix(0x1e4a2e, 0xffa36b, a));
        fb.rect(bxs - 8, GY - 14, 22, 12, mix(0x1e4a2e, 0x151726, a)); text(fb, '>:)', bxs + 3, GY - 11, mix(0x1e4a2e, 0x9cffd0, a), { font: 'small', align: 'center' });
        fb.glow(bxs + 56, GY - 8, 10, 0xdfe8ff, 0.6 * a);
        for (let i = 0; i < 4; i++) fb.set(bxs + 56 + [0, 4, 0, -4][i], GY - 8 + [-4, 0, 4, 0][i], [0xea4335, 0x4285f4, 0x34a853, 0xfbbc04][i]);
      }
    }
    if (burstOut > 0) {
      const laugh = t > 12.2;
      clawd(fb, lerp(bxs - 52, 300, E.outCubic(burstOut)), GY + 2 + hop(t, 7.2, 0.4, 16) + (laugh ? bounce(t, 0.35, 3) : 0), { u: 3, eyes: laugh ? 'happy' : 'determined', mouth: laugh ? 'open' : undefined, armR: t > 13.4 && t < 14.2 ? 1.1 : laugh ? 0.6 : 0.3, armL: laugh ? 0.6 : 0.3, look: -1 });
      codex(fb, lerp(bxs + 4, 430, E.outCubic(burstOut)), GY - 4 + float(t, 1.5, 3) + (laugh ? bounce(t + 0.1, 0.35, 3) : 0), { u: 1.5, t, face: laugh ? '^_^' : t < 7.6 ? '>:)' : 'code', flip: true, hands: { l: [2, 17], r: [24, 17] } });
      if (t < 11) { fb.rect(404, GY - 8, 28, 4, 0x3a3a48); fb.rect(406, GY - 18, 24, 10, 0x22222c); if (t > 7.0 && t < 7.4) fb.glow(418, GY - 12, 10, 0x9cffd0, 0.8); }
      const gx = lerp(bxs + 56, 250, E.outCubic(burstOut)), gy = GY - 70 + float(t, 2, 2.4) + (laugh ? bounce(t + 0.2, 0.35, 3) : 0);
      gemini(fb, gx, gy, { size: 44, t, bright: spot * 0.4, eyes: laugh ? 'happy' : 'determined', mouth: laugh ? 'grin' : 'flat', armL: t > 13.4 && t < 14.2 ? 1.1 : 0.5, armR: 0.5, blush: laugh });
      if (t > 13.5 && t < 14.3) for (let i = 0; i < 8; i++) { const a = i * 0.785; fb.set(270 + Math.cos(a) * (4 + (t - 13.5) * 30), GY - 44 + Math.sin(a) * (4 + (t - 13.5) * 30), 0xffffff); }
    }

    // lighting: moonlit night; the spotlight turns everything bright
    const L = new LightMap().reset(0.5 + spot * 0.6, 0.52 + spot * 0.6, 0.72 + spot * 0.5);
    if (t > 3.8 && t < 5.4) L.light(cartX + 10, GY - 12, 60, 0xffa060, 0.8);
    if (spot > 0) {
      L.cone(250, GY - 90, 120, 0.7, 0xffffff, 1.6 * spot);
      L.light(150, GY - 30, 90, 0xea4335, 0.3 * spot); L.light(170, GY - 30, 90, 0x4285f4, 0.3 * spot);
    }
    if (cage > 0) L.light(150, GY - 60, 90, 0x9cffd0, 0.5 * cage);
    L.apply(fb, 9);
    if (spot > 0 && t < 7.9) fb.overlay(0xffffff, (1 - seg(t, 7.4, 7.9)) * 0.5);
    if (t > 12) drawFlies(fb, Array.from({ length: 8 }, (_, i) => [260 + Math.cos(t + i) * 80, 150 + Math.sin(t * 1.3 + i) * 30, 0.7]), 0xd9ff7a, 0.8);
    vignette(fb, 0.45);
  },
};
