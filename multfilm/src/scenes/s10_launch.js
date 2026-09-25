// Gemini 4 (3D climax). On the hill Gemini's rays light up one by one — red, blue,
// green, yellow — and the rebuilt star lantern ignites with a "4". It rises into
// the empty slot in the sky; the COMING SOON sign snaps off; four-coloured aurora,
// fireworks, the fireflies come back. The bullies and the copycat stare.
import { hillWorld, SEA_Y } from '../world/hill.js';
import { r3d, actor, billboard, lanternW, worldLights, rgbf } from '../world/stage.js';
import { skyDome, seaPass } from '../engine/sky.js';
import { key, E, seg, clamp, lerp, hash, TAU } from '../engine/core.js';
import { vignette, stars, burst } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { scratch } from '../engine/fb.js';
import { lanternP, emote } from '../sprites/props.js';
import { char } from '../sprites/chars.js';
import { woodSign, firework } from '../props.js';
import { starShape } from '../sprites/star.js';
import { SKY } from '../bg.js';
import { float, bounce, blink } from '../kit.js';

const GC = [0xea4335, 0x4285f4, 0x34a853, 0xfbbc04];
const LIGHT_T = [3.8, 4.5, 5.2, 5.9];

function aurora(fb, t, k, y0 = 0) {
  if (k <= 0) return;
  const cols = [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853];
  for (let b = 0; b < 4; b++) for (let x = 0; x < fb.w; x++) {
    const base = y0 + 20 + b * 16 + Math.sin(x * 0.02 + t * 0.8 + b * 1.7) * 14 + Math.sin(x * 0.05 - t * 1.3 + b) * 5;
    const len = 18 + Math.sin(x * 0.07 + t * 2 + b * 3) * 8;
    for (let y = 0; y < len; y++) fb.add(x, base + y, cols[b], k * (1 - y / len) * 0.22 * (0.6 + 0.4 * Math.sin(x * 0.3 + b + t * 3)));
  }
}

export default {
  dur: 16,
  in: { type: 'black', dur: 0.8 },
  render(fb, t) {
    if (t >= 9.6 && t < 12.2) return skySlot(fb, t);
    const Wd = hillWorld(), P = Wd.plaza;
    const shot = t < 3.2 ? 'A' : t < 9.6 ? 'B' : 'E';
    const lit = seg(t, 6.3, 6.8), rise = E.inOutSine(seg(t, 7.2, 9.6));
    const lanternP3 = [P[0], P[1] + 4.2 + rise * 30, P[2] + 2.5];
    let sc = 1;
    if (shot === 'A') { r3d.camera(key(t, [[0, [P[0] - 15, P[1] + 11, P[2] - 36]], [3.2, [P[0] - 8, P[1] + 7, P[2] - 26]]], E.inOutSine), [P[0] + 1, P[1] + 3, P[2] + 3], 48); sc = 0.5; }
    else if (shot === 'B') r3d.camera([P[0] - 1, P[1] + 3.4, P[2] - 15], [P[0], lerp(P[1] + 3.6, lanternP3[1] - 3, rise), P[2] + 2], rise > 0 ? 54 : 50);
    else { const a = lerp(-1.95, -1.25, E.inOutSine(seg(t, 12.2, 16))); r3d.camera([P[0] + Math.cos(a) * 26, P[1] + 7, P[2] + Math.sin(a) * 26], [P[0], P[1] + 4.5, P[2] + 1], 50); sc = 0.5; }
    r3d.clear();
    const after = shot === 'E';
    const dome = skyDome(fb, r3d, t, { moon: [0.75, 0.62, 7] });
    if (after) aurora(fb, t, seg(t, 12.2, 13.2), 0);
    seaPass(fb, r3d, t, SEA_Y + 0.5, { moonX: dome.moonX, far: dome.horizon, tint: after ? 0x6a4aa0 : undefined, tintK: 0.15 });
    const gPos = [P[0], P[1] + 0.6 + float(t, 0.12, 2.4) + lit * 0.4, P[2] - 1];
    r3d.ambient = after ? [0.32, 0.3, 0.48] : [0.22, 0.25, 0.42];
    r3d.sun = { dir: [0.35, 0.8, 0.45], color: [0.24, 0.27, 0.4] };
    r3d.points = worldLights(Wd.lights.map((L) => ({ ...L, r: L.small ? 7 : 12 })), 1.6);
    LIGHT_T.forEach((t0, i) => { const k = seg(t, t0, t0 + 0.25) * (1 - 0.5 * seg(t, t0 + 0.4, t0 + 1.2)); if (k > 0 && !after) r3d.points.push({ p: gPos, c: rgbf(GC[i], 2.2 * k), r: 11 }); });
    if (lit > 0) r3d.points.push({ p: lanternP3, c: rgbf(0xeef2ff, 2.4 * lit), r: 18 });
    if (after) { [[70, 16, 58], [96, 14, 52], [84, 16, 62], [108, 14, 60]].forEach(([x, y, z], i) => r3d.points.push({ p: [x, y, z], c: rgbf(GC[i], 1.6 + 0.3 * Math.sin(t * 3 + i)), r: 26 })); r3d.points.push({ p: gPos, c: rgbf(0xffffff, 1.4), r: 12 }); }
    r3d.drawMesh(fb, Wd.mesh);
    r3d.drawMesh(fb, Wd.treeMesh);
    r3d.fog(fb, dome.horizon, 70, 230, 0.7);
    // the rebuilt star lantern on its stand, then rising
    if (!after) billboard(fb, lanternP3, (L, x, y) => {
      if (rise < 0.02) { const g = r3d.project(P[0], P[1], P[2] + 2.5); if (g) L.rect(x - 1, y + 20, 3, Math.max(0, g[1] - y - 20), 0x5a4636); }
      lanternP(L, x, y, { kind: 'gem', w: sc === 1 ? 44 : 22, lit, t, glow: false });
      if (lit > 0.3) text(L, '4', x, y - 7, 0xffffff, { scale: sc === 1 ? 2 : 1, align: 'center', outline: 0x1a2046 });
    }, { bias: 0.2, glow: lit * 0.3 });
    if (!after && lit > 0) { const lp = r3d.project(lanternP3[0], lanternP3[1], lanternP3[2]); if (lp) fb.glow(lp[0], lp[1], sc === 1 ? 70 : 36, 0xcfe0ff, 0.6 * lit, 6); }
    else lanternW(fb, [P[0] + 3, P[1] + 44, P[2] + 30], { kind: 'gem', w: 30, label: 'GEMINI 4', t });
    // characters
    const cheer = after;
    actor(fb, [P[0] + 12, P[1], P[2] + 3], 'qwen', { eyes: after ? 'shock' : 'shifty', mouth: after ? 'scream' : 'smile', spy: true, handL: after ? -12 : 0, handR: after ? -12 : 0 }, { scale: sc === 1 ? 1 : 0.5, lift: 0.4 });
    actor(fb, [P[0] - 10.5, P[1] + 0.4, P[2] - 3.5], 'deepseek', { eyes: after ? 'shock' : 'shifty', mouth: after ? 'bigo' : 'smirk' }, { scale: sc, lift: 0.45 });
    actor(fb, [P[0] - 13, P[1], P[2] - 2.5], 'kimi', { eyes: after ? 'shock' : 'shifty', mouth: after ? 'bigo' : 'smirk' }, { scale: sc, lift: 0.45 });
    actor(fb, [P[0] + 5.5, P[1] + (cheer ? bounce(t, 0.5, 0.5) : 0), P[2] - 0.5], 'clawd', { eyes: cheer ? 'happy' : t > 6.4 ? 'wide' : 'open', lookY: rise > 0.2 ? -1 : 0, lookX: -1, armL: cheer && Math.sin(t * 14) > 0 ? -12 : 0, armR: cheer && Math.sin(t * 14 + 1) > 0 ? -12 : 0, blush: cheer ? 'big' : true, mouth: cheer ? 'open' : t > 6.4 && t < 7.6 ? 'o' : 'smile' }, { scale: sc });
    actor(fb, [P[0] - 5.5, P[1], P[2] - 0.5], 'codex', { face: cheer ? 'happy' : t > 6.4 ? 'wow' : 'prompt', armL: cheer && Math.sin(t * 14) > 0 ? 'up' : undefined, armR: cheer && Math.sin(t * 14 + 1) > 0 ? 'up' : undefined }, { scale: sc, dy: -Math.round(float(t, 1.5, 2)) });
    const rays = { r: seg(t, 3.8, 4.1) * 0.8 + 0.2, b: seg(t, 4.5, 4.8) * 0.8 + 0.2, g: seg(t, 5.2, 5.5) * 0.8 + 0.2, y: seg(t, 5.9, 6.2) * 0.8 + 0.2 };
    const gs = actor(fb, gPos, 'gemini', {
      eyes: t < 3.6 ? 'determined' : t < 6.3 ? 'closed' : 'happy', mouth: t < 6.3 ? 'flat' : 'laugh', blush: t > 6.3 ? 'big' : true,
      rays: after ? undefined : rays, lookY: rise > 0.2 ? -1 : 0, handL: t > 6.3 ? -14 : -6, handR: t > 6.3 ? -14 : -6, bright: lit * 0.2 * (1 - rise),
    }, { scale: sc, groundY: P[1], lift: 0.6, glow: 0.12 + lit * 0.2 });
    for (let i = 0; i < (after ? 60 : 16); i++) {
      const h1 = hash(i * 7 + 1), h2 = hash(i * 7 + 2), h3 = hash(i * 7 + 3);
      const R = after ? 6 + h2 * 10 : 10 + h1 * 12;
      r3d.spark(fb, P[0] + Math.cos(t * (0.5 + h1) + i) * R, P[1] + 2 + h3 * 7 + Math.sin(t * (1 + h2) + i) * 1.5, P[2] + Math.sin(t * (0.5 + h1) + i) * R * 0.8, 0xd9ff7a, (after ? 0.9 : 0.35) + 0.2 * Math.sin(t * 3 + i), after ? 5 : 3);
    }
    r3d.outline(fb, 0.62);
    r3d.bloom(fb, after ? 1.0 : 0.85, 3);
    if (shot === 'B' && gs) {
      LIGHT_T.forEach((t0, i) => burst(fb, t, t0, gs.x + [0, 24, 0, -24][i], gs.y - 28 + [-24, 0, 24, 0][i], { colors: [GC[i], 0xffffff], n: 18, speed: 50, gravity: 0, life: 0.8, seed: i }));
      if (t > 6.3 && t < 7.0) fb.overlay(0xffffff, (1 - seg(t, 6.3, 7.0)) * 0.5);
    }
    if (after) {
      const cols = [[0xea4335, 0xffb3a8], [0x4285f4, 0xbcd4ff], [0xfbbc04, 0xffe8a0], [0x34a853, 0xb8f0c8]];
      [12.6, 13.1, 13.7, 14.2, 14.8, 15.3].forEach((t0, k) => firework(fb, t, t0, [110, 370, 240, 60, 420, 180][k], [50, 40, 30, 60, 70, 45][k], cols[k % 4], k + 10));
      const ws = r3d.project(P[0] - 11.5, P[1] + 0.1, P[2] - 5);
      if (ws) { const s = scratch(70, 16, 'sign'); woodSign(s, 35, 8, 'COMING SOON', { font: 'small' }); fb.blit(s, ws[0] - 35, ws[1] - 4, { sy: 0.45 }); }
    }
    vignette(fb, 0.35);
  },
};

// the empty slot in the sky receives the "4"
function skySlot(fb, t) {
  const lt = t - 9.6, fit = seg(lt, 1.1, 1.3);
  fb.gradV(0, 0, 480, 270, SKY.night);
  stars(fb, t, 81, 200, 0, 0, 480, 270);
  aurora(fb, t, seg(lt, 1.25, 2.4), 10);
  const sx = 240, sy = 100, S = 110;
  if (fit < 1) {
    starShape(fb, sx, sy, S, (a, r, px, py) => (r > 0.86 || (px * 3 + py) % 7 === 0 ? 0x8a96c8 : null));
    fb.line(sx, sy + S * 0.4, sx - 16, sy + 58, 0x8a7a60); fb.line(sx, sy + S * 0.4, sx + 16, sy + 58, 0x8a7a60);
    woodSign(fb, sx, sy + 66, 'COMING SOON', { font: 'big' });
  } else {
    const k = seg(lt, 1.25, 2.6), y = sy + 66 + k * k * 260, x = sx + k * 40 + Math.sin(k * 12) * 6;
    const s = scratch(110, 20, 'sign2'); woodSign(s, 55, 10, 'COMING SOON', { font: 'big' });
    fb.blit(s, x - 55, y - 10, { sy: Math.max(0.2, Math.abs(Math.cos(k * 9))) });
  }
  const rk = E.outCubic(seg(lt, 0, 1.2)), ly = lerp(330, sy, rk);
  lanternP(fb, sx, ly, { kind: 'gem', w: 76, t });
  text(fb, '4', sx, ly - 10, 0xffffff, { scale: 3, align: 'center', outline: 0x1a2046 });
  if (fit > 0) {
    const f = seg(lt, 1.2, 1.9);
    fb.glow(sx, sy, 60 + f * 200, 0xffffff, 1.2 * (1 - f), 6);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r0 = 40 + f * 30, r1 = 60 + f * 260; fb.line(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0, sx + Math.cos(a) * r1, sy + Math.sin(a) * r1, GC[i % 4], 0.8 * (1 - f)); }
    if (lt > 1.4) text(fb, 'GEMINI 4', sx, sy + 70, 0xffffff, { scale: 2, align: 'center', outline: 0x1a2046 });
  }
  vignette(fb, 0.4);
}
