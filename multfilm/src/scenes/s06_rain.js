// Rain. Gemini alone on a bench under a street lamp. In a puddle — the bright
// Gemini of lantern "3" — until a drop shatters it into the grey present. The
// last firefly leaves. Along the rooftops, a figure in a fedora sneaks towards
// Clawd's house. Gemini sees it.
import { FB } from '../engine/fb.js';
import { streetWorld } from '../world/street.js';
import { r3d, actor, rgbf } from '../world/stage.js';
import { skyDome } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, mix } from '../engine/core.js';
import { vignette, LightMap, rain, letterbox, drawFlies } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { char } from '../sprites/chars.js';
import { lanternP, emote } from '../sprites/props.js';
import { float, blink } from '../kit.js';

const refl = new FB(300, 100);
const STORMSKY = [0x2a3050, 0x1a2036, 0x10142a, 0x080a18];

export default {
  dur: 12,
  in: { type: 'black', dur: 0.8 },
  render(fb, t) {
    if (t >= 4.0 && t < 8.3) return puddle(fb, t);
    if (t >= 8.3 && t < 10.4) return rooftops(fb, t);
    if (t >= 10.4) return reaction(fb, t);
    const Wd = streetWorld();
    const B = Wd.bench;
    const C = t >= 8.3;
    if (!C) { const k = E.inOutSine(seg(t, 0, 4)); r3d.camera([33 - k * 3, 4.2 - k * 0.8, B[2] - 9 + k * 2], [B[0], 3.2, B[2] + 0.5], 52); }
    else r3d.camera([25, 2.4, B[2] - 12], [19, 8.5, B[2] + 30], 58);
    r3d.clear();
    const lightning = clamp(1 - Math.abs(t - 2.5) / 0.08) + 0.6 * clamp(1 - Math.abs(t - 2.72) / 0.06);
    skyDome(fb, r3d, t, { stops: STORMSKY, stars: C ? 90 : 0, starAlpha: 0.6, moon: C ? [-0.16, 0.2, 20] : undefined, span: 0.7 });
    r3d.ambient = [0.26 + lightning, 0.28 + lightning, 0.42 + lightning];
    r3d.sun = { dir: [0.4, 0.7, 0.3], color: [0.2, 0.24, 0.4] };
    r3d.points = [];
    for (const p of Wd.lamps) r3d.points.push({ p, c: rgbf(0xffd9a0, 1.6), r: 11 });
    for (const p of Wd.lights) r3d.points.push({ p, c: rgbf(0xffc86b, 0.9), r: 5 });
    r3d.drawMesh(fb, Wd.mesh, {}, { tint: [0.85, 0.9, 1.05] });
    r3d.drawMesh(fb, Wd.nightMesh);
    r3d.fog(fb, 0x1a2036, 18, 80, 0.8);
    for (const p of Wd.lamps) { const s = r3d.project(p[0], 0.6, p[2]); if (s && s[2] < 60) for (let i = 0; i < 10; i++) fb.add(s[0] + Math.sin(t * 3 + i) * 2, s[1] + i * 2, 0xffc080, 0.25 * (1 - i / 10)); }
    const gp = [B[0] + 0.4, 2.6 + float(t, 0.06, 1.3), B[2]];
    if (!C) {
      actor(fb, gp, 'gemini', { eyes: blink(t, 3) ? 'blink' : 'sad', mouth: 'frown', grey: 0.7, lookY: 1, handL: 6, handR: 6 }, { scale: 1, groundY: 1, lift: 0.35 });
    } else {
      const lt = t - 8.3;
      const R = Wd.ridges.filter((r) => r.side === 0);
      const qz = lerp(B[2] + 2, B[2] + 26, seg(lt, 0.6, 3.7));
      const roof = R.find((r) => qz >= r.z0 - 0.5 && qz <= r.z1 + 0.5) || R.reduce((a, r) => (Math.abs((r.z0 + r.z1) / 2 - qz) < Math.abs((a.z0 + a.z1) / 2 - qz) ? r : a), R[0]);
      if (lt > 0.6 && lt < 3.7) {
        const bobY = Math.abs(Math.sin(lt * 9)) * 0.25;
        actor(fb, [roof.x + 1, roof.y + 0.4 + bobY, qz], 'qwen', { spy: true, eyes: 'shifty', handL: -6, handR: -6 }, { scale: 1, tint: 0x05060c, tintK: 0.95, lit: false, shadow: false, bias: 3 });
      }
      const see = lt > 1.6;
      const gs = actor(fb, gp, 'gemini', { eyes: see ? (lt > 2.2 ? 'wide' : 'open') : 'sad', mouth: see ? 'o' : 'frown', grey: 0.65, lookY: see ? -1 : 1, lookX: see ? 1 : 0, handL: 6, handR: see ? -6 : 6 }, { scale: 1, groundY: 1, lift: 0.4 });
      if (gs && lt > 2.2) emote(fb, 'excl', gs.x + 2, gs.y - 64 - (lt < 2.4 ? 4 : 0), { scale: 2 });
      if (gs) {
        const fk = E.inOutSine(seg(lt, 0.2, 2.6));
        const fx = lerp(gs.x + 20 + Math.sin(t * 4) * 6, 440, fk), fy = lerp(gs.y - 40, 20, fk);
        drawFlies(fb, [[fx, fy, 0.8]], 0xd9ff7a, 1 - 0.6 * fk);
      }
    }
    r3d.outline(fb, 0.6);
    r3d.bloom(fb, 0.8, 3);
    rain(fb, t, { n: 240, speed: 320, angle: 0.18, len: 6, ground: 270, alpha: 0.5, color: 0xa8b8e0 });
    if (lightning > 0) fb.overlay(0xdfe8ff, lightning * 0.3);
    letterbox(fb, 20);
    vignette(fb, 0.5);
  },
};

// close-up: the puddle remembers the bright Gemini of lantern "3"
function puddle(fb, t) {
  const lt = t - 4.0;
  fb.gradV(0, 0, 480, 270, [0x0e1426, 0x151c32, 0x1c2438]);
  for (let y = 150; y < 270; y += 7) for (let x = ((y / 7) % 2) * 9 - 9; x < 480; x += 18) { fb.rect(x, y, 16, 5, 0x232b40); fb.rect(x, y, 16, 1, 0x2e3852); }
  fb.rect(40, 118, 400, 8, 0x5a3e2a); fb.rect(40, 118, 400, 2, 0x7a5638); fb.rect(60, 126, 6, 40, 0x2c3140); fb.rect(414, 126, 6, 40, 0x2c3140);
  const drop = 2.4;
  char(fb, 'gemini', 250, 120 + float(t, 1, 1.4), { eyes: 'sad', mouth: 'frown', grey: 0.7, lookY: 1, handL: 6, handR: 6, tear: lt > 2.9 ? lt : undefined }, { scale: 2 });
  refl.clear(0x1a2440);
  const memory = lt < drop + 0.12;
  if (memory) {
    refl.gradV(0, 0, 300, 100, [0x4a5ab0, 0x2a3a80, 0x1c2a60]);
    for (let i = 0; i < 18; i++) refl.set(hash(i * 3) * 300, hash(i * 7) * 60, 0xffffff);
    lanternP(refl, 212, 26, { kind: 'gem', w: 24, t, label: '3' });
    for (let i = 0; i < 10; i++) { const a = t * 1.5 + i * 0.63; refl.glow(212 + Math.cos(a) * 30, 26 + Math.sin(a) * 18, 4, 0xd9ff7a, 0.6, 3); }
    char(refl, 'gemini', 140, 96, { eyes: 'happy', mouth: 'open', blush: 'big', handL: -12, handR: -12 });
  } else char(refl, 'gemini', 140, 96, { eyes: 'sad', mouth: 'frown', grey: 0.7 });
  const px = 90, py = 170, pw = 300, ph = 100;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const dx = (x - pw / 2) / (pw / 2), dy = (y - ph / 2) / (ph / 2);
    if (dx * dx + dy * dy > 1) continue;
    const rip = lt > drop ? Math.sin(Math.hypot(dx * 4, dy * 2) * 12 - (lt - drop) * 16) * 3 * Math.exp(-(lt - drop) * 1.2) : 0;
    const sx = Math.round(x + rip + Math.sin(y * 0.8 + t * 3) * 0.6), sy = Math.round(y + rip * 0.5);
    let c = refl.get(Math.max(0, Math.min(299, sx)), Math.max(0, Math.min(99, 99 - sy)));
    if (c < 0) c = 0x1a2440;
    fb.set(px + x, py + y, mix(c, 0x0a1224, 0.12 + (dx * dx + dy * dy) * 0.3));
  }
  if (lt > drop) for (let r = 0; r < 3; r++) { const rr = (lt - drop) * 50 - r * 14; if (rr > 0 && rr < 140) fb.ellipse(px + pw / 2, py + ph / 2, rr, rr * 0.2, 0xbfd0f0, 0.45 * (1 - rr / 140)); }
  if (lt > drop - 0.5 && lt < drop) { const k = (lt - (drop - 0.5)) / 0.5; fb.rect(px + pw / 2, lerp(100, py + ph / 2, k), 2, 4, 0xbfe6ff); }
  const L = new LightMap().reset(0.55, 0.58, 0.8);
  L.light(420, 10, 360, 0xffd9a0, 0.9);
  L.light(240, 230, 200, 0x9fb4ff, 0.35);
  L.apply(fb, 8);
  rain(fb, t, { n: 200, speed: 320, angle: 0.18, len: 7, ground: 270, alpha: 0.45 });
  letterbox(fb, 20);
  vignette(fb, 0.55);
}

// silhouette: the copycat tiptoes across the rooftops in front of the moon
function rooftops(fb, t) {
  const lt = t - 8.3;
  fb.gradV(0, 0, 480, 270, [0x0a0d22, 0x141a3a, 0x232c58, 0x2e3a6a]);
  const mx = 250, my = 118;
  fb.glow(mx, my, 150, 0x9fb4ff, 0.35, 8);
  fb.circle(mx, my, 58, 0xf4efd8);
  fb.circle(mx - 18, my - 14, 10, 0xe4ddc0); fb.circle(mx + 20, my + 16, 13, 0xe4ddc0); fb.circle(mx + 8, my - 26, 6, 0xe4ddc0);
  for (let i = 0; i < 4; i++) { const cx = ((i * 170 + lt * 14) % 700) - 110; fb.ellipse(cx, 60 + i * 22, 70, 9, 0x1c2244, 0.8); }
  // rooftop skyline (near layer), with chimneys, antennas and lit windows
  const ridge = (x) => 190 - (Math.floor(x / 60) % 3) * 12 - (((x % 60) + 60) % 60 < 30 ? ((x % 60) + 60) % 60 : 60 - (((x % 60) + 60) % 60)) * 0.9;
  for (let x = 0; x < 480; x++) fb.rect(x, Math.round(ridge(x)), 1, 270, 0x06070f);
  for (const [cx, h] of [[70, 22], [205, 18], [350, 26], [430, 16]]) fb.rect(cx, Math.round(ridge(cx)) - h, 10, h + 4, 0x06070f);
  fb.line(300, Math.round(ridge(300)) - 30, 300, Math.round(ridge(300)), 0x06070f); fb.line(292, Math.round(ridge(300)) - 26, 308, Math.round(ridge(300)) - 26, 0x06070f);
  for (let i = 0; i < 16; i++) { const wx = 12 + i * 30, wy = 222 + (i % 3) * 12; if (hash(i * 7) > 0.35) fb.rect(wx, wy, 6, 8, 0xffc86b); }
  // Qwen crossing the moon with a sack of cardboard copies
  const qx = lerp(40, 440, E.inOutSine(seg(lt, 0.1, 2.0)));
  const qy = Math.round(ridge(qx)) + 1 - Math.abs(Math.sin(lt * 10)) * 3;
  fb.rect(qx - 30, qy - 58, 16, 26, 0x06070f); fb.rect(qx - 32, qy - 60, 20, 3, 0x06070f);
  char(fb, 'qwen', qx, qy, { spy: true, handL: -8, handR: -8 }, { scale: 1, solid: 0x06070f });
  // the last firefly heads away
  const fk = seg(lt, 0, 2.0);
  drawFlies(fb, [[lerp(420, 150, fk), lerp(250, 40, fk) + Math.sin(t * 5) * 3, 0.8]], 0xd9ff7a, 1 - 0.5 * fk);
  rain(fb, t, { n: 200, speed: 320, angle: 0.18, len: 6, ground: 270, alpha: 0.45, color: 0xa8b8e0 });
  letterbox(fb, 20);
  vignette(fb, 0.5);
}

// Gemini notices — and decides to follow
function reaction(fb, t) {
  const lt = t - 10.4;
  fb.gradV(0, 0, 480, 270, [0x0e1426, 0x151c32, 0x1c2438]);
  fb.rect(0, 190, 480, 80, 0x151a2a);
  for (let y = 196; y < 270; y += 7) for (let x = ((y / 7) % 2) * 9 - 9; x < 480; x += 18) fb.rect(x, y, 16, 5, 0x1e2536);
  fb.rect(40, 176, 400, 8, 0x5a3e2a); fb.rect(40, 176, 400, 2, 0x7a5638);
  const up = E.inOutSine(seg(lt, 0.9, 1.6));
  const gx = 240 + up * 40, gy = 178 - up * 30 + float(t, 1, 2);
  const see = lt > 0.15;
  char(fb, 'gemini', gx, gy, { eyes: see ? (lt > 0.9 ? 'determined' : 'wide') : 'sad', mouth: lt > 0.9 ? 'flat' : see ? 'o' : 'frown', grey: 0.6 - 0.2 * up, lookY: -1, lookX: 1, handL: lt > 0.9 ? -8 : 6, handR: lt > 0.9 ? -8 : 6 }, { scale: 2 });
  if (see && lt < 1.2) emote(fb, 'excl', gx + 6, gy - 130 - (lt < 0.3 ? 6 : 0), { scale: 3 });
  const L = new LightMap().reset(0.5, 0.54, 0.78);
  L.light(380, 0, 330, 0xffd9a0, 0.95);
  L.apply(fb, 8);
  rain(fb, t, { n: 200, speed: 320, angle: 0.18, len: 7, ground: 270, alpha: 0.45 });
  letterbox(fb, 20);
  vignette(fb, 0.55);
}
