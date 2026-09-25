// Prologue (3D): November 18. Gemini launches lantern "3" — the brightest in the
// sky, and every firefly (user) flies to it. Six days later Clawd's "OPUS 4.5"
// rises higher, then Codex's "GPT-5.2". The fireflies drift away from "3".
import { hillWorld, SEA_Y } from '../world/hill.js';
import { r3d, actor, lanternW, worldLights, rgbf } from '../world/stage.js';
import { skyDome, seaPass } from '../engine/sky.js';
import { key, E, seg, clamp, lerp, hash, step } from '../engine/core.js';
import { vignette } from '../engine/fx.js';
import { lanternP, emote } from '../sprites/props.js';
import { caption, firework } from '../props.js';
import { hop, float, blink } from '../kit.js';

const OLD_B = [
  { label: 'GPT-5.1', kind: 'openai', d: [12, 27, 16] }, { label: 'SONNET 4.5', kind: 'claude', d: [-15, 24, 18] },
  { label: '2.5 PRO', kind: 'gem', d: [3, 19, 24] }, { label: 'V3.2', kind: 'whale', d: [22, 15, 30] },
  { label: 'K2', kind: 'kimi', d: [-24, 13, 30] }, { label: 'GROK 4', kind: 'plain', d: [-4, 30, 40] },
];
const OLD_C = [
  { label: 'GPT-5.1', kind: 'openai', d: [-14, 10, -14] }, { label: 'SONNET 4.5', kind: 'claude', d: [13, 9, -13] },
  { label: '2.5 PRO', kind: 'gem', d: [-5, 6.5, -16] }, { label: 'V3.2', kind: 'whale', d: [-21, 5, -20] },
  { label: 'K2', kind: 'kimi', d: [20, 5, -20] }, { label: 'GROK 4', kind: 'plain', d: [5, 13, -24] },
];

export default {
  dur: 15,
  in: { type: 'black', dur: 0.9 },
  render(fb, t) {
    const Wd = hillWorld();
    const P = Wd.plaza;
    const shot = t < 3.2 ? 'A' : t < 8.3 ? 'B' : 'C';
    let eye, tgt, fov = 48, sc = 1;
    if (shot === 'A') {
      eye = key(t, [[0, [P[0] - 13, P[1] + 9, P[2] - 37]], [3.2, [P[0] - 10, P[1] + 8, P[2] - 33]]], E.inOutSine);
      tgt = key(t, [[0, [P[0], P[1] + 46, P[2] + 22]], [3.0, [P[0] + 1, P[1] + 3, P[2] + 4], E.inOutCubic]]);
      sc = 0.5;
    } else if (shot === 'B') {
      const lt = seg(t, 3.9, 8.2);
      eye = [P[0] - 1 + (t - 3.2) * 0.25, P[1] + 3.2, P[2] - 18];
      tgt = [P[0] + 0.5, P[1] + 3.6 + E.inOutSine(clamp(lt * 1.6)) * 1.6, P[2] + 2];
    } else {
      eye = [P[0] + 3.5, P[1] + 1.5, P[2] + 11];
      const up = E.inOutCubic(seg(t, 13.6, 15));
      tgt = [P[0] + 2.5, P[1] + lerp(8.5, 30, up), P[2] - lerp(8, 12, up)];
      fov = 70;
    }
    r3d.camera(eye, tgt, fov);
    r3d.clear();
    const dome = skyDome(fb, r3d, t, { moon: [0.75, 0.62, 7] });
    seaPass(fb, r3d, t, SEA_Y + 0.5, { moonX: dome.moonX, far: dome.horizon });

    const side = shot === 'C' ? -1 : 1;
    const zc = shot === 'C' ? P[2] + 1 : P[2] - 0.5;
    const gPos = [P[0], P[1] + 0.5 + float(t, 0.12, 2.4) + hop(t, 4.4, 0.5, 1.0) + hop(t, 5.2, 0.5, 1.0) + hop(t, 6.0, 0.5, 0.8), P[2] - 1];
    const cPos = [P[0] - 5 * side + (side < 0 ? 2.5 : 0), P[1] + hop(t, 4.6, 0.35, 0.5) + hop(t, 5.4, 0.35, 0.5) + hop(t, 9.0, 0.4, 0.6), zc];
    const xPos = [P[0] + 5 * side + (side < 0 ? 2.5 : 0), P[1] + float(t, 0.15, 2, 1), zc];
    if (shot === 'C') { gPos[0] = P[0] + 2.5; gPos[2] = P[2] + 0.5; }

    const rise = (t0, t1, from, to) => {
      const k = E.outCubic(seg(t, t0, t1));
      return [lerp(from[0], to[0], k) + Math.sin(t * 0.8 + to[0]) * 0.3 * k, lerp(from[1], to[1], k), lerp(from[2], to[2], k)];
    };
    let gL, oL, xL;
    if (shot === 'C') {
      gL = [P[0] + 2 + Math.sin(t * 0.7) * 0.3, P[1] + 10.5, P[2] - 7];
      oL = rise(9.3, 11.6, [cPos[0], cPos[1] + 4, cPos[2]], [P[0] + 6, P[1] + 14, P[2] - 8]);
      xL = rise(11.8, 13.4, [xPos[0], xPos[1] + 4.5, xPos[2]], [P[0] - 3, P[1] + 17, P[2] - 9]);
    } else {
      gL = rise(3.9, 8.2, [gPos[0], gPos[1] + 4.2, gPos[2]], [P[0] + 1, P[1] + 33, P[2] + 6]);
    }
    const gLit = seg(t, 3.2, 3.8), oLit = seg(t, 8.7, 9.1), xLit = seg(t, 11.3, 11.7);

    r3d.ambient = [0.22, 0.25, 0.42];
    r3d.sun = { dir: [0.35, 0.8, 0.45], color: [0.24, 0.27, 0.4] };
    r3d.points = worldLights(Wd.lights.map((L) => ({ ...L, r: L.small ? 7 : 12 })), 1.6);
    if (gLit > 0) r3d.points.push({ p: gL, c: rgbf(0xcfe0ff, 1.8 * gLit), r: 15 });
    if (shot === 'C' && oLit > 0) r3d.points.push({ p: oL, c: rgbf(0xffa36b, 1.8 * oLit), r: 15 });
    if (shot === 'C' && xLit > 0) r3d.points.push({ p: xL, c: rgbf(0xdfe6ff, 1.7 * xLit), r: 15 });
    r3d.drawMesh(fb, Wd.mesh);
    if (shot !== 'C') r3d.drawMesh(fb, Wd.treeMesh);
    r3d.fog(fb, dome.horizon, 70, 230, 0.75);

    for (const L of shot === 'C' ? OLD_C : OLD_B) {
      const p = [P[0] + L.d[0] + Math.sin(t * 0.3 + L.d[0]) * 0.4, P[1] + L.d[1] + Math.sin(t * 0.5 + L.d[2]) * 0.25, P[2] + L.d[2]];
      lanternW(fb, p, { kind: L.kind, label: L.label, w: 12, smallLabel: true, t, lit: 0.6 });
    }

    // ---- characters ----
    const party = t > 4.2 && t < 8.3;
    const clap = party && Math.sin(t * 14) > 0;
    const cHold = t > 8.55 && t < 9.35, xHold = t > 11.1 && t < 11.85, gHold = t < 3.95;
    const cs = actor(fb, cPos, 'clawd', {
      eyes: party || t > 11.4 ? 'happy' : blink(t, 1) ? 'blink' : 'open', lookY: t > 9.3 ? -1 : 0, lookX: shot === 'C' && t < 9.3 ? 1 : 0,
      mouth: party ? 'open' : t > 11.4 ? 'smile' : 'smile', armL: cHold ? -14 : clap ? -8 : 0, armR: cHold ? -14 : clap ? -8 : 0, blush: party ? 'big' : true,
    }, { scale: sc });
    const xs = actor(fb, xPos, 'codex', {
      face: step(t, [[0, 'prompt'], [4.2, 'happy'], [8.3, 'prompt'], [10.2, 'wow'], [11.0, 'determined'], [11.9, 'happy']]), cursor: Math.floor(t * 3) % 2 === 0,
      armL: xHold || (party && Math.sin(t * 14 + 1) > 0) ? 'up' : undefined, armR: xHold || (party && Math.sin(t * 14) > 0) ? 'up' : undefined,
    }, { scale: sc, dy: -Math.round(float(t, 1.5, 2, 1)) });
    const spin = party && t < 5.6 ? Math.abs(Math.cos((t - 4.2) * 7)) : 1;
    const go = { eyes: 'open', mouth: 'smile' };
    if (t < 4.2) Object.assign(go, { handL: -14, handR: -14, eyes: 'happy', mouth: 'open' });
    else if (t < 8.3) Object.assign(go, { eyes: 'happy', mouth: 'open', blush: 'big', sx: Math.max(0.2, spin), handL: Math.sin(t * 12) > 0 ? -12 : 0, handR: Math.sin(t * 12) > 0 ? 0 : -12, lookY: t > 6.8 ? -1 : 0 });
    else if (t < 10.4) Object.assign(go, { eyes: blink(t, 3) ? 'blink' : 'open', mouth: 'smile', lookY: -1, lookX: t > 9.4 ? 1 : 0 });
    else if (t < 12.0) Object.assign(go, { eyes: 'wide', mouth: 'o', lookY: -1, lookX: 1 });
    else Object.assign(go, { eyes: blink(t, 3) ? 'blink' : 'open', mouth: 'flat', lookY: -1, grey: 0.15 * seg(t, 12, 13) });
    const gs = actor(fb, gPos, 'gemini', go, { scale: sc, groundY: P[1], lift: 0.55, glow: 0.08 });
    if (gs && t > 10.4 && sc === 1) emote(fb, 'sweat', gs.x + 24, gs.y - 50 + ((t * 2) % 1) * 4, { scale: 1 });

    // lanterns held above heads
    if (gHold && gs) lanternP(fb, gs.x, gs.y - (sc === 1 ? 72 : 36), { kind: 'gem', w: sc === 1 ? 20 : 12, lit: gLit, t, label: gLit > 0.5 && sc === 1 ? '3' : undefined });
    if (cHold && cs) lanternP(fb, cs.x, cs.y - 60, { kind: 'claude', w: 20, lit: oLit, t });
    if (xHold && xs) lanternP(fb, xs.x, xs.y - 70, { kind: 'openai', w: 20, lit: xLit, t });
    // released lanterns
    if (!gHold) lanternW(fb, gL, { kind: 'gem', label: '3', w: shot === 'C' ? 22 : 20, t, lit: 1 });
    if (shot === 'C' && t >= 9.35) lanternW(fb, oL, { kind: 'claude', label: 'OPUS 4.5', w: 24, t, lit: 1 });
    if (shot === 'C' && t >= 11.85) lanternW(fb, xL, { kind: 'openai', label: 'GPT-5.2', w: 24, t, lit: 1 });

    // fireflies = users
    for (let i = 0; i < 46; i++) {
      const h1 = hash(i * 7 + 1), h2 = hash(i * 7 + 2), h3 = hash(i * 7 + 3);
      const idle = [P[0] + (h1 - 0.5) * 30, P[1] + 1 + h2 * 6 + Math.sin(t * (0.6 + h3) + i) * 0.8, P[2] + (h3 - 0.3) * 16];
      const orb = (c, r) => [c[0] + Math.cos(t * (0.8 + h1) + i) * r * (0.5 + h2), c[1] + Math.sin(t * (1.1 + h3) + i * 2) * r * 0.6, c[2] + Math.sin(t * (0.8 + h1) + i) * r * (0.5 + h3)];
      let p;
      if (shot === 'C') {
        const k2 = E.inOutCubic(seg(t, 10.0 + h2 * 0.9, 11.8 + h2 * 1.2)) * (h3 > 0.1 ? 1 : 0);
        const a = orb(gL, 2.6), b = orb(oL, 2.6);
        p = [0, 1, 2].map((j) => lerp(a[j], b[j], k2));
      } else {
        const k1 = E.inOutCubic(seg(t, 4.1 + h1 * 0.8, 6.4 + h1 * 1.2));
        const a = orb(gL, 3.0);
        p = [0, 1, 2].map((j) => lerp(idle[j], a[j], k1));
      }
      r3d.spark(fb, p[0], p[1], p[2], 0xd9ff7a, 0.7 + 0.3 * Math.sin(t * (2 + h3 * 3) + i), 5);
    }
    r3d.outline(fb, 0.62);
    r3d.bloom(fb, 0.85, 3);
    if (shot === 'B') {
      const cols = [[0xea4335, 0xffb3a8], [0x4285f4, 0xbcd4ff], [0xfbbc04, 0xffe8a0], [0x34a853, 0xb8f0c8]];
      [4.6, 5.1, 5.7, 6.3, 6.9, 7.4].forEach((t0, k) => firework(fb, t, t0, [110, 370, 230, 60, 420, 180][k], [60, 45, 30, 50, 70, 40][k], cols[k % 4], k));
    }
    vignette(fb, 0.35);
    caption(fb, t, 1.0, 3.3, '18 НОЯБРЯ 2025');
    caption(fb, t, 8.5, 10.3, '6 ДНЕЙ СПУСТЯ');
  },
};
