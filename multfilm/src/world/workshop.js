// Gemini's workshop (cutaway diorama): big back window, shelves of Flash rockets,
// calendar wall, workbench, stove, hanging bulb. The big lantern is a sprite.
import { VoxModel, meshify, EMIT } from '../engine/vox.js';
import { hash, hash2, mix } from '../engine/core.js';
import { tex, planks, bricks, crate, barrel } from './vbuild.js';

// room interior spans x 0..27, z 0..17, y 0..14; camera looks toward +z (screen right = -x)
export const WS = { stand: [14, 1, 9], window: [14, 7, 17], shelf: [24, 1, 12], stove: [3, 1, 12], bench: [22, 1, 4], calendar: [26.4, 8, 6], bulb: [14, 12.5, 8] };

let cache = null;
export function workshopWorld() {
  if (cache) return cache;
  const SX = 30, SY = 16, SZ = 20;
  const m = new VoxModel(SX, SY, SZ);
  const lights = [];
  // floor planks and a rug
  m.box(0, 0, 0, 29, 0, 19, planks(0x8a5a3a, 0x9a6a44, 'x'));
  for (let z = 5; z <= 13; z++) for (let x = 9; x <= 19; x++) {
    const edge = x === 9 || x === 19 || z === 5 || z === 13;
    m.set(x, 0, z, edge ? 0xe0b040 : ((x + z) % 4 < 2 ? 0x3a4a8a : 0x33427c));
  }
  // walls: back (z=18) with a big window, left (x=28) and right (x=0) — the camera sees x=28 on the left
  const wallTex = (x, y, z) => (y === 1 ? 0x5a3b27 : y === 9 ? 0x6d4a32 : mix(0xc9a27a, 0xb8916a, hash2(x * 3 + y * 7, z * 5 + y)));
  m.box(0, 1, 18, 29, 14, 19, wallTex);
  m.box(28, 1, 0, 29, 14, 19, wallTex);
  m.box(0, 1, 0, 1, 14, 19, wallTex);
  for (let y = 4; y <= 12; y++) for (let x = 7; x <= 21; x++) { m.del(x, y, 18); m.del(x, y, 19); }
  // window frame and mullions
  for (let x = 6; x <= 22; x++) { m.set(x, 3, 18, 0x6d4a32); m.set(x, 13, 18, 0x6d4a32); m.set(x, 3, 17, 0x8a5a3a); }
  for (let y = 3; y <= 13; y++) { m.set(6, y, 18, 0x6d4a32); m.set(22, y, 18, 0x6d4a32); m.set(14, y, 18, 0x6d4a32); }
  for (let x = 7; x <= 21; x++) m.set(x, 8, 18, 0x6d4a32);
  // shelves with rocket crates on the left wall (x = 27)
  for (const y of [4, 8]) m.box(25, y, 8, 27, y, 16, planks(0x9a6a44, 0x8a5a36, 'z'));
  crate(m, 25, 1, 13, 2); crate(m, 25, 1, 10, 2); crate(m, 26, 3, 11, 1);
  // workbench (front left of screen = high x)
  m.box(19, 3, 2, 26, 3, 5, planks(0xb08050, 0x9a6a40, 'x'));
  for (const [x, z] of [[19, 2], [26, 2], [19, 5], [26, 5]]) m.box(x, 1, z, x, 2, z, 0x6a4028);
  m.box(21, 4, 3, 22, 4, 4, 0x4a6aa0); m.box(24, 4, 3, 24, 5, 3, 0xd64541); m.set(25, 4, 4, 0xfbbc04);
  // blueprints pinned on the left wall
  m.box(27, 9, 3, 27, 12, 6, (x, y, z) => ((y + z) % 3 === 0 ? 0xdfe8ff : 0x3a68b8));
  // stove on the right (low x)
  m.box(2, 1, 11, 5, 4, 14, 0x2a2a30); m.box(3, 5, 12, 4, 13, 13, 0x3a3a44);
  const fire = new VoxModel(SX, SY, SZ);
  m.box(2, 2, 10, 5, 3, 10, 0x151014);
  fire.box(3, 2, 10, 4, 2, 10, 0xff8a3a | EMIT); fire.set(3, 3, 10, 0xffc44a | EMIT);
  lights.push({ p: [3.5, 2.5, 9.5], c: 0xff9a4a, r: 9, fire: true });
  // barrel of paint and crates on the right
  barrel(m, 3, 1, 4); crate(m, 5, 1, 2, 2);
  // hanging bulb
  m.box(14, 13, 8, 14, 14, 8, 0x2a2a2a);
  m.set(14, 12, 8, 0xfff0c0 | EMIT);
  lights.push({ p: [14.5, 11.5, 8.5], c: 0xffd9a0, r: 20, bulb: true });
  // lantern stand in the middle (lantern itself is a sprite)
  m.box(13, 1, 9, 15, 1, 11, 0x3a3a44); m.box(14, 2, 10, 14, 2, 10, 0x55555f);
  // star decorations on the back wall
  for (const [x, y, c] of [[3, 11, 0xea4335], [25, 11, 0x4285f4], [4, 7, 0xfbbc04], [24, 6, 0x34a853]]) { m.set(x, y, 17, c); m.set(x - 1, y, 17, c); m.set(x + 1, y, 17, c); m.set(x, y + 1, 17, c); m.set(x, y - 1, 17, c); }
  cache = { mesh: meshify(m), fireMesh: meshify(fire), lights };
  return cache;
}
