// Quick 3D look test: node tools/test3d.mjs [out.png]
import { FB } from '../src/engine/fb.js';
import { R3D } from '../src/engine/vox.js';
import { hillWorld, HILL, SEA_Y } from '../src/world/hill.js';
import { nightSky, moonDisc, seaPass } from '../src/engine/sky.js';
import { writeFB } from './png.mjs';

let t0 = Date.now();
const world = hillWorld();
console.log('build', Date.now() - t0, 'ms, quads', world.mesh.n);
const fb = new FB();
const r = new R3D();
const cam = process.argv[3] ? JSON.parse(process.argv[3]) : { eye: [18, 34, -6], at: [52, 18, 52], fov: 50 };
t0 = Date.now();
for (let rep = 0; rep < 3; rep++) {
  r.camera(cam.eye, cam.at, cam.fov);
  r.clear();
  nightSky(fb, 1.0);
  moonDisc(fb, 380, 40, 9);
  seaPass(fb, r, 1.0, SEA_Y + 0.5, { moonX: 380 });
  r.ambient = [0.22, 0.25, 0.42];
  r.sun = { dir: [0.3, 0.8, 0.5], color: [0.25, 0.28, 0.4] };
  r.points = world.lights.map((L) => ({ p: L.p, c: [((L.c >> 16) & 255) / 255 * 1.6, ((L.c >> 8) & 255) / 255 * 1.6, (L.c & 255) / 255 * 1.6], r: L.small ? 7 : 12 }));
  r.drawMesh(fb, world.mesh);
  r.fog(fb, 0x2a3570, 40, 200, 0.6);
  r.outline(fb, 0.6);
  r.bloom(fb, 0.9, 3);
}
console.log('frame', (Date.now() - t0) / 3, 'ms');
writeFB(process.argv[2] || 'out/test3d.png', fb, 2);
