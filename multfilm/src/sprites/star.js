// Gemini's four-point star shape and colours, used for lanterns, icons and sky slots.
import { clamp, mix, qd } from '../engine/core.js';

export const GEM = {
  blue: 0x4285f4, red: 0xea4335, yellow: 0xfbbc04, green: 0x34a853,
  eye: 0x161a36, line: 0x1c2046, blush: 0xff9ab4, grey: 0x7d869c, dim: 0x4a5266, white: 0xffffff,
};

// Star = union of two tapered arms with concave sides and round tips.
const W0 = 0.58, K = 1.7, TW = 0.075, CAP = 1 - TW;
function armW(d) {
  if (d > 1) return -1;
  if (d <= CAP) return (W0 - TW) * Math.pow((CAP - d) / CAP, K) + TW;
  const e = d - CAP;
  return Math.sqrt(Math.max(0, TW * TW - e * e));
}
export function starIn(x, y) {
  const ax = Math.abs(x), ay = Math.abs(y);
  return ay <= armW(ax) || ax <= armW(ay);
}

// colour at angle (radians, 0 = right, CCW positive) with per-point intensities [top, right, bottom, left]
function starColor(ang, r, o, px, py) {
  const A = [GEM.blue, GEM.red, GEM.yellow, GEM.green];
  const idx = [1, 0, 3, 2]; // map anchor -> pts index (pts: top,right,bottom,left)
  let a = ang / (Math.PI / 2); // 0..4 around: right, top, left, bottom
  if (a < 0) a += 4;
  const i = Math.floor(a) % 4;
  const f = clamp((a - Math.floor(a) - 0.32) / 0.36);
  const j = (i + 1) % 4;
  const pts = o.pts;
  const lit = (k) => (pts ? clamp(pts[idx[k]]) : 1);
  const colA = mix(GEM.dim, A[i], lit(i)), colB = mix(GEM.dim, A[j], lit(j));
  let c = mix(colA, colB, qd(f, 3, px, py));
  if (r < 0.3) c = mix(c, 0xffffff, qd((0.3 - r) * 1.6, 4, px, py) * 0.45 * (o.core === undefined ? 1 : o.core));
  return c;
}

// Plain star shape (no face) for lanterns, icons, iris and sky holes
export function starShape(fb, x, y, size, colorFn, o = {}) {
  const R = size / 2, N = Math.ceil(size) + 2;
  const rot = o.rot || 0, cs = Math.cos(-rot), sn = Math.sin(-rot);
  for (let py = 0; py < N; py++)
    for (let px = 0; px < N; px++) {
      const dx = (px + 0.5 - N / 2) / R, dy = (py + 0.5 - N / 2) / R;
      const bx = dx * cs - dy * sn, by = dx * sn + dy * cs;
      if (starIn(bx, by)) {
        const gx = Math.round(x - N / 2 + px), gy = Math.round(y - N / 2 + py);
        const c = colorFn(Math.atan2(-by, bx), Math.hypot(bx, by), gx, gy);
        if (c !== null && c !== undefined) fb.set(gx, gy, c);
      }
    }
}

export function gemColorAt(ang, r, px, py, o = {}) { return starColor(ang, r, o, px, py); }
