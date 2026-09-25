// Morning. The three friends walk down the street together (3D tracking shot).
// DeepSeek and Kimi block the way; the whale's water jet meets Gemini's light and
// becomes a rainbow — and the water comes down on the bullies. High five.
import { streetWorld, ST } from '../world/street.js';
import { r3d, actor } from '../world/stage.js';
import { skyDome } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash } from '../engine/core.js';
import { vignette } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { emote, bubble } from '../sprites/props.js';
import { clawdWalk, codexWalk } from '../sprites/chars.js';
import { cloud } from '../bg.js';
import { float, blink } from '../kit.js';

const CX = (ST.x0 + ST.x1) / 2;

export default {
  dur: 12,
  in: { type: 'white', dur: 0.8 },
  render(fb, t) {
    const Wd = streetWorld();
    const walking = t < 5.0 || t > 9.8;
    const tz = 120 - Math.min(t, 5.0) * 3.0 - Math.max(0, t - 9.8) * 3.0;
    const camZ = tz - 9.5 - (t > 5.0 && t < 9.8 ? E.inOutSine(seg(t, 5.0, 6.0)) * 2.5 : 0);
    r3d.camera([CX + Math.sin(t * 0.4) * 0.5, 3.4, camZ], [CX, 3.0, tz + 4], 55);
    r3d.clear();
    skyDome(fb, r3d, t, { stops: [0xf6ecd0, 0xbfe0f7, 0x86c3f0, 0x4a98e0], stars: 0, span: 0.6 });
    for (let i = 0; i < 4; i++) cloud(fb, ((i * 150 + t * 5) % 640) - 80, 24 + (i % 2) * 18, 100, 0xffffff, 0xd8e8f4, i + 41, 1);
    r3d.ambient = [0.58, 0.62, 0.74];
    r3d.sun = { dir: [0.55, 0.7, -0.45], color: [0.75, 0.62, 0.45] };
    r3d.points = [];
    r3d.drawMesh(fb, Wd.mesh);
    r3d.fog(fb, 0xe8eef6, 30, 110, 0.8);
    // petals in the air
    for (let i = 0; i < 30; i++) {
      const h1 = hash(i * 3 + 1), h2 = hash(i * 3 + 2);
      const s = r3d.project(CX + (h1 - 0.5) * 18 + Math.sin(t + i) * 1.5, 9 - ((t * (0.8 + h2) + h2 * 9) % 9), camZ + 4 + h2 * 30);
      if (s && s[0] >= 0 && s[0] < 480 && s[1] >= 0 && s[1] < 270 && s[2] < r3d.z[Math.round(s[1]) * 480 + Math.round(s[0])]) { fb.set(s[0], s[1], i % 2 ? 0xffb8d0 : 0xffffff); fb.set(s[0] + 1, s[1], 0xffd8e6); }
    }
    const ph = t * 2.2;
    const cw = walking ? clawdWalk(ph) : {}, xw = walking ? codexWalk(ph + 0.5) : {};
    const shine = seg(t, 7.3, 7.6) * (1 - 0.6 * seg(t, 9.0, 10.0));
    const hi5 = t > 10.6 && t < 11.4;
    const standoff = t > 5.2 && t < 9.6;
    const gP = [CX, 1.6 + float(t, 0.12, 3), tz], cP = [CX + 3.4, 1, tz + 0.3], xP = [CX - 3.4, 1, tz + 0.3];
    actor(fb, cP, 'clawd', { ...cw, eyes: t > 9.2 ? 'happy' : standoff && t < 7.2 ? 'determined' : blink(t, 1) ? 'blink' : 'open', mouth: t > 9.2 ? 'open' : standoff ? 'flat' : 'smile', armR: hi5 ? -14 : cw.armR, blush: t > 9.4 ? 'big' : true }, { scale: 1, lift: 0.2, gain: 1.0 });
    actor(fb, xP, 'codex', { ...xw, face: t < 5.2 ? 'happy' : t < 7.3 ? 'bored' : t < 9.6 ? 'wow' : 'smile' }, { scale: 1, lift: 0.2, gain: 1.0 });
    const gs = actor(fb, gP, 'gemini', { eyes: t < 5.2 ? 'happy' : t < 9.6 ? 'determined' : 'happy', mouth: t < 5.2 ? 'open' : t < 9.6 ? 'flat' : 'laugh', bright: shine * 0.35, handL: hi5 ? -14 : 0, handR: shine > 0.5 ? -14 : 0, blush: t < 5.2 || t > 9.6 ? 'big' : true }, { scale: 1, groundY: 1, lift: 0.3, gain: 1.0, glow: shine * 0.3 });
    // bullies step in and later retreat
    const inK = E.outCubic(seg(t, 5.0, 5.8)) * (1 - E.inCubic(seg(t, 9.8, 10.6)));
    if (inK > 0) {
      const wet = t > 8.4, bz = tz - 3.2;
      const wX = lerp(CX + 14, CX + 4.6, inK), kX = lerp(CX - 14, CX - 4.6, inK);
      const ds = actor(fb, [wX, 1.4 + float(t, 0.12, 2.4), bz], 'deepseek', { eyes: t < 6.6 ? 'shifty' : t < 8.4 ? 'wide' : 'closed', mouth: t < 7.2 ? 'smirk' : t < 8.4 ? 'o' : 'wobble', wet: wet ? t : 0, handR: t > 6.4 && t < 7.4 ? -10 : 0 }, { scale: 1, groundY: 1, lift: 0.2, gain: 1.0 });
      const ks = actor(fb, [kX, 1, bz], 'kimi', { eyes: t < 8.4 ? 'shifty' : 'closed', mouth: t < 8.4 ? 'smirk' : 'wobble' }, { scale: 1, lift: 0.2, gain: 1.0 });
      if (ds && t > 5.4 && t < 6.6) emote(fb, 'anger', ds.x + 22, ds.y - 56, { scale: 2 });
      if (ks && t > 5.6 && t < 6.6) { const b = bubble(fb, ks.x - 30, ks.y - 88, 60, 22, ks.x, ks.y - 58, { k: E.outBack(seg(t, 5.6, 5.9)) }); if (b) text(fb, 'СТОЯТЬ!', b.cx, b.cy - 3, 0x2a2a3a, { align: 'center' }); }
      const ws = ds ? [ds.x + 4, ds.y - 46] : null;
      if (ws && gs && t > 6.6 && t < 7.6) {
        const k = seg(t, 6.6, 7.3);
        const ex = gs.x + (ws[0] < gs.x ? -22 : 22);
        for (let i = 0; i < 60; i++) { const q = (i / 60) * k; const px = lerp(ws[0], ex, q), py = lerp(ws[1], gs.y - 30, q) - Math.sin(q * Math.PI) * 60; fb.set(px + Math.sin(i * 7 + t * 30) * 2, py, i % 3 ? 0xbfe6ff : 0xffffff); }
      }
      if (shine > 0 && ws && gs) {
        const cx = (ws[0] + gs.x) / 2, cy = Math.max(ws[1], gs.y - 20) + 10, R = Math.abs(ws[0] - gs.x) / 2 + 40;
        const bands = [0xea4335, 0xff8a3a, 0xfbbc04, 0x34a853, 0x4285f4, 0x7a5af0];
        for (let b = 0; b < bands.length; b++) for (let a = 0; a < 180; a++) {
          const ang = Math.PI + (a / 179) * Math.PI, r = R - b * 3;
          for (let w = 0; w < 3; w++) fb.blend(cx + Math.cos(ang) * (r - w), cy + Math.sin(ang) * (r - w) * 0.8, bands[b], 0.8 * shine);
        }
        if (t > 8.0 && t < 9.6) for (let i = 0; i < 50; i++) { const d = (t * 2 + hash(i)) % 1; fb.rect(ws[0] - 50 + hash(i * 3) * 100, ws[1] - 50 + d * 120, 1, 2, 0xbfe6ff); }
        if (t > 8.1 && t < 9.2) text(fb, 'ПЛЮХ!', ws[0] + 10, ws[1] - 60, 0xbfe6ff, { scale: 2, outline: 0x1a2a4a, align: 'center' });
      }
    }
    if (hi5 && gs) { for (let i = 0; i < 10; i++) { const a = i * 0.63, r = 6 + (t - 10.6) * 40; fb.set(gs.x + 30 + Math.cos(a) * r, gs.y - 50 + Math.sin(a) * r, 0xffffff); } if (t < 11.1) text(fb, 'ХЛОП!', gs.x + 30, gs.y - 86, 0xffe08a, { scale: 2, outline: 0x1a1a2a, align: 'center' }); }
    r3d.outline(fb, 0.6);
    vignette(fb, 0.3);
  },
};
