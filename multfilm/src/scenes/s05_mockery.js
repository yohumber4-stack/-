// The hill at dusk. Clawd and Codex release their flagships high into the sky.
// Gemini's Flash rocket outshines them for one second and pops. DeepSeek and
// Kimi release V4 and K3 — higher than anything Gemini has — laugh, slap a
// "COMING SOON" sticker on Gemini and drench it. Gemini leaves; Clawd notices.
import { hillWorld, SEA_Y } from '../world/hill.js';
import { r3d, actor, billboard, lanternW, worldLights, rgbf } from '../world/stage.js';
import { skyDome, seaPass } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, mix } from '../engine/core.js';
import { vignette, rain } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { rocket, exhaust, emote, bubble, lanternP } from '../sprites/props.js';
import { flashPop } from '../props.js';
import { cloud } from '../bg.js';
import { tag } from './common.js';
import { hop, bounce, float, blink } from '../kit.js';

const DUSK = [0xffb88a, 0xe07a7a, 0x8a4a86, 0x3b2a6a, 0x1a1a44];
const STORM = [0x5a5a78, 0x3a3a5a, 0x262640, 0x15152a];

export default {
  dur: 14,
  in: { type: 'black', dur: 0.5 },
  render(fb, t) {
    const Wd = hillWorld(), P = Wd.plaza;
    const shot = t < 4.2 ? 'A' : t < 5.8 ? 'B' : t < 11.0 ? 'C' : 'D';
    if (shot === 'B') r3d.camera([P[0] - 0.5, P[1] + 1.2, P[2] - 6], [P[0], P[1] + 4.5, P[2] + 6], 55);
    else if (shot === 'D') { const k = E.inOutSine(seg(t, 11, 14)); r3d.camera([P[0] - 2 + k * 3, P[1] + 4 + k, P[2] - 15 - k * 2], [P[0] + 3 + k * 3, P[1] + 2.5, P[2]], 50); }
    else r3d.camera([P[0] - 1.2, P[1] + 4.2, P[2] - 17.5], [P[0] - 1.2, P[1] + 4.6, P[2] + 2], 50);
    r3d.clear();
    const storm = seg(t, 11.2, 14);
    const stops = DUSK.map((c, i) => mix(c, STORM[Math.min(i, 3)], storm));
    skyDome(fb, r3d, t, { stops, stars: 60, starAlpha: 0.5 * (1 - storm), span: 0.55 });
    seaPass(fb, r3d, t, SEA_Y + 0.5, { moonX: -999, far: mix(0xd08a8a, 0x3a3a5a, storm), deep: mix(0x3a3060, 0x151a30, storm), glint: 0xffd0a0 });
    r3d.ambient = [0.5 - storm * 0.15, 0.42 - storm * 0.1, 0.5 - storm * 0.05];
    r3d.sun = { dir: [0.5, 0.35, -0.6], color: [0.7 * (1 - storm), 0.45 * (1 - storm), 0.35 * (1 - storm)] };
    r3d.points = worldLights(Wd.lights.map((L) => ({ ...L, r: 10 })), 1.1);
    const fl = clamp(1 - Math.abs(t - 4.4) / 0.4);
    if (fl > 0) r3d.points.push({ p: [P[0], P[1] + 14, P[2] + 4], c: rgbf(0xfff4d0, 2.4 * fl), r: 40 });
    r3d.drawMesh(fb, Wd.mesh);
    r3d.fog(fb, mix(0xe0a090, 0x3a3a5a, storm), 60, 220, 0.6);
    if (storm > 0) for (let i = 0; i < 7; i++) cloud(fb, lerp(-160, -40 + i * 90, E.outSine(storm)), 18 + (i % 3) * 16, 130, 0x2a2f48, 0x1c2036, i + 3, 0.95);

    // ---- lanterns ----
    const rise = (t0, d, from, to) => { const k = E.outCubic(seg(t, t0, t0 + d)); return [lerp(from[0], to[0], k) + Math.sin(t * 0.8 + to[0]) * 0.3 * k, lerp(from[1], to[1], k), lerp(from[2], to[2], k)]; };
    const cX = P[0] + 6.5, xX = P[0] - 2.8, gX = P[0] + 2, dX = P[0] - 6.8, kX = P[0] - 9.6;
    const opus = rise(0.8, 5, [cX, P[1] + 4, P[2]], [P[0] + 5, P[1] + 13, P[2] + 6]);
    const astra = rise(1.3, 5, [xX, P[1] + 4.5, P[2]], [P[0] - 1, P[1] + 15, P[2] + 7]);
    const inB = E.outCubic(seg(t, 5.8, 6.8));
    const v4 = rise(6.9, 3.2, [dX - 3 * (1 - inB), P[1] + 4, P[2]], [P[0] - 6, P[1] + 10.5, P[2] + 5]);
    const k3 = rise(7.3, 3.2, [kX - 3 * (1 - inB), P[1] + 4, P[2]], [P[0] - 9.5, P[1] + 9.5, P[2] + 5]);
    if (shot !== 'B') {
      if (t >= 0.8) lanternW(fb, opus, { kind: 'claude', w: 24, label: 'OPUS 5.5', t });
      if (t >= 1.3) lanternW(fb, astra, { kind: 'astra', w: 26, label: 'GPT-6 ASTRA', t });
      if (t > 6.9) lanternW(fb, v4, { kind: 'whale', w: 22, label: 'DEEPSEEK V4', t });
      if (t > 7.3) lanternW(fb, k3, { kind: 'kimi', w: 20, label: 'KIMI K3', t });
    }
    // ---- the Flash rocket ----
    const rk = seg(t, 3.4, 4.3);
    if (shot === 'A') {
      if (t < 3.4) billboard(fb, [gX - 1.6, P[1], P[2] - 0.5], (L, x, y) => rocket(L, x, y - 11), { bias: 0.1 });
      else if (rk < 1) { const p = r3d.project(gX - 1.6, P[1] + 1 + E.inQuad(rk) * 16, P[2] - 0.5); if (p) { rocket(fb, p[0], p[1]); exhaust(fb, t, p[0], p[1] + 10, 22); } }
    }
    // ---- characters ----
    const wet = t > 9.8, stuck = t > 9.25;
    if (shot === 'B') {
      const lit = t < 4.75;
      const gs = actor(fb, [P[0], P[1] + 0.6 + float(t, 0.08, 3), P[2]], 'gemini', {
        eyes: lit ? 'star' : t < 5.1 ? 'wide' : 'sad', mouth: lit ? 'laugh' : t < 5.1 ? 'o' : 'frown', blush: lit ? 'big' : true, lookY: -1, handL: lit ? -14 : 0, handR: lit ? -14 : 0, grey: t > 5.1 ? 0.2 : 0,
      }, { scale: 2, lift: 0.5 + fl * 0.8, shadow: false, dy: 40 });
      const p = r3d.project(P[0] + 1, P[1] + 16, P[2] + 6);
      if (p) flashPop(fb, t, 4.3, p[0], Math.max(40, p[1] - 10), { size: 70, label: 'FLASH', seed: 3 });
      if (gs && t > 5.2) emote(fb, 'sweat', gs.x + 44, gs.y - 150, { scale: 2 });
      if (fl > 0.5) fb.overlay(0xffffff, (fl - 0.5) * 0.6);
    } else {
      const celebrate = t > 1.0 && t < 3.0;
      const cs = actor(fb, [cX, P[1], P[2] - 0.5], 'clawd', {
        eyes: shot === 'D' ? (t > 11.8 ? 'sad' : 'open') : celebrate ? 'happy' : blink(t, 1) ? 'blink' : 'open', lookX: shot === 'D' ? -1 : 0, lookY: t < 3.2 && t > 0.7 ? -1 : 0,
        armL: t < 0.8 ? -14 : celebrate && Math.sin(t * 12) > 0 ? -8 : 0, armR: t < 0.8 ? -14 : celebrate && Math.sin(t * 12 + 1) > 0 ? -8 : 0, mouth: celebrate ? 'open' : shot === 'D' ? 'flat' : 'smile',
      }, { scale: 1 });
      if (cs && t < 0.8) lanternP(fb, cs.x, cs.y - 62, { kind: 'claude', w: 24, t, lit: seg(t, 0, 0.4) });
      if (cs && shot === 'D' && t > 12.2) { const b = bubble(fb, cs.x - 18, cs.y - 76, 36, 20, cs.x - 4, cs.y - 46, { k: E.outBack(seg(t, 12.2, 12.5)) }); if (b) text(fb, '...', b.cx, b.cy - 5, 0x2a2a3a, { align: 'center' }); }
      const xs = actor(fb, [xX, P[1], P[2] - 0.5], 'codex', { face: t < 1.3 ? 'determined' : celebrate ? 'happy' : shot === 'C' && t > 8.6 ? 'wow' : 'prompt', cursor: Math.floor(t * 3) % 2 === 0, armL: t < 1.3 ? 'up' : undefined, armR: t < 1.3 ? 'up' : undefined }, { scale: 1, dy: -Math.round(float(t, 1.5, 2)) });
      if (xs && t < 1.3) lanternP(fb, xs.x, xs.y - 76, { kind: 'astra', w: 26, t, lit: seg(t, 0, 0.5) });
      let gx = gX;
      const go = { eyes: 'determined', mouth: 'flat' };
      if (t < 3.4) Object.assign(go, { eyes: t < 1.5 ? 'open' : 'determined', lookY: t < 3 ? -1 : 0, handR: t > 2.6 ? -6 : 0 });
      else if (t < 4.2) Object.assign(go, { eyes: 'happy', mouth: 'open', lookY: -1, handL: -12, handR: -12 });
      else if (shot === 'C') Object.assign(go, t < 8.4 ? { eyes: 'sad', mouth: 'frown', lookY: t < 7 ? -1 : 0, lookX: t > 7.4 ? -1 : 0, grey: 0.25 } : { eyes: wet ? 'closed' : 'sad', mouth: 'wobble', grey: wet ? 0.6 : 0.35, handL: wet ? 4 : 0, handR: wet ? 4 : 0 });
      if (shot === 'D') { const k = E.inOutSine(seg(t, 11.3, 14)); gx = gX + k * 8; Object.assign(go, { eyes: 'sad', mouth: 'frown', grey: 0.6, lookY: 1, handL: 4, handR: 4 }); }
      const gs = actor(fb, [gx, P[1] + 0.5 + float(t, 0.1, shot === 'D' ? 1.5 : 3), P[2] - 0.5], 'gemini', go, { scale: 1, groundY: P[1], lift: 0.5 });
      if (gs) {
        if (stuck) tag(fb, gs.x + 16, gs.y - 38, ['COMING', 'SOON'], { swing: Math.sin(t * 4) * 0.6 });
        if (wet && t < 12.5) for (let i = 0; i < 6; i++) { const d = (t * 3 + hash(i)) % 1; fb.rect(gs.x - 18 + hash(i * 3) * 36, gs.y - 44 + d * 40, 1, 2, 0xbfe6ff); }
        if (t > 9.8 && t < 11) emote(fb, 'drop', gs.x - 24, gs.y - 56, { scale: 2 });
      }
      if (shot === 'C') {
        const laugh = t > 8.4;
        const dsx = dX - 4 * (1 - inB), kx0 = kX - 4 * (1 - inB);
        const slapK = seg(t, 8.9, 9.25) * (1 - seg(t, 9.5, 10.0));
        const kmx = lerp(kx0, gx - 2.0, E.inOutSine(slapK));
        const ds = actor(fb, [dsx, P[1] + 0.3 + float(t, 0.15, 2.4) + (laugh ? bounce(t, 0.35, 0.3) : 0), P[2] - 1.5], 'deepseek', { eyes: laugh ? 'happy' : 'shifty', mouth: laugh ? 'laugh' : 'smirk', handL: t < 6.9 ? -10 : 0, handR: laugh ? -8 : 0 }, { scale: 1, groundY: P[1], lift: 0.5 });
        const ks = actor(fb, [kmx, P[1] + (laugh && slapK === 0 ? bounce(t + 0.15, 0.35, 0.35) : 0) + hop(t, 8.9, 0.35, 1.2), P[2] - 1], 'kimi', { eyes: laugh ? 'happy' : 'shifty', mouth: laugh ? 'laugh' : 'smirk', handL: t < 7.3 ? -10 : 0, handR: slapK > 0.5 ? -10 : 0 }, { scale: 1, lift: 0.5 });
        if (ds && t < 6.9 && t > 6.0) lanternP(fb, ds.x, ds.y - 58, { kind: 'whale', w: 22, t });
        if (ks && t < 7.3 && t > 6.0) lanternP(fb, ks.x, ks.y - 62, { kind: 'kimi', w: 20, t });
        if (ks && slapK > 0 && !stuck) tag(fb, ks.x - 20, ks.y - 40, ['COMING', 'SOON']);
        if (t > 9.2 && t < 9.4 && gs) {
          for (let i = 0; i < 8; i++) { const a = i * 0.785; fb.line(gs.x + 16 + Math.cos(a) * 8, gs.y - 30 + Math.sin(a) * 8, gs.x + 16 + Math.cos(a) * 16, gs.y - 30 + Math.sin(a) * 16, 0xffffff); }
          text(fb, 'ШЛЁП!', gs.x + 10, gs.y - 70, 0xffe08a, { scale: 2, outline: 0x1a1a2a });
        }
        if (ds && gs && t > 9.7 && t < 10.9) {
          const sx = ds.x + 6, sy = ds.y - 46;
          for (let i = 0; i < 70; i++) {
            const q = (t * 1.8 + i / 70) % 1;
            const x = lerp(sx, gs.x, q), y = lerp(sy, gs.y - 40, q) - Math.sin(q * Math.PI) * 70 + (hash(i) - 0.5) * 6;
            fb.set(x, y, i % 4 ? 0xbfe6ff : 0xffffff); if (i % 3 === 0) fb.set(x + 1, y + 1, 0x8fc4ee);
          }
          text(fb, 'ПЛЮХ!', gs.x - 20, gs.y - 86, 0xbfe6ff, { scale: 2, outline: 0x1a2a4a });
        }
        if (laugh) {
          const a = 1 - seg(t, 10.6, 11);
          if (ds) { const b = bubble(fb, ds.x - 26, ds.y - 92, 52, 22, ds.x - 6, ds.y - 58, { k: E.outBack(seg(t, 8.4, 8.7)) * a }); if (b && a > 0.9) text(fb, 'ХА-ХА', b.cx, b.cy - 3, 0x2a2a3a, { align: 'center' }); }
          if (ks && slapK === 0) { const b = bubble(fb, ks.x - 22, ks.y - 94, 44, 22, ks.x, ks.y - 60, { k: E.outBack(seg(t, 8.55, 8.85)) * a }); if (b && a > 0.9) text(fb, 'ХИ-ХИ', b.cx, b.cy - 3, 0x2a2a3a, { align: 'center' }); }
        }
      }
    }
    r3d.outline(fb, 0.6);
    r3d.bloom(fb, 0.75, 3);
    if (t > 12.8) rain(fb, t, { n: Math.round(90 * seg(t, 12.8, 14)), alpha: 0.4, speed: 280 });
    vignette(fb, 0.4);
  },
};
