// Morning. The three friends walk down the street together (3D tracking shot).
// DeepSeek and Kimi block the way; the whale's water jet meets Gemini's light and
// becomes a rainbow — and the water comes down on the bullies.
import { streetWorld, ST } from '../world/street.js';
import { r3d, actor, rgbf } from '../world/stage3d.js';
import { skyDome } from '../engine/sky.js';
import { key, E, seg, clamp, lerp, hash, mix, TAU } from '../engine/core.js';
import { vignette } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { cloud } from '../bg.js';
import { clawd } from '../chars/clawd.js';
import { codex } from '../chars/codex.js';
import { gemini } from '../chars/gemini.js';
import { whale, moon, spout } from '../chars/extras.js';
import { float, bounce, eyesB } from '../kit.js';

const CX = (ST.x0 + ST.x1) / 2;

export default {
  dur: 12,
  in: { type: 'white', dur: 0.8 },
  render(fb, t) {
    const Wd = streetWorld();
    // the trio walks towards -z; stops for the confrontation
    const walkZ = (tt) => 120 - Math.min(tt, 5.0) * 3.2 - Math.max(0, tt - 9.8) * 3.2;
    const tz = walkZ(t);
    const walking = t < 5.0 || t > 9.8;
    const camZ = tz - 9.5 - (t > 5.0 && t < 9.8 ? E.inOutSine(seg(t, 5.0, 6.0)) * 3 : 0) + (t > 9.8 ? 0 : 0);
    const eye = [CX + Math.sin(t * 0.4) * 0.6, 3.2, camZ];
    const tgt = [CX, 3.0, tz + 4];
    r3d.camera(eye, tgt, 55);
    r3d.clear();
    skyDome(fb, r3d, t, { stops: [0xf6ecd0, 0xbfe0f7, 0x86c3f0, 0x4a98e0], stars: 0, span: 0.6 });
    for (let i = 0; i < 4; i++) cloud(fb, ((i * 150 + t * 5) % 640) - 80, 24 + (i % 2) * 18, 100, 0xffffff, 0xd8e8f4, i + 41, 1);
    r3d.ambient = [0.55, 0.6, 0.72];
    r3d.sun = { dir: [0.55, 0.7, -0.45], color: [0.75, 0.62, 0.45] };
    r3d.points = [];
    r3d.drawMesh(fb, Wd.mesh);
    r3d.fog(fb, 0xe8eef6, 30, 110, 0.8);

    // petals drifting
    for (let i = 0; i < 30; i++) {
      const h1 = hash(i * 3 + 1), h2 = hash(i * 3 + 2);
      const p = [CX + (h1 - 0.5) * 18 + Math.sin(t + i) * 1.5, 9 - ((t * (0.8 + h2) + h2 * 9) % 9), camZ + 4 + h2 * 30];
      const s = r3d.project(p[0], p[1], p[2]);
      if (s && s[2] < r3d.z[Math.max(0, Math.min(fb.h - 1, Math.round(s[1]))) * fb.w + Math.max(0, Math.min(fb.w - 1, Math.round(s[0])))]) { fb.set(s[0], s[1], i % 2 ? 0xffb8d0 : 0xffffff); fb.set(s[0] + 1, s[1], 0xffd8e6); }
    }

    const ph = t * 2.2;
    const bob = (k) => (walking ? Math.abs(Math.sin(ph * Math.PI + k)) * -0.25 : 0);
    const gP = [CX, 1.9 + bob(0.5) + float(t, 0.15, 3), tz];
    const cP = [CX - 3.4, 1 + bob(0), tz + 0.3];
    const xP = [CX + 3.4, 1.7 + float(t, 0.2, 2.5), tz + 0.3];
    const shine = seg(t, 7.3, 7.6) * (1 - 0.6 * seg(t, 9.0, 10.0));
    const hi5 = t > 10.6 && t < 11.4;
    actor(fb, cP, (L, x, y) => clawd(L, x, y, { u: 3, walk: walking ? ph : undefined, eyes: t > 9.2 ? 'happy' : t > 5.2 && t < 7.2 ? 'determined' : eyesB(t, 'normal', 1), armR: hi5 ? 1.1 : 0, blush: t > 9.4, look: t > 5.2 && t < 9.6 ? 0 : -0.5 }), { lift: 0.2, gain: 1.0 });
    actor(fb, xP, (L, x, y) => codex(L, x, y, { u: 1.5, t, face: t < 5.2 ? '>_' : t < 7.3 ? '-_-' : t < 9.6 ? 'o_o' : 'B)', flip: false }), { lift: 0.2, gain: 1.0 });
    actor(fb, gP, (L, x, y) => gemini(L, x, y, { size: 46, t, eyes: t < 5.2 ? 'happy' : t < 7.3 ? 'determined' : t < 9.6 ? 'determined' : 'happy', mouth: t < 5.2 ? 'grin' : t < 9.6 ? 'flat' : 'grin', bright: shine * 0.35, armL: hi5 ? 1.1 : 0, blush: t < 5.2 || t > 9.6 }), { lift: 0.3, gain: 1.0, glow: shine * 0.3 });

    // bullies step in (foreground), then retreat
    const inK = E.outCubic(seg(t, 5.0, 5.8)) * (1 - E.inCubic(seg(t, 9.8, 10.6)));
    if (inK > 0) {
      const wet = t > 8.4;
      const bz = tz - 5.5;
      const wX = lerp(CX - 14, CX - 5.2, inK), mX = lerp(CX + 14, CX + 5.2, inK);
      actor(fb, [wX, 1.4, bz], (L, x, y) => whale(L, x, y, { u: 3, t, flip: false, eyes: t < 6.6 ? 'smug' : t < 8.4 ? 'normal' : 'closed', mouth: t < 7.2 ? 'smile' : t < 8.4 ? 'o' : 'frown', wet, squash: 0 }), { lift: 0.2, gain: 1.0 });
      actor(fb, [mX, 0.8, bz], (L, x, y) => moon(L, x, y, { u: 3, t, flip: false, eyes: t < 8.4 ? 'smug' : 'closed', mouth: t < 8.4 ? 'smirk' : 'o' }), { lift: 0.2, gain: 1.0 });
      const ws = r3d.project(wX + 1.2, 5.2, bz);
      const gs = r3d.project(gP[0], gP[1], gP[2]);
      // water jet towards Gemini (6.6..7.4), turned into a rainbow by Gemini's light
      if (ws && gs && t > 6.6 && t < 7.6) {
        const k = seg(t, 6.6, 7.3);
        for (let i = 0; i < 60; i++) {
          const q = (i / 60) * k;
          const px = lerp(ws[0], gs[0] - 30, q), py = lerp(ws[1], gs[1], q) - Math.sin(q * Math.PI) * 60;
          fb.set(px + Math.sin(i * 7 + t * 30) * 2, py, i % 3 ? 0xbfe6ff : 0xffffff);
        }
      }
      if (shine > 0 && ws && gs) {
        const cx = (ws[0] + gs[0]) / 2, cy = Math.max(ws[1], gs[1]) + 10, R = Math.abs(ws[0] - gs[0]) / 2 + 40;
        const bands = [0xea4335, 0xff8a3a, 0xfbbc04, 0x34a853, 0x4285f4, 0x7a5af0];
        for (let b = 0; b < bands.length; b++)
          for (let a = 0; a < 180; a++) {
            const ang = Math.PI + (a / 179) * Math.PI;
            const r = R - b * 3;
            for (let w = 0; w < 3; w++) fb.blend(cx + Math.cos(ang) * (r - w), cy + Math.sin(ang) * (r - w) * 0.8, bands[b], 0.8 * shine);
          }
        // droplets rain back onto the bullies
        if (t > 8.0 && t < 9.6) for (let i = 0; i < 40; i++) { const d = (t * 2 + hash(i)) % 1; fb.set(ws[0] - 40 + hash(i * 3) * 80, ws[1] - 50 + d * 120, 0xbfe6ff); }
      }
      if (t > 5.4 && t < 6.6 && ws) text(fb, '!', ws[0] - 10, ws[1] - 20, 0xffffff, { scale: 2, outline: 0x1a1a2a });
    }
    if (hi5) { const gs = r3d.project(gP[0] - 1.6, gP[1] + 1.4, gP[2]); if (gs) for (let i = 0; i < 10; i++) { const a = i * 0.63; fb.set(gs[0] + Math.cos(a) * (6 + (t - 10.6) * 30), gs[1] + Math.sin(a) * (6 + (t - 10.6) * 30), 0xffffff); } }
    r3d.outline(fb, 0.6);
    vignette(fb, 0.3);
  },
};
