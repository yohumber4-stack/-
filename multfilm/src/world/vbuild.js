// Voxel building kit shared by the dioramas: textured boxes, roofs, trees,
// fences, furniture and light fixtures.
import { EMIT } from '../engine/vox.js';
import { hash2, hash, mix } from '../engine/core.js';

export const tex = (a, b, s = 1) => (x, y, z) => mix(a, b, hash2(x * 7 + y * 13 * s, z * 11 - y * 5));
export const planks = (a, b, dir = 'x') => (x, y, z) => {
  const row = dir === 'x' ? z : x, along = dir === 'x' ? x : z;
  const seg = Math.floor((along + hash(row * 17) * 7) / 6);
  const base = mix(a, b, hash(row * 31 + seg * 7) * 0.8);
  return (along + Math.floor(hash(row * 17) * 7)) % 6 === 0 ? mix(base, 0x000000, 0.25) : mix(base, 0xffffff, hash2(x + y, z) * 0.06);
};
export const bricks = (a, b, mortar) => (x, y, z) => {
  const off = y % 2 ? 1 : 0, u = x + z;
  if (y % 2 === 0 && (u + off) % 3 === 0) return mortar;
  if (y % 3 === 2) return mix(mortar, a, 0.4);
  return mix(a, b, hash2(Math.floor((u + off) / 3) * 5 + y, y * 3));
};

export function gableRoof(m, x0, x1, z0, z1, y0, col, alongX = true, overhang = 1) {
  const depth = alongX ? z1 - z0 + 1 : x1 - x0 + 1;
  const half = Math.ceil(depth / 2);
  for (let k = 0; k <= half; k++) {
    const y = y0 + k;
    if (alongX) m.box(x0 - overhang, y, z0 - overhang + k, x1 + overhang, y, z1 + overhang - k, (x, yy, z) => mix(col, 0x000000, ((x + yy) % 2) * 0.1 + (k === 0 ? 0.15 : 0)));
    else m.box(x0 - overhang + k, y, z0 - overhang, x1 + overhang - k, y, z1 + overhang, (x, yy, z) => mix(col, 0x000000, ((z + yy) % 2) * 0.1 + (k === 0 ? 0.15 : 0)));
  }
}

export function tree(m, x, y, z, s = 1, leafA = 0x2f6b3a, leafB = 0x3f8646) {
  const h = Math.round(6 * s);
  m.box(x, y, z, x + 1, y + h, z + 1, tex(0x6d4a32, 0x5a3b27));
  const leaf = tex(leafA, leafB);
  m.ellipsoid(x + 1, y + h + 2.5 * s, z + 1, 4.5 * s, 3.6 * s, 4.5 * s, leaf);
  m.ellipsoid(x - 1.5 * s, y + h + 0.5 * s, z + 1, 3 * s, 2.5 * s, 3 * s, leaf);
  m.ellipsoid(x + 3.5 * s, y + h + 1 * s, z + 2, 3 * s, 2.5 * s, 3 * s, leaf);
}
export function bush(m, x, y, z, r = 2.5, a = 0x2a6236, b = 0x3a7e44) {
  m.ellipsoid(x, y + r * 0.6, z, r * 1.3, r, r, tex(a, b));
}
export function flowers(m, x, y, z, n, seed = 1) {
  const cols = [0xff6b8a, 0xffd04a, 0xffffff, 0xb28dff];
  for (let i = 0; i < n; i++) {
    const fx = x + Math.floor(hash(seed * 13 + i) * 5), fz = z + Math.floor(hash(seed * 7 + i * 3) * 3);
    m.set(fx, y, fz, 0x3f8646); m.set(fx, y + 1, fz, cols[i % 4]);
  }
}
export function fence(m, x0, x1, z, y, col = 0xc9b28a, gap = null, h = 3) {
  for (let x = x0; x <= x1; x++) {
    if (gap && x >= gap[0] && x <= gap[1]) continue;
    if ((x - x0) % 3 === 0) { m.box(x, y, z, x, y + h, z, col); }
    m.set(x, y + 1, z, mix(col, 0x000000, 0.12)); if (h > 2) m.set(x, y + 2, z, mix(col, 0x000000, 0.06));
  }
}
export function barrel(m, x, y, z) {
  for (let yy = 0; yy < 4; yy++) {
    const r = yy === 0 || yy === 3 ? 1.2 : 1.6;
    m.ellipsoid(x + 0.5, y + yy + 0.5, z + 0.5, r, 0.5, r, yy === 1 || yy === 2 ? tex(0x8a6040, 0x7a5236) : 0x3a3a44);
  }
}
export function crate(m, x, y, z, s = 2) {
  m.box(x, y, z, x + s - 1, y + s - 1, z + s - 1, (xx, yy, zz) => ((xx === x || xx === x + s - 1) && (yy === y || yy === y + s - 1)) || ((zz === z || zz === z + s - 1) && (yy === y || yy === y + s - 1)) ? 0x7a5236 : mix(0xb08050, 0x9a6a40, hash2(xx + yy, zz)));
}
export function lampPost(m, x, y, z, h = 9, on = true) {
  m.box(x, y, z, x, y + h, z, 0x2c3140);
  m.box(x - 1, y, z - 1, x + 1, y, z + 1, 0x2c3140);
  m.box(x, y + h, z, x + 2, y + h, z, 0x2c3140);
  m.box(x + 2, y + h - 1, z, x + 2, y + h - 1, z, on ? 0xfff0c0 | EMIT : 0x7a7a84);
  return [x + 2.5, y + h - 1.5, z + 0.5];
}
export function bench(m, x, y, z, w = 6) {
  m.box(x, y + 1, z, x + w - 1, y + 1, z + 1, planks(0x9a6a44, 0x8a5a36, 'x'));
  m.box(x, y + 2, z + 1, x + w - 1, y + 3, z + 1, planks(0x9a6a44, 0x8a5a36, 'x'));
  for (const xx of [x, x + w - 1]) { m.set(xx, y, z, 0x2c3140); m.set(xx, y, z + 1, 0x2c3140); }
}
