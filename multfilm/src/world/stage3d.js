// Helpers for HD-2D shots: 2D pixel characters and lanterns placed in voxel worlds.
import { R3D } from '../engine/vox.js';
import { clamp } from '../engine/core.js';
import { lantern } from '../props.js';

export const r3d = new R3D();

const rgbf = (c, k = 1) => [((c >> 16) & 255) / 255 * k, ((c >> 8) & 255) / 255 * k, (c & 255) / 255 * k];
export { rgbf };

export function worldLights(world, k = 1.6) {
  return world.lights.map((L) => ({ p: L.p, c: rgbf(L.c, k), r: L.small ? 7 : 12 }));
}

// Draw a 2D character standing at world point p (feet). fn(layer, sx, sy, scale) draws at screen coords.
// Returns screen position or null.
export function actor(fb, p, fn, o = {}) {
  const s = r3d.project(p[0], p[1], p[2]);
  if (!s) return null;
  let mul = null;
  if (o.lit !== false) {
    const L = r3d.lightAt(p[0], p[1] + 1, p[2], null);
    const lift = o.lift === undefined ? 0.35 : o.lift;
    mul = L.map((v) => clamp(v * (o.gain || 1.25) + lift, 0, 1.4));
  }
  r3d.layer(fb, s[2] - (o.bias || 0.6), (L) => fn(L, Math.round(s[0]), Math.round(s[1]), s[2]), mul, o.glow || 0);
  return s;
}

// Sky lantern at world point p; size scales with distance; simple centre depth test.
export function skyLantern(fb, p, o = {}) {
  const s = r3d.project(p[0], p[1], p[2]);
  if (!s) return null;
  const sx = Math.round(s[0]), sy = Math.round(s[1]);
  if (sx < -40 || sy < -40 || sx > fb.w + 40 || sy > fb.h + 40) return s;
  if (sx >= 0 && sy >= 0 && sx < fb.w && sy < fb.h && s[2] > r3d.z[sy * fb.w + sx]) return s;
  const size = clamp(((o.size || 3) * r3d.focal) / s[2], 3, o.maxSize || 60);
  lantern(fb, sx, sy, { ...o, size });
  return s;
}
