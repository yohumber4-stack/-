// Background painters for 2D scenes: skies, hills, town silhouettes, clouds, sea, grass.
import { W, H, clamp, hash, noise1, fbm, mix, bayer, lerp, fract } from './engine/core.js';
import { stars } from './engine/fx.js';

export const SKY = {
  night: [0x0a0e2a, 0x151d4a, 0x27306a, 0x3d4585],
  dusk: [0x2b2a5c, 0x6a3f7a, 0xc9607a, 0xf0a070, 0xffd08a],
  day: [0x5aa8e8, 0x86c3f0, 0xbfe0f7, 0xf3f0dc],
  sunset: [0x3a3f8a, 0x8a5aa8, 0xe07a8a, 0xffb07a, 0xffe0a0],
  storm: [0x0d1020, 0x1a2036, 0x2a3048, 0x3a4058],
  dawn: [0x3b5aa0, 0x8f9fd0, 0xf0c0b0, 0xffe6b8],
};

export function sky(fb, stops, y0 = 0, y1 = H) { fb.gradV(0, y0, fb.w, y1 - y0, stops); }

// rolling hill silhouette layer; returns height function
export function hills(fb, base, amp, freq, color, seed, scroll = 0, o = {}) {
  const hi = o.hi;
  for (let x = 0; x < fb.w; x++) {
    const wx = x + scroll;
    const h = base - (fbm(wx * freq, seed, 3) - 0.5) * 2 * amp - (o.bump ? Math.exp(-((wx - o.bump[0]) ** 2) / (2 * o.bump[1] ** 2)) * o.bump[2] : 0);
    const y0 = Math.round(h);
    fb.rect(x, y0, 1, fb.h - y0, color);
    if (hi !== undefined) fb.set(x, y0, hi);
    if (o.grass && hash(Math.floor(wx) * 7 + seed) > 0.8) fb.set(x, y0 - 1, o.grass);
  }
}

// town skyline silhouettes with lit windows
export function skyline(fb, baseY, color, seed, scroll = 0, o = {}) {
  let x = -((scroll % 40) + 40) % 40 - 40;
  let i = Math.floor(scroll / 40) - 1;
  while (x < fb.w + 40) {
    const r = hash(i * 13 + seed);
    const w = 16 + Math.floor(r * 22), h = 18 + Math.floor(hash(i * 7 + seed) * 30);
    fb.rect(x, baseY - h, w, h, color);
    // roof
    const roof = hash(i * 3 + seed);
    if (roof > 0.5) fb.poly([x - 1, baseY - h, x + w / 2, baseY - h - 8, x + w + 1, baseY - h], color);
    if (o.windows) {
      for (let wy = baseY - h + 5; wy < baseY - 5; wy += 6)
        for (let wx = x + 3; wx < x + w - 3; wx += 5)
          if (hash(wx * 31 + wy * 17 + seed) > 0.55) {
            const flick = o.t !== undefined ? 0.85 + 0.15 * Math.sin(o.t * 2 + wx) : 1;
            fb.rect(wx, wy, 2, 3, mix(color, o.windows, flick));
          }
    }
    x += w + 2 + Math.floor(hash(i * 5 + seed) * 6);
    i++;
  }
}

// fluffy pixel cloud centred at (x, y)
export function cloud(fb, x, y, w, color, shade, seed = 0, a = 1) {
  const n = Math.max(3, Math.round(w / 10));
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const r = (w / n) * (0.8 + hash(i + seed * 17) * 0.7) * (1 - Math.abs(k - 0.5) * 0.8);
    const cx = x - w / 2 + k * w, cy = y - r * 0.4;
    fb.circle(cx, cy + 2, r, shade, a);
  }
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const r = (w / n) * (0.8 + hash(i + seed * 17) * 0.7) * (1 - Math.abs(k - 0.5) * 0.8);
    const cx = x - w / 2 + k * w, cy = y - r * 0.4;
    fb.circle(cx, cy, r, color, a);
  }
}

export function nightStars(fb, t, seed = 5, n = 140, maxY = H * 0.7, o = {}) {
  stars(fb, t, seed, n, 0, 0, fb.w, maxY, o);
}

// horizontal sea strip with shimmer
export function sea(fb, y0, y1, t, o = {}) {
  const top = o.top || 0x2b3f7a, bot = o.bottom || 0x0f1a3a;
  fb.gradV(0, y0, fb.w, y1 - y0, [top, bot]);
  for (let y = y0; y < y1; y++) {
    const k = (y - y0) / (y1 - y0);
    for (let i = 0; i < 6 + k * 10; i++) {
      const x = fract(hash(i * 13 + y * 7) + t * 0.02 * (1 + k)) * fb.w;
      if (noise1(x * 0.1 + t * 2 + y) > 0.6) fb.hline(x, x + 2 + k * 6, y, o.glint || 0x6f86c8);
    }
  }
  if (o.moonX !== undefined) {
    for (let y = y0; y < y1; y += 1) {
      const k = (y - y0) / (y1 - y0);
      const w = 2 + k * 14;
      if (noise1(y * 0.9 + t * 3) > 0.4) fb.hline(o.moonX - w / 2 + Math.sin(y + t * 4) * 2, o.moonX + w / 2, y, 0xdfe8ff);
    }
  }
}

export function grassTufts(fb, y, t, color, seed = 1, density = 0.3, scroll = 0) {
  for (let x = 0; x < fb.w; x++) {
    const wx = x + scroll;
    if (hash(Math.floor(wx) * 3 + seed) > density) continue;
    const h = 1 + Math.floor(hash(Math.floor(wx) * 11 + seed) * 3);
    const sway = Math.round(Math.sin(t * 2 + wx * 0.3) * 0.6);
    fb.vline(x + sway, y - h, y - 1, color);
  }
}

// soft light rays from a point (god rays), dithered
export function rays(fb, x, y, n, len, color, a, t = 0, spread = Math.PI) {
  for (let i = 0; i < n; i++) {
    const ang = Math.PI / 2 - spread / 2 + (i / (n - 1)) * spread + Math.sin(t * 0.5 + i) * 0.03;
    const w = 3 + hash(i * 7) * 6;
    for (let r = 0; r < len; r += 1) {
      const k = 1 - r / len;
      const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
      for (let d = -w / 2; d < w / 2; d++) {
        const qx = px - Math.sin(ang) * d, qy = py + Math.cos(ang) * d;
        if (a * k * 0.9 > bayer(Math.round(qx), Math.round(qy)) * 1.6) fb.add(qx, qy, color, a * k * 0.35);
      }
    }
  }
}
