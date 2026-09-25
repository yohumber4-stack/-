// Contact sheet: node tools/sheet.mjs <from> <to> <count> [cols] [out.png] [scale]
import { FB } from '../src/engine/fb.js';
import { text } from '../src/engine/font.js';
import { renderFrame } from '../src/film.js';
import { writeFB } from './png.mjs';

const [a, b, n, cols = 3, out = 'out/sheet.png', sc = 1] = process.argv.slice(2);
const from = +a, to = +b, count = +n, C = +cols, S = +sc;
const rows = Math.ceil(count / C);
const tile = new FB();
const sheet = new FB(480 * C + (C - 1) * 2, 270 * rows + (rows - 1) * 2).clear(0x202020);
const t0 = Date.now();
for (let k = 0; k < count; k++) {
  const T = count === 1 ? from : from + ((to - from) * k) / (count - 1);
  renderFrame(tile, T);
  text(tile, T.toFixed(2), 3, 262, 0xffff00, { font: 'small', outline: 0x000000 });
  const x = (k % C) * 482, y = Math.floor(k / C) * 272;
  sheet.blit(tile, x, y);
}
writeFB(out, sheet, S);
console.log(`${count} frames in ${Date.now() - t0}ms -> ${out}`);
