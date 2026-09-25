// Gemini 4 (3D climax). On the hill Gemini's four points light up one by one —
// red, blue, green, yellow — and the rebuilt star lantern ignites with a "4".
// It rises into the empty slot in the sky; the COMING SOON sign snaps off;
// four-coloured aurora, the town glows, the fireflies come back.
import { hillWorld, SEA_Y } from '../world/hill.js';
import { r3d, actor, skyLantern, worldLights, rgbf } from '../world/stage3d.js';
import { skyDome, seaPass } from '../engine/sky.js';
import { key, E, seg, clamp, lerp, hash, mix, TAU } from '../engine/core.js';
import { vignette, stars, burst } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { scratch } from '../engine/fb.js';
import { clawd } from '../chars/clawd.js';
import { codex } from '../chars/codex.js';
import { gemini, starShape } from '../chars/gemini.js';
import { qwen } from '../chars/qwen.js';
import { whale, moon } from '../chars/extras.js';
import { woodSign, firework, lantern } from '../props.js';
import { starLantern } from './s09_montage.js';
import { cloud, SKY } from '../bg.js';
import { float, hop, bounce, eyesB } from '../kit.js';

const GC = [0xea4335, 0x4285f4, 0x34a853, 0xfbbc04]; // top, right, bottom, left
const LIGHT_T = [3.8, 4.5, 5.2, 5.9];

function aurora(fb, t, k, y0 = 0, h = 120) {
  if (k <= 0) return;
  const cols = [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853];
  for (let b = 0; b < 4; b++)
    for (let x = 0; x < fb.w; x += 1) {
      const base = y0 + 20 + b * 16 + Math.sin(x * 0.02 + t * 0.8 + b * 1.7) * 14 + Math.sin(x * 0.05 - t * 1.3 + b) * 5;
      const len = 18 + Math.sin(x * 0.07 + t * 2 + b * 3) * 8;
      for (let y = 0; y < len; y++) {
        const a = k * (1 - y / len) * 0.22 * (0.6 + 0.4 * Math.sin(x * 0.3 + b + t * 3));
        fb.add(x, base + y, cols[b], a);
      }
    }
}

export default {
  dur: 16,
  in: { type: 'black', dur: 0.8 },
  render(fb, t) {
    if (t >= 9.6 && t < 12.2) return skySlot(fb, t);
    const Wd = hillWorld();
    const P = Wd.plaza;
    const shot = t < 3.2 ? 'A' : t < 9.6 ? 'B' : 'E';
    let eye, tgt, U = { c: 2, x: 1, g: 32, w: 1 };
    const lit = seg(t, 6.3, 6.8);
    const rise = E.inOutSine(seg(t, 7.2, 9.6));
    const lanternP = [P[0], P[1] + 4.6 + rise * 36, P[2] + 2.5];
    if (shot === 'A') {
      eye = key(t, [[0, [P[0] - 15, P[1] + 11, P[2] - 38]], [3.2, [P[0] - 9, P[1] + 8, P[2] - 28]]], E.inOutSine);
      tgt = [P[0] + 1, P[1] + 3.5, P[2] + 3];
    } else if (shot === 'B') {
      eye = [P[0] - 2 + (t - 3.2) * 0.2, P[1] + 4.2, P[2] - 16];
      tgt = [P[0], lerp(P[1] + 3.6, lanternP[1] - 2, rise), P[2] + 2];
      U = { c: 3, x: 1.5, g: 46, w: 2 };
    } else {
      const a = lerp(-1.95, -1.25, E.inOutSine(seg(t, 12.2, 16)));
      eye = [P[0] + Math.cos(a) * 30, P[1] + 9, P[2] + Math.sin(a) * 30];
      tgt = [P[0], P[1] + 5, P[2] + 2];
    }
    r3d.camera(eye, tgt, shot === 'B' && rise > 0 ? 52 : 48);
    r3d.clear();
    const after = shot === 'E';
    const dome = skyDome(fb, r3d, t, { moon: [0.75, 0.62, 7], starAlpha: after ? 1 : seg(t, 0, 3) * 0.8 + 0.2 });
    if (after) aurora(fb, t, seg(t, 12.2, 13.2), 0, 110);
    seaPass(fb, r3d, t, SEA_Y + 0.5, { moonX: dome.moonX, far: dome.horizon, tint: after ? 0x6a4aa0 : undefined, tintK: 0.15 });

    // positions
    const gPos = [P[0], P[1] + 2.3 + float(t, 0.2, 2.4) + (lit > 0 ? 0.6 * lit : 0), P[2] - 1];
    const cPos = [P[0] - 5.5, P[1] + (after ? bounce(t, 0.5, 0.5) : 0), P[2] - 0.5];
    const xPos = [P[0] + 5.5, P[1] + 0.8 + float(t, 0.2, 2, 1), P[2] - 0.5];
    const wPos = [P[0] + 10.5, P[1] + 0.4, P[2] - 3.5], mPos = [P[0] + 13, P[1] + 0.2, P[2] - 2.5];
    const qPos = [P[0] - 11.5, P[1], P[2] + 3.5];

    // lights
    r3d.ambient = after ? [0.3, 0.28, 0.45] : [0.2, 0.23, 0.4];
    r3d.sun = { dir: [0.35, 0.8, 0.45], color: [0.22, 0.25, 0.38] };
    r3d.points = worldLights(Wd);
    LIGHT_T.forEach((t0, i) => { const k = seg(t, t0, t0 + 0.25) * (1 - 0.5 * seg(t, t0 + 0.4, t0 + 1.2)); if (k > 0 && !after) r3d.points.push({ p: gPos, c: rgbf(GC[i], 2.2 * k), r: 11 }); });
    if (lit > 0) r3d.points.push({ p: lanternP, c: rgbf(0xeef2ff, 2.4 * lit), r: 18 });
    if (after) {
      const tw = [[70, 16, 58], [96, 14, 52], [84, 16, 62], [108, 14, 60]];
      tw.forEach(([x, y, z], i) => r3d.points.push({ p: [x, y, z], c: rgbf(GC[i], 1.6 + 0.3 * Math.sin(t * 3 + i)), r: 26 }));
      r3d.points.push({ p: gPos, c: rgbf(0xffffff, 1.4), r: 12 });
    }
    r3d.drawMesh(fb, Wd.mesh);
    r3d.drawMesh(fb, Wd.treeMesh);
    r3d.fog(fb, dome.horizon, 70, 230, 0.7);

    // the lantern stand and star lantern
    if (rise < 0.02) {
      const sp = r3d.project(P[0], P[1], P[2] + 2.5);
      if (sp) r3d.layer(fb, sp[2] + 0.5, (L) => { const top = r3d.project(lanternP[0], lanternP[1] - 2.4, lanternP[2]); if (top) L.rect(sp[0] - 1, top[1], 3, sp[1] - top[1], 0x5a4636); });
    }
    const ls = r3d.project(lanternP[0], lanternP[1], lanternP[2]);
    if (ls && !after) {
      const size = clamp((5.2 * r3d.focal) / ls[2], 8, 140);
      starLantern(fb, ls[0], ls[1], size, lit, t, { noFrame: lit > 0.5 });
      if (lit > 0.2) text(fb, '4', ls[0], ls[1] - size * 0.12, 0xffffff, { scale: Math.max(1, Math.round(size / 40)), align: 'center', outline: 0x1a2046 });
    }
    if (after) skyLantern(fb, [P[0] + 3, P[1] + 44, P[2] + 30], { kind: 'gem', size: 7, label: 'GEMINI 4', t, lit: 1, maxSize: 60 });

    // characters
    if (shot !== 'B') actor(fb, qPos, (L, x, y) => qwen(L, x, y, { u: U.w, eyes: after ? 'scared' : 'shifty', look: 1, mouth: after ? 'open' : 'none', fur: after ? 1 : 0, sweat: after }), { lift: 0.3 });
    actor(fb, wPos, (L, x, y) => whale(L, x, y, { u: U.w, t, eyes: after ? 'shock' : 'smug', mouth: after ? 'o' : 'smile', flip: false }));
    actor(fb, mPos, (L, x, y) => moon(L, x, y, { u: U.w, t, eyes: after ? 'shock' : 'smug', mouth: after ? 'o' : 'smirk' }));
    actor(fb, cPos, (L, x, y) => clawd(L, x, y, { u: U.c, eyes: after ? 'happy' : t > 6.4 ? 'wide' : 'normal', lookY: rise > 0.2 ? -1 : 0, look: 1, armL: after ? 0.8 + Math.sin(t * 14) * 0.3 : 0, armR: after ? 0.8 - Math.sin(t * 14) * 0.3 : 0, blush: after, mouth: after ? 'open' : t > 6.4 && t < 7.6 ? 'o' : undefined }));
    actor(fb, xPos, (L, x, y) => codex(L, x, y, { u: U.x, t, face: after ? '^_^' : t > 6.4 ? 'o_o' : '>_', flip: true, hands: after ? { l: [-3, 6 + Math.sin(t * 14) * 3], r: [29, 6 - Math.sin(t * 14) * 3] } : undefined }));
    actor(fb, gPos, (L, x, y) => {
      const pts = LIGHT_T.map((t0) => E.outCubic(seg(t, t0, t0 + 0.3)) * 0.7 + 0.3);
      const full = seg(t, 6.2, 6.6);
      gemini(L, x, y, {
        size: U.g, t, pts: full > 0 || after ? undefined : pts, sat: t < 3.8 ? 0.8 : 1, bright: (full * 0.35) * (1 - seg(t, 7, 9)),
        eyes: t < 3.6 ? 'determined' : t < 6.3 ? 'closed' : after ? 'happy' : 'happy', mouth: t < 6.3 ? 'flat' : 'grin', blush: t > 6.3,
        lookY: rise > 0.2 ? -1 : 0, armL: after ? 0.7 : full * 0.6, armR: after ? 0.7 : full * 0.6,
      });
    }, { lift: 0.6, glow: 0.15 });

    // fireflies: few and dim before, swarming the hill after
    const nF = after ? 60 : 16;
    for (let i = 0; i < nF; i++) {
      const h1 = hash(i * 7 + 1), h2 = hash(i * 7 + 2), h3 = hash(i * 7 + 3);
      const R = after ? 6 + h2 * 10 : 10 + h1 * 12;
      const p = [P[0] + Math.cos(t * (0.5 + h1) + i) * R, P[1] + 2 + h3 * 7 + Math.sin(t * (1 + h2) + i) * 1.5, P[2] + Math.sin(t * (0.5 + h1) + i) * R * 0.8];
      r3d.spark(fb, p[0], p[1], p[2], 0xd9ff7a, (after ? 0.9 : 0.35) + 0.2 * Math.sin(t * 3 + i), after ? 5 : 3);
    }
    r3d.outline(fb, 0.62);
    r3d.bloom(fb, after ? 1.0 : 0.85, 3);

    // chimes: bursts in each colour as the points ignite
    if (shot === 'B') {
      const gs = r3d.project(gPos[0], gPos[1], gPos[2]);
      if (gs) LIGHT_T.forEach((t0, i) => burst(fb, t, t0, gs[0] + [0, 22, 0, -22][i], gs[1] + [-22, 0, 22, 0][i], { colors: [GC[i], 0xffffff], n: 18, speed: 50, gravity: 0, life: 0.8, seed: i }));
      if (t > 6.3 && t < 7.0) fb.overlay(0xffffff, (1 - seg(t, 6.3, 7.0)) * 0.5);
    }
    if (after) {
      const cols = [[0xea4335, 0xffb3a8], [0x4285f4, 0xbcd4ff], [0xfbbc04, 0xffe8a0], [0x34a853, 0xb8f0c8]];
      [12.6, 13.1, 13.7, 14.2, 14.8, 15.3].forEach((t0, k) => firework(fb, t, t0, [110, 370, 240, 60, 420, 180][k], [50, 40, 30, 60, 70, 45][k], cols[k % 4], k + 10));
      // the fallen sign at the bullies' feet
      const ws = r3d.project(P[0] + 10.8, P[1] + 0.1, P[2] - 5);
      if (ws) {
        const s = scratch(70, 16, 'sign');
        woodSign(s, 35, 8, 'COMING SOON', { font: 'small' });
        fb.blit(s, ws[0] - 35, ws[1] - 4, { sy: 0.45 });
      }
    }
    vignette(fb, 0.35);
  },
};

// the empty slot in the sky receives the "4"
function skySlot(fb, t) {
  const lt = t - 9.6;
  const fit = seg(lt, 1.1, 1.3);
  fb.gradV(0, 0, 480, 270, SKY.night);
  stars(fb, t, 81, 200, 0, 0, 480, 270);
  aurora(fb, t, seg(lt, 1.25, 2.4), 10, 120);
  const sx = 240, sy = 100, S = 110;
  if (fit < 1) {
    starShape(fb, sx, sy, S, (a, r, px, py) => (r > 0.86 || (px * 3 + py) % 7 === 0 ? 0x8a96c8 : null));
    fb.line(sx, sy + S * 0.4, sx - 16, sy + 58, 0x8a7a60); fb.line(sx, sy + S * 0.4, sx + 16, sy + 58, 0x8a7a60);
    woodSign(fb, sx, sy + 66, 'COMING SOON', { font: 'big' });
  } else {
    // the sign snaps off and tumbles down
    const k = seg(lt, 1.25, 2.6);
    const y = sy + 66 + k * k * 260, x = sx + k * 40 + Math.sin(k * 12) * 6;
    const s = scratch(110, 20, 'sign2');
    woodSign(s, 55, 10, 'COMING SOON', { font: 'big' });
    fb.blit(s, x - 55, y - 10, { sy: Math.max(0.2, Math.abs(Math.cos(k * 9))) });
  }
  // the lantern rises into place
  const rk = E.outCubic(seg(lt, 0, 1.2));
  const ly = lerp(330, sy, rk);
  starLantern(fb, sx, ly, S, 1, t, { noFrame: true });
  text(fb, '4', sx, ly - 12, 0xffffff, { scale: 3, align: 'center', outline: 0x1a2046 });
  if (fit > 0) {
    const f = seg(lt, 1.2, 1.9);
    fb.glow(sx, sy, 60 + f * 200, 0xffffff, 1.2 * (1 - f), 6);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r0 = 40 + f * 30, r1 = 60 + f * 260;
      fb.line(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0, sx + Math.cos(a) * r1, sy + Math.sin(a) * r1, GC[i % 4], 0.8 * (1 - f));
    }
    if (lt > 1.4) text(fb, 'GEMINI 4', sx, sy + 70, 0xffffff, { scale: 2, align: 'center', outline: 0x1a2046 });
  }
  vignette(fb, 0.4);
}
