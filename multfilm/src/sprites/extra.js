// Extra props in the sprite style: umbrella, blanket, chips bag, fedora, open door.
import { createGrid, set, fillRect, shade, outline, toFB } from './grid.js';
import { text } from '../engine/font.js';
import { mix } from '../engine/core.js';

const cache = new Map();
const memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };

// Umbrella canopy (orange stripes) with handle; (x, y) = handle bottom
export function umbrella(fb, x, y, o = {}) {
  const R = o.r || 40, open = o.open === undefined ? 1 : o.open, tilt = o.tilt || 0;
  const spr = memo(`umb|${R}|${Math.round(open * 8)}`, () => {
    const w = Math.round(R * 2 * Math.max(0.25, open)), h = Math.round(R * 0.62), g = createGrid(w + 4, h + 4);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const dx = (xx + 0.5 - w / 2) / (w / 2), dy = (h - yy - 0.5) / h;
      if (dx * dx + dy * dy * 1.05 <= 1) set(g, xx + 2, yy + 2, 'o');
    }
    shade(g);
    for (let yy = 0; yy < g.length; yy++) for (let xx = 0; xx < g[0].length; xx++) {
      const c = g[yy][xx]; if (c === '.') continue;
      const seg = Math.floor(((xx - 2) / w) * 6);
      if (seg % 2 === 1) g[yy][xx] = c === 'h' ? 'H' : c === 's' ? 'S' : 'W';
    }
    // scalloped rim
    for (let xx = 2; xx < w + 2; xx++) if (((xx - 2) % Math.max(4, Math.round(w / 6))) === 0) set(g, xx, h + 2, 'O');
    outline(g, 'O');
    return toFB(g, { o: 0xd97757, h: 0xee9b78, s: 0xb35a3c, W: 0xfff0e6, H: 0xffffff, S: 0xe0cfc4, O: 0x6b2e1c });
  });
  const hx = Math.round(x + tilt * 8), hy = Math.round(y - R * 1.1);
  fb.line(x, y, hx, hy, 0x1a1a2a); fb.line(x + 1, y, hx + 1, hy, 0x3b2a20);
  fb.rect(x - 4, y - 1, 5, 2, 0x3b2a20); fb.rect(x - 4, y - 3, 2, 2, 0x3b2a20);
  fb.blit(spr, hx - Math.floor(spr.w / 2), hy - spr.h + 4);
}

// Knitted blanket wrapped around the lower part of a sprite; (x, y) = centre bottom
export function blanket(fb, x, y, w = 50, h = 26) {
  const spr = memo(`blk|${w}|${h}`, () => {
    const g = createGrid(w + 2, h + 2);
    for (let yy = 0; yy < h; yy++) { const inset = Math.round(Math.max(0, (6 - yy)) * 0.8); fillRect(g, 1 + inset, 1 + yy, w - inset * 2, 1, 'o'); }
    shade(g);
    for (let yy = 0; yy < g.length; yy++) for (let xx = 0; xx < g[0].length; xx++) {
      if (g[yy][xx] === '.') continue;
      if ((xx + 1) % 8 < 2 || (yy + 1) % 9 === 0) g[yy][xx] = g[yy][xx] === 's' ? 'Y' : 'y';
    }
    outline(g, 'O');
    return toFB(g, { o: 0xb84a44, h: 0xd8685e, s: 0x8a3430, y: 0xe8c070, Y: 0xc09a50, O: 0x3a1418 });
  });
  fb.blit(spr, Math.round(x - spr.w / 2), Math.round(y - spr.h));
}

// Bag of chips in Google colours labelled TPU (Claude runs on Google TPUs); k = scale
export function chipsBag(fb, x, y, k = 2, open = true) {
  const spr = memo(`chips|${open}`, () => {
    const g = createGrid(20, 26);
    fillRect(g, 3, 4, 14, 20, 'o'); fillRect(g, 2, 6, 16, 16, 'o');
    shade(g);
    const C = ['r', 'y', 'g', 'b'];
    for (let i = 0; i < 4; i++) fillRect(g, 3 + i * 3.5 | 0, 7, 4, 3, C[i]);
    fillRect(g, 3, 3, 14, 2, 'd');
    outline(g, 'O');
    if (open) { set(g, 7, 1, 'c'); set(g, 8, 1, 'c'); set(g, 11, 0, 'c'); set(g, 12, 1, 'c'); set(g, 9, 2, 'c'); }
    return toFB(g, { o: 0xf6f3ea, h: 0xffffff, s: 0xd0ccc0, r: 0xea4335, y: 0xfbbc04, g: 0x34a853, b: 0x4285f4, d: 0xc9c4b6, O: 0x2a2a3a, c: 0xf0cc68 });
  });
  fb.blit(spr, Math.round(x - (spr.w * k) / 2), Math.round(y - spr.h * k), { sx: k, sy: k });
  text(fb, 'TPU', Math.round(x), Math.round(y - spr.h * k * 0.42), 0x2a2a3a, { align: 'center', scale: k > 1.5 ? 1 : 1, font: k > 1.5 ? 'big' : 'small' });
}
export function chip(fb, x, y) { fb.ellipse(x, y, 3, 2, 0xf0cc68); fb.rect(x - 1, y - 1, 2, 1, 0xfff0a0); fb.ellipse(x, y, 3, 2, 0xc09a40, 0.3); }

export function fedora(fb, x, y, k = 1) {
  fb.rect(x - 10 * k, y - 3 * k, 20 * k, 3 * k, 0x1a1210); fb.rect(x - 9 * k, y - 2 * k, 18 * k, 1 * k, 0x2e2622);
  fb.rect(x - 7 * k, y - 10 * k, 14 * k, 7 * k, 0x2e2622); fb.rect(x - 7 * k, y - 5 * k, 14 * k, 2 * k, 0x8c2f39); fb.rect(x - 6 * k, y - 10 * k, 12 * k, 1 * k, 0x4a4f7a);
}
