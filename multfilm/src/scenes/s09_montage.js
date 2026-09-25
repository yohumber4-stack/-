// Together: quick montage in the workshop. Codex debugs the frame, Clawd stitches
// new fabric, Gemini learns to glow ray by ray. Evenings of cards while
// "GEMINI 4" pre-training fills up. Gemini burns the "COMING SOON" tag herself.
import { workshopWorld } from '../world/workshop.js';
import { r3d, actor, billboard, rgbf } from '../world/stage.js';
import { skyDome } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, step } from '../engine/core.js';
import { vignette, smoke, burst } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { lanternP, emote, calPage } from '../sprites/props.js';
import { tag } from './common.js';
import { float, blink, bounce } from '../kit.js';

const NIGHT = [0x2c3470, 0x1b2458, 0x0d1236, 0x070a22];
const GC = [0xea4335, 0x4285f4, 0x34a853, 0xfbbc04];

export default {
  dur: 10,
  in: { type: 'white', dur: 0.3 },
  render(fb, t) {
    const Wd = workshopWorld();
    const shot = t < 1.1 ? 'code' : t < 2.2 ? 'sew' : t < 3.3 ? 'glow' : t < 6.6 ? 'cards' : 'burn';
    if (shot === 'code') r3d.camera([14.5, 4.4, -3.5], [18.5, 3.2, 4], 50);
    else if (shot === 'sew') r3d.camera([11, 4.6, 0], [14, 4.6, 10], 50);
    else if (shot === 'glow') r3d.camera([14, 3.8, -1.5], [14, 3.6, 10], 50);
    else if (shot === 'cards') r3d.camera([14 + Math.sin(t) * 0.3, 7.2, -8.5], [14, 3.2, 9], 50);
    else r3d.camera([10.5, 5.2, -3.5], [6, 3, 10], 52);
    r3d.clear();
    skyDome(fb, r3d, t, { stops: NIGHT, stars: 200, span: 0.5 });
    const flare = shot === 'burn' ? seg(t, 8.4, 8.6) * (1 - seg(t, 9.2, 10)) : 0;
    r3d.ambient = [0.4, 0.36, 0.38];
    r3d.sun = { dir: [0.1, 0.5, -0.85], color: [0.2, 0.24, 0.4] };
    r3d.points = [];
    for (const L of Wd.lights) { const f = L.fire ? (0.85 + 0.15 * Math.sin(t * 13)) * (1 + flare * 2) : 1; r3d.points.push({ p: L.p, c: rgbf(flare > 0.05 && L.fire ? 0xdfe8ff : L.c, (L.bulb ? 1.5 : 1.3) * f), r: L.r * (L.fire ? 1 + flare : 1) }); }
    r3d.drawMesh(fb, Wd.mesh);
    r3d.drawMesh(fb, Wd.fireMesh, {}, { emit: 0.85 + 0.15 * Math.sin(t * 12) + flare });
    // the rebuilt lantern (star shaped, Gemini colours) on its stand
    const lit = shot === 'glow' ? 0 : 0;
    billboard(fb, [14, 2, 10], (L, x, y) => {
      L.rect(x - 1, y - 30, 3, 30, 0x5a4636);
      lanternP(L, x, y - 56, { kind: 'gem', w: 50, lit, t, glow: false });
      if (shot === 'sew') { const n = Math.floor((t - 1.1) * 12); for (let k = 0; k < Math.min(10, n); k++) L.rect(x - 20 + k * 4, y - 50, 2, 1, 0xffffff); }
      if (t < 7.2 && shot !== 'burn') tag(L, x + 36, y - 80, ['COMING', 'SOON'], { string: 8, swing: Math.sin(t * 2) * 0.5 });
    }, { bias: 0.3 });
    // ---- montage beats ----
    if (shot === 'code') {
      const fixed = t > 0.7;
      const xs = actor(fb, [17.4, 1, 2.6], 'codex', { face: fixed ? 'check' : 'code', t, armL: 'type', armR: 'type' }, { scale: 1, lift: 0.5 });
      if (xs) {
        // hologram of the lantern frame with a bug that turns green
        const hx = xs.x - 76, hy = xs.y - 70;
        fb.rect(hx - 34, hy - 30, 68, 58, 0x10162a, 0.75); fb.rect(hx - 34, hy - 30, 68, 1, 0x6ad0ff);
        for (let a = 0; a < 40; a++) { const q = a / 40 * Math.PI * 2; const r = 20 * (0.45 + 0.55 * Math.abs(Math.cos(q * 2))); fb.set(hx + Math.cos(q) * r, hy + Math.sin(q) * r, 0x6ad0ff); }
        const bc = fixed ? 0x4aff8a : 0xff4a4a;
        fb.circle(hx + 12, hy - 8, 3, bc); fb.glow(hx + 12, hy - 8, 10, bc, 0.6);
        text(fb, fixed ? 'FIXED' : 'BUG', hx, hy + 18, bc, { font: 'small', align: 'center' });
      }
    } else if (shot === 'sew') {
      const cs = actor(fb, [12.4, 1, 7.5], 'clawd', { eyes: 'determined', mouth: 'flat', lookX: -1, armL: Math.sin(t * 16) > 0 ? -10 : -6 }, { scale: 1, lift: 0.5 });
      if (cs) { const nx = cs.x - 40 + Math.sin(t * 16) * 4, ny = cs.y - 60; fb.line(nx, ny, nx + 3, ny - 10, 0xe0e4f0); fb.line(nx, ny, cs.x - 20, cs.y - 36, 0xffffff); }
    } else if (shot === 'glow') {
      const k = (t - 2.2) / 1.1;
      const rays = { r: k > 0.1 ? 1 : 0.2, b: k > 0.35 ? 1 : 0.2, g: k > 0.6 ? 1 : 0.2, y: k > 0.8 ? 1 : 0.2 };
      const gs = actor(fb, [14, 2.0 + float(t, 0.1, 3), 6.0], 'gemini', { eyes: k > 0.85 ? 'happy' : 'closed', mouth: k > 0.85 ? 'open' : 'flat', rays, handL: -10, handR: -10 }, { scale: 1, groundY: 1, lift: 0.6, glow: 0.1 + k * 0.2 });
      if (gs) [0.1, 0.35, 0.6, 0.8].forEach((t0, i) => burst(fb, k, t0, gs.x + [0, 22, 0, -22][i], gs.y - 28 + [-22, 0, 22, 0][i], { colors: [GC[i], 0xffffff], n: 12, speed: 3, gravity: 0, life: 0.25, seed: i }));
    } else if (shot === 'cards') {
      const lt = t - 3.3;
      const laugh = Math.sin(lt * 5) > 0.3;
      billboard(fb, [14, 1, 6.5], (L, x, y) => { L.rect(x - 34, y - 14, 68, 5, 0x8a5a3a); L.rect(x - 30, y - 9, 4, 9, 0x6a4028); L.rect(x + 26, y - 9, 4, 9, 0x6a4028); for (let i = 0; i < 5; i++) { L.rect(x - 22 + i * 10, y - 18, 7, 5, 0xf8f4ea); L.rect(x - 20 + i * 10, y - 17, 2, 2, i % 2 ? 0xea4335 : 0x2a2a3a); } }, { bias: 0.2 });
      actor(fb, [17.8, 1, 6.2], 'clawd', { eyes: laugh ? 'happy' : 'open', mouth: laugh ? 'laugh' : 'smile', armL: laugh ? -8 : 0 }, { scale: 1, lift: 0.5 });
      actor(fb, [14, 1.6 + (laugh ? bounce(lt, 0.3, 0.3) : 0), 7.4], 'gemini', { eyes: laugh ? 'happy' : 'open', mouth: laugh ? 'laugh' : 'smile', blush: 'big', rays: { r: 0.8, b: 1, g: 0.8, y: 0.8 } }, { scale: 1, groundY: 1, lift: 0.5 });
      const xs = actor(fb, [10.2, 1, 6.2], 'codex', { face: 'bar:' + clamp(0.1 + lt / 3.4 * 0.87).toFixed(2), armR: laugh ? 'up' : undefined }, { scale: 1, lift: 0.5 });
      if (xs) { const p = Math.round(clamp(0.1 + lt / 3.4 * 0.87) * 100); text(fb, 'GEMINI 4: ' + p + '%', xs.x, xs.y - 74, 0x9cffd0, { align: 'center', outline: 0x0d1444 }); }
      for (let k = 0; k < 3; k++) { const q = (lt * 0.9 + k / 3) % 1; calPage(fb, Math.round(380 + q * 60), Math.round(20 + q * 30 + q * q * 120), 34, 28, ['ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'][k]); }
    } else {
      const lt = t - 6.6;
      const toss = seg(lt, 1.2, 1.8);
      const gs = actor(fb, [8.5, 2.0 + float(t, 0.1, 3), 8], 'gemini', { eyes: lt < 1.0 ? 'determined' : lt < 2.0 ? 'determined' : 'happy', mouth: lt < 2.0 ? 'flat' : 'laugh', rays: { r: 1, b: 1, g: 1, y: 1 }, handR: toss > 0 && toss < 1 ? -14 : lt < 1.2 ? -8 : 0, blush: lt > 2 ? 'big' : true }, { scale: 1, groundY: 1, lift: 0.6 });
      const sp = r3d.project(3.5, 2.6, 10);
      if (gs && toss < 1) {
        if (toss === 0) tag(fb, gs.x - 30, gs.y - 64, ['COMING', 'SOON']);
        else if (sp) { const bx = lerp(gs.x - 20, sp[0], toss), by = lerp(gs.y - 50, sp[1], toss) - Math.sin(toss * Math.PI) * 40; fb.circle(bx, by, 6, 0x1a1a2a); fb.circle(bx, by, 5, 0xfff8e1); fb.set(bx - 1, by, 0xc8c0a8); }
      }
      if (sp && lt > 1.8) {
        burst(fb, t, 8.4, sp[0], sp[1] - 10, { colors: GC, n: 60, speed: 110, gravity: -30, life: 1.4, flash: 70 });
        if (t > 8.4 && t < 9.4) { const k2 = 1 - seg(t, 8.4, 9.4); for (let i = 0; i < 4; i++) fb.glow(sp[0] + [-8, 8, -4, 4][i], sp[1] - 20 - i * 8, 26 * k2 + 6, GC[i], 0.7 * k2, 5); text(fb, 'ФШШ!', sp[0], sp[1] - 60, 0xffe08a, { scale: 2, align: 'center', outline: 0x1a1a2a }); }
        smoke(fb, t, 8.6, sp[0], sp[1] - 30, { n: 5, color: 0x9098a8 });
      }
      const cheer = lt > 2.0;
      actor(fb, [13.5, 1, 6], 'clawd', { eyes: cheer ? 'happy' : 'open', mouth: cheer ? 'open' : 'smile', armL: cheer ? -12 : 0, armR: cheer ? -12 : 0, lookX: 1 }, { scale: 1, lift: 0.5 });
      actor(fb, [16.8, 1, 7], 'codex', { face: cheer ? 'happy' : 'prompt', armL: cheer ? 'up' : undefined, armR: cheer ? 'up' : undefined }, { scale: 1, lift: 0.5 });
    }
    r3d.outline(fb, 0.6);
    r3d.bloom(fb, 0.7, 3);
    if (flare > 0.4) fb.overlay(0xffffff, (flare - 0.4) * 0.4);
    vignette(fb, 0.4);
  },
};
