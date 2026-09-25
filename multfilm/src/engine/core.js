// Shared math, easing, randomness and colour helpers. Everything is pure so any
// frame can be rendered in isolation (seeking, parallel rendering).

export const W = 480;
export const H = 270;
export const FPS = 30;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const fract = (x) => x - Math.floor(x);
export const TAU = Math.PI * 2;

export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// Keyframe interpolation: frames = [[time, value, ease?], ...] (value: number or array)
export function key(t, frames, ease = E.inOutQuad) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1, e1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      const k = (e1 || ease)((t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((a, j) => a + (v1[j] - a) * k);
      return v0 + (v1 - v0) * k;
    }
  }
  return frames[frames.length - 1][1];
}

// Discrete states: states = [[time, value], ...]
export function step(t, states) {
  let v = states[0][1];
  for (const [ts, s] of states) if (t >= ts) v = s;
  return v;
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export const hash2 = (x, y) => hash(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663));

export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  return lerp(hash(i), hash(i + 1), smooth(f));
}
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2; a *= 0.5; }
  return s;
}

// ---- colours: plain ints 0xRRGGBB ----
export const rgb = (r, g, b) => ((clamp(r, 0, 255) | 0) << 16) | ((clamp(g, 0, 255) | 0) << 8) | (clamp(b, 0, 255) | 0);
export const cr = (c) => (c >> 16) & 255;
export const cg = (c) => (c >> 8) & 255;
export const cb = (c) => c & 255;
export function mix(a, b, t) {
  return rgb(cr(a) + (cr(b) - cr(a)) * t, cg(a) + (cg(b) - cg(a)) * t, cb(a) + (cb(b) - cb(a)) * t);
}
export const scale = (c, k) => rgb(cr(c) * k, cg(c) * k, cb(c) * k);
export function desat(c, k) {
  const l = cr(c) * 0.3 + cg(c) * 0.59 + cb(c) * 0.11;
  return rgb(lerp(cr(c), l, k), lerp(cg(c), l, k), lerp(cb(c), l, k));
}
export const luma = (c) => (cr(c) * 0.3 + cg(c) * 0.59 + cb(c) * 0.11) / 255;
export function ramp(stops, t) {
  t = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  return mix(stops[i], stops[i + 1], t - i);
}

export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

// Quantise 0..1 to n levels with ordered dither (pixel-art friendly gradients)
export function qd(v, n, x, y) {
  const s = clamp(v) * (n - 1);
  const i = Math.floor(s);
  return (s - i > bayer(x, y) ? i + 1 : i) / (n - 1);
}
