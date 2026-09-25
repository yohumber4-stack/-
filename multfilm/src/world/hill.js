// Voxel world for the festival hill: hill with an old tree, a seaside town with
// lit windows, lantern strings, a lighthouse. Built once and cached.
import { VoxModel, meshify, EMIT } from '../engine/vox.js';
import { hash2, noise2, fbm, mix, clamp, hash } from '../engine/core.js';

export const SEA_Y = 2;
export const HILL = { x: 40, z: 40, top: 0 };

function heightAt(x, z) {
  const dh = Math.hypot(x - HILL.x, (z - HILL.z) * 1.15);
  const hill = 19 * Math.exp(-(dh * dh) / (2 * 15 * 15));
  const plateau = 4 + fbm(x * 0.05, z * 0.05, 3) * 3;
  let h = Math.max(hill + 3, plateau);
  // coast towards +z (the sea at the back) and flat top on the hill
  const coast = clamp((z - 78 + (noise2(x * 0.08, 3.3) - 0.5) * 10) / 8);
  h = h * (1 - coast) + (SEA_Y - 2) * coast;
  if (dh < 9) h = Math.max(h, 21.5);
  return Math.round(h);
}

let cache = null;
export function hillWorld() {
  if (cache) return cache;
  const SX = 136, SY = 48, SZ = 100;
  let m = new VoxModel(SX, SY, SZ);
  const H = [];
  for (let z = 0; z < SZ; z++)
    for (let x = 0; x < SX; x++) {
      const h = heightAt(x, z);
      H[z * SX + x] = h;
      for (let y = 0; y <= h; y++) {
        let c;
        const n = hash2(x * 7 + y, z * 13 + y * 3);
        if (y === h) {
          const beach = h <= SEA_Y + 1;
          c = beach ? mix(0xd9c28e, 0xc9ae78, n) : mix(0x4f8a45, 0x3d7438, n);
          if (!beach && hash2(x, z) > 0.93) c = mix(0x6aa054, 0x80b35d, n);
        } else if (y > h - 3) c = mix(0x6b4a33, 0x5c3f2c, n);
        else c = mix(0x5b5f69, 0x4c5059, n);
        m.set(x, y, z, c);
      }
    }
  HILL.top = heightAt(HILL.x, HILL.z) + 1;

  // stone path spiralling from the town up the hill
  for (let i = 0; i < 400; i++) {
    const a = i / 400;
    const x = Math.round(HILL.x + 4 + Math.cos(a * 4.2 + 0.3) * (6 + a * 26));
    const z = Math.round(HILL.z + 3 + Math.sin(a * 4.2 + 0.3) * (5 + a * 18) + a * 12);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const xx = x + dx, zz = z + dz;
        if (xx < 0 || zz < 0 || xx >= SX || zz >= SZ) continue;
        const h = H[zz * SX + xx];
        if (h > SEA_Y) m.set(xx, h, zz, mix(0xb9a98c, 0x9d8f76, hash2(xx, zz)));
      }
  }
  // plaza on the hilltop (launch pad)
  for (let dz = -6; dz <= 6; dz++)
    for (let dx = -7; dx <= 7; dx++)
      if (dx * dx / 49 + dz * dz / 36 <= 1) m.set(HILL.x + dx, HILL.top - 1, HILL.z + dz, (dx + dz) & 1 ? 0xb4a58a : 0xa39479);
  for (let a = 0; a < 64; a++) {
    const x = Math.round(HILL.x + Math.cos((a / 64) * Math.PI * 2) * 7.5), z = Math.round(HILL.z + Math.sin((a / 64) * Math.PI * 2) * 6.5);
    m.set(x, HILL.top - 1, z, 0x8a7d66);
  }

  // the old tree behind the plaza (own model so shots can omit it)
  const tx = HILL.x - 9, tz = HILL.z + 8, ty = HILL.top - 1;
  const main = m;
  m = new VoxModel(SX, SY, SZ);
  m.box(tx, ty, tz, tx + 1, ty + 9, tz + 1, (x, y, z) => mix(0x6d4a32, 0x5a3b27, hash2(x + y, z)));
  m.box(tx - 3, ty + 6, tz, tx - 1, ty + 6, tz, 0x5a3b27);
  m.box(tx + 2, ty + 7, tz + 1, tx + 4, ty + 7, tz + 1, 0x5a3b27);
  const leaf = (x, y, z) => mix(0x24552f, 0x33703d, hash2(x * 3 + y, z * 5 - y));
  m.ellipsoid(tx + 1, ty + 12, tz + 1, 7, 4.5, 6, leaf);
  m.ellipsoid(tx - 4, ty + 9.5, tz + 1, 4, 3, 4, leaf);
  m.ellipsoid(tx + 6, ty + 10, tz + 2, 4, 3, 4, leaf);
  // lanterns hanging from the canopy
  const lanternCols = [0xffb347, 0xff7a59, 0xffe066, 0x8fd3ff];
  const lights = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const lx = Math.round(tx + 1 + Math.cos(a) * 7), lz = Math.round(tz + 1 + Math.sin(a) * 6), ly = ty + 8 - (i % 2);
    m.set(lx, ly + 1, lz, 0x3b2a20);
    m.set(lx, ly, lz, lanternCols[i % 4] | EMIT);
    lights.push({ p: [lx + 0.5, ly + 0.5, lz + 0.5], c: lanternCols[i % 4] });
  }
  const treeModel = m;
  m = main;

  // town houses
  const houses = [];
  const walls = [0xf1e6d0, 0xe8d3b5, 0xf5efe6, 0xdfe7ee, 0xf2dcc8];
  const roofs = [0xc0503a, 0xb5653e, 0x4a6fa5, 0x8c4f6b, 0xc97a3d];
  let seed = 1;
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 7; col++) {
      seed++;
      const hx = 62 + col * 10 + Math.round((hash(seed) - 0.5) * 3) - row * 3;
      const hz = 50 + row * 10 + Math.round((hash(seed * 3) - 0.5) * 3);
      if (hx + 7 >= SX) continue;
      const w = 5 + Math.floor(hash(seed * 5) * 3), d = 5 + Math.floor(hash(seed * 7) * 2), hh = 4 + Math.floor(hash(seed * 11) * 3);
      let base = 0;
      for (let x = hx; x < hx + w; x++) for (let z = hz; z < hz + d; z++) base = Math.max(base, H[z * SX + x] || 0);
      if (base <= SEA_Y + 1) continue;
      const wc = walls[Math.floor(hash(seed * 13) * walls.length)], rc = roofs[Math.floor(hash(seed * 17) * roofs.length)];
      for (let x = hx; x < hx + w; x++) for (let z = hz; z < hz + d; z++) for (let y = (H[z * SX + x] || 0) + 1; y <= base; y++) m.set(x, y, z, 0x7a6f66);
      m.box(hx, base + 1, hz, hx + w - 1, base + hh, hz + d - 1, (x, y, z) => mix(wc, 0xffffff, hash2(x + y * 5, z) * 0.12));
      // pitched roof along x
      for (let k = 0; k <= Math.ceil(d / 2); k++)
        m.box(hx - 1, base + hh + 1 + k, hz - 1 + k, hx + w, base + hh + 1 + k, hz + d - k, (x, y, z) => mix(rc, 0x000000, ((z + y) % 2) * 0.12));
      // windows (emissive) and door
      for (let x = hx + 1; x < hx + w - 1; x += 2) {
        const lit = hash(seed * 19 + x) > 0.25;
        m.set(x, base + 3, hz - 0, lit ? (0xffd27a | EMIT) : 0x3a4458);
        if (hh > 4) m.set(x, base + 5, hz, hash(seed * 23 + x) > 0.4 ? (0xffc561 | EMIT) : 0x3a4458);
      }
      m.box(hx + Math.floor(w / 2), base + 1, hz, hx + Math.floor(w / 2), base + 2, hz, 0x6b4a32);
      // chimney
      if (hash(seed * 29) > 0.5) m.box(hx + w - 2, base + hh + 2, hz + 1, hx + w - 2, base + hh + 4, hz + 1, 0x8a6a5a);
      houses.push({ x: hx + w / 2, y: base + 3, z: hz, w, d });
      if (hash(seed * 31) > 0.5) lights.push({ p: [hx + w / 2, base + 3, hz - 1.5], c: 0xffc86b, small: true });
    }

  // lantern strings across the town
  for (let s = 0; s < 4; s++) {
    const x0 = 58 + s * 17, z0 = 46 + (s % 2) * 9, x1 = x0 + 15;
    let y0 = 0;
    for (let x = x0; x <= x1; x++) y0 = Math.max(y0, (H[z0 * SX + x] || 0));
    for (let x = x0; x <= x1; x++) {
      const k = (x - x0) / (x1 - x0);
      const y = Math.round(y0 + 9 - Math.sin(k * Math.PI) * 3);
      if ((x - x0) % 3 === 1) m.set(x, y, z0, [0xff8a5c, 0xffd166, 0x9be7ff, 0xff9ecd][(x + s) % 4] | EMIT);
      else m.set(x, y + 1, z0, 0x333333);
    }
  }

  // lighthouse on the cape
  const lx = 120, lz = 70;
  let lbase = 0;
  for (let x = lx - 3; x <= lx + 3; x++) for (let z = lz - 3; z <= lz + 3; z++) lbase = Math.max(lbase, H[z * SX + x] || 0);
  for (let y = 0; y <= lbase; y++) for (let x = lx - 3; x <= lx + 3; x++) for (let z = lz - 3; z <= lz + 3; z++) m.set(x, y, z, 0x6e6a66);
  for (let y = lbase + 1; y <= lbase + 18; y++) {
    const r = 2.6 - (y - lbase) * 0.04;
    for (let x = lx - 3; x <= lx + 3; x++)
      for (let z = lz - 3; z <= lz + 3; z++)
        if ((x - lx) ** 2 + (z - lz) ** 2 <= r * r) m.set(x, y, z, Math.floor((y - lbase) / 3) % 2 ? 0xd64541 : 0xf4f1ea);
  }
  m.box(lx - 1, lbase + 19, lz - 1, lx + 1, lbase + 20, lz + 1, 0xfff1b0 | EMIT);
  m.box(lx - 2, lbase + 21, lz - 2, lx + 2, lbase + 21, lz + 2, 0x3a3a44);
  const beacon = [lx + 0.5, lbase + 20, lz + 0.5];

  cache = { mesh: meshify(m), treeMesh: meshify(treeModel), lights, houses, beacon, H, SX, SZ, heightAt: (x, z) => H[Math.round(z) * SX + Math.round(x)] || 0, tree: [tx + 1, ty + 12, tz + 1], plaza: [HILL.x, HILL.top, HILL.z] };
  return cache;
}
