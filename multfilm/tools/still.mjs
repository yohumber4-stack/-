// Render one frame: node tools/still.mjs <seconds> [out.png] [scale]
import { FB } from '../src/engine/fb.js';
import { renderFrame } from '../src/film.js';
import { writeFB } from './png.mjs';

const T = parseFloat(process.argv[2] || '0');
const fb = new FB();
const t0 = Date.now();
renderFrame(fb, T);
writeFB(process.argv[3] || 'out/still.png', fb, +(process.argv[4] || 2));
console.log(`t=${T}s rendered in ${Date.now() - t0}ms`);
