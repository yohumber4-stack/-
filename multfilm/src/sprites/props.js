// Props in the reference sprite style (grid -> shade -> details -> outline):
// sky lanterns for every lab, the Flash rocket, emotes and speech bubbles.
import { createGrid, set, fillRect, shade, outline, toFB, isSolid } from './grid.js';
import { text, textWidth } from '../engine/font.js';
import { mix, clamp, hash, TAU } from '../engine/core.js';
import { WHALE_SHAPE, KIMI_K } from './shapes.js';

const HX = (s) => parseInt(s.slice(1), 16);
const cache = new Map();
const memo = (key, fn) => { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; };

// ---------------- lanterns ----------------
export const LKIND = {
  claude: { o: '#e88a64', h: '#f7b596', s: '#bf5f3d', O: '#6b2e1c', i: '#fff3ea', glow: 0xffa36b, lab: 0xd97757 },
  openai: { o: '#e9eaf2', h: '#ffffff', s: '#b9bcd2', O: '#2a2d44', i: '#3a3f5a', glow: 0xe6ecff, lab: 0x9aa3c8 },
  qwen: { o: '#7a58f0', h: '#9d85ff', s: '#5536cc', O: '#1f0d5c', i: '#ffffff', glow: 0xb3a0ff, lab: 0x6339e6 },
  plain: { o: '#ffc27a', h: '#ffdcaa', s: '#d8914a', O: '#5a3218', i: '#fff0d0', glow: 0xffc870, lab: 0xc98a4a },
  gem: { glow: 0xcfe0ff, lab: 0x4285f4 },
  astra: { o: '#fff2c4', h: '#ffffff', s: '#e0c270', O: '#6a4e14', i: '#fffbe8', glow: 0xfff0c0, lab: 0xe0b040 },
  sol: { o: '#ffc83d', h: '#ffe488', s: '#e08a1c', O: '#6a3a08', i: '#fff6c8', glow: 0xffd070, lab: 0xf0a020 },
  luna: { o: '#d6e2ff', h: '#f4f8ff', s: '#9aaad6', O: '#2a3460', i: '#ffffff', glow: 0xdce8ff, lab: 0x8a9ac9 },
  whale: { o: '#4d6bfe', h: '#7d95ff', s: '#3450d6', O: '#10195e', W: '#fdfcff', L: '#c9d4ff', glow: 0x8ea4ff, lab: 0x4d6bfe },
  kimi: { o: '#1b1d24', h: '#3b3e4c', s: '#0d0e12', O: '#000000', W: '#fdfcff', B: '#1e88ff', glow: 0x7cc0ff, lab: 0x1e88ff },
};

function paperMask(w) {
  const h = Math.round(w * 1.2), g = createGrid(w + 2, h + 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const prof = v < 0.12 ? 0.62 + v * 2.2 : v < 0.7 ? 0.88 + Math.sin(((v - 0.12) / 0.58) * Math.PI) * 0.12 : 0.88 - (v - 0.7) * 1.05;
    const half = Math.max(1, Math.round((w / 2) * prof));
    fillRect(g, 1 + Math.round(w / 2) - half, 1 + y, half * 2, 1, 'o');
  }
  return { g, h };
}

function lanternGrid(kind, w, lit) {
  const K = LKIND[kind];
  let g, h;
  if (kind === 'gem' || kind === 'astra' || kind === 'sol' || kind === 'luna' || kind === 'whale' || kind === 'kimi') {
    const S = w + 4;
    g = createGrid(S, S); h = S;
    const c = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, R = w / 2;
      let inside = false;
      if (kind === 'gem') inside = Math.abs(dx) ** 0.68 + Math.abs(dy) ** 0.68 <= R ** 0.68;
      else if (kind === 'astra') {
        const a = Math.atan2(dy, dx) + Math.PI / 2, r = Math.hypot(dx, dy);
        const k = ((a / TAU) * 5) % 1, lim = R * (0.45 + 0.55 * Math.abs(1 - 2 * ((k + 1) % 1)) ** 1.6);
        inside = r <= lim;
      } else if (kind === 'sol') inside = Math.hypot(dx, dy) <= R * 0.62 || (Math.hypot(dx, dy) <= R && Math.abs(Math.sin(Math.atan2(dy, dx) * 6)) > 0.8);
      else if (kind === 'luna') inside = Math.hypot(dx, dy) <= R && Math.hypot(dx - R * 0.45, dy + R * 0.2) > R * 0.72;
      else if (kind === 'kimi') { const r = Math.max(2, Math.round(R * 0.35)), qx = Math.max(Math.abs(dx) - (R - r), 0), qy = Math.max(Math.abs(dy) - (R - r), 0); inside = qx * qx + qy * qy <= r * r; }
      else if (kind === 'whale') {
        const sx = Math.floor(((x - 2) / w) * 52), sy = Math.floor(((y - 2 - w * 0.12) / (w * 0.76)) * 38);
        const ch = (WHALE_SHAPE[sy] || '')[sx];
        inside = ch === 'o' || ch === 'W';
        if (ch === 'W') { set(g, x, y, 'W'); continue; }
      }
      if (inside) set(g, x, y, 'o');
    }
    shade(g);
    if (kind === 'gem') {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const t = g[y][x]; if (t !== 'o' && t !== 'h' && t !== 's') continue;
        const dx = x + 0.5 - c, dy = y + 0.5 - c, dist = Math.hypot(dx, dy);
        const reg = dist < w * 0.14 ? 'b' : Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'r' : 'g') : dx < 0 ? 'y' : 'b';
        g[y][x] = reg + t;
      }
    }
    if (kind === 'kimi' && w >= 14) {
      const sc = w >= 26 ? 1 : 0;
      const kx = Math.round(c - 7.5 * (sc ? 1 : 0.5)), ky = Math.round(c - 7 * (sc ? 1 : 0.5));
      KIMI_K.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch === '#' && (sc || (xx % 2 === 0 && yy % 2 === 0))) set(g, sc ? kx + xx : kx + xx / 2, sc ? ky + yy : ky + yy / 2, 'W'); }));
      set(g, Math.round(c + w * 0.28), Math.round(c - w * 0.28), 'B'); set(g, Math.round(c + w * 0.28) + 1, Math.round(c - w * 0.28), 'B');
    }
  } else {
    ({ g, h } = paperMask(w));
    shade(g);
    // ribs
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] === 'o' && w >= 12 && (x - 1) % Math.max(4, Math.round(w / 4)) === 0) g[y][x] = 's';
    // bottom rim and top cap
    for (let x = 0; x < g[0].length; x++) { if (isSolid(g, x, h)) set(g, x, h, 'r'); if (isSolid(g, x, 1)) set(g, x, 1, 'r'); }
    // logo
    const cx = Math.round((w + 2) / 2), cy = Math.round(h * 0.55);
    if (w >= 12) {
      if (kind === 'claude') { const L = w >= 20 ? 3 : 2; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; for (let r = 1; r <= L; r++) set(g, cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), 'i'); } set(g, cx, cy, 'i'); }
      else if (kind === 'openai') { const r = w >= 20 ? 3 : 2; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; set(g, cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), 'i'); set(g, cx + Math.round(Math.cos(a + 0.5) * (r - 1)), cy + Math.round(Math.sin(a + 0.5) * (r - 1)), 'i'); } }
      else if (kind === 'qwen') { fillRect(g, cx - 1, cy - 2, 3, 1, 'i'); fillRect(g, cx - 2, cy - 1, 1, 3, 'i'); fillRect(g, cx + 2, cy - 1, 1, 3, 'i'); fillRect(g, cx - 1, cy + 2, 3, 1, 'i'); }
    }
    // warm core when lit
    if (lit) for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
      if (g[y][x] !== 'o' && g[y][x] !== 'h') continue;
      const d = Math.hypot((x - cx) / (w * 0.32), (y - cy) / (h * 0.3));
      if (d < 1 && ((x + y) % 2 === 0 || d < 0.6)) g[y][x] = 'c';
    }
  }
  outline(g, 'O');
  return g;
}

function lanternPalette(kind, lit) {
  const K = LKIND[kind];
  const p = {};
  if (kind === 'gem') Object.assign(p, { ro: 0xea4335, rh: 0xff7a6b, rs: 0xb3261e, yo: 0xfbbc04, yh: 0xffd95a, ys: 0xd08d00, go: 0x34a853, gh: 0x6fd08a, gs: 0x1e7a3a, bo: 0x4285f4, bh: 0x7fb0ff, bs: 0x2c5fc7, O: 0x1a1f4d });
  else for (const [k, v] of Object.entries(K)) if (typeof v === 'string') p[k] = HX(v);
  p.r = mix(p.O || 0x333333, p.s || 0x555555, 0.5);
  p.c = mix(p.h || 0xffffff, 0xffffff, 0.6);
  if (!lit) for (const k of Object.keys(p)) p[k] = mix(p[k], 0x20243a, 0.45);
  else for (const k of Object.keys(p)) if (k !== 'O') p[k] = mix(p[k], 0xffffff, 0.12);
  return p;
}

export function lanternSprite(kind, w, lit = true) {
  w = Math.max(6, Math.round(w / 2) * 2);
  return memo(`L|${kind}|${w}|${lit ? 1 : 0}`, () => toFB(lanternGrid(kind, w, lit), lanternPalette(kind, lit)));
}

// Label plate under a lantern: dark box, brand-coloured top edge, 5x7 font
export function label(fb, x, y, str, col = 0x9aa3c8, o = {}) {
  const small = o.small, font = small ? 'small' : 'big';
  const w = textWidth(str, font) + (small ? 4 : 6), h = small ? 8 : 11;
  const X = Math.round(x - w / 2), Y = Math.round(y);
  const a = o.alpha === undefined ? 1 : o.alpha;
  fb.rect(X - 1, Y - 1, w + 2, h + 2, 0x05060c, 0.8 * a);
  fb.rect(X, Y, w, h, 0x151827, 0.9 * a);
  fb.rect(X, Y, w, 1, col, a);
  text(fb, str, Math.round(x), Y + (small ? 2 : 3), mix(0x151827, 0xffffff, a), { font, align: 'center' });
  return { w, h };
}

// Draw a lantern centred at (x, y). o: kind, w (px), lit (0..1), t, label, glow (bool)
export function lanternP(fb, x, y, o = {}) {
  const kind = o.kind || 'plain', K = LKIND[kind];
  const w = Math.round((o.w || 16) * (kind === 'gem' ? 1.45 : 1)), lit = o.lit === undefined ? 1 : o.lit;
  const t = o.t || 0;
  const flick = 0.88 + 0.12 * Math.sin(t * 11 + x * 0.37) * Math.sin(t * 6.3 + y * 0.21);
  x = Math.round(x); y = Math.round(y);
  if (lit > 0 && o.glow !== false) fb.glow(x, y, w * 1.6, K.glow, 0.55 * lit * flick, 6);
  const spr = lanternSprite(kind, w, lit > 0.5);
  fb.blit(spr, x - Math.floor(spr.w / 2), y - Math.floor(spr.h / 2), { alpha: o.alpha, dither: o.dither });
  if (lit > 0.5 && !['gem', 'astra', 'sol', 'luna', 'whale', 'kimi'].includes(kind)) {
    const by = y + Math.floor(spr.h / 2) - 1;
    fb.add(x, by, 0xfff2a8, flick); fb.glow(x, by, 4, 0xffcf6b, 0.8 * flick, 3);
  }
  if (o.label) label(fb, x, y + Math.ceil(spr.h / 2) + 2, o.label, K.lab, { small: o.smallLabel, alpha: o.labelAlpha });
  return spr;
}

// ---------------- Flash rocket ----------------
export function rocketSprite(k = 1) {
  return memo('rocket' + k, () => {
    const W = 9 * k, H = 20 * k, g = createGrid(W + 6 * k, H + 2);
    const cx = Math.floor(g[0].length / 2);
    const R = (x, y, w, h, ch) => fillRect(g, x, y, w, h, ch);
    R(cx - 3 * k, 5 * k, 7 * k, 11 * k, 'o');
    for (let i = 0; i < 5 * k; i++) R(cx - Math.floor(i * 0.7), 1 + i, 1 + Math.floor(i * 0.7) * 2, 1, 'n');
    R(cx - 5 * k, 12 * k, 2 * k, 5 * k, 'f'); R(cx + 4 * k, 12 * k, 2 * k, 5 * k, 'f'); R(cx - 1, 16 * k, 3, 3 * k, 'f');
    shade(g);
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] === 'f') g[y][x] = 'b';
    R(cx - 3 * k, 7 * k, 7 * k, 1, 'b'); R(cx - 3 * k, 14 * k, 7 * k, 1, 'b');
    // lightning bolt emblem
    const B = ['..##', '.##.', '####', '.##.', '##..'];
    B.forEach((r, yy) => [...r].forEach((c2, xx) => { if (c2 === '#') set(g, cx - 2 + xx, 8 * k + yy, 'y'); }));
    outline(g, 'O');
    return toFB(g, { o: 0xf4f6ff, h: 0xffffff, s: 0xc4cae6, n: 0xea4335, b: 0x4285f4, y: 0xfbbc04, O: 0x1a1f4d });
  });
}
export function rocket(fb, x, y, o = {}) {
  const s = rocketSprite(o.k || 1);
  fb.blit(s, Math.round(x - s.w / 2), Math.round(y - s.h / 2), { alpha: o.alpha });
  return s;
}
export function exhaust(fb, t, x, y, len = 18, k = 1) {
  for (let i = 0; i < len; i++) {
    const q = i / len, w = Math.max(1, Math.round((1 - q) * 3 * k));
    const px = x + Math.sin(t * 50 + i * 1.3) * q * 2;
    const c = q < 0.2 ? 0xffffff : q < 0.5 ? 0xffe08a : 0xff8a3a;
    for (let d = -w; d <= w; d++) fb.add(px + d, y + i, c, (1 - q) * 0.9);
  }
  fb.glow(x, y + 3, 8 * k, 0xffc16b, 0.8, 4);
}

// ---------------- emotes ----------------
const EMO = {
  sweat: ['..#..', '.###.', '#####', '#####', '.###.'],
  anger: ['##.##', '#...#', '.....', '#...#', '##.##'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  excl: ['###', '###', '###', '###', '.#.', '...', '###'],
  q: ['.###.', '##.##', '...##', '..##.', '..#..', '.....', '..#..'],
  note: ['..###', '..#.#', '..#..', '###..', '###..'],
  spark: ['..#..', '..#..', '#####', '..#..', '..#..'],
  drop: ['.#.', '###', '###', '.#.'],
};
const EMO_COL = { sweat: 0x9fd8ff, anger: 0xff4a4a, heart: 0xff6b8a, excl: 0xffd23f, q: 0xffffff, note: 0xffffff, spark: 0xffffff, drop: 0x9fd8ff };
export function emote(fb, kind, x, y, o = {}) {
  const rows = EMO[kind], sc = o.scale || 1, col = o.color || EMO_COL[kind];
  const w = rows[0].length, h = rows.length;
  const X = Math.round(x - (w * sc) / 2), Y = Math.round(y - (h * sc) / 2);
  // dark outline first
  for (let yy = -1; yy <= h; yy++) for (let xx = -1; xx <= w; xx++) {
    const on = (r, c2) => (rows[r] || '')[c2] === '#';
    if (on(yy, xx)) continue;
    if (on(yy - 1, xx) || on(yy + 1, xx) || on(yy, xx - 1) || on(yy, xx + 1)) fb.rect(X + xx * sc, Y + yy * sc, sc, sc, o.line || 0x1a1a2a, o.alpha === undefined ? 1 : o.alpha);
  }
  rows.forEach((r, yy) => [...r].forEach((c2, xx) => { if (c2 === '#') fb.rect(X + xx * sc, Y + yy * sc, sc, sc, col, o.alpha === undefined ? 1 : o.alpha); }));
  if (kind === 'sweat' || kind === 'drop') fb.rect(X + sc, Y + 2 * sc, sc, sc, 0xffffff);
}

// Pixel speech bubble: rounded box with 1px outline and a tail to (tx, ty); fill(cx, cy) draws content
export function bubble(fb, x, y, w, h, tx, ty, o = {}) {
  const line = o.line || 0x1a1a2a, fill = o.fill || 0xffffff, k = o.k === undefined ? 1 : o.k;
  if (k <= 0) return;
  const W = Math.max(4, Math.round(w * k)), Hh = Math.max(4, Math.round(h * k));
  const X = Math.round(x + (w - W) / 2), Y = Math.round(y + (h - Hh) / 2);
  const bx = Math.max(X + 5, Math.min(X + W - 6, tx));
  // tail: tapered wedge from the box bottom to (tx, ty)
  const L = Math.max(1, ty - (Y + Hh));
  for (let r = -1; r <= L; r++) {
    const q = Math.max(0, r) / L, cx = bx + (tx - bx) * q, hw = 4.5 * (1 - q);
    fb.rect(Math.round(cx - hw - 1), Y + Hh + r, Math.round(hw * 2 + 2), 1, line);
    if (hw > 0.8) fb.rect(Math.round(cx - hw), Y + Hh + r - 1, Math.round(hw * 2), 1, fill);
  }
  // box with rounded corners
  fb.rect(X + 2, Y - 1, W - 4, Hh + 2, line); fb.rect(X - 1, Y + 2, W + 2, Hh - 4, line); fb.rect(X, Y, W, Hh, line);
  fb.rect(X + 2, Y, W - 4, Hh, fill); fb.rect(X, Y + 2, W, Hh - 4, fill); fb.rect(X + 1, Y + 1, W - 2, Hh - 2, fill);
  fb.rect(X + 2, Y + Hh - 2, W - 4, 1, mix(fill, 0x9aa0c0, 0.35));
  return { x: X, y: Y, w: W, h: Hh, cx: X + W / 2, cy: Y + Hh / 2 };
}
export function thoughtBubble(fb, x, y, w, h, tx, ty, o = {}) {
  const line = o.line || 0x1a1a2a, fill = o.fill || 0xffffff;
  const cx = x + w / 2, cy = y + h / 2;
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; fb.circle(cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * h * 0.36, h * 0.28 + 1, line); }
  fb.ellipse(cx, cy, w / 2 - 1, h / 2 - 1, line);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; fb.circle(cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * h * 0.36, h * 0.28, fill); }
  fb.ellipse(cx, cy, w / 2 - 2, h / 2 - 2, fill);
  for (let i = 1; i <= 2; i++) {
    const k = 0.45 + i * 0.22, px = cx + (tx - cx) * k, py = y + h + (ty - y - h) * k, r = 4 - i;
    fb.circle(px, py, r + 1, line); fb.circle(px, py, r, fill);
  }
  return { cx, cy };
}

// Calendar page icon (used in bubbles and on walls)
export function calPage(fb, x, y, w, h, month, o = {}) {
  fb.rect(x - 1, y - 1, w + 2, h + 2, 0x1a1a2a);
  fb.rect(x, y, w, h, 0xfbf7ee);
  const hh = Math.max(9, Math.round(h * 0.36));
  fb.rect(x, y, w, hh, 0xd64541);
  for (let i = 0; i < 3; i++) fb.rect(x + 4 + i * ((w - 10) / 2), y - 3, 2, 4, 0x555a66);
  const font = textWidth(month, 'big') <= w - 4 ? 'big' : 'small';
  text(fb, month, x + w / 2, y + Math.floor((hh - (font === 'big' ? 7 : 5)) / 2), 0xffffff, { font, align: 'center' });
  if (o.day !== undefined) text(fb, String(o.day), x + w / 2, y + Math.round(h * 0.45), 0x2a2a35, { align: 'center', scale: o.dayScale || 2 });
  if (o.cross) { fb.line(x + 2, y + 2, x + w - 3, y + h - 3, 0xd64541); fb.line(x + 3, y + 2, x + w - 2, y + h - 3, 0xd64541); fb.line(x + w - 3, y + 2, x + 2, y + h - 3, 0xd64541); fb.line(x + w - 2, y + 2, x + 3, y + h - 3, 0xd64541); }
}
