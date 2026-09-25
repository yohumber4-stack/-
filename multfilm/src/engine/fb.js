// Pixel framebuffer with alpha. Used both for the screen and for sprites.
import { W, H, clamp, bayer } from './core.js';

const toPx = (c) => 0xff000000 | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255);
const fromPx = (p) => ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255);

export class FB {
  constructor(w = W, h = H) {
    this.w = w;
    this.h = h;
    this.buf = new ArrayBuffer(w * h * 4);
    this.u8 = new Uint8ClampedArray(this.buf);
    this.u32 = new Uint32Array(this.buf);
    this.ox = 0; // drawing offset, handy for cameras and shakes
    this.oy = 0;
  }

  clear(c) { this.u32.fill(c === undefined ? 0 : toPx(c)); return this; }
  copy(src) { this.u32.set(src.u32); return this; }
  clone() { const f = new FB(this.w, this.h); f.u32.set(this.u32); return f; }

  set(x, y, c) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.u32[y * this.w + x] = toPx(c);
  }
  // absolute coordinates, returns -1 for transparent / outside
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    const p = this.u32[y * this.w + x];
    return p >>> 24 ? fromPx(p) : -1;
  }
  opaque(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && (this.u32[y * this.w + x] >>> 24) !== 0;
  }

  blend(x, y, c, a) {
    if (a <= 0) return;
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) << 2, u = this.u8;
    if (a >= 1 || u[i + 3] === 0) { this.u32[i >> 2] = toPx(c); return; }
    u[i] += (((c >> 16) & 255) - u[i]) * a;
    u[i + 1] += (((c >> 8) & 255) - u[i + 1]) * a;
    u[i + 2] += ((c & 255) - u[i + 2]) * a;
  }
  add(x, y, c, k = 1) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) << 2, u = this.u8;
    u[i] += ((c >> 16) & 255) * k;
    u[i + 1] += ((c >> 8) & 255) * k;
    u[i + 2] += (c & 255) * k;
    u[i + 3] = 255;
  }

  rect(x, y, w, h, c, a = 1) {
    let x0 = Math.floor(x + this.ox), y0 = Math.floor(y + this.oy);
    let x1 = x0 + Math.round(w), y1 = y0 + Math.round(h);
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.w, x1); y1 = Math.min(this.h, y1);
    if (a >= 1) {
      const p = toPx(c);
      for (let yy = y0; yy < y1; yy++) this.u32.fill(p, yy * this.w + x0, yy * this.w + x1);
      return;
    }
    const ox = this.ox, oy = this.oy;
    this.ox = this.oy = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, c, a);
    this.ox = ox; this.oy = oy;
  }
  rectAdd(x, y, w, h, c, k) {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.add(x + xx, y + yy, c, k);
  }
  // dithered alpha rect: crisp pixel-art translucency
  rectD(x, y, w, h, c, a) {
    const X0 = Math.floor(x), Y0 = Math.floor(y);
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const px = X0 + xx, py = Y0 + yy;
        if (a > bayer(px + this.ox, py + this.oy)) this.set(px, py, c);
      }
  }
  hline(x0, x1, y, c) { if (x1 < x0) [x0, x1] = [x1, x0]; this.rect(x0, y, x1 - x0 + 1, 1, c); }
  vline(x, y0, y1, c) { if (y1 < y0) [y0, y1] = [y1, y0]; this.rect(x, y0, 1, y1 - y0 + 1, c); }

  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4000; n++) {
      if (a >= 1) this.set(x0, y0, c); else this.blend(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // filled pixel-art circle centred on (cx, cy)
  circle(cx, cy, r, c, a = 1) {
    if (r <= 0.5) { if (a >= 1) this.set(cx, cy, c); else this.blend(cx, cy, c, a); return; }
    const R = Math.ceil(r), rr = r * r + r * 0.6;
    cx = Math.round(cx); cy = Math.round(cy);
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++)
        if (x * x + y * y <= rr) { if (a >= 1) this.set(cx + x, cy + y, c); else this.blend(cx + x, cy + y, c, a); }
  }
  ring(cx, cy, r, c, th = 1) {
    const R = Math.ceil(r + 1), o = r * r + r * 0.6, i = Math.max(0, (r - th) * (r - th) + (r - th) * 0.6);
    cx = Math.round(cx); cy = Math.round(cy);
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const d = x * x + y * y;
        if (d <= o && d > i) this.set(cx + x, cy + y, c);
      }
  }
  ellipse(cx, cy, rx, ry, c, a = 1) {
    const X = Math.ceil(rx), Y = Math.ceil(ry);
    for (let y = -Y; y <= Y; y++)
      for (let x = -X; x <= X; x++) {
        const v = (x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3);
        if (v <= 1) { if (a >= 1) this.set(Math.round(cx) + x, Math.round(cy) + y, c); else this.blend(Math.round(cx) + x, Math.round(cy) + y, c, a); }
      }
  }
  // scanline polygon fill, pts = [x0, y0, x1, y1, ...]
  poly(pts, c, a = 1) {
    const n = pts.length / 2;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) { minY = Math.min(minY, pts[i * 2 + 1]); maxY = Math.max(maxY, pts[i * 2 + 1]); }
    minY = Math.floor(minY); maxY = Math.ceil(maxY);
    const xs = [];
    for (let y = minY; y <= maxY; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], y1 = pts[((i + 1) % n) * 2 + 1];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]);
        if (xb > xa) this.rect(xa, y, xb - xa, 1, c, a);
      }
    }
  }

  // vertical gradient through colour stops, dithered between neighbouring stops
  gradV(x, y, w, h, stops, t0 = 0, t1 = 1) {
    const n = stops.length - 1;
    for (let yy = 0; yy < h; yy++) {
      const t = clamp(t0 + ((t1 - t0) * yy) / Math.max(1, h - 1)) * n;
      const i = Math.min(n - 1, Math.floor(t)), f = t - i;
      const ca = stops[i], cb2 = stops[i + 1];
      const py = Math.floor(y + yy);
      for (let xx = 0; xx < w; xx++) {
        const px = Math.floor(x + xx);
        this.set(px, py, f > bayer(px + this.ox, py + this.oy) ? cb2 : ca);
      }
    }
  }

  // additive soft light blob, quantised with dither for a pixel look
  glow(cx, cy, r, c, k = 1, levels = 7) {
    const R = Math.ceil(r);
    const X = Math.round(cx), Y = Math.round(cy);
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const d = Math.sqrt(x * x + y * y) / r;
        if (d >= 1) continue;
        let v = (1 - d) * (1 - d);
        const px = X + x, py = Y + y;
        const s = v * levels;
        const lo = Math.floor(s);
        v = (s - lo > bayer(px + this.ox, py + this.oy) ? lo + 1 : lo) / levels;
        if (v > 0) this.add(px, py, c, v * k);
      }
  }

  // global colour ops (absolute, whole buffer)
  mulAll(r, g, b) {
    const u = this.u8;
    for (let i = 0; i < u.length; i += 4) { u[i] *= r; u[i + 1] *= g; u[i + 2] *= b; }
  }
  overlay(c, a) {
    const u = this.u8, R = (c >> 16) & 255, G = (c >> 8) & 255, B = c & 255;
    for (let i = 0; i < u.length; i += 4) { u[i] += (R - u[i]) * a; u[i + 1] += (G - u[i + 1]) * a; u[i + 2] += (B - u[i + 2]) * a; }
  }

  // Copy a sprite (FB with alpha). opts: flip, sx, sy (scales), alpha, tint, tintK, solid, anchor
  blit(src, dx, dy, o = {}) {
    const sx = o.sx || 1, sy = o.sy || 1;
    const w = Math.round(src.w * sx), h = Math.round(src.h * sy);
    const x0 = Math.round(dx + this.ox), y0 = Math.round(dy + this.oy);
    const alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0) return;
    const tint = o.tint, tk = o.tintK || 0, solid = o.solid;
    const flip = !!o.flip, flipY = !!o.flipY, dither = !!o.dither;
    const su = src.u8, du = this.u8, sw = src.w;
    for (let y = 0; y < h; y++) {
      const ty = y0 + y;
      if (ty < 0 || ty >= this.h) continue;
      let syi = Math.min(src.h - 1, Math.floor(y / sy));
      if (flipY) syi = src.h - 1 - syi;
      for (let x = 0; x < w; x++) {
        const tx = x0 + x;
        if (tx < 0 || tx >= this.w) continue;
        let sxi = Math.min(sw - 1, Math.floor(x / sx));
        if (flip) sxi = sw - 1 - sxi;
        const si = (syi * sw + sxi) << 2;
        if (su[si + 3] === 0) continue;
        let r = su[si], g = su[si + 1], b = su[si + 2];
        if (solid !== undefined) { r = (solid >> 16) & 255; g = (solid >> 8) & 255; b = solid & 255; }
        else if (tint !== undefined && tk > 0) {
          r += (((tint >> 16) & 255) - r) * tk; g += (((tint >> 8) & 255) - g) * tk; b += ((tint & 255) - b) * tk;
        }
        const di = (ty * this.w + tx) << 2;
        if (alpha >= 1) { du[di] = r; du[di + 1] = g; du[di + 2] = b; du[di + 3] = 255; }
        else if (dither) {
          if (alpha > bayer(tx, ty)) { du[di] = r; du[di + 1] = g; du[di + 2] = b; du[di + 3] = 255; }
        } else if (du[di + 3] === 0) {
          du[di] = r; du[di + 1] = g; du[di + 2] = b; du[di + 3] = 255 * alpha;
        } else {
          du[di] += (r - du[di]) * alpha; du[di + 1] += (g - du[di + 1]) * alpha; du[di + 2] += (b - du[di + 2]) * alpha;
        }
      }
    }
  }
}

// New sprite with a 1px outline around all opaque pixels (8-neighbourhood optional)
export function outlined(src, color, diag = false) {
  const o = new FB(src.w + 2, src.h + 2);
  o.clear();
  const p = toPx(color);
  for (let y = 0; y < o.h; y++)
    for (let x = 0; x < o.w; x++) {
      const sx = x - 1, sy = y - 1;
      if (src.opaque(sx, sy)) { o.u32[y * o.w + x] = src.u32[sy * src.w + sx]; continue; }
      if (src.opaque(sx - 1, sy) || src.opaque(sx + 1, sy) || src.opaque(sx, sy - 1) || src.opaque(sx, sy + 1) ||
        (diag && (src.opaque(sx - 1, sy - 1) || src.opaque(sx + 1, sy - 1) || src.opaque(sx - 1, sy + 1) || src.opaque(sx + 1, sy + 1))))
        o.u32[y * o.w + x] = p;
    }
  return o;
}

// Parse string pixel art: rows of chars mapped through a palette object; '.' = transparent
export function spriteFrom(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const s = new FB(w, h).clear();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch !== '.' && ch !== ' ' && pal[ch] !== undefined) s.set(x, y, pal[ch]);
    }
  return s;
}

// Tiny pool of scratch sprites to avoid per-frame allocations
const pool = new Map();
export function scratch(w, h, slot = 0) {
  const k = w + 'x' + h + ':' + slot;
  let f = pool.get(k);
  if (!f) { f = new FB(w, h); pool.set(k, f); }
  f.ox = f.oy = 0;
  return f.clear();
}
