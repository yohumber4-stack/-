// HD-2D helpers: pixel sprites placed in voxel worlds at crisp integer scales,
// depth-tested against the z-buffer, lit by the scene lights, with ground shadows.
import { R3D } from '../engine/vox.js';
import { clamp } from '../engine/core.js';
import { BUILD, drawSprite } from '../sprites/chars.js';
import { lanternP } from '../sprites/props.js';

export const r3d = new R3D();
export const rgbf = (c, k = 1) => [((c >> 16) & 255) / 255 * k, ((c >> 8) & 255) / 255 * k, (c & 255) / 255 * k];

export function worldLights(list, k = 1.5) {
  return list.map((L) => ({ p: L.p, c: rgbf(L.c, k * (L.k || 1)), r: L.r || 12 }));
}

function lightMul(p, o) {
  if (o.lit === false) return null;
  const L = r3d.lightAt(p[0], p[1] + 1.5, p[2], null);
  const lift = o.lift === undefined ? 0.42 : o.lift, gain = o.gain === undefined ? 1.1 : o.gain;
  return L.map((v) => clamp(v * gain + lift, 0, o.max || 1.35));
}

// Character at world point p (feet on the ground). name: sprite builder key, so: sprite options,
// d: { scale, flip, shadow (px width), lift, gain, lit, bias, glow, alpha, dy (screen px offset) }
export function actor(fb, p, name, so = {}, d = {}) {
  const s = r3d.project(p[0], p[1], p[2]);
  if (!s) return null;
  const sx = Math.round(s[0]), sy = Math.round(s[1]) + (d.dy || 0);
  const depth = s[2] - (d.bias === undefined ? 0.8 : d.bias);
  if (d.shadow !== false) {
    const g = r3d.project(p[0], (d.groundY === undefined ? p[1] : d.groundY) + 0.02, p[2]);
    if (g) {
      const w = (d.shadow || 34) * (d.scale || 1);
      r3d.layer(fb, g[2] - 0.3, (L) => L.ellipse(Math.round(g[0]), Math.round(g[1]), w / 2, Math.max(1.5, w / 8), 0x000000, 0.9), [0.45, 0.45, 0.5]);
    }
  }
  const spr = BUILD[name](so);
  r3d.layer(fb, depth, (L) => drawSprite(L, spr, sx, sy, { scale: d.scale || 1, flip: d.flip, alpha: d.alpha, tint: d.tint, tintK: d.tintK }), lightMul(p, d), d.glow || 0);
  return { x: sx, y: sy, z: s[2], spr };
}

// Any 2D drawing at a world point, depth-tested (props, bubbles pinned in the scene)
export function billboard(fb, p, fn, d = {}) {
  const s = r3d.project(p[0], p[1], p[2]);
  if (!s) return null;
  r3d.layer(fb, s[2] - (d.bias || 0.5), (L) => fn(L, Math.round(s[0]), Math.round(s[1]), s[2]), d.lit ? lightMul(p, d) : null, d.glow || 0);
  return { x: Math.round(s[0]), y: Math.round(s[1]), z: s[2] };
}

// Sky lantern at world point p with a fixed on-screen size (crisp sprite), simple depth test on its centre
export function lanternW(fb, p, o = {}) {
  const s = r3d.project(p[0], p[1], p[2]);
  if (!s) return null;
  const sx = Math.round(s[0]), sy = Math.round(s[1]);
  if (sx < -60 || sy < -60 || sx > fb.w + 60 || sy > fb.h + 60) return s;
  if (sx >= 0 && sy >= 0 && sx < fb.w && sy < fb.h && s[2] > r3d.z[sy * fb.w + sx]) return s;
  const w = o.persp ? clamp((o.size * r3d.focal) / s[2], 6, o.maxW || 48) : o.w || 16;
  lanternP(fb, sx, sy, { ...o, w });
  return s;
}
