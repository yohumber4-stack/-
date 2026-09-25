// Character builders in the reference pixel style, with animation states.
// Default poses reproduce clawd-codex.html exactly; everything else is a variant
// built with the same toolkit (fillRect -> shade -> details -> outline).
import { createGrid, set, get, fillRect, shade, outline, stampHand, stampBlock, toFB, half, isSolid, EMPTY } from './grid.js';
import { eye, mouth, finishFace, EMPTY_BODY } from './face.js';
import { QWEN_SHAPE, WHALE_SHAPE, KIMI_K } from './shapes.js';
import { mix, desat, clamp } from '../engine/core.js';
import { text } from '../engine/font.js';
import { FB } from '../engine/fb.js';

// ---------------- palettes (from the reference) ----------------
const H = (s) => parseInt(s.slice(1), 16);
export const PAL = {
  clawd: { O: '#6b2e1c', o: '#d97757', h: '#ee9b78', s: '#b35a3c', k: '#1a1113', w: '#fff6ee', p: '#f4a08c', m: '#5a2416', q: '#e0607a', t: '#9fd8ff',
    n: '#4b6cc9', N: '#35509e', c: '#eef2ff', C: '#c9d2ee' },
  codex: { O: '#0d1444', o: '#5a7cff', h: '#8fa9ff', s: '#3f5ae0', k: '#121838', g: '#2a3468', e: '#9fd8ff', x: '#ffd479', r: '#ff6b7a', n: '#7dffb0', q: '#ff8fb0' },
  gemini: { O: '#1a1f4d', ro: '#ea4335', rh: '#ff7a6b', rs: '#b3261e', yo: '#fbbc04', yh: '#ffd95a', ys: '#d08d00', go: '#34a853', gh: '#6fd08a', gs: '#1e7a3a',
    bo: '#4285f4', bh: '#7fb0ff', bs: '#2c5fc7', k: '#151a3d', w: '#fdfcff', p: '#f7a8c4', m: '#151a3d', q: '#e0607a', t: '#9fd8ff' },
  qwen: { O: '#1f0d5c', o: '#6339e6', h: '#8b6dff', s: '#4521c2', W: '#fdfcff', L: '#d6caff', k: '#1a0f45', w: '#fdfcff', p: '#f7a8c4', m: '#1a0f45', q: '#e0607a', t: '#9fd8ff',
    F: '#2e2622', f: '#8c2f39', G: '#0b0b12', j: '#4a4f7a', a: '#ff9a4a', A: '#d96a1e' },
  deepseek: { O: '#10195e', o: '#4d6bfe', h: '#7d95ff', s: '#3450d6', W: '#fdfcff', L: '#c9d4ff', k: '#10163f', w: '#fdfcff', p: '#f7a8c4', m: '#10163f', q: '#e0607a', t: '#bfe6ff' },
  kimi: { O: '#000000', o: '#1b1d24', h: '#3b3e4c', s: '#0d0e12', W: '#fdfcff', L: '#c9ccd8', B: '#1e88ff', b: '#7cc0ff', D: '#0b5fd0',
    k: '#fdfcff', w: '#1e88ff', p: '#f78fb0', m: '#fdfcff', q: '#e0607a', t: '#9fd8ff' },
};

function palette(name, o) {
  let p = PAL[name];
  if (o.pal) p = { ...p, ...o.pal };
  const out = {};
  for (const [k, v] of Object.entries(p)) out[k] = typeof v === 'string' ? H(v) : v;
  if (o.grey > 0) for (const k of Object.keys(out)) {
    if (['k', 'w', 'm', 'q', 't'].includes(k)) continue;
    out[k] = mix(out[k], mix(desat(out[k], 1), 0x7a8098, 0.3), o.grey);
  }
  // per-ray saturation for Gemini: rays = {r, y, g, b} 0..1 (0 = grey)
  if (o.rays) for (const [r, v] of Object.entries(o.rays)) for (const t of ['o', 'h', 's']) {
    const k = r + t; if (out[k] !== undefined) out[k] = mix(mix(desat(out[k], 1), 0x8a90a8, 0.35), out[k], clamp(v));
  }
  return out;
}

const cache = new Map();
function cached(name, o, build) {
  const key = name + '|' + JSON.stringify(o);
  let s = cache.get(key);
  if (!s) {
    s = build(o);
    cache.set(key, s);
    if (cache.size > 6000) cache.delete(cache.keys().next().value);
  }
  return s;
}

// Isolated rectangle toned exactly like shade() would tone it, stamped over the grid with a seam.
function stampShaded(g, x, y, w, h, seam = 'O') {
  const inR = (cx, cy) => cx >= 0 && cy >= 0 && cx < w && cy < h;
  const runR = (cx, cy, dx, dy) => { let n = 0; while (inR(cx + dx * (n + 1), cy + dy * (n + 1))) n++; return n + 1; };
  for (let cy = -1; cy <= h; cy++) for (let cx = -1; cx <= w; cx++) {
    if (inR(cx, cy)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (inR(cx + dx, cy + dy)) near = true;
    if (near && isSolid(g, x + cx, y + cy)) set(g, x + cx, y + cy, seam);
  }
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    const top = runR(cx, cy, 0, -1), left = runR(cx, cy, -1, 0), right = runR(cx, cy, 1, 0), bottom = runR(cx, cy, 0, 1);
    const checker = (x + cx + y + cy) % 2 === 0;
    let t = 'o';
    if (top === 1 || left === 1) t = 'h';
    else if (right <= 2 || bottom <= 2) t = 's';
    else if (top === 2 && checker) t = 'h';
    else if ((right === 3 || bottom === 3) && checker) t = 's';
    set(g, x + cx, y + cy, t);
  }
}

function finish(g, name, o, ax, ay) {
  outline(g, 'O');
  return { fb: toFB(g, palette(name, o)), ax, ay, g };
}

// ============================ CLAWD ============================
// o: eyes, mouth, blush ('big'|false), lookX, lookY, armL, armR (dy, negative = up),
//    legs [4 lifts], bob (body dy), sq (squash + / stretch -), acc ('nightcap'), tear
export function clawdSprite(o = {}) {
  return cached('clawd', o, (o) => {
    const PT = 16, PS = 4, PB = 1;
    const g = createGrid(56 + PS * 2, 39 + PT + PB);
    const X = PS, Y = PT;
    const R = (x, y, w, h, ch = 'o') => fillRect(g, X + x, Y + y, w, h, ch);
    const P = (x, y, ch) => set(g, X + x, Y + y, ch);
    const bob = o.bob || 0, sq = o.sq || 0;
    const bx = 7 - sq, bw = 42 + sq * 2, by = 1 + sq * 2 + bob, bh = 27 - sq * 2;
    R(bx, by, bw, bh);
    const legs = o.legs || [0, 0, 0, 0];
    const LX = [9, 17, 34, 42];
    LX.forEach((lx, i) => { const top = by + bh; const bot = 37 - legs[i]; R(lx + (i < 2 ? -Math.max(0, sq) : Math.max(0, sq)) * 0, top, 5, Math.max(1, bot - top + 1)); });
    const armY = (a) => 9 + sq + bob + (a || 0);
    const aL = armY(o.armL), aR = armY(o.armR);
    const armIn = (a) => (a || 0) < -10; // raised above the body top: stamp in front
    if (!armIn(o.armL)) R(1 - sq, aL, 6, 9);
    if (!armIn(o.armR)) R(49 + sq, aR, 6, 9);
    shade(g);
    if (armIn(o.armL)) stampShaded(g, X + 1 - sq, Y + aL, 6, 9);
    if (armIn(o.armR)) stampShaded(g, X + 49 + sq, Y + aR, 6, 9);
    LX.forEach((lx) => R(lx, by + bh, 5, 1, 's'));
    R(bx + 3, by + 2, 4, 1, 'w'); P(bx + 3, by + 3, 'w');
    const fy = by - 1, fx = bx - 7 + sq; // face origin shift (reference: body at 7,1)
    for (const [i, ex] of [[-1, 14], [1, 36]]) eye(g, X + fx + ex + (i < 0 ? 0 : 0), Y + fy + 6, 6, 8, o.eyes || 'open', i, o);
    if (o.blush !== false) for (const x of [9, 43]) {
      R(fx + x, fy + 15, 4, 2, 'p'); P(fx + x - 1, fy + 16, 'p'); P(fx + x + 4, fy + 15, 'p');
      if (o.blush === 'big') R(fx + x - 1, fy + 14, 6, 1, 'p');
    }
    mouth(g, X + fx + 25, Y + fy + 15, 6, o.mouth || 'smile');
    if (o.tear) { const ty = Y + fy + 14 + (o.tear % 6); R(fx + 15, ty - Y - 0, 2, 2, 't'); }
    finishFace(g, ['o', 'h', 's']);
    if (o.acc === 'nightcap') {
      // cap drooping to the right, white trim and pompom
      const cx = X + bx + 6, cy = Y + by - 1;
      for (let r = 0; r < 12; r++) {
        const w = 30 - r * 2, x0 = cx + r * 2 + Math.floor(r * r * 0.06);
        fillRect(g, x0, cy - r, w, 1, r < 2 ? 'c' : (r + (x0 & 1)) % 5 === 0 ? 'N' : 'n');
      }
      fillRect(g, cx - 1, cy - 1, 32, 2, 'c'); fillRect(g, cx - 1, cy, 32, 1, 'C');
      fillRect(g, cx + 30, cy - 13, 4, 4, 'c'); set(g, cx + 30, cy - 13, 'C');
    }
    return finish(g, 'clawd', o, X + 28, Y + 38);
  });
}

// Walk cycle helper: phase in [0,1)
export function clawdWalk(phase) {
  const f = Math.floor((((phase % 1) + 1) % 1) * 4);
  return [
    { legs: [2, 0, 2, 0], bob: -1, armL: -1, armR: 1 },
    { legs: [0, 0, 0, 0], bob: 0, armL: 0, armR: 0 },
    { legs: [0, 2, 0, 2], bob: -1, armL: 1, armR: -1 },
    { legs: [0, 0, 0, 0], bob: 0, armL: 0, armR: 0 },
  ][f];
}

// ============================ CODEX ============================
// o: face (see codexFace), cursor (bool), armL/armR: [dx, dy] or 'up'|'wave'|'type'|'hold',
//    legs [2 lifts], bob, lean (head dx)
const ARM_PRESET = { up: [-8, -10], out: [-4, -4], type: [3, -3], hold: [4, -6], down: [0, 2], hug: [6, -2] };
export function codexSprite(o = {}) {
  return cached('codex', o, (o) => {
    const PT = 8, PS = 6, PB = 1;
    const g = createGrid(56 + PS * 2, 53 + PT + PB);
    const X = PS, Y = PT;
    const bob = o.bob || 0, lean = o.lean || 0;
    const R = (x, y, w, h, ch = 'o') => fillRect(g, X + x, Y + y, w, h, ch);
    const HX = lean, HY = bob; // head offset
    R(22 + HX, 1 + HY, 12, 2); R(18 + HX, 3 + HY, 20, 4); R(8 + HX, 5 + HY, 8, 2); R(40 + HX, 5 + HY, 8, 2); R(6 + HX, 7 + HY, 44, 26);
    R(18, 34 + bob, 20, 12 - bob);
    const legs = o.legs || [0, 0];
    R(19, 46, 6, 6 - legs[0]); R(31, 46, 6, 6 - legs[1]);
    const arm = (v, side) => {
      let d = v === undefined ? [0, 0] : typeof v === 'string' ? ARM_PRESET[v] || [0, 0] : v;
      if (side > 0) d = [-d[0], d[1]];
      return [(side < 0 ? 11 : 39) + d[0], 37 + d[1] + bob];
    };
    const aL = arm(o.armL, -1), aR = arm(o.armR, 1);
    const armFree = (a, side) => (side < 0 ? a[0] + 6 < 18 : a[0] > 37) && a[1] > 33 + bob;
    if (armFree(aL, -1)) R(aL[0], aL[1], 6, 6);
    if (armFree(aR, 1)) R(aR[0], aR[1], 6, 6);
    shade(g);
    R(16 + HX, 7 + HY, 2, 2, 's'); R(38 + HX, 7 + HY, 2, 2, 's'); R(18, 45, 20, 1, 's');
    // screen
    R(12 + HX, 12 + HY, 32, 16, 'k');
    for (const [x, y] of [[12, 12], [42, 12], [12, 26], [42, 26]]) R(x + HX, y + HY, 2, 2, 'o');
    R(14 + HX, 14 + HY, 4, 1, 'g'); R(14 + HX, 15 + HY, 1, 2, 'g'); set(g, X + 41 + HX, Y + 25 + HY, 'g');
    codexFace(g, X + 12 + HX, Y + 12 + HY, o.face || 'prompt', o);
    if (!armFree(aL, -1)) stampShaded(g, X + aL[0], Y + aL[1], 6, 6);
    if (!armFree(aR, 1)) stampShaded(g, X + aR[0], Y + aR[1], 6, 6);
    return finish(g, 'codex', o, X + 28, Y + 52);
  });
}

export function codexWalk(phase) {
  const f = Math.floor((((phase % 1) + 1) % 1) * 4);
  return [{ legs: [2, 0], bob: -1 }, { legs: [0, 0], bob: 0 }, { legs: [0, 2], bob: -1 }, { legs: [0, 0], bob: 0 }][f];
}

// Faces on the 32x16 terminal screen (origin sx, sy). Glyph colour 'e' unless noted.
function codexFace(g, sx, sy, face, o) {
  const E = (x, y, w, h, ch = 'e') => fillRect(g, sx + x, sy + y, w, h, ch);
  const P = (x, y, ch = 'e') => set(g, sx + x, sy + y, ch);
  const chevR = (x, y, ch = 'e') => [0, 1, 2, 3, 4, 4, 3, 2, 1, 0].forEach((d, i) => E(x + d, y + i, 2, 1, ch));
  const chevL = (x, y, ch = 'e') => [4, 3, 2, 1, 0, 0, 1, 2, 3, 4].forEach((d, i) => E(x + d, y + i, 2, 1, ch));
  const arch = (x, y, ch = 'e') => { E(x + 1, y, 4, 2, ch); E(x, y + 2, 2, 2, ch); E(x + 4, y + 2, 2, 2, ch); };
  const cup = (x, y, ch = 'e') => { E(x, y, 2, 2, ch); E(x + 4, y, 2, 2, ch); E(x + 1, y + 2, 4, 2, ch); };
  switch (face) {
    case 'prompt': chevR(6, 4); if (o.cursor !== false) E(18, 8, 8, 2); break;
    case 'happy': arch(7, 5); arch(19, 5); break;
    case 'smile': arch(7, 4); arch(19, 4); E(13, 11, 6, 1); P(12, 10); P(19, 10); break;
    case 'laugh': arch(7, 3); arch(19, 3); E(12, 9, 8, 4, 'e'); E(13, 12, 6, 1, 'q'); break;
    case 'wow': E(8, 4, 4, 1); E(7, 5, 1, 4); E(12, 5, 1, 4); E(8, 9, 4, 1); E(20, 4, 4, 1); E(19, 5, 1, 4); E(24, 5, 1, 4); E(20, 9, 4, 1); E(14, 11, 4, 3); break;
    case 'shock': E(8, 3, 3, 7); E(21, 3, 3, 7); E(14, 11, 4, 3); break;
    case 'squint': chevR(6, 3); chevL(20, 3); E(12, 13, 8, 1); break;
    case 'wink': arch(7, 5); E(19, 7, 6, 2); break;
    case 'sad': E(7, 6, 6, 2); E(19, 6, 6, 2); E(8, 8, 2, 5, 'e'); E(22, 8, 2, 5, 'e'); E(13, 12, 6, 1); break;
    case 'cry': E(7, 5, 6, 2); E(19, 5, 6, 2); for (let i = 0; i < 3; i++) { P(9, 8 + i * 2, 'e'); P(22, 8 + i * 2, 'e'); } cup(13, 12); break;
    case 'bored': E(7, 7, 6, 2); E(19, 7, 6, 2); break;
    case 'angry': for (let i = 0; i < 5; i++) { E(6 + i, 3 + Math.floor(i / 2), 1, 1); E(25 - i, 3 + Math.floor(i / 2), 1, 1); } E(8, 6, 4, 4); E(20, 6, 4, 4); E(12, 12, 8, 1); break;
    case 'determined': for (let i = 0; i < 6; i++) { P(6 + i, 3 + Math.floor(i / 2)); P(25 - i, 3 + Math.floor(i / 2)); } E(8, 6, 4, 5); E(20, 6, 4, 5); break;
    case 'evil': chevR(5, 3); chevL(21, 3); E(12, 12, 8, 1, 'e'); P(11, 11); P(20, 11); break;
    case 'heart': { const Hh = ['.##..##.', '########', '########', '.######.', '..####..', '...##...']; Hh.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') E(12 + x, 5 + y, 1, 1, 'q'); })); break; }
    case 'check': for (let i = 0; i < 4; i++) E(9 + i, 7 + i, 2, 2, 'n'); for (let i = 0; i < 8; i++) E(13 + i, 10 - i, 2, 2, 'n'); break;
    case 'excl': E(15, 2, 2, 8, 'x'); E(15, 12, 2, 2, 'x'); break;
    case 'q': E(12, 2, 8, 2, 'x'); E(18, 4, 2, 3, 'x'); E(15, 7, 3, 2, 'x'); E(15, 9, 2, 2, 'x'); E(15, 12, 2, 2, 'x'); break;
    case 'dots': { const n = o.t === undefined ? 3 : 1 + (Math.floor(o.t * 3) % 3); for (let i = 0; i < n; i++) E(9 + i * 6, 7, 3, 3); break; }
    case 'enter': E(22, 3, 2, 7); E(9, 8, 15, 2); E(9, 8, 2, 2); E(11, 6, 1, 6); E(12, 5, 1, 8); break;
    case 'braces': { // { }
      E(8, 2, 3, 1); E(7, 3, 2, 3); E(5, 6, 3, 2); E(7, 8, 2, 3); E(8, 11, 3, 1);
      E(21, 2, 3, 1); E(23, 3, 2, 3); E(24, 6, 3, 2); E(23, 8, 2, 3); E(21, 11, 3, 1);
      E(14, 6, 2, 2, 'x'); break;
    }
    case 'code': {
      const t = o.t || 0;
      for (let i = 0; i < 5; i++) {
        const ln = (i + Math.floor(t * 5)) % 7, w = 4 + ((ln * 7) % 13);
        E(3 + (ln % 3) * 2, 2 + i * 2 + 1, w, 1, ['e', 'x', 'n', 'e', 'q', 'e', 'n'][ln]);
      }
      break;
    }
    case 'bug': { const B = ['.#..#.', '..##..', '######', '.####.', '######', '.####.', '#.##.#']; B.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') E(13 + x, 4 + y, 1, 1, 'r'); })); break; }
    default:
      if (face.startsWith('bar:')) {
        const p = clamp(parseFloat(face.slice(4)));
        E(4, 6, 24, 4, 'g'); E(4, 6, Math.round(24 * p), 4, 'n');
      } else if (face.startsWith('txt:')) {
        // tiny text on screen via the 3x5 font
        const tmp = new FB(32, 16).clear();
        text(tmp, face.slice(4), 16, 5, 0xffffff, { font: 'small', align: 'center' });
        for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) if (tmp.opaque(x, y)) P(x, y, 'e');
      }
  }
}

// ============================ GEMINI ============================
// o: eyes, mouth, blush, lookX/Y, handL/handR (dy; 'hide'), sx/sy (star radius scale), glow via draw,
//    rays {r,y,g,b} saturation, grey (0..1)
export function geminiSprite(o = {}) {
  return cached('gemini', o, (o) => {
    const PAD = 6;
    const SIZE = 56, C = 28, R0 = 26.5, P = 0.68;
    const g = createGrid(SIZE + PAD * 2, SIZE + PAD * 2 + 2);
    const rx = R0 * (o.sx || 1), ry = R0 * (o.sy || 1), limit = 1;
    const cy0 = C + (1 - (o.sy || 1)) * R0; // keep the bottom tip on the ground
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
      const dx = Math.abs(x - PAD + 0.5 - C) / rx, dy = Math.abs(y - PAD + 0.5 - cy0) / ry;
      if (dx ** P + dy ** P <= limit) set(g, x, y, 'o');
    }
    shade(g);
    const regionAt = (x, y) => {
      const dx = x - PAD + 0.5 - C, dy = y - PAD + 0.5 - cy0;
      const checker = (x - PAD + y - PAD) % 2 === 0;
      const dist = Math.hypot(dx, dy);
      if (dist < 8 || (dist < 10 && checker)) return 'b';
      const vertical = Math.abs(dy) >= Math.abs(dx);
      const nearDiagonal = Math.abs(Math.abs(dx) - Math.abs(dy)) < 2 && checker;
      const useVertical = nearDiagonal ? !vertical : vertical;
      if (useVertical) return dy < 0 ? 'r' : 'g';
      return dx < 0 ? 'y' : 'b';
    };
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
      const t = g[y][x];
      if (t === 'o' || t === 'h' || t === 's') g[y][x] = regionAt(x, y) + t;
    }
    const narrow = (o.sx || 1) < 0.45;
    const fyo = Math.round(cy0 - C);
    if (!narrow) {
      if (o.handL !== 'hide') stampHand(g, PAD + 20, PAD + 33 + fyo + (o.handL || 0), 6, -1, { o: 'yo', h: 'yh', s: 'ys' });
      if (o.handR !== 'hide') stampHand(g, PAD + 30, PAD + 33 + fyo + (o.handR || 0), 6, 1, { o: 'bo', h: 'bh', s: 'bs' });
      const fx = Math.round((o.sx || 1) < 1 ? 0 : 0);
      for (const [i, x] of [[-1, 20], [1, 32]]) eye(g, PAD + x + fx, PAD + 23 + fyo, 4, 6, o.eyes || 'open', i, o);
      if (o.blush !== false) {
        fillRect(g, PAD + 17, PAD + 30 + fyo, 3, 2, 'p'); fillRect(g, PAD + 36, PAD + 30 + fyo, 3, 2, 'p');
        if (o.blush === 'big') { fillRect(g, PAD + 16, PAD + 29 + fyo, 4, 1, 'p'); fillRect(g, PAD + 36, PAD + 29 + fyo, 4, 1, 'p'); }
      }
      mouth(g, PAD + 26, PAD + 30 + fyo, 4, o.mouth || 'smile');
      if (o.tear) fillRect(g, PAD + 21, PAD + 29 + fyo + (Math.floor(o.tear * 4) % 6), 1, 2, 't');
      finishFace(g, ['bo', 'bh', 'bs', 'ro', 'rh', 'rs', 'yo', 'go']);
    }
    return finish(g, 'gemini', o, PAD + 28, PAD + 55 + fyo * 0);
  });
}

// ============================ QWEN ============================
// o: eyes, mouth, blush, handL/handR (dy), rub (0..1 hands to centre), spy (hat+glasses), goo (0..1)
export function qwenSprite(o = {}) {
  return cached('qwen', o, (o) => {
    const PX = 5, PY = 2, TOP = 12;
    const rows = QWEN_SHAPE.length, cols = QWEN_SHAPE[0].length;
    const g = createGrid(cols + PX * 2, rows + PY * 2 + TOP);
    const OY = PY + TOP;
    const at = (x, y) => (QWEN_SHAPE[y] && QWEN_SHAPE[y][x]) || '.';
    const put = (x, y, ch) => set(g, x + PX, y + OY, ch);
    const rect = (x, y, w, h, ch) => fillRect(g, x + PX, y + OY, w, h, ch);
    QWEN_SHAPE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') put(x, y, ch); }));
    shade(g);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ch = at(x, y);
      if (ch === 'o') {
        const seam = (at(x - 1, y) === 'W' && at(x + 1, y) === 'W') || (at(x, y - 1) === 'W' && at(x, y + 1) === 'W');
        if (seam) put(x, y, 'L');
      } else if (ch === 'W' && (at(x + 1, y) === 'o' || at(x, y + 1) === 'o')) put(x, y, 'L');
    }
    const hand = { o: 'o', h: 'h', s: 's' };
    const rub = o.rub || 0;
    if (rub > 0) {
      const wig = o.t ? Math.round(Math.sin(o.t * 30) * 1) : 0;
      stampBlock(g, 18 + PX + wig, 30 + OY, 6, 6, hand); stampBlock(g, 27 + PX - wig, 30 + OY, 6, 6, hand);
    } else {
      stampHand(g, 8 + PX, 30 + OY + (o.handL || 0), 6, -1, hand);
      stampHand(g, 42 + PX, 30 + OY + (o.handR || 0), 6, 1, hand);
    }
    for (const [i, x] of [[-1, 20], [1, 28]]) eye(g, x + PX, 20 + OY, 4, 6, o.eyes || 'open', i, o);
    if (o.blush !== false) { rect(19, 26, 2, 1, 'p'); rect(31, 26, 2, 1, 'p'); }
    mouth(g, 24 + PX, 27 + OY, 4, o.mouth || 'smile');
    if (o.spy) {
      if (o.glasses !== false) { rect(18, 21, 7, 4, 'G'); rect(27, 21, 7, 4, 'G'); rect(25, 22, 2, 1, 'G'); put(19, 21, 'j'); put(28, 21, 'j'); }
      if (o.hat !== false) {
        rect(8, -1, 30, 3, 'F'); rect(13, -9, 20, 8, 'F'); rect(13, -3, 20, 2, 'f'); rect(15, -9, 16, 1, 'j');
      }
    }
    if (o.goo) {
      const n = Math.round(o.goo * 14);
      for (let i = 0; i < n; i++) {
        const x = 6 + ((i * 17) % 42), y0 = 4 + ((i * 11) % 30), len = 2 + (i % 4);
        rect(x, y0, 3, len, i % 3 ? 'a' : 'A');
      }
    }
    finishFace(g, ['o', 'h', 's', 'W', 'L']);
    return finish(g, 'qwen', o, PX + 26, OY + 51);
  });
}

// ============================ DEEPSEEK ============================
// o: eyes, mouth, blush, handL/handR (dy), wet
export function deepseekSprite(o = {}) {
  return cached('deepseek', o, (o) => {
    const PX = 6, PY = 4;
    const rows = WHALE_SHAPE.length, cols = WHALE_SHAPE[0].length;
    const g = createGrid(cols + PX * 2, rows + PY * 2);
    const at = (x, y) => (WHALE_SHAPE[y] && WHALE_SHAPE[y][x]) || '.';
    const put = (x, y, ch) => set(g, x + PX, y + PY, ch);
    const rect = (x, y, w, h, ch) => fillRect(g, x + PX, y + PY, w, h, ch);
    WHALE_SHAPE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') put(x, y, 'o'); }));
    shade(g);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (at(x, y) === 'W') put(x, y, (at(x + 1, y) === 'o' || at(x, y + 1) === 'o') ? 'L' : 'W');
    // fins as hands
    const fin = { o: 'o', h: 'h', s: 's' };
    stampHand(g, 2 + PX, 27 + PY + (o.handL || 0), 6, -1, fin);
    stampHand(g, 33 + PX, 25 + PY + (o.handR || 0), 6, 1, fin);
    // face on the white belly
    for (const [i, x] of [[-1, 8], [1, 15]]) eye(g, x + PX, 19 + PY, 4, 6, o.eyes || 'open', i, o);
    if (o.blush !== false) { rect(6, 25, 3, 2, 'p'); rect(19, 25, 3, 2, 'p'); }
    mouth(g, 11 + PX, 26 + PY, 4, o.mouth || 'smile');
    if (o.wet) for (let i = 0; i < 5; i++) rect(4 + i * 7, 5 + (i % 2) * 3 + ((o.wet * 7 + i) % 3 | 0), 1, 2, 't');
    finishFace(g, ['W', 'L', 'o']);
    return finish(g, 'deepseek', o, PX + 20, PY + 37);
  });
}

// ============================ KIMI ============================
// o: eyes, mouth, blush, handL/handR (dy), bob
export function kimiSprite(o = {}) {
  return cached('kimi', o, (o) => {
    const PX = 6, PY = 8, W0 = 40, H0 = 46;
    const g = createGrid(W0 + PX * 2, H0 + PY * 2);
    const rect = (x, y, w, h, ch) => fillRect(g, x + PX, y + PY, w, h, ch);
    const put = (x, y, ch) => set(g, x + PX, y + PY, ch);
    // rounded tile (radius 7)
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      const r = 7, cx = x < r ? r : x > W0 - 1 - r ? W0 - 1 - r : x, cy = y < r ? r : y > H0 - 1 - r ? H0 - 1 - r : y;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 2) put(x, y, 'o');
    }
    shade(g);
    // grainy speckle at the bottom-right like the icon
    for (let y = 30; y < H0 - 2; y++) for (let x = 20; x < W0 - 2; x++) if (((x * 7 + y * 13) % 11 === 0) && get(g, x + PX, y + PY) === 'o') put(x, y, 'h');
    // K emblem
    KIMI_K.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') put(9 + x, 6 + y, (r[x + 1] !== '#' || (KIMI_K[y + 1] || '')[x] !== '#') ? 'L' : 'W'); }));
    // blue dot
    rect(28, 3, 5, 5, 'B'); rect(29, 2, 3, 1, 'B'); rect(29, 8, 3, 1, 'B'); rect(27, 4, 1, 3, 'B'); rect(33, 4, 1, 3, 'B');
    rect(29, 3, 2, 2, 'b'); rect(31, 6, 2, 2, 'D');
    // face (light eyes on the dark tile)
    for (const [i, x] of [[-1, 11], [1, 25]]) eye(g, x + PX, 26 + PY, 4, 6, o.eyes || 'open', i, o);
    if (o.blush !== false) { rect(7, 33, 3, 2, 'p'); rect(30, 33, 3, 2, 'p'); }
    mouth(g, 18 + PX, 34 + PY, 4, o.mouth || 'smile');
    // little hands
    const hand = { o: 'o', h: 'h', s: 's' };
    stampHand(g, 1 + PX, 30 + PY + (o.handL || 0), 6, -1, hand);
    stampHand(g, 33 + PX, 30 + PY + (o.handR || 0), 6, 1, hand);
    finishFace(g, ['o', 'h', 's']);
    return finish(g, 'kimi', o, PX + 20, PY + H0);
  });
}

// ============================ small versions ============================
// Half-size sprites for wide shots: downsample the finished sprite with a
// priority for eyes/outline, then re-outline so the silhouette stays crisp.
const PRIO = { O: 0.1, k: 3, w: 1.2, m: 2.5, p: 1.1, e: 2.5, '.': 0.9 };
export function small(sprite) {
  if (sprite.small) return sprite.small;
  // map (possibly multi-char) classes to single chars for the string-based downsampler
  const code = new Map(), back = new Map();
  const enc = (c) => {
    if (c === EMPTY || c === 'O') return '.';
    if (!code.has(c)) { const ch = String.fromCharCode(0xe000 + code.size); code.set(c, ch); back.set(ch, c); }
    return code.get(c);
  };
  const rows = sprite.g.map((r) => r.map(enc).join(''));
  const prio = {};
  for (const [c, ch] of code) prio[ch] = PRIO[c] || 1;
  prio['.'] = PRIO['.'];
  const hg = half(rows, prio).map((r) => [...r].map((ch) => (ch === '.' ? EMPTY : back.get(ch))));
  outline(hg, 'O');
  const col = { O: sprite.fb.get(...findClass(sprite.g, 'O')) };
  for (let y = 0; y < sprite.g.length; y++) for (let x = 0; x < sprite.g[0].length; x++) {
    const c = sprite.g[y][x];
    if (c !== EMPTY && col[c] === undefined) col[c] = sprite.fb.get(x, y);
  }
  sprite.small = { fb: toFB(hg, col), ax: Math.round(sprite.ax / 2), ay: Math.round(sprite.ay / 2), g: hg };
  return sprite.small;
}
function findClass(g, c) {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] === c) return [x, y];
  return [0, 0];
}

export const BUILD = { clawd: clawdSprite, codex: codexSprite, gemini: geminiSprite, qwen: qwenSprite, deepseek: deepseekSprite, kimi: kimiSprite };

// Draw a character sprite anchored at its feet (x, y).
// d: scale (0.5 | 1 | 2 | 3), flip, alpha, tint, tintK, dither, shadow (bool/width)
export function drawSprite(fb, spr, x, y, d = {}) {
  const sc = d.scale || 1;
  const s = sc === 0.5 ? small(spr) : spr;
  const k = sc === 0.5 ? 1 : sc;
  const ax = d.flip ? s.fb.w - 1 - s.ax : s.ax;
  if (d.shadow !== false && d.shadowY !== undefined) {
    const w = (d.shadowW || 30) * (sc === 0.5 ? 0.5 : sc);
    fb.ellipse(x, d.shadowY, w / 2, Math.max(1, w / 9), 0x000000, d.shadowA || 0.3);
  }
  fb.blit(s.fb, Math.round(x - ax * k), Math.round(y - s.ay * k), { sx: k, sy: k, flip: d.flip, alpha: d.alpha, tint: d.tint, tintK: d.tintK, dither: d.dither, solid: d.solid });
}

export function char(fb, name, x, y, o = {}, d = {}) {
  const spr = BUILD[name](o);
  drawSprite(fb, spr, x, y, d);
  return spr;
}
