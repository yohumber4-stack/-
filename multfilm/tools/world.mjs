// Preview a voxel world: node tools/world.mjs yard '[ex,ey,ez]' '[tx,ty,tz]' [fov] [night|day|dusk] [out]
import { FB } from '../src/engine/fb.js';
import { R3D } from '../src/engine/vox.js';
import { skyDome } from '../src/engine/sky.js';
import { writeFB } from './png.mjs';

const [name, eyeS, tgtS, fovS = '50', mood = 'night', out = 'out/world.png'] = process.argv.slice(2);
const mod = await import(`../src/world/${name}.js`);
const fn = Object.values(mod).find((f) => typeof f === 'function' && /World$/.test(f.name));
let t0 = Date.now();
const W = fn();
console.log('build', Date.now() - t0, 'ms');
const fb = new FB(), r = new R3D();
r.camera(JSON.parse(eyeS), JSON.parse(tgtS), +fovS);
r.clear();
const rgbf = (c, k = 1) => [((c >> 16) & 255) / 255 * k, ((c >> 8) & 255) / 255 * k, (c & 255) / 255 * k];
if (mood === 'night') { skyDome(fb, r, 1, { moon: [0.6, 0.6, 7] }); r.ambient = [0.24, 0.27, 0.45]; r.sun = { dir: [-0.4, 0.8, -0.4], color: [0.28, 0.32, 0.5] }; }
else if (mood === 'dusk') { skyDome(fb, r, 1, { stops: [0xffc08a, 0xe07a7a, 0x7a4a86, 0x2b2a5c], stars: 40 }); r.ambient = [0.45, 0.38, 0.45]; r.sun = { dir: [0.6, 0.35, 0.3], color: [0.8, 0.5, 0.35] }; }
else { skyDome(fb, r, 1, { stops: [0xf6ecd0, 0xbfe0f7, 0x86c3f0, 0x4a98e0], stars: 0 }); r.ambient = [0.55, 0.6, 0.72]; r.sun = { dir: [0.5, 0.75, -0.4], color: [0.75, 0.65, 0.5] }; }
r.points = (W.lights || []).map((L) => ({ p: L.p, c: rgbf(L.c, 1.5), r: L.r || 12 }));
t0 = Date.now();
for (const k of Object.keys(W)) if (/[mM]esh$/.test(k) && W[k] && W[k].n !== undefined && !/dark|Off/.test(k)) r.drawMesh(fb, W[k]);
r.fog(fb, 0x1a2244, 40, 140, 0.5);
r.outline(fb, 0.6);
r.bloom(fb, 0.8, 3);
console.log('render', Date.now() - t0, 'ms');
writeFB(out, fb, 2);
