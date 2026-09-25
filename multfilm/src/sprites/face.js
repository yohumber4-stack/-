// Expressions in the reference style: solid dark eyes with white highlights,
// pink blush, tiny mouth. Variants are drawn relative to the default eye box.
import { fillRect, set } from './grid.js';

// Default "open" eye exactly as in the reference for each eye size.
function openEye(g, x, y, w, h) {
  fillRect(g, x, y, w, h, 'k');
  if (w >= 6) { fillRect(g, x + 1, y + 1, 2, 2, 'w'); set(g, x + 4, y + 5, 'w'); }
  else if (w >= 4) { fillRect(g, x, y, 2, 2, 'w'); set(g, x + 3, y + 4, 'w'); }
  else { set(g, x, y, 'w'); }
}

// side: -1 left eye, +1 right eye (as seen by the viewer)
export function eye(g, x, y, w, h, v = 'open', side = -1, o = {}) {
  const lx = o.lookX || 0, ly = o.lookY || 0;
  x += lx; y += ly;
  const big = w >= 6;
  switch (v) {
    case 'blink':
      fillRect(g, x, y + h - (big ? 3 : 2), w, big ? 2 : 1, 'k');
      if (big) { set(g, x - 1, y + h - 4, 'k'); set(g, x + w, y + h - 4, 'k'); }
      break;
    case 'closed': // sleeping / content: "u"
      set(g, x, y + h - 4, 'k'); set(g, x + w - 1, y + h - 4, 'k');
      fillRect(g, x + 1, y + h - 3, w - 2, 1, 'k');
      if (big) { set(g, x, y + h - 5, 'k'); set(g, x + w - 1, y + h - 5, 'k'); fillRect(g, x + 1, y + h - 4, 1, 1, 'k'); fillRect(g, x + w - 2, y + h - 4, 1, 1, 'k'); }
      break;
    case 'happy': { // "^" arch
      const t = y + Math.floor(h / 2) - (big ? 2 : 1);
      fillRect(g, x + 1, t, w - 2, 1, 'k');
      fillRect(g, x, t + 1, 1, big ? 3 : 2, 'k'); fillRect(g, x + w - 1, t + 1, 1, big ? 3 : 2, 'k');
      if (big) { fillRect(g, x + 1, t + 1, 1, 1, 'k'); fillRect(g, x + w - 2, t + 1, 1, 1, 'k'); fillRect(g, x + 2, t - 1 + 0, w - 4, 1, 'k'); }
      break;
    }
    case 'sad': {
      fillRect(g, x, y + 1, w, h - 1, 'k');
      const outer = side < 0 ? x : x + w - 1, dir = side < 0 ? 1 : -1;
      for (let i = 0; i < Math.ceil(w / 2) + (big ? 1 : 0); i++) set(g, outer + dir * i, y + 1, EMPTY_BODY);
      set(g, outer, y + 2, EMPTY_BODY);
      if (big) set(g, outer + dir, y + 2, EMPTY_BODY);
      if (big) { fillRect(g, x + (side < 0 ? 2 : 1), y + 3, 2, 2, 'w'); set(g, x + (side < 0 ? 4 : 1), y + h - 2, 'w'); }
      else { set(g, x + (side < 0 ? 2 : 1), y + 2, 'w'); set(g, x + (side < 0 ? 1 : 2), y + h - 1, 'w'); }
      break;
    }
    case 'teary':
      openEye(g, x, y, w, h);
      fillRect(g, x, y + h - 1, w, 1, 't');
      if (big) fillRect(g, x + 1, y + 1, 3, 3, 'w');
      break;
    case 'angry':
    case 'determined': {
      fillRect(g, x, y + 1, w, h - 1, 'k');
      const inner = side < 0 ? x + w - 1 : x, dir = side < 0 ? -1 : 1;
      for (let i = 0; i < Math.ceil(w / 2); i++) set(g, inner + dir * i, y + 1, EMPTY_BODY);
      set(g, inner, y + 2, EMPTY_BODY);
      // brow line above
      for (let i = 0; i < w; i++) set(g, x + (side < 0 ? i : w - 1 - i), y - 1 + Math.floor((i * 2) / w), 'k');
      if (big) { fillRect(g, x + 1, y + 3, 2, 2, 'w'); } else set(g, x + (side < 0 ? 0 : 1), y + 3, 'w');
      break;
    }
    case 'wide': {
      fillRect(g, x - 1, y - 1, w + 2, h + 2, 'k');
      fillRect(g, x, y, big ? 3 : 2, big ? 3 : 2, 'w');
      set(g, x + w - 1, y + h - 1, 'w'); if (big) set(g, x + w - 2, y + h - 1, 'w');
      break;
    }
    case 'shock': { // tiny pupils in white
      fillRect(g, x - 1, y - 1, w + 2, h + 2, 'k');
      fillRect(g, x, y, w, h, 'w');
      fillRect(g, x + Math.floor(w / 2) - 1, y + Math.floor(h / 2) - 1, 2, 2, 'k');
      break;
    }
    case 'shifty': // suspicious half-lids
      fillRect(g, x, y + Math.floor(h / 2), w, Math.ceil(h / 2), 'k');
      fillRect(g, x - 1, y + Math.floor(h / 2) - 1, w + 2, 1, 'k');
      set(g, x + (side * (o.glance || 1) > 0 ? w - 1 : 0), y + Math.floor(h / 2) + 1, 'w');
      break;
    case 'star': {
      fillRect(g, x, y, w, h, 'k');
      const cx = x + Math.floor(w / 2) - (big ? 1 : 0), cy = y + Math.floor(h / 2) - 1;
      set(g, cx, cy - 1, 'w'); set(g, cx - 1, cy, 'w'); set(g, cx, cy, 'w'); set(g, cx + 1, cy, 'w'); set(g, cx, cy + 1, 'w');
      if (big) { set(g, cx, cy - 2, 'w'); set(g, cx, cy + 2, 'w'); set(g, cx - 2, cy, 'w'); set(g, cx + 2, cy, 'w'); }
      break;
    }
    case 'dizzy': {
      const s = Math.min(w, h);
      for (let i = 0; i < s; i++) { set(g, x + i, y + i + (h - s) / 2, 'k'); set(g, x + s - 1 - i, y + i + (h - s) / 2, 'k'); }
      break;
    }
    case 'dot':
      fillRect(g, x + Math.floor(w / 2) - 1, y + Math.floor(h / 2), 2, 2, 'k');
      break;
    case 'heart': {
      const H = big ? ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'] : ['#.#', '###', '.#.'];
      const ox = x + Math.floor((w - H[0].length) / 2), oy = y + Math.floor((h - H.length) / 2);
      H.forEach((r, yy) => [...r].forEach((c, xx) => { if (c === '#') set(g, ox + xx, oy + yy, 'q'); }));
      break;
    }
    default:
      openEye(g, x, y, w, h);
  }
}
// Marker for "erase back to body tone" used by eye cut-outs; resolved by finishFace.
export const EMPTY_BODY = '_';

// Mouth with its left corner at (x0, y0), total width w (4 or 6).
export function mouth(g, x0, y0, w, v = 'smile') {
  switch (v) {
    case 'none': break;
    case 'open':
      fillRect(g, x0 + 1, y0, w - 2, 2, 'm');
      fillRect(g, x0 + 2, y0 + 2, w - 4, 1, 'm');
      fillRect(g, x0 + Math.floor(w / 2) - 1, y0 + 1, 2, 1, 'q');
      break;
    case 'laugh':
      fillRect(g, x0, y0, w, 1, 'm');
      fillRect(g, x0, y0 + 1, w, 2, 'm');
      fillRect(g, x0 + 1, y0 + 3, w - 2, 1, 'm');
      fillRect(g, x0 + 1, y0 + 2, w - 2, 1, 'q');
      break;
    case 'scream':
      fillRect(g, x0 + 1, y0 - 1, w - 2, 1, 'm');
      fillRect(g, x0, y0, w, 4, 'm');
      fillRect(g, x0 + 1, y0 + 4, w - 2, 1, 'm');
      fillRect(g, x0 + 1, y0 + 3, w - 2, 1, 'q');
      break;
    case 'o':
      fillRect(g, x0 + Math.floor(w / 2) - 1, y0, 2, 2, 'm');
      break;
    case 'bigo':
      fillRect(g, x0 + Math.floor(w / 2) - 2, y0, 4, 3, 'm');
      break;
    case 'flat':
      fillRect(g, x0 + 1, y0 + 1, w - 2, 1, 'm');
      break;
    case 'frown':
      fillRect(g, x0 + 1, y0, w - 2, 1, 'm');
      set(g, x0, y0 + 1, 'm'); set(g, x0 + w - 1, y0 + 1, 'm');
      break;
    case 'wobble':
      for (let i = 0; i < w; i++) set(g, x0 + i, y0 + (i % 2), 'm');
      break;
    case 'smirk':
      fillRect(g, x0 + 1, y0 + 1, w - 2, 1, 'm');
      set(g, x0 + w - 1, y0, 'm');
      break;
    case 'cat':
      set(g, x0, y0, 'm'); set(g, x0 + w - 1, y0, 'm');
      for (let i = 1; i < w - 1; i++) set(g, x0 + i, y0 + (i === Math.floor(w / 2) - (w > 4 ? 0 : 0) || i === Math.ceil(w / 2) - 1 ? 0 : 1), 'm');
      break;
    case 'grin':
      fillRect(g, x0, y0, w, 2, 'm');
      fillRect(g, x0 + 1, y0, w - 2, 1, 'w');
      set(g, x0 - 1, y0 - 1, 'm'); set(g, x0 + w, y0 - 1, 'm');
      break;
    default: // smile (reference)
      set(g, x0, y0, 'm'); set(g, x0 + w - 1, y0, 'm');
      fillRect(g, x0 + 1, y0 + 1, w - 2, 1, 'm');
  }
}

// Resolve '_' cut-outs back to the body tone found around them.
export function finishFace(g, bodyTones) {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (g[y][x] !== EMPTY_BODY) continue;
    let found = null;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [0, -2]]) {
      const c = (g[y + dy] || [])[x + dx];
      if (c && bodyTones.includes(c)) { found = c; break; }
    }
    g[y][x] = found || bodyTones[0];
  }
}
