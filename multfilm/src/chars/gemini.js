// Gemini — the four-point sparkle with rounded tips and Google's four colours
// (blue right, red top, yellow left, green bottom). The side points double as arms.
import { scratch, outlined } from '../engine/fb.js';
import { clamp, mix, desat, smooth, qd } from '../engine/core.js';

export const GEM = {
  blue: 0x4285f4, red: 0xea4335, yellow: 0xfbbc04, green: 0x34a853,
  eye: 0x161a36, line: 0x1c2046, blush: 0xff9ab4, grey: 0x7d869c, dim: 0x4a5266, white: 0xffffff,
};

const ss = (a, b, x) => smooth(clamp((x - a) / (b - a)));

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

// (x, y) = centre. Options: size, rot, sat (0 grey..1 colour), pts, armL/armR (+up), top, bottom, droop,
// squash, eyes, look, lookY, mouth, blush, tear, alpha, flip, bright
export function gemini(fb, x, y, o = {}) {
  const S = Math.round(o.size || 30);
  const pad = 3;
  const N = S + pad * 2;
  const s = scratch(N, N, 'gem');
  const c0 = N / 2, R = S / 2;
  const droop = o.droop || 0;
  const armR = (o.armR || 0) - droop * 0.6, armL = (o.armL || 0) - droop * 0.6;
  const top = (o.top || 0) + droop * 0.2, bottom = o.bottom || 0;
  const rot = o.rot || 0, cs = Math.cos(-rot), sn = Math.sin(-rot);
  const sq = o.squash || 0, kx = 1 + sq * 0.3, ky = 1 - sq * 0.3;
  const shrink = 1 - droop * 0.08;
  const sat = o.sat === undefined ? 1 : o.sat;
  const mask = new Uint8Array(N * N);
  const cols = new Int32Array(N * N);

  for (let py = 0; py < N; py++)
    for (let px = 0; px < N; px++) {
      let dx = (px + 0.5 - c0) / (R * kx * shrink), dy = (py + 0.5 - c0) / (R * ky * shrink);
      // rotate into body space
      let bx = dx * cs - dy * sn, by = dx * sn + dy * cs;
      // limb bends: rotate outer parts of each point around the centre (inverse map)
      const r = Math.hypot(bx, by);
      const f = ss(0.12, 1.0, r);
      let ang = 0;
      const side = 1 - ss(0.2, 0.6, Math.abs(by) - Math.abs(bx) + 0.3);
      ang += armR * 0.55 * f * ss(0.0, 0.35, bx) * side;
      ang -= armL * 0.55 * f * ss(0.0, 0.35, -bx) * side;
      ang -= top * 0.5 * f * ss(0.0, 0.35, -by);
      ang -= bottom * 0.5 * f * ss(0.0, 0.35, by);
      if (ang !== 0) {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const nx = bx * ca - by * sa, ny = bx * sa + by * ca;
        bx = nx; by = ny;
      }
      if (!starIn(bx, by)) continue;
      const i = py * N + px;
      mask[i] = 1;
      let c = starColor(Math.atan2(-by, bx), Math.hypot(bx, by), o, px, py);
      if (sat < 1) c = mix(mix(GEM.grey, desat(c, 0.85), 0.35), c, sat);
      if (o.bright) c = mix(c, 0xffffff, clamp(o.bright));
      cols[i] = c;
    }
  // edge light / shade
  for (let py = 0; py < N; py++)
    for (let px = 0; px < N; px++) {
      const i = py * N + px;
      if (!mask[i]) continue;
      let c = cols[i];
      const ul = px > 0 && py > 0 ? mask[i - N - 1] : 0;
      const dr = px < N - 1 && py < N - 1 ? mask[i + N + 1] : 0;
      if (!ul) c = mix(c, 0xffffff, 0.35);
      else if (!dr) c = mix(c, 0x000000, 0.22);
      s.set(px, py, c);
    }

  // face (upright regardless of rotation)
  const E = GEM.eye;
  const big = S >= 40, mid = S >= 22;
  const look = Math.round((o.look || 0) * (big ? 2 : 1)), lookY = Math.round((o.lookY || 0) * (big ? 2 : 1));
  const esp = Math.max(2, Math.round(S * 0.11));
  const ecx = Math.round(c0) + look, ecy = Math.round(c0 - S * 0.04) + lookY;
  const ew = big ? 2 : 1, eh = big ? Math.round(S * 0.09) : mid ? 3 : 2;
  const eyes = o.eyes || 'normal';
  for (const side of [-1, 1]) {
    const exx = ecx + side * esp - (side < 0 ? ew : 0);
    switch (eyes) {
      case 'closed':
        s.rect(exx - (big ? 1 : 0), ecy + eh - 1, ew + (big ? 2 : 1), 1, E); break;
      case 'happy':
        s.rect(exx, ecy, ew, 1, E); s.set(exx - 1, ecy + 1, E); s.set(exx + ew, ecy + 1, E);
        if (big) { s.set(exx - 1, ecy + 2, E); s.set(exx + ew, ecy + 2, E); }
        break;
      case 'sad':
        s.rect(exx, ecy + 1, ew, eh - 1, E);
        s.set(side < 0 ? exx - 1 : exx + ew, ecy - 1, E);
        if (big) s.set(side < 0 ? exx - 2 : exx + ew + 1, ecy - 2, E);
        break;
      case 'wide':
        s.rect(exx - 1, ecy - 1, ew + 2, eh + 2, 0xffffff); s.rect(exx, ecy, ew, eh, E); break;
      case 'determined':
        s.rect(exx, ecy + 1, ew, eh - 1, E); s.rect(side < 0 ? exx - 1 : exx, ecy - 1, ew + 1, 1, E); break;
      default:
        s.rect(exx, ecy, ew, eh, E);
        if (big) s.set(exx, ecy, 0xffffff);
    }
  }
  const my = ecy + eh + (big ? 3 : 2), mx = ecx;
  const m = o.mouth === undefined ? 'smile' : o.mouth;
  if (m === 'smile') { s.rect(mx - 1, my, 2 + (big ? 1 : 0), 1, E); if (big) { s.set(mx - 2, my - 1, E); s.set(mx + 2, my - 1, E); } }
  else if (m === 'grin') { s.rect(mx - 2, my - 1, 5, 2, E); s.rect(mx - 1, my, 3, 1, 0xe25563); }
  else if (m === 'open') { s.rect(mx - 1, my - 1, 3, big ? 3 : 2, E); }
  else if (m === 'frown') { s.rect(mx - 1, my, 3, 1, E); s.set(mx - 2, my + 1, E); s.set(mx + 2, my + 1, E); }
  else if (m === 'flat') s.rect(mx - 1, my, 3, 1, E);
  else if (m === 'wobble') { s.set(mx - 2, my, E); s.set(mx - 1, my - 1, E); s.set(mx, my, E); s.set(mx + 1, my - 1, E); s.set(mx + 2, my, E); }
  if (o.blush) { s.rect(ecx - esp - ew - 2, ecy + eh, 2, 1, GEM.blush); s.rect(ecx + esp + 1, ecy + eh, 2, 1, GEM.blush); }
  if (o.tear) {
    const ty = ecy + eh + Math.floor((o.tear * 8) % 6);
    s.set(ecx - esp - 1, ty, 0x9fd8ff); if (big) s.set(ecx - esp - 1, ty + 1, 0x9fd8ff);
  }

  const spr = o.outline === false ? s : outlined(s, o.line === undefined ? GEM.line : o.line);
  const off = o.outline === false ? 0 : 1;
  fb.blit(spr, Math.round(x - c0 - off), Math.round(y - c0 - off), { alpha: o.alpha, flip: o.flip, tint: o.tint, tintK: o.tintK, dither: o.dither });
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
