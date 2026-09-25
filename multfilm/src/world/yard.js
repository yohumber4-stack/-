// Clawd's cottage and garden at night (heist, friendship, ambush).
import { VoxModel, meshify, EMIT } from '../engine/vox.js';
import { hash, hash2, mix, fbm } from '../engine/core.js';
import { tex, planks, bricks, gableRoof, tree, bush, flowers, fence, barrel, crate, lampPost } from './vbuild.js';

export const YD = {
  house: { x0: 34, x1: 55, z0: 30, z1: 43 },
  door: [47.5, 1, 29.4], hatch: [52.5, 3.2, 29.3], win: [39.5, 4.5, 29.4], bell: [44.2, 5.2, 29.0], lamp: [50.9, 5.5, 29.2],
  hammock: [18, 1, 27], bushes: [30, 1, 22], barrel: [10, 1, 14], gate: [44, 1, 20], road: 10,
};

let cache = null;
export function yardWorld() {
  if (cache) return cache;
  const SX = 84, SY = 30, SZ = 78;
  const m = new VoxModel(SX, SY, SZ);
  const lights = [];
  // ground: grass, cobbled road at the front, stone path to the door
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const hill = z > 58 ? Math.round((z - 58) * 0.5 + fbm(x * 0.06, z * 0.06, 3) * 3) : 0;
    for (let y = 0; y <= hill; y++) {
      let c;
      if (z >= 4 && z <= 13 && hill === 0) c = ((x + (z % 2) * 2) % 4 === 0 || z % 3 === 0) ? mix(0x6e6a72, 0x5e5a62, hash2(x, z)) : mix(0x8a8690, 0x9a96a0, hash2(z, x));
      else if (x >= 45 && x <= 49 && z > 13 && z < 30 && hill === 0) c = ((x + z) % 3 === 0) ? 0x9a8c74 : mix(0xc4b496, 0xb4a486, hash2(x, z));
      else c = y === hill ? mix(0x3f7a3a, 0x4f8a45, hash2(x * 3, z * 5)) : 0x5a4a3a;
      m.set(x, y, z, c);
    }
    if (hill === 0 && z > 34 && hash2(x * 5, z * 3) > 0.9) m.set(x, 1, z, mix(0x5aa048, 0x6ab458, hash2(z, x)));
  }
  // road kerb
  for (let x = 0; x < SX; x++) { m.set(x, 1, 14, 0xb0aca4); m.set(x, 1, 3, 0xb0aca4); }

  // ---- the cottage ----
  const { x0, x1, z0, z1 } = YD.house;
  const wall = (x, y, z) => {
    const beam = (x - x0) % 7 === 0 || y === 1 || y === 9;
    return beam ? mix(0x6d4a32, 0x5a3b27, hash2(x, y)) : mix(0xf1e4c8, 0xe6d6b6, hash2(x * 3 + y, z));
  };
  m.box(x0, 1, z0, x1, 9, z1, wall);
  for (let x = x0 + 1; x < x1; x++) for (let z = z0 + 1; z < z1; z++) for (let y = 1; y <= 8; y++) m.del(x, y, z);
  gableRoof(m, x0, x1, z0, z1, 10, 0xc8643c, true, 1);
  // chimney
  m.box(x1 - 5, 12, z0 + 8, x1 - 3, 19, z0 + 10, bricks(0x9a5a48, 0x8a4a3a, 0x6a5a52));
  // door (recessed) and porch
  m.box(46, 1, z0, 48, 6, z0, (x, y) => (y === 6 ? 0x5a3b27 : mix(0x9a5a36, 0xa8683e, hash2(x, y))));
  m.set(48, 3, z0 - 1, 0xe0b040);
  m.box(44, 1, z0 - 2, 50, 1, z0 - 1, planks(0xa08060, 0x8a6a4a, 'x'));
  // round window with warm light (lit state is swapped per scene via separate meshes)
  const winPix = [];
  for (let y = 2; y <= 7; y++) for (let x = 37; x <= 42; x++) {
    const dx = x - 39.5, dy = y - 4.5;
    if (dx * dx + dy * dy <= 7.5) winPix.push([x, y]);
  }
  for (const [x, y] of winPix) m.del(x, y, z0);
  // ASK hatch with counter
  for (let y = 3; y <= 5; y++) for (let x = 51; x <= 54; x++) m.del(x, y, z0);
  m.box(50, 2, z0 - 1, 55, 2, z0 - 1, planks(0xb08050, 0x9a6a40, 'x'));
  m.box(50, 6, z0 - 1, 55, 6, z0 - 1, 0x8a2f39);
  // flower boxes
  m.box(36, 1, z0 - 1, 43, 1, z0 - 1, 0x7a5236); flowers(m, 37, 2, z0 - 1, 6, 3);
  // porch lamp bracket
  m.set(51, 6, z0 - 1, 0x2c3140);
  // bell by the door (yellow), mailbox by the gate, stepping stones
  m.box(44, 6, z0 - 1, 44, 6, z0 - 1, 0x5a3b27);
  m.box(43, 4, z0 - 1, 45, 5, z0 - 1, 0xe0b040); m.set(44, 3, z0 - 1, 0x8a6a2a); m.set(43, 5, z0 - 1, 0xfff0a0);
  for (let z = 21; z < 29; z += 2) m.set(47 + (z % 4 === 1 ? -1 : 1), 1, z, 0xb4a88e);
  // string lights: eave of the house to a garden pole, and along the fence
  const bulbs = [0xff8a5c, 0xffd166, 0x9be7ff, 0xff9ecd, 0xb4ff9a];
  m.box(30, 1, 22, 30, 10, 22, tex(0x6d4a32, 0x5a3b27));
  for (let i = 0; i <= 20; i++) {
    const k = i / 20, x = Math.round(30 + (x0 - 30) * k), z = Math.round(22 + (z0 - 1 - 22) * k), y = Math.round(10 - Math.sin(k * Math.PI) * 2.5);
    if (i % 2 === 0) { m.set(x, y, z, bulbs[(i / 2) % 5] | EMIT); lights.push({ p: [x + 0.5, y, z + 0.5], c: bulbs[(i / 2) % 5], r: 5 }); }
    else m.set(x, y + 1, z, 0x333333);
  }

  // ---- garden ----
  // hammock posts (the hammock itself is a sprite)
  m.box(12, 1, 27, 12, 6, 27, tex(0x6d4a32, 0x5a3b27)); m.box(24, 1, 27, 24, 6, 27, tex(0x6d4a32, 0x5a3b27));
  tree(m, 6, 1, 36, 1.3); tree(m, 26, 1, 46, 1.1); tree(m, 70, 1, 44, 1.4); tree(m, 78, 1, 30, 1.0);
  bush(m, 24.5, 1, 21.5, 2.4); bush(m, 28, 1, 21, 2.8); bush(m, 31.5, 1, 22, 2.3); bush(m, 60, 1, 36, 2.2); bush(m, 74, 1, 34, 2.4);
  flowers(m, 26, 1, 22, 8, 7); flowers(m, 60, 1, 25, 6, 9);
  crate(m, 13, 1, 13, 2);
  // across the road: a low wall and a lamp post
  m.box(0, 1, 1, SX - 1, 2, 2, bricks(0x8a8278, 0x7a7268, 0x5a544e));
  lights.push({ p: lampPost(m, 28, 3, 1, 8), c: 0xffe0a0, r: 16 });
  // neighbours in the back
  for (const [hx, hz, w, c, rc] of [[4, 52, 14, 0xd8e6f0, 0x4a74b0], [62, 54, 16, 0xf6d2c2, 0x8a4a6a]]) {
    m.box(hx, 1, hz, hx + w, 7, hz + 8, tex(c, mix(c, 0xffffff, 0.2)));
    gableRoof(m, hx, hx + w, hz, hz + 8, 8, rc, true, 1);
    for (let x = hx + 2; x < hx + w - 1; x += 4) { m.set(x, 4, hz, hash(x) > 0.4 ? 0xffc86b | EMIT : 0x3a4458); m.set(x + 1, 4, hz, hash(x) > 0.4 ? 0xffc86b | EMIT : 0x3a4458); }
  }

  // lit window / hatch panes as separate emissive meshes so scenes can switch them
  const lit = new VoxModel(SX, SY, SZ), dark = new VoxModel(SX, SY, SZ);
  for (const [x, y] of winPix) { lit.set(x, y, z0 + 1, 0xffc27a | EMIT); dark.set(x, y, z0 + 1, 0x1c2033); }
  for (let y = 3; y <= 5; y++) for (let x = 51; x <= 54; x++) { lit.set(x, y, z0 + 1, 0xffd08a | EMIT); dark.set(x, y, z0 + 1, 0x2a2030); }
  const lampOn = new VoxModel(SX, SY, SZ); lampOn.set(51, 5, z0 - 1, 0xfff0b0 | EMIT);
  const lampOff = new VoxModel(SX, SY, SZ); lampOff.set(51, 5, z0 - 1, 0x6a6a74);
  // window mullions
  for (let y = 2; y <= 7; y++) m.set(39, y, z0, 0x6a4a32);
  for (let x = 37; x <= 42; x++) m.set(x, 4, z0, 0x6a4a32);

  cache = { mesh: meshify(m), litMesh: meshify(lit), darkMesh: meshify(dark), lampOn: meshify(lampOn), lampOff: meshify(lampOff), lights };
  return cache;
}
