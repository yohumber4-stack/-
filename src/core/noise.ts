import { RNG } from './math';

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1, 0.7071, 0.7071, -0.7071, 0.7071, 0.7071, -0.7071, -0.7071, -0.7071]);

/** Seeded 2D simplex noise (Gustavson), output roughly in [-1, 1]. */
export class Simplex2 {
  private perm = new Uint16Array(512);
  private gi = new Uint8Array(512);
  constructor(seed: number) {
    const rng = new RNG(seed);
    const p = new Uint16Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.gi[i] = this.perm[i] % 12;
    }
  }
  noise(xin: number, yin: number): number {
    const perm = this.perm, gi = this.gi;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = gi[ii + perm[jj]] * 2; t0 *= t0; n += t0 * t0 * (GRAD[g] * x0 + GRAD[g + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = gi[ii + i1 + perm[jj + j1]] * 2; t1 *= t1; n += t1 * t1 * (GRAD[g] * x1 + GRAD[g + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = gi[ii + 1 + perm[jj + 1]] * 2; t2 *= t2; n += t2 * t2 * (GRAD[g] * x2 + GRAD[g + 1] * y2); }
    return 70 * n;
  }
  fbm(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * f + o * 19.19, y * f - o * 7.73);
      norm += amp;
      amp *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  }
  ridged(x: number, y: number, octaves: number): number {
    let amp = 0.5, f = 1, sum = 0, prev = 1;
    for (let o = 0; o < octaves; o++) {
      let n = 1 - Math.abs(this.noise(x * f + o * 3.1, y * f + o * 1.7));
      n *= n;
      sum += n * amp * prev;
      prev = n;
      f *= 2;
      amp *= 0.5;
    }
    return sum;
  }
}

/** Smooth 1D noise built from the 2D simplex. */
export function noise1(s: Simplex2, x: number) {
  return s.noise(x, 0.37 * 17.0);
}
