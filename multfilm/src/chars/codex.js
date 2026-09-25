// Codex — a soft cloud with a terminal screen for a face (">_" with a blinking
// cursor) and floating hands. Faces are short strings in the 3x5 micro font.
import { scratch, outlined } from '../engine/fb.js';
import { text, textWidth } from '../engine/font.js';

export const CODEX = {
  hi: 0xffffff, base: 0xeceefa, sh: 0xc3c8e6, dk: 0x959cc7, line: 0x262a44,
  screen: 0x151726, screenHi: 0x2b3050, glyph: 0x9cffd0, blush: 0xffa3b8,
};

// cloud body: union of circles in unit space (26 x 21)
const BLOBS = [
  [13, 13.5, 11.5, 7.8], // main ellipse cx, cy, rx, ry
  [7.2, 9.2, 5.2, 5.2],
  [13.5, 6.6, 6.4, 6.2],
  [19.6, 9.6, 4.8, 4.8],
];
function inCloud(x, y) {
  for (const [cx, cy, rx, ry] of BLOBS) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

// (x, y) = bottom centre of the body (it floats; draw its shadow separately).
// Options: u, face (string), t (time, for cursor blink), hands: {l:[dx,dy], r:[dx,dy]} in unit space,
// tilt (-1..1 lean), squash, flip, alpha, blush, glyph colour, pet (bool)
export function codex(fb, x, y, o = {}) {
  const u = o.u || 1;
  const P = CODEX;
  const Wd = Math.round(34 * u), Hd = Math.round(28 * u);
  const s = scratch(Wd, Hd, 'codex');
  const ox = Math.round(4 * u), oy = Math.round(4 * u);
  const tilt = o.tilt || 0;
  // body with shading
  for (let py = 0; py < Math.round(22 * u); py++)
    for (let px = 0; px < Math.round(26 * u); px++) {
      const ux = (px + 0.5) / u - tilt * ((py + 0.5) / u - 21) * 0.12, uy = (py + 0.5) / u;
      if (!inCloud(ux, uy) || uy > 21.2) continue;
      let c = P.base;
      const up = inCloud(ux - 0.9, uy - 1.2), dn = inCloud(ux + 0.6, uy + 1.4);
      if (!up) c = P.hi;
      else if (!dn || uy > 19.5) c = P.sh;
      if (uy > 20.3) c = P.dk;
      s.set(ox + px, oy + py, c);
    }
  // screen face
  const sx = ox + Math.round((6.5 + tilt * 0.8) * u), sy = oy + Math.round(9 * u), sw = Math.round(13 * u), sh = Math.round(8 * u);
  const gs = Math.max(1, Math.floor(u + 0.5));
  s.rect(sx + 1, sy, sw - 2, sh, P.screen);
  s.rect(sx, sy + 1, sw, sh - 2, P.screen);
  s.rect(sx + 2, sy + 1, sw - 5, 1, P.screenHi);
  let face = o.face === undefined ? '>_' : o.face;
  const t = o.t || 0;
  if (face.endsWith('_') && face.length <= 3 && Math.floor(t * 2) % 2 === 1) face = face.slice(0, -1) + ' ';
  const gcol = o.glyph || P.glyph;
  if (face === 'code') {
    // scrolling code lines
    for (let i = 0; i < 3; i++) {
      const w = 3 + ((i * 5 + Math.floor(t * 6)) % 7);
      s.rect(sx + Math.round(2 * u), sy + Math.round((1 + i * 2) * u), Math.min(sw - Math.round(4 * u), Math.round(w * u)), Math.max(1, Math.round(u)), i === 1 ? 0xffd479 : gcol);
    }
  } else if (face.startsWith('bar:')) {
    const p = Math.max(0, Math.min(1, parseFloat(face.slice(4))));
    const bx = sx + Math.round(2 * u), bw = sw - Math.round(4 * u);
    s.rect(bx, sy + Math.round(3 * u), bw, Math.round(2 * u), 0x2a3350);
    s.rect(bx, sy + Math.round(3 * u), Math.round(bw * p), Math.round(2 * u), gcol);
  } else {
    const tw = textWidth(face, 'small') * gs;
    text(s, face, sx + Math.round((sw - tw) / 2), sy + Math.round((sh - 5 * gs) / 2), gcol, { font: 'small', scale: gs });
  }
  if (o.blush) { const b = Math.max(1, Math.round(u)); s.rect(sx - 2 * b, sy + sh - 2 * b, 2 * b, b, P.blush); s.rect(sx + sw, sy + sh - 2 * b, 2 * b, b, P.blush); }

  // hands (floating circles)
  const hands = o.hands || {};
  const hl = hands.l || [0, 18.5], hr = hands.r || [26, 18.5];
  for (const [hx, hy] of [hl, hr]) {
    const cx = Math.round(ox + hx * u), cy = Math.round(oy + hy * u), r = 2.2 * u;
    s.circle(cx, cy, r, P.base);
    s.set(cx - Math.round(r * 0.5), cy - Math.round(r * 0.5), P.hi);
    s.rect(cx - Math.round(r * 0.4), cy + Math.round(r * 0.6), Math.max(1, Math.round(r * 0.8)), 1, P.sh);
  }

  const spr = o.outline === false ? s : outlined(s, P.line);
  const pad = o.outline === false ? 0 : 1;
  const sq = o.squash || 0, kx = 1 + sq * 0.3, ky = 1 - sq * 0.3;
  const bottom = (oy + Math.round(21 * u) + pad + 1) * ky;
  const cx = (ox + Math.round(13 * u) + pad) * kx;
  fb.blit(spr, x - cx, y - bottom, { sx: kx, sy: ky, flip: o.flip, alpha: o.alpha, dither: o.dither, tint: o.tint, tintK: o.tintK });
  if (o.pet) codexPet(fb, x + (o.flip ? -20 : 20) * u, y - 22 * u + Math.sin(t * 3) * 2, t, u);
}

// Tiny pixel cat that follows Codex around (Codex "pets")
const PET = [
  ['.#...#.', '.##.##.', '#######', '#.#.#.#', '#######', '.#####.', '.#...#.'],
  ['.#...#.', '.##.##.', '#######', '#######', '#######', '.#####.', '..#.#..'],
];
export function codexPet(fb, x, y, t, u = 1) {
  const f = PET[Math.floor(t * 3) % 2];
  const s = scratch(7, 7, 'pet');
  for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 7; xx++) if (f[yy][xx] === '#') s.set(xx, yy, yy === 3 && (xx === 2 || xx === 4) && f === PET[0] ? 0x1b1b2a : 0xffc46b);
  if (f === PET[1]) { s.set(2, 3, 0x1b1b2a); s.set(4, 3, 0x1b1b2a); }
  fb.blit(outlined(s, 0x3a2a1a), x - 4 * u, y - 4 * u, { sx: u, sy: u });
}
