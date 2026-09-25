// Exact port of the sprite toolkit from the reference file clawd-codex.html
// (createGrid / fillRect / shade / outline / stampHand), plus helpers to turn
// grids into framebuffer sprites.
import { FB } from '../engine/fb.js';

export const EMPTY = '.';
export const createGrid = (w, h) => Array.from({ length: h }, () => Array(w).fill(EMPTY));
export const inBounds = (g, x, y) => y >= 0 && y < g.length && x >= 0 && x < g[0].length;
export const set = (g, x, y, ch) => { if (inBounds(g, x, y)) g[y][x] = ch; };
export const get = (g, x, y) => (inBounds(g, x, y) ? g[y][x] : EMPTY);
export const fillRect = (g, x, y, w, h, ch = 'o') => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(g, xx, yy, ch);
};
export const isSolid = (g, x, y) => inBounds(g, x, y) && g[y][x] !== EMPTY;
const run = (g, x, y, dx, dy) => { let n = 0; while (isSolid(g, x + dx * (n + 1), y + dy * (n + 1))) n++; return n + 1; };

export function shade(g, base = 'o', light = 'h', dark = 's') {
  const out = g.map((r) => [...r]);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (g[y][x] !== base) continue;
    const top = run(g, x, y, 0, -1), left = run(g, x, y, -1, 0);
    const right = run(g, x, y, 1, 0), bottom = run(g, x, y, 0, 1);
    const checker = (x + y) % 2 === 0;
    if (top === 1 || left === 1) out[y][x] = light;
    else if (right <= 2 || bottom <= 2) out[y][x] = dark;
    else if (top === 2 && checker) out[y][x] = light;
    else if ((right === 3 || bottom === 3) && checker) out[y][x] = dark;
  }
  g.forEach((row, y) => row.forEach((_, x) => (g[y][x] = out[y][x])));
}

export function outline(g, ch = 'O') {
  const t = [];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (g[y][x] !== EMPTY) continue;
    let hit = false;
    for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++)
      if (isSolid(g, x + dx, y + dy) && g[y + dy][x + dx] !== ch) hit = true;
    if (hit) t.push([x, y]);
  }
  t.forEach(([x, y]) => (g[y][x] = ch));
}

export function stampHand(g, x, y, size, dir, tones, seam = 'O') {
  const cells = [];
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++)
    if (!((xx === 0 || xx === size - 1) && (yy === 0 || yy === size - 1))) cells.push([xx, yy]);
  const has = new Set(cells.map(([cx, cy]) => cx + ',' + cy));
  const inHand = (cx, cy) => has.has(cx + ',' + cy);
  const overlap = (ox) => cells.filter(([cx, cy]) => isSolid(g, ox + cx, y + cy)).length;
  let ox = x;
  if (dir !== 0) while (overlap(ox) > cells.length / 2 && ox > -size && ox < g[0].length) ox += dir;
  for (const [cx, cy] of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, ny = cy + dy;
    if (!inHand(nx, ny) && isSolid(g, ox + nx, y + ny)) set(g, ox + nx, y + ny, seam);
  }
  for (const [cx, cy] of cells) {
    const tone = !inHand(cx, cy - 1) || !inHand(cx - 1, cy) ? tones.h : !inHand(cx, cy + 1) || !inHand(cx + 1, cy) ? tones.s : tones.o;
    set(g, ox + cx, y + cy, tone);
  }
  return ox;
}

// Shaded block drawn on top of an existing grid with a seam outline where it overlaps
// (arms held in front of a body, props in hands...). Same tone logic as stampHand.
export function stampBlock(g, x, y, w, h, tones, seam = 'O', round = true) {
  const inB = (cx, cy) => cx >= 0 && cy >= 0 && cx < w && cy < h && !(round && (cx === 0 || cx === w - 1) && (cy === 0 || cy === h - 1));
  for (let cy = -1; cy <= h; cy++) for (let cx = -1; cx <= w; cx++) {
    if (inB(cx, cy)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (inB(cx + dx, cy + dy)) near = true;
    if (near && isSolid(g, x + cx, y + cy)) set(g, x + cx, y + cy, seam);
  }
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    if (!inB(cx, cy)) continue;
    const tone = !inB(cx, cy - 1) || !inB(cx - 1, cy) ? tones.h : !inB(cx, cy + 1) || !inB(cx + 1, cy) ? tones.s : tones.o;
    set(g, x + cx, y + cy, tone);
  }
}

export const hexToInt = (h) => parseInt(h.slice(1), 16);

export function toFB(g, palette) {
  const h = g.length, w = g[0].length, f = new FB(w, h).clear();
  const cache = {};
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = g[y][x];
    if (ch === EMPTY) continue;
    let c = cache[ch];
    if (c === undefined) { const p = palette[ch]; c = cache[ch] = p === undefined ? 0xff00ff : typeof p === 'string' ? hexToInt(p) : p; }
    f.set(x, y, c);
  }
  return f;
}

// Majority downsample of a class grid by factor 2 with priority for some classes
export function half(rows, prio = {}) {
  const H = Math.ceil(rows.length / 2), W = Math.ceil(rows[0].length / 2), out = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const cnt = {};
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const ch = (rows[y * 2 + dy] || '')[x * 2 + dx] || '.';
        cnt[ch] = (cnt[ch] || 0) + (prio[ch] || 1);
      }
      let best = '.', bv = -1;
      for (const [k, v] of Object.entries(cnt)) if (v > bv || (v === bv && k !== '.')) { bv = v; best = k; }
      r += best;
    }
    out.push(r);
  }
  return out;
}
