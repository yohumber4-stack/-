// Lighting, atmosphere, particles and transitions.
import { W, H, clamp, bayer, hash, lerp, fract, TAU, noise1 } from './core.js';
import { FB } from './fb.js';

// Multiplicative light map: albedo * (ambient + sum of lights), quantised with dither.
export class LightMap {
  constructor(w = W, h = H) {
    this.w = w; this.h = h;
    this.r = new Float32Array(w * h); this.g = new Float32Array(w * h); this.b = new Float32Array(w * h);
  }
  reset(ar, ag, ab) { this.r.fill(ar); this.g.fill(ag); this.b.fill(ab); return this; }
  // soft radial light; c = 0xRRGGBB, k = intensity; sq = vertical squash (ellipse)
  light(x, y, rad, c, k = 1, sq = 1) {
    const R = ((c >> 16) & 255) / 255 * k, G = ((c >> 8) & 255) / 255 * k, B = (c & 255) / 255 * k;
    const x0 = Math.max(0, Math.floor(x - rad)), x1 = Math.min(this.w - 1, Math.ceil(x + rad));
    const ry = rad * sq;
    const y0 = Math.max(0, Math.floor(y - ry)), y1 = Math.min(this.h - 1, Math.ceil(y + ry));
    const inv = 1 / rad, invy = 1 / ry;
    for (let py = y0; py <= y1; py++) {
      const dy = (py - y) * invy;
      for (let px = x0; px <= x1; px++) {
        const dx = (px - x) * inv;
        const d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = (1 - d) * (1 - d);
        const i = py * this.w + px;
        this.r[i] += R * f; this.g[i] += G * f; this.b[i] += B * f;
      }
    }
  }
  // cone light (streetlamp): apex (x,y), pointing down, half-angle spread, length
  cone(x, y, len, spread, c, k = 1) {
    const R = ((c >> 16) & 255) / 255 * k, G = ((c >> 8) & 255) / 255 * k, B = (c & 255) / 255 * k;
    const x0 = Math.max(0, Math.floor(x - len * spread - 2)), x1 = Math.min(this.w - 1, Math.ceil(x + len * spread + 2));
    const y1 = Math.min(this.h - 1, Math.ceil(y + len));
    for (let py = Math.max(0, Math.floor(y)); py <= y1; py++) {
      const dy = py - y, half = dy * spread + 1;
      for (let px = x0; px <= x1; px++) {
        const dx = Math.abs(px - x) / half;
        if (dx >= 1) continue;
        const f = (1 - dx * dx) * (1 - dy / len) * 0.9;
        if (f <= 0) continue;
        const i = py * this.w + px;
        this.r[i] += R * f; this.g[i] += G * f; this.b[i] += B * f;
      }
    }
  }
  apply(fb, levels = 10, max = 1.7) {
    const u = fb.u8, w = this.w;
    for (let i = 0, n = this.w * this.h; i < n; i++) {
      let r = this.r[i], g = this.g[i], b = this.b[i];
      if (levels) {
        const x = i % w, y = (i / w) | 0, th = bayer(x, y);
        r = Math.floor(r * levels + th) / levels; g = Math.floor(g * levels + th) / levels; b = Math.floor(b * levels + th) / levels;
      }
      const j = i << 2;
      u[j] *= Math.min(r, max); u[j + 1] *= Math.min(g, max); u[j + 2] *= Math.min(b, max);
    }
  }
}

export function vignette(fb, k = 0.35, power = 2) {
  const u = fb.u8, cx = fb.w / 2, cy = fb.h / 2;
  for (let y = 0; y < fb.h; y++) {
    const dy = (y - cy) / cy;
    for (let x = 0; x < fb.w; x++) {
      const dx = (x - cx) / cx;
      const d = Math.pow((dx * dx * 0.8 + dy * dy) / 1.8, power / 2);
      const f = 1 - k * clamp(d * 1.6);
      const j = (y * fb.w + x) << 2;
      u[j] *= f; u[j + 1] *= f; u[j + 2] *= f;
    }
  }
}

export function letterbox(fb, h, c = 0x000000) {
  if (h <= 0) return;
  const ox = fb.ox, oy = fb.oy;
  fb.ox = fb.oy = 0;
  fb.rect(0, 0, fb.w, Math.round(h), c);
  fb.rect(0, fb.h - Math.round(h), fb.w, Math.round(h), c);
  fb.ox = ox; fb.oy = oy;
}

export function fade(fb, c, a) { if (a > 0) fb.overlay(c, clamp(a)); }

// chunky dithered fade (2x2 blocks) to a colour
export function ditherFade(fb, c, a) {
  if (a <= 0) return;
  const ox = fb.ox, oy = fb.oy; fb.ox = fb.oy = 0;
  for (let y = 0; y < fb.h; y++)
    for (let x = 0; x < fb.w; x++) if (a > bayer(x >> 1, y >> 1)) fb.set(x, y, c);
  fb.ox = ox; fb.oy = oy;
}

// out = mix of a and b with a chunky ordered-dither dissolve
export function dissolve(out, a, b, t, block = 2) {
  const w = out.w;
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const th = bayer(Math.floor(x / block), Math.floor(y / block));
      out.u32[i] = t > th ? b.u32[i] : a.u32[i];
    }
}

// out = lerp(prev, out, k): smooth cross-fade (prev shows at k = 0)
export function crossfade(out, prev, k) {
  const a = out.u8, b = prev.u8;
  for (let i = 0; i < a.length; i += 4) {
    a[i] = b[i] + (a[i] - b[i]) * k; a[i + 1] = b[i + 1] + (a[i + 1] - b[i + 1]) * k; a[i + 2] = b[i + 2] + (a[i + 2] - b[i + 2]) * k;
  }
}

// 4-point star mask test (Gemini sparkle) in normalised coords
export function starInside(x, y, p = 0.62) {
  const ax = Math.abs(x), ay = Math.abs(y);
  return Math.pow(ax, p) + Math.pow(ay, p) <= 1;
}

// Iris transitions: fill everything outside the shape with colour
export function irisStar(fb, cx, cy, r, c = 0x000000, rot = 0) {
  if (r > fb.w * 2) return;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const ox = fb.ox, oy = fb.oy; fb.ox = fb.oy = 0;
  for (let y = 0; y < fb.h; y++)
    for (let x = 0; x < fb.w; x++) {
      const dx = (x - cx) / Math.max(0.001, r), dy = (y - cy) / Math.max(0.001, r);
      const rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
      if (!starInside(rx, ry)) fb.set(x, y, c);
    }
  fb.ox = ox; fb.oy = oy;
}
export function irisCircle(fb, cx, cy, r, c = 0x000000) {
  const ox = fb.ox, oy = fb.oy; fb.ox = fb.oy = 0;
  const rr = r * r;
  for (let y = 0; y < fb.h; y++)
    for (let x = 0; x < fb.w; x++) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > rr) fb.set(x, y, c);
  fb.ox = ox; fb.oy = oy;
}

// ---- particles (stateless: position is a function of time and seed) ----

// Twinkling stars in a rect. parallax offset (px, py) scrolls them.
export function stars(fb, t, seed, n, x0, y0, w, h, o = {}) {
  const cols = o.colors || [0xffffff, 0xcfe3ff, 0xfff1c9];
  for (let i = 0; i < n; i++) {
    const hx = hash(seed * 997 + i * 3), hy = hash(seed * 991 + i * 3 + 1), hz = hash(seed * 983 + i * 3 + 2);
    let x = x0 + fract(hx + (o.px || 0) / w) * w, y = y0 + fract(hy + (o.py || 0) / h) * h;
    const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + hz * 3) + hz * 40);
    const c = cols[(hz * cols.length) | 0];
    const big = hz > 0.93;
    const a = (o.alpha === undefined ? 1 : o.alpha) * (0.35 + 0.65 * tw);
    if (big && tw > 0.35) {
      fb.blend(x, y, c, a); fb.blend(x - 1, y, c, a * 0.5); fb.blend(x + 1, y, c, a * 0.5); fb.blend(x, y - 1, c, a * 0.5); fb.blend(x, y + 1, c, a * 0.5);
    } else fb.blend(x, y, c, a * (hz > 0.6 ? 1 : 0.6));
  }
}

// Fireflies wandering around a centre; users of the AI world
export function fireflies(fb, t, seed, n, cx, cy, rx, ry, o = {}) {
  const col = o.color || 0xd9ff7a, pts = [];
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed * 31 + i * 7), h2 = hash(seed * 31 + i * 7 + 1), h3 = hash(seed * 31 + i * 7 + 2);
    const sp = 0.25 + h3 * 0.5;
    const x = cx + Math.sin(t * sp + h1 * TAU) * rx * (0.4 + 0.6 * h2) + (noise1(t * 0.7 + i * 13.1) - 0.5) * 10;
    const y = cy + Math.cos(t * sp * 1.3 + h2 * TAU) * ry * (0.4 + 0.6 * h1) + (noise1(t * 0.6 + i * 7.7) - 0.5) * 8;
    const blink = 0.55 + 0.45 * Math.sin(t * (2 + h3 * 3) + h1 * 20);
    pts.push([x, y, blink]);
  }
  return drawFlies(fb, pts, col, o.k || 1);
}
export function drawFlies(fb, pts, col = 0xd9ff7a, k = 1) {
  for (const [x, y, b] of pts) {
    fb.glow(x, y, 5, col, 0.45 * b * k, 4);
    fb.blend(x, y, 0xffffe0, Math.min(1, b * k));
  }
  return pts;
}

// Rain streaks falling at an angle; ground: y where drops end with splashes
export function rain(fb, t, o = {}) {
  const n = o.n || 220, sp = o.speed || 260, ang = o.angle || 0.25, len = o.len || 5;
  const col = o.color || 0x9fb4d8, a = o.alpha || 0.55, ground = o.ground || fb.h;
  const x0 = o.x0 || 0, w = o.w || fb.w;
  for (let i = 0; i < n; i++) {
    const h1 = hash(i * 17 + 3), h2 = hash(i * 17 + 5), h3 = hash(i * 17 + 9);
    const period = (ground + 20) / (sp * (0.8 + 0.4 * h3));
    const ph = fract(t / period + h2);
    const y = -10 + ph * (ground + 10);
    const x = x0 + fract(h1 + (y * ang) / w) * w;
    const dx = -ang * len, dy = len;
    fb.line(x, y, x + dx, y - dy, col, a * (0.6 + 0.4 * h3));
    if (o.splash !== false && ph > 0.97) {
      const gy = ground - 1;
      fb.blend(x - 1, gy, col, 0.7); fb.blend(x + 1, gy, col, 0.7); fb.blend(x, gy - 1, col, 0.5);
    }
  }
}

// Burst of sparks from (x,y) started at t0; returns nothing, draws additive
export function burst(fb, t, t0, x, y, o = {}) {
  const dt = t - t0;
  const life = o.life || 1.2;
  if (dt < 0 || dt > life) return;
  const n = o.n || 24, sp = o.speed || 60, g = o.gravity === undefined ? 40 : o.gravity;
  const cols = o.colors || [0xffffff, 0xffe28a];
  const k = 1 - dt / life;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(i + (o.seed || 0) * 50) * 0.5;
    const s = sp * (0.5 + hash(i * 3 + (o.seed || 0) * 7) * 0.7);
    const px = x + Math.cos(a) * s * dt, py = y + Math.sin(a) * s * dt + 0.5 * g * dt * dt;
    const c = cols[i % cols.length];
    fb.add(px, py, c, k * 1.2);
    if (o.trail !== false) fb.add(px - Math.cos(a) * 2, py - Math.sin(a) * 2 - g * dt * 0.05, c, k * 0.5);
  }
  if (dt < 0.15) fb.glow(x, y, (o.flash || 18) * (1 - dt / 0.15), cols[0], 0.9);
}

// Confetti falling from the top; colours array
export function confetti(fb, t, t0, o = {}) {
  const dt = t - t0;
  if (dt < 0) return;
  const n = o.n || 80, cols = o.colors || [0xea4335, 0xfbbc04, 0x34a853, 0x4285f4, 0xffffff];
  for (let i = 0; i < n; i++) {
    const h1 = hash(i * 13 + 1), h2 = hash(i * 13 + 2), h3 = hash(i * 13 + 3);
    const y = -5 + dt * (30 + h2 * 40) - h3 * 60;
    if (y < -5 || y > fb.h + 5) continue;
    const x = h1 * fb.w + Math.sin(dt * (2 + h3 * 3) + i) * 8;
    const flip = Math.sin(dt * (6 + h2 * 6) + i) > 0;
    const c = cols[i % cols.length];
    fb.set(x, y, c);
    if (flip) fb.set(x + 1, y, c); else fb.set(x, y + 1, c);
  }
}

// Smoke puffs rising from (x,y) since t0
export function smoke(fb, t, t0, x, y, o = {}) {
  const dt = t - t0, life = o.life || 1.6, n = o.n || 6, col = o.color || 0x8a8f99;
  for (let i = 0; i < n; i++) {
    const d = dt - i * (o.gap || 0.12);
    if (d < 0 || d > life) continue;
    const k = d / life;
    const px = x + Math.sin(i * 2.3 + d * 2) * 4 * k + (hash(i) - 0.5) * 6;
    const py = y - d * (o.rise || 14);
    fb.circle(px, py, 1 + k * (o.size || 4), col, (1 - k) * 0.7);
  }
}

// Simple horizontal speed lines / whoosh
export function speedLines(fb, t, y0, y1, col = 0xffffff, a = 0.35, n = 14, dir = 1) {
  for (let i = 0; i < n; i++) {
    const h1 = hash(i * 7 + 1), h2 = hash(i * 7 + 2);
    const y = y0 + h1 * (y1 - y0);
    const L = 20 + h2 * 50;
    const x = fract(h2 + t * (2 + h1 * 2) * dir) * (fb.w + L) - L;
    fb.line(x, y, x + L, y, col, a);
  }
}

export { FB };
