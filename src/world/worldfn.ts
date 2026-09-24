import { Simplex2 } from '../core/noise';
import { clamp, lerp, smoothstep, hash2 } from '../core/math';

/** A flat pad the terrain is levelled to (for buildings). */
export interface Pad {
  x: number;
  z: number;
  hw: number; // half extents of the rectangle
  hd: number;
  rot: number; // yaw
  y: number; // target height
  blend: number; // falloff distance
}

export const ROAD_HALF = 4.3; // asphalt half width
export const ROAD_START_Z = -40;
export const SEGMENT_LEN = 200;

/**
 * Pure, deterministic description of the world: road centreline, elevation, terrain height.
 * All coordinates are absolute world metres (float64); the renderer subtracts a floating origin.
 */
export class WorldFn {
  readonly seed: number;
  private nT: Simplex2;
  private nD: Simplex2;
  private nR: Simplex2;
  private nS: Simplex2;
  private roadYCache = new Map<number, number>();
  /** Pads registered by world generation, bucketed by road segment index. */
  private pads = new Map<number, Pad[]>();
  padProvider: ((seg: number) => Pad[]) | null = null;
  readonly windAngle: number;
  private cw: number;
  private sw: number;

  constructor(seed: number) {
    this.seed = seed;
    this.nT = new Simplex2(seed * 7 + 1);
    this.nD = new Simplex2(seed * 13 + 5);
    this.nR = new Simplex2(seed * 31 + 11);
    this.nS = new Simplex2(seed * 3 + 17);
    this.windAngle = 0.35 + hash2(seed, 3) * 0.5;
    this.cw = Math.cos(this.windAngle);
    this.sw = Math.sin(this.windAngle);
  }

  // ---------------------------------------------------------------- road
  /** Lateral offset of the road centreline at longitudinal coordinate z. */
  roadX(z: number): number {
    const n = this.nR;
    // start straight near the homestead, meander further on
    const k = smoothstep(150, 900, z);
    const big = n.noise(z / 5200, 1.7) * 520 + n.noise(z / 2100, 4.1) * 150;
    const mid = n.noise(z / 950, 8.3) * 48 * (0.6 + 0.4 * n.noise(z / 4000, 2.2));
    const small = n.noise(z / 360, 12.9) * 5;
    const base = n.noise(0 / 5200, 1.7) * 520 + n.noise(0 / 2100, 4.1) * 150;
    return (big + mid + small - base) * k;
  }
  roadDX(z: number): number {
    return (this.roadX(z + 0.5) - this.roadX(z - 0.5));
  }
  /** Yaw of the road direction (0 = +z). */
  roadHeading(z: number): number {
    return Math.atan2(this.roadDX(z), 1);
  }
  /** Signed perpendicular distance from road centreline (positive = right side when driving +z). */
  roadDist(x: number, z: number): number {
    const dx = this.roadDX(z);
    return -(x - this.roadX(z)) / Math.sqrt(1 + dx * dx);
  }
  onRoad(x: number, z: number, margin = 0): boolean {
    return z > ROAD_START_Z && Math.abs(this.roadDist(x, z)) < ROAD_HALF + margin;
  }

  /** Smoothed elevation of the road surface. Cached on a 4 m lattice and interpolated. */
  roadY(z: number): number {
    const s = z / 4;
    const i = Math.floor(s);
    const t = s - i;
    const p0 = this.roadYAt(i - 1), p1 = this.roadYAt(i), p2 = this.roadYAt(i + 1), p3 = this.roadYAt(i + 2);
    // Catmull-Rom
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  private roadYAt(i: number): number {
    let v = this.roadYCache.get(i);
    if (v !== undefined) return v;
    const z = i * 4;
    let sum = 0, wsum = 0;
    for (let k = -8; k <= 8; k++) {
      const zz = z + k * 12;
      const w = 1 - Math.abs(k) / 9;
      sum += this.baseHeight(this.roadX(zz), zz) * w;
      wsum += w;
    }
    v = sum / wsum;
    if (this.roadYCache.size > 200000) this.roadYCache.clear();
    this.roadYCache.set(i, v);
    return v;
  }

  // ---------------------------------------------------------------- terrain
  /** Natural terrain before any flattening. */
  baseHeight(x: number, z: number): number {
    const nT = this.nT, nD = this.nD;
    let h = nT.fbm(x / 3400, z / 3400, 3) * 34;
    const hills = smoothstep(-0.2, 0.6, nT.noise(x / 5200 + 11.3, z / 5200 - 4.1));
    h += nT.fbm(x / 780 + 21.7, z / 780 - 5.3, 3) * 9 * (0.35 + hills);
    // dune fields: elongated ridges perpendicular to the prevailing wind
    const duneMask = smoothstep(0.05, 0.55, nD.noise(x / 2600 - 7.7, z / 2600 + 3.3));
    if (duneMask > 0.001) {
      const u = x * this.cw - z * this.sw;
      const v = x * this.sw + z * this.cw;
      const warp = nD.noise(u / 400, v / 400) * 40;
      let r = 1 - Math.abs(nD.noise((u + warp) / 190, v / 560));
      r = r * r * (3 - 2 * r);
      h += (r * 11 + nD.noise(u / 70, v / 90) * 1.4) * duneMask;
    }
    h += nT.noise(x / 52, z / 52) * 0.55 + nT.noise(x / 17, z / 17) * 0.12;
    return h;
  }

  /** Final terrain height, including road bed and building pads. */
  height(x: number, z: number): number {
    let h = this.baseHeight(x, z);
    if (z > ROAD_START_Z - 30) {
      const d = Math.abs(this.roadDist(x, z));
      if (d < 26) {
        const ry = this.roadY(z);
        const endFade = smoothstep(ROAD_START_Z - 30, ROAD_START_Z, z);
        // gentle embankment: shoulders ease into the natural terrain
        const t = smoothstep(ROAD_HALF + 0.6, ROAD_HALF + 22, d);
        const shoulderDip = smoothstep(ROAD_HALF, ROAD_HALF + 1.5, d) * (1 - smoothstep(ROAD_HALF + 1.5, ROAD_HALF + 6, d)) * 0.12;
        const hr = lerp(ry - shoulderDip, h, t);
        h = lerp(h, hr, endFade);
      }
    }
    if (this.padProvider) {
      const seg = Math.floor(z / SEGMENT_LEN);
      for (let s = seg - 1; s <= seg + 1; s++) {
        const pads = this.getPads(s);
        for (let i = 0; i < pads.length; i++) h = applyPad(pads[i], x, z, h);
      }
    }
    return h;
  }

  getPads(seg: number): Pad[] {
    let p = this.pads.get(seg);
    if (!p) {
      p = this.padProvider ? this.padProvider(seg) : [];
      this.pads.set(seg, p);
    }
    return p;
  }

  normal(x: number, z: number, e = 0.5): [number, number, number] {
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  }

  /** 0..1 density of desert vegetation. */
  vegetation(x: number, z: number): number {
    return clamp(0.55 + this.nS.noise(x / 900, z / 900) * 0.6 + this.nS.noise(x / 160, z / 160) * 0.25, 0, 1);
  }
  /** Dune field mask, used for sand colour and vegetation. */
  duneMask(x: number, z: number): number {
    return smoothstep(0.05, 0.55, this.nD.noise(x / 2600 - 7.7, z / 2600 + 3.3));
  }
  noise2(x: number, y: number) {
    return this.nS.noise(x, y);
  }
}

function applyPad(p: Pad, x: number, z: number, h: number): number {
  const dx = x - p.x, dz = z - p.z;
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const lx = Math.abs(dx * c - dz * s) - p.hw;
  const lz = Math.abs(dx * s + dz * c) - p.hd;
  const d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
  if (d >= p.blend) return h;
  const t = smoothstep(0, p.blend, d);
  return lerp(p.y, h, t);
}
