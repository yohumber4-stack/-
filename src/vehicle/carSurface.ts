import * as THREE from 'three';
import { lerp, smoothstep, clamp } from '../core/math';

/** Body dimensions of the 1970s sedan (metres). Car local space: +z forward, +y up, +x = left side. */
export const C = {
  zF: 2.04,
  zR: -2.04,
  hw: 0.8,
  axleF: 1.22,
  axleR: -1.21,
  track: 0.672,
  wheelR: 0.3,
  archR: 0.385,
  archY: 0.285,
  sill: 0.245,
  belt: 0.92,
  hoodFront: 0.845,
  hoodRear: 0.915,
  trunkRear: 0.885,
  trunkFront: 0.925,
  roof: 1.385,
  zWS0: 0.7,
  zWS1: 0.1,
  zRW1: -0.84,
  zRW0: -1.3,
  ghBase: 0.776,
  ghTop: 0.655,
  rcF: 0.12,
  rcR: 0.11,
};

export interface LowSec {
  w: number;
  y0: number;
  y1: number;
  rb: number;
  rt: number;
}

const endRound = (z: number, zEnd: number, r: number, front: boolean) => {
  const d = front ? z - (zEnd - r) : zEnd + r - z;
  if (d <= 0) return 0;
  return r - Math.sqrt(Math.max(0, r * r - Math.min(d, r) ** 2));
};

export function lowSec(z: number, out: LowSec = { w: 0, y0: 0, y1: 0, rb: 0, rt: 0 }): LowSec {
  let w = C.hw - endRound(z, C.zF, C.rcF, true) - endRound(z, C.zR, C.rcR, false);
  w *= 1 - 0.018 * smoothstep(1.3, 2.04, Math.abs(z));
  let y1: number;
  if (z >= C.zWS0) {
    const t = (z - C.zWS0) / (C.zF - C.zWS0);
    y1 = lerp(C.hoodRear, C.hoodFront, t) + Math.sin(t * Math.PI) * 0.012;
  } else if (z <= C.zRW0) {
    const t = (C.zRW0 - z) / (C.zRW0 - C.zR);
    y1 = lerp(C.trunkFront, C.trunkRear, t) + Math.sin(t * Math.PI) * 0.008;
  } else y1 = C.belt;
  y1 -= endRound(z, C.zF, 0.075, true) + endRound(z, C.zR, 0.07, false);
  const aF = smoothstep(C.zF - 0.5, C.zF, z), aR = smoothstep(C.zR + 0.45, C.zR, z);
  const y0 = C.sill + 0.17 * aF * aF + 0.14 * aR * aR;
  out.w = w;
  out.y0 = y0;
  out.y1 = y1;
  out.rb = 0.07;
  out.rt = 0.072;
  return out;
}

const sec = { w: 0, y0: 0, y1: 0, rb: 0, rt: 0 };
/** Lower body surface. v: 0 bottom centre -> 0.15 -> bottom arc -> 0.25 side -> 0.75 shoulder arc -> 0.85 top -> 1 top centre. */
export function lowPoint(z: number, v: number, side: number, out: THREE.Vector3): THREE.Vector3 {
  const s = lowSec(z, sec);
  const { w, y0, y1, rb, rt } = s;
  let x: number, y: number;
  if (v < 0.15) {
    const t = v / 0.15;
    x = t * (w - rb);
    y = y0;
  } else if (v < 0.25) {
    const a = -Math.PI / 2 + ((v - 0.15) / 0.1) * (Math.PI / 2);
    x = w - rb + Math.cos(a) * rb;
    y = y0 + rb + Math.sin(a) * rb;
  } else if (v < 0.75) {
    const t = (v - 0.25) / 0.5;
    y = lerp(y0 + rb, y1 - rt, t);
    // gentle convexity + crisp feature line
    const crease = Math.exp(-(((t - 0.66) / 0.035) ** 2)) * 0.0045;
    x = w + Math.sin(t * Math.PI) * 0.011 + crease - (t > 0.66 ? (t - 0.66) * 0.012 : 0);
  } else if (v < 0.85) {
    const a = ((v - 0.75) / 0.1) * (Math.PI / 2);
    const xs = w - 0.34 * 0.012;
    x = xs - rt + Math.cos(a) * rt;
    y = y1 - rt + Math.sin(a) * rt;
  } else {
    const t = (v - 0.85) / 0.15;
    const xs = w - 0.34 * 0.012 - rt;
    x = (1 - t) * xs;
    y = y1 + 0.016 * (1 - (x / Math.max(xs, 0.01)) ** 2);
  }
  return out.set(x * side, y, z);
}

/** Map a height on the side of the lower body to the v parameter. */
export function vOfY(z: number, y: number): number {
  const s = lowSec(z, sec);
  const lo = s.y0 + s.rb, hi = s.y1 - s.rt;
  if (y >= lo) return clamp(0.25 + (0.5 * (y - lo)) / (hi - lo), 0.25, 0.75);
  if (y > s.y0) {
    const a = Math.asin(clamp((y - lo) / s.rb, -1, 0));
    return 0.15 + ((a + Math.PI / 2) / (Math.PI / 2)) * 0.1;
  }
  return 0.15;
}

/** Lower bound of side panels around the wheel arch (null outside the arch). */
export function archV(z: number, axle: number): number | null {
  const d = z - axle;
  if (Math.abs(d) >= C.archR) return null;
  const y = C.archY + Math.sqrt(C.archR * C.archR - d * d);
  return vOfY(z, y);
}

export interface GhSec {
  yb: number;
  yr: number;
}
const smin = (a: number, b: number, k: number) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
};
export function ghSec(z: number): GhSec {
  const yb = C.belt + 0.006;
  const tW = (C.zWS0 - z) / (C.zWS0 - C.zWS1); // 0 at base, 1 at top
  const tR = (z - C.zRW0) / (C.zRW1 - C.zRW0);
  const mid = (C.zWS1 + C.zRW1) / 2, half = (C.zWS1 - C.zRW1) / 2;
  const roofY = C.roof - 0.014 * ((z - mid) / half) ** 2;
  const ws = yb + (roofY - yb) * tW;
  const rw = yb + (roofY - yb) * tR;
  let yr = smin(roofY, ws, 0.06);
  yr = smin(yr, rw, 0.07);
  return { yb, yr: Math.max(yb, yr) };
}

/** Greenhouse (cabin) surface. v: 0 belt -> 0.62 side top -> 0.82 roof corner -> 1 roof centre. */
export function ghPoint(z: number, v: number, side: number, out: THREE.Vector3): THREE.Vector3 {
  const { yb, yr } = ghSec(z);
  const h = yr - yb;
  const rr = Math.min(0.1, h * 0.85 + 1e-4);
  const lean = (y: number) => lerp(C.ghBase, C.ghTop, (y - yb) / (C.roof - yb));
  let x: number, y: number;
  if (v < 0.62) {
    const t = v / 0.62;
    y = lerp(yb, yr - rr, t);
    x = lean(y);
  } else if (v < 0.82) {
    const a = ((v - 0.62) / 0.2) * (Math.PI / 2);
    const cx = lean(yr - rr) - rr;
    x = cx + Math.cos(a) * rr;
    y = yr - rr + Math.sin(a) * rr;
  } else {
    const t = (v - 0.82) / 0.18;
    const x0 = lean(yr - rr) - rr;
    x = (1 - t) * x0;
    y = yr + 0.012 * (1 - (x / Math.max(x0, 0.01)) ** 2) * Math.min(1, h * 6);
  }
  return out.set(x * side, y, z);
}

export type SurfFn = (z: number, v: number, side: number, out: THREE.Vector3) => THREE.Vector3;
type Bound = number | ((z: number) => number);
const bval = (b: Bound, z: number) => (typeof b === 'number' ? b : b(z));

export interface PatchOpts {
  nz?: number;
  nv?: number;
  side?: number;
  gap?: [number, number, number, number]; // world gaps at z0, z1, vLo, vHi
  thickness?: number; // shell thickness (0 = single surface)
  offset?: number; // push the whole surface along the normal
  uvScale?: number;
  zCluster?: 'none' | 'end1' | 'both';
  vCluster?: boolean;
}
export interface PatchResult {
  outer: THREE.BufferGeometry;
  inner?: THREE.BufferGeometry;
  edge?: THREE.BufferGeometry;
}

const A = new THREE.Vector3(), B = new THREE.Vector3(), D1 = new THREE.Vector3(), D2 = new THREE.Vector3();
function normalAt(S: SurfFn, z: number, v: number, side: number, out: THREE.Vector3) {
  const ez = 0.002, ev = 0.0015;
  S(z + ez, v, side, A);
  S(z - ez, v, side, B);
  D1.subVectors(A, B);
  S(z, v + ev, side, A);
  S(z, v - ev, side, B);
  D2.subVectors(A, B);
  out.crossVectors(D2, D1).multiplyScalar(side);
  const l = out.length();
  if (l < 1e-9 || !isFinite(l)) return out.set(0, 1, 0);
  return out.divideScalar(l);
}

/** Mesh a rectangular (z, v) region of a surface; optional thickness makes a closed shell. */
export function surfPatch(S: SurfFn, z0: number, z1: number, vLo: Bound, vHi: Bound, o: PatchOpts = {}): PatchResult {
  const nz = o.nz ?? 24, nv = o.nv ?? 16, side = o.side ?? 1;
  const [g0, g1, g2, g3] = o.gap ?? [0, 0, 0, 0];
  const zs = Math.min(z0, z1) + (z0 < z1 ? g0 : g1), ze = Math.max(z0, z1) - (z0 < z1 ? g1 : g0);
  const uvS = o.uvScale ?? 1;
  const P: THREE.Vector3[][] = [], N: THREE.Vector3[][] = [], UV: [number, number][][] = [];
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  for (let i = 0; i <= nz; i++) {
    let t = i / nz;
    if (o.zCluster === 'both') t = 0.5 - 0.5 * Math.cos(t * Math.PI);
    else if (o.zCluster === 'end1') t = Math.sin((t * Math.PI) / 2);
    const z = lerp(zs, ze, t);
    let lo = bval(vLo, z), hi = bval(vHi, z);
    // convert world gaps to parameter offsets using the local metric
    if (g2 || g3) {
      const e = 0.002;
      S(z, lo + e, side, tmp); S(z, lo, side, tmp2);
      const mLo = tmp.distanceTo(tmp2) / e;
      S(z, hi, side, tmp); S(z, hi - e, side, tmp2);
      const mHi = tmp.distanceTo(tmp2) / e;
      if (mLo > 1e-6) lo += g2 / mLo;
      if (mHi > 1e-6) hi -= g3 / mHi;
    }
    const row: THREE.Vector3[] = [], nrow: THREE.Vector3[] = [], uvrow: [number, number][] = [];
    let acc = 0;
    let prev: THREE.Vector3 | null = null;
    for (let j = 0; j <= nv; j++) {
      let s = j / nv;
      if (o.vCluster) s = 0.5 - 0.5 * Math.cos(s * Math.PI);
      const v = lerp(lo, hi, s);
      const p = S(z, v, side, new THREE.Vector3());
      const n = normalAt(S, z, v, side, new THREE.Vector3());
      if (o.offset) p.addScaledVector(n, o.offset);
      if (prev) acc += p.distanceTo(prev);
      prev = p;
      row.push(p);
      nrow.push(n);
      uvrow.push([z / uvS, acc / uvS]);
    }
    P.push(row);
    N.push(nrow);
    UV.push(uvrow);
  }
  const build = (off: number, flip: boolean) => {
    const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
    const V = nv + 1;
    for (let i = 0; i <= nz; i++)
      for (let j = 0; j <= nv; j++) {
        const p = P[i][j], n = N[i][j];
        pos.push(p.x - n.x * off, p.y - n.y * off, p.z - n.z * off);
        const s = flip ? -1 : 1;
        nrm.push(n.x * s, n.y * s, n.z * s);
        uv.push(UV[i][j][0], UV[i][j][1]);
      }
    const cw = (side > 0) !== flip;
    for (let i = 0; i < nz; i++)
      for (let j = 0; j < nv; j++) {
        const a = i * V + j, b = (i + 1) * V + j, c = a + 1, d = b + 1;
        if (cw) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  };
  const res: PatchResult = { outer: build(0, false) };
  const th = o.thickness ?? 0;
  if (th > 0) {
    res.inner = build(th, true);
    // edge strips around the boundary
    const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
    const loop: [number, number][] = [];
    for (let j = 0; j <= nv; j++) loop.push([0, j]);
    for (let i = 1; i <= nz; i++) loop.push([i, nv]);
    for (let j = nv - 1; j >= 0; j--) loop.push([nz, j]);
    for (let i = nz - 1; i >= 1; i--) loop.push([i, 0]);
    const n = loop.length;
    let acc = 0;
    for (let k = 0; k <= n; k++) {
      const [i, j] = loop[k % n];
      const p = P[i][j], nn = N[i][j];
      const [pi, pj] = loop[(k + 1) % n];
      const [qi, qj] = loop[(k - 1 + n) % n];
      const tan = P[pi][pj].clone().sub(P[qi][qj]).normalize();
      const en = new THREE.Vector3().crossVectors(tan, nn).normalize().multiplyScalar(side > 0 ? 1 : -1);
      if (k > 0) {
        const [ri, rj] = loop[(k - 1) % n];
        acc += p.distanceTo(P[ri][rj]);
      }
      pos.push(p.x, p.y, p.z, p.x - nn.x * th, p.y - nn.y * th, p.z - nn.z * th);
      nrm.push(en.x, en.y, en.z, en.x, en.y, en.z);
      uv.push(acc, 0, acc, th);
    }
    for (let k = 0; k < n; k++) {
      const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
      if (side > 0) idx.push(a, b, c, c, b, d);
      else idx.push(a, c, b, c, d, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    res.edge = g;
  }
  return res;
}

/** Sweep a closed 2D profile (in local x/y) along a 3D path. */
export function sweep(profile: THREE.Vector2[], path: THREE.Vector3[], up = new THREE.Vector3(0, 1, 0), closeEnds = true): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  const n = path.length, m = profile.length;
  for (let i = 0; i < n; i++) {
    const t = path[Math.min(n - 1, i + 1)].clone().sub(path[Math.max(0, i - 1)]).normalize();
    let side = new THREE.Vector3().crossVectors(up, t);
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0);
    side.normalize();
    const u = new THREE.Vector3().crossVectors(t, side).normalize();
    for (let k = 0; k < m; k++) {
      const p = path[i].clone().addScaledVector(side, profile[k].x).addScaledVector(u, profile[k].y);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < m; k++) {
      const a = i * m + k, b = i * m + ((k + 1) % m), c = (i + 1) * m + k, d = (i + 1) * m + ((k + 1) % m);
      idx.push(a, b, c, b, d, c);
    }
  if (closeEnds) {
    const c0 = pos.length / 3;
    const cen0 = path[0], cen1 = path[n - 1];
    pos.push(cen0.x, cen0.y, cen0.z, cen1.x, cen1.y, cen1.z);
    for (let k = 0; k < m; k++) {
      idx.push(c0, k, (k + 1) % m);
      idx.push(c0 + 1, (n - 1) * m + ((k + 1) % m), (n - 1) * m + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function roundRectProfile(w: number, h: number, r: number, seg = 3): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const hw = w / 2, hh = h / 2;
  r = Math.min(r, hw, hh);
  const corners: [number, number, number][] = [
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, Math.PI / 2],
    [-hw + r, -hh + r, Math.PI],
    [hw - r, -hh + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners)
    for (let s = 0; s <= seg; s++) {
      const a = a0 + (s / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  return pts;
}
