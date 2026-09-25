// Clawd's living room (cutaway): fireplace on the back wall, armchair and rug,
// bookshelf, rainy window, door on the side. Camera looks towards +z (screen right = -x).
import { VoxModel, meshify, EMIT } from '../engine/vox.js';
import { hash2, mix } from '../engine/core.js';
import { tex, planks, bricks } from './vbuild.js';

export const LR = { fire: [21.5, 2.5, 16], chair: [20, 1, 9.5], rug: [14, 0, 9], door: [1.5, 1, 7], window: [8, 7, 18] };

let cache = null;
export function livingroomWorld() {
  if (cache) return cache;
  const SX = 30, SY = 15, SZ = 20;
  const m = new VoxModel(SX, SY, SZ);
  const lights = [];
  m.box(0, 0, 0, 29, 0, 19, planks(0x7a4a2e, 0x8a5a38, 'x'));
  for (let z = 3; z <= 15; z++) for (let x = 5; x <= 24; x++) {
    const dx = (x - 14.5) / 10, dz = (z - 9) / 6, d = dx * dx + dz * dz;
    if (d <= 1) m.set(x, 0, z, d > 0.78 ? 0xe8a04a : d > 0.5 ? 0xb84a44 : (x + z) % 3 === 0 ? 0xd06050 : 0xc8554a);
  }
  const wallTex = (x, y, z) => (y <= 3 ? mix(0x6d4a32, 0x5a3b27, hash2(x + z, y)) : y === 4 ? 0x4a2e1e : ((x + z + y) % 5 === 0 ? 0xe8b88a : mix(0xf0c89a, 0xe8bc8c, hash2(x * 3 + y, z))));
  m.box(0, 1, 18, 29, 13, 19, wallTex);
  m.box(28, 1, 0, 29, 13, 19, wallTex);
  m.box(0, 1, 0, 1, 13, 19, wallTex);
  // window on the back wall, right side of the screen (low x)
  for (let y = 6; y <= 11; y++) for (let x = 5; x <= 11; x++) { m.del(x, y, 18); m.del(x, y, 19); }
  for (let x = 4; x <= 12; x++) { m.set(x, 5, 18, 0x6d4a32); m.set(x, 12, 18, 0x6d4a32); m.set(x, 5, 17, 0x8a5a3a); }
  for (let y = 5; y <= 12; y++) { m.set(4, y, 18, 0x6d4a32); m.set(12, y, 18, 0x6d4a32); m.set(8, y, 18, 0x6d4a32); }
  // fireplace on the back wall, left side (high x), opening facing the camera
  m.box(17, 1, 15, 26, 9, 17, bricks(0x9a8a82, 0x8a7a72, 0x6a5e58));
  m.box(16, 9, 14, 27, 9, 17, planks(0x8a5a3a, 0x7a4a2e, 'x'));
  for (let y = 1; y <= 5; y++) for (let x = 19; x <= 24; x++) { m.del(x, y, 15); m.del(x, y, 16); }
  m.box(19, 1, 17, 24, 5, 17, 0x1a1010);
  m.box(20, 1, 16, 23, 1, 16, 0x3a2418);
  m.box(18, 10, 15, 18, 10, 15, 0xfff0d0); m.set(18, 11, 15, 0xffd070 | EMIT);
  m.box(25, 10, 15, 25, 10, 15, 0xfff0d0); m.set(25, 11, 15, 0xffd070 | EMIT);
  m.box(20, 10, 16, 23, 12, 16, 0x6d4a32); m.box(21, 11, 16, 22, 11, 16, 0xffc27a);
  const fire = new VoxModel(SX, SY, SZ);
  fire.box(20, 2, 16, 23, 2, 16, 0xff7a2a | EMIT); fire.box(21, 3, 16, 22, 3, 16, 0xffb44a | EMIT); fire.set(21, 4, 16, 0xfff0a0 | EMIT);
  lights.push({ p: LR.fire, c: 0xff9040, r: 24, fire: true });
  // armchair in front of the fire
  const chair = tex(0x4a6aa0, 0x3a5a90);
  m.box(18, 1, 8, 22, 2, 11, chair); m.box(18, 3, 11, 22, 5, 11, chair);
  m.box(18, 3, 8, 18, 3, 11, chair); m.box(22, 3, 8, 22, 3, 11, chair);
  // bookshelf on the left wall of the screen (x high)
  m.box(26, 1, 3, 27, 10, 9, planks(0x8a5a3a, 0x7a4a2e, 'z'));
  for (const y of [3, 5, 7, 9]) for (let z = 3; z <= 9; z++) m.set(25, y, z, [0xd64541, 0x4285f4, 0xfbbc04, 0x34a853, 0xe8e0d0][(z * 3 + y) % 5]);
  // side table with a lamp (right of the screen)
  m.box(3, 3, 11, 6, 3, 13, planks(0xa06a44, 0x8a5a36, 'x')); m.box(4, 1, 12, 4, 2, 12, 0x6a4028);
  m.box(4, 4, 12, 4, 5, 12, 0xe0b040); m.box(3, 6, 11, 5, 7, 13, 0xc8a878 | EMIT);
  lights.push({ p: [4.5, 6.5, 12.5], c: 0xffe0a0, r: 8, k: 0.6 });
  // door in the right wall (x = 1)
  m.box(1, 1, 4, 1, 7, 8, (x, y, z) => (y === 7 || z === 4 || z === 8 ? 0x4a2e1e : mix(0x9a5a36, 0xa8683e, hash2(y, z))));
  // ceiling beams
  for (let x = 0; x <= 29; x += 5) m.box(x, 13, 0, x, 13, 19, 0x5a3b27);
  cache = { mesh: meshify(m), fireMesh: meshify(fire), lights };
  return cache;
}
