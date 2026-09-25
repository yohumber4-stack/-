// Voxel street for the morning "hero walk": pastel houses, bunting, cobblestones.
import { VoxModel, meshify, EMIT } from '../engine/vox.js';
import { hash, hash2, mix } from '../engine/core.js';

export const ST = { x0: 20, x1: 36, len: 150 };
let cache = null;

export function streetWorld() {
  if (cache) return cache;
  const SX = 56, SY = 30, SZ = ST.len;
  const m = new VoxModel(SX, SY, SZ);
  // ground: road + sidewalks
  for (let z = 0; z < SZ; z++)
    for (let x = 0; x < SX; x++) {
      let c;
      if (x >= ST.x0 && x < ST.x1) c = ((x + z) % 2 ? mix(0x9a9aa4, 0x8a8a94, hash2(x, z)) : mix(0xaaaab2, 0x9c9ca6, hash2(z, x)));
      else if ((x >= ST.x0 - 3 && x < ST.x0) || (x >= ST.x1 && x < ST.x1 + 3)) c = mix(0xd8ccb4, 0xc8bca4, hash2(x * 3, z));
      else c = mix(0x6a9a54, 0x5a8a48, hash2(x, z * 7));
      m.set(x, 0, z, c);
      if (x === ST.x0 - 1 || x === ST.x1) m.set(x, 1, z, 0xb8ac94);
    }
  const walls = [0xf4e3c8, 0xf6d2c2, 0xd8e6f0, 0xe4f0d8, 0xf2e0f0, 0xfff0c8];
  const roofs = [0xc8543c, 0x4a74b0, 0x8a4a6a, 0xd0843c, 0x3a8a6a];
  const lights = [];
  for (const side of [0, 1]) {
    let z = 2, i = side * 50;
    while (z < SZ - 8) {
      i++;
      const w = 8 + Math.floor(hash(i * 3) * 6), h = 8 + Math.floor(hash(i * 5) * 8), d = 9;
      const x0 = side === 0 ? ST.x0 - 3 - d : ST.x1 + 3, x1 = x0 + d - 1;
      const wc = walls[Math.floor(hash(i * 7) * walls.length)], rc = roofs[Math.floor(hash(i * 11) * roofs.length)];
      m.box(x0, 1, z, x1, h, z + w - 1, (x, y, zz) => mix(wc, 0xffffff, hash2(x + y * 3, zz) * 0.1));
      // gabled roof along z
      for (let k = 0; k <= Math.ceil(d / 2); k++) m.box(x0 - 1 + k, h + 1 + k, z - 1, x1 + 1 - k, h + 1 + k, z + w, (x, y, zz) => mix(rc, 0x000000, ((x + y) % 2) * 0.12));
      // street-facing windows, door, flower boxes
      const fx = side === 0 ? x1 : x0;
      for (let zz = z + 1; zz < z + w - 1; zz += 3) {
        for (let y = 3; y < h - 1; y += 4) {
          m.set(fx, y, zz, 0x8fb4d8); m.set(fx, y + 1, zz, 0x8fb4d8);
          if (hash(zz * 13 + y + i) > 0.5) { const bx = side === 0 ? fx + 1 : fx - 1; m.set(bx, y - 1, zz, 0x7a5a3a); m.set(bx, y, zz, hash(zz + y) > 0.5 ? 0xe84a5a : 0xffd04a); }
        }
      }
      const dz = z + Math.floor(w / 2);
      m.box(fx, 1, dz, fx, 3, dz, 0x7a4a2a);
      // hanging lantern by the door
      const lx = side === 0 ? fx + 1 : fx - 1;
      m.set(lx, 5, dz + 1, 0xffc86b | EMIT);
      lights.push([lx + 0.5, 5.5, dz + 1.5]);
      z += w + 1 + Math.floor(hash(i * 13) * 2);
    }
  }
  // bunting across the street
  const cols = [0xea4335, 0xfbbc04, 0x34a853, 0x4285f4];
  for (let z = 10; z < SZ; z += 18) {
    for (let x = ST.x0 - 3; x <= ST.x1 + 3; x++) {
      const k = (x - (ST.x0 - 3)) / (ST.x1 - ST.x0 + 6);
      const y = Math.round(13 - Math.sin(k * Math.PI) * 3);
      m.set(x, y, z, 0x4a3a3a);
      if (x % 2 === 0) { m.set(x, y - 1, z, cols[(x / 2 + z) % 4]); m.set(x, y - 2, z, cols[(x / 2 + z) % 4]); }
    }
  }
  // potted trees on the sidewalks
  for (let z = 6; z < SZ; z += 14)
    for (const x of [ST.x0 - 2, ST.x1 + 1]) {
      m.box(x, 1, z, x, 1, z, 0x9a5a3a);
      m.box(x, 2, z, x, 3, z, 0x6a4a32);
      m.ellipsoid(x + 0.5, 5, z + 0.5, 1.8, 1.6, 1.8, (xx, yy, zz) => mix(0x4a8a3a, 0x5aa048, hash2(xx + yy, zz)));
    }
  cache = { mesh: meshify(m), lights };
  return cache;
}
