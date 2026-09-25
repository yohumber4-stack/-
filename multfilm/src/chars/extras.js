// Supporting cast: DeepSeek (blue whale), Kimi (crescent moon), and small helpers.
import { scratch, outlined } from '../engine/fb.js';
import { hash } from '../engine/core.js';

export const WHALE = { base: 0x4d6bfe, hi: 0x7f96ff, sh: 0x3450d6, belly: 0xc9d6ff, groove: 0x93a8f6, eye: 0x101838, line: 0x16215c };

// DeepSeek whale, side view facing left (flip for right). (x, y) = bottom centre.
// Options: u, eyes ('normal'|'smug'|'laugh'|'shock'|'closed'), mouth ('smile'|'laugh'|'o'|'frown'), t, flip, wet, alpha
export function whale(fb, x, y, o = {}) {
  const u = o.u || 1, P = WHALE;
  const s = scratch(44 * u, 32 * u, 'whale');
  const ox = 3 * u, oy = 6 * u;
  const t = o.t || 0;
  for (let py = 0; py < 20 * u; py++)
    for (let px = 0; px < 30 * u; px++) {
      const dx = (px + 0.5 - 14 * u) / (14 * u), dy = (py + 0.5 - 10 * u) / (9 * u);
      if (dx * dx + dy * dy > 1) continue;
      let c = P.base;
      if (dy > 0.25 && dx < 0.55) c = Math.floor(py / (2 * u)) % 2 === 0 ? P.belly : P.groove;
      else if (dy < -0.55 && dx < 0.3) c = P.hi;
      else if (dx > 0.55 || dy > 0.7) c = P.sh;
      s.set(ox + px, oy + py, c);
    }
  const wag = Math.sin(t * 3) * 1.5 * u;
  s.poly([ox + 26 * u, oy + 8 * u, ox + 33 * u, oy + 1 * u + wag, ox + 36 * u, oy + 3 * u + wag, ox + 30 * u, oy + 12 * u], P.base);
  s.poly([ox + 31 * u, oy + 2 * u + wag, ox + 38 * u, oy - 2 * u + wag, ox + 36 * u, oy + 4 * u + wag], P.sh);
  s.poly([ox + 12 * u, oy + 15 * u, ox + 18 * u, oy + 15 * u, ox + 20 * u, oy + 20 * u], P.sh);
  const ex = ox + 7 * u, ey = oy + 8 * u, eyes = o.eyes || 'normal';
  if (eyes === 'smug') { s.rect(ex, ey + u, 3 * u, u, P.eye); s.rect(ex - u, ey, 4 * u, u, P.sh); }
  else if (eyes === 'laugh' || eyes === 'closed') {
    s.rect(ex, ey, 3 * u, u, P.eye); s.rect(ex - u, ey + u, u, u, P.eye); s.rect(ex + 3 * u, ey + u, u, u, P.eye);
  } else if (eyes === 'shock') { s.circle(ex + u, ey + u, 2 * u, 0xffffff); s.rect(ex + u, ey + u, u, u, P.eye); }
  else { s.rect(ex, ey, 2 * u, 2 * u, P.eye); s.rect(ex, ey, u, u, 0xffffff); }
  const mo = o.mouth || 'smile', mx = ox + 2 * u, my = oy + 12 * u;
  if (mo === 'laugh') {
    s.poly([mx, my, mx + 9 * u, my + u, mx + 7 * u, my + 4 * u, mx + 2 * u, my + 3 * u], P.eye);
    s.rect(mx + 3 * u, my + 2 * u, 3 * u, u, 0xe0606a);
  } else if (mo === 'o') s.circle(mx + 3 * u, my + u, 1.2 * u, P.eye);
  else if (mo === 'frown') s.line(mx + u, my + 2 * u, mx + 6 * u, my + u, P.eye);
  else { s.line(mx, my, mx + 4 * u, my + u, P.eye); s.line(mx + 4 * u, my + u, mx + 8 * u, my, P.eye); }
  if (o.wet) for (let i = 0; i < 4; i++) s.rect(ox + (6 + i * 5) * u, oy + (3 + (i % 2) * 2) * u + (Math.floor(t * 8 + i) % 3) * u, u, u * 2, 0xbfe6ff);
  const spr = outlined(s, P.line);
  fb.blit(spr, x - (ox + 16 * u + 1), y - (oy + 20 * u + 2), { flip: o.flip, alpha: o.alpha, dither: o.dither, tint: o.tint, tintK: o.tintK });
}

// Water spout from a blowhole at (x, y); dir tilts it (radians)
export function spout(fb, t, x, y, o = {}) {
  const n = o.n || 26, h = o.h || 26, col = o.color || 0xbfe6ff, dir = o.dir || 0;
  for (let i = 0; i < n; i++) {
    const ph = (t * (o.rate || 1.6) + hash(i * 7)) % 1;
    const a = -Math.PI / 2 + dir + (hash(i * 3 + 1) - 0.5) * (o.spread || 0.9);
    const v = h * 2.2;
    const px = x + Math.cos(a) * v * ph;
    const py = y + Math.sin(a) * v * ph + v * ph * ph;
    fb.set(px, py, col);
    if (i % 3 === 0) fb.set(px, py + 1, 0xffffff);
  }
}

export const MOON = { base: 0xf3e3a0, hi: 0xfff6d2, sh: 0xd6c077, dk: 0xb09b58, eye: 0x2c2630, line: 0x5a4a28 };

// Kimi (Moonshot) — a smug crescent moon. (x, y) = bottom centre.
export function moon(fb, x, y, o = {}) {
  const u = o.u || 1, P = MOON;
  const s = scratch(34 * u, 36 * u, 'moon');
  const ox = 4 * u, oy = 4 * u;
  const R = 13 * u, cx = ox + 13 * u, cy = oy + 13 * u, ix = cx + 7 * u, iy = cy - 4 * u, r2 = 11 * u;
  for (let py = 0; py < 28 * u; py++)
    for (let px = 0; px < 28 * u; px++) {
      const X = ox + px, Y = oy + py;
      const d1 = (X + 0.5 - cx) ** 2 + (Y + 0.5 - cy) ** 2, d2 = (X + 0.5 - ix) ** 2 + (Y + 0.5 - iy) ** 2;
      if (d1 > R * R || d2 < r2 * r2) continue;
      let c = P.base;
      if (d2 < (r2 + 1.6 * u) ** 2) c = P.hi;
      else if (d1 > (R - 1.6 * u) ** 2 && Y > cy - 2 * u) c = P.sh;
      if (hash(Math.floor(px / (2 * u)) * 31 + Math.floor(py / (2 * u)) * 17) > 0.93) c = P.dk;
      s.set(X, Y, c);
    }
  const eyes = o.eyes || 'smug';
  const ex = ox + 10 * u, ey = oy + 11 * u;
  if (eyes === 'laugh') { s.rect(ex, ey, 3 * u, u, P.eye); s.rect(ex - u, ey + u, u, u, P.eye); s.rect(ex + 3 * u, ey + u, u, u, P.eye); }
  else if (eyes === 'shock') { s.circle(ex + u, ey, 2 * u, 0xffffff); s.rect(ex + u, ey, u, u, P.eye); }
  else if (eyes === 'smug') { s.rect(ex, ey + u, 3 * u, u, P.eye); s.rect(ex - u, ey, 4 * u, u, P.sh); }
  else s.rect(ex, ey, 2 * u, 2 * u, P.eye);
  const mo = o.mouth || 'smirk', mx = ox + 11 * u, my = oy + 17 * u;
  if (mo === 'laugh') { s.rect(mx, my, 5 * u, 3 * u, P.eye); s.rect(mx + u, my + 2 * u, 3 * u, u, 0xe0606a); }
  else if (mo === 'o') s.circle(mx + 2 * u, my + u, 1.2 * u, P.eye);
  else { s.line(mx, my + u, mx + 4 * u, my, P.eye); s.set(mx + 5 * u, my - u, P.eye); }
  const t = o.t || 0, wave = o.arms === 'laugh' ? Math.round(Math.sin(t * 20)) * u : 0;
  s.rect(ox + 1 * u, oy + 16 * u + wave, 3 * u, 2 * u, P.base);
  s.rect(ox + 16 * u, oy + 22 * u - wave, 3 * u, 2 * u, P.base);
  const spr = outlined(s, P.line);
  fb.blit(spr, x - (ox + 13 * u + 1), y - (oy + 26 * u + 2), { flip: o.flip, alpha: o.alpha, dither: o.dither, tint: o.tint, tintK: o.tintK });
}

// Drop shadow ellipse under a character
export function shadow(fb, x, y, w, a = 0.35) {
  fb.ellipse(x, y, w / 2, Math.max(1, w / 8), 0x000000, a);
}
