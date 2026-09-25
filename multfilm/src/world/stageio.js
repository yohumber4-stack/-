// A festival stage built on the hill plaza for the May 19 keynote.
import { VoxModel, meshify, EMIT } from '../engine/vox.js';
import { hash2, mix } from '../engine/core.js';
import { hillWorld } from './hill.js';
import { planks, tex } from './vbuild.js';

const GC = [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853];
let cache = null;
// Stage faces -z (towards the audience). Returns meshes + key points.
export function stageWorld() {
  if (cache) return cache;
  const H = hillWorld();
  const [px, py, pz] = H.plaza;
  const SX = 136, SY = 48, SZ = 100;
  const m = new VoxModel(SX, SY, SZ), bulbs = new VoxModel(SX, SY, SZ), bulbsOff = new VoxModel(SX, SY, SZ);
  const x0 = px - 9, x1 = px + 9, z0 = pz + 2, z1 = pz + 8, y0 = py - 1;
  // platform
  m.box(x0, y0, z0, x1, y0 + 1, z1, planks(0x9a6a44, 0x8a5a36, 'x'));
  for (let x = x0; x <= x1; x++) m.set(x, y0, z0, (x % 2) ? 0xc0392b : 0xe0b040);
  // steps
  m.box(px - 2, y0, z0 - 1, px + 2, y0, z0 - 1, planks(0x8a5a36, 0x7a4a2e, 'x'));
  // backdrop panel
  m.box(x0 + 1, y0 + 2, z1, x1 - 1, y0 + 11, z1, (x, y) => (y === y0 + 11 || y === y0 + 2 ? 0x1c1640 : mix(0x2c2456, 0x352c66, ((x + y) % 4 === 0) ? 1 : 0)));
  const pts = [];
  // speaker stacks
  for (const sx of [x0 - 2, x1 + 1]) {
    m.box(sx, y0, z0 + 1, sx + 1, y0 + 6, z0 + 2, 0x22222c);
    m.set(sx, y0 + 5, z0, 0x3a3a48); m.set(sx + 1, y0 + 5, z0, 0x3a3a48); m.set(sx, y0 + 2, z0, 0x3a3a48); m.set(sx + 1, y0 + 2, z0, 0x3a3a48);
  }
  // side poles with a few flags
  for (const bx of [x0 - 3, x1 + 3]) {
    m.box(bx, y0, z0, bx, y0 + 12, z0, tex(0x6d4a32, 0x5a3b27));
    for (let i = 0; i < 4; i++) { m.set(bx + (bx < px ? 1 : -1), y0 + 11 - i * 2, z0, GC[i]); }
  }
  // spotlights on poles
  const spots = [];
  for (const sx of [x0 - 3, x1 + 3]) { m.box(sx, y0 + 12, z0 - 1, sx, y0 + 12, z0 - 1, 0x3a3a44); bulbs.set(sx, y0 + 11, z0 - 1, 0xfff4d0 | EMIT); spots.push([sx + 0.5, y0 + 11, z0 - 0.5]); }
  cache = { mesh: meshify(m), bulbs: meshify(bulbs), bulbsOff: meshify(bulbsOff), bulbPts: pts, spots, front: [px, y0 + 2, z0 + 2.5], lanternAt: [px - 4.5, y0 + 2, z0 + 3], panel: [px, y0 + 8.5, z1 - 0.6] };
  return cache;
}
