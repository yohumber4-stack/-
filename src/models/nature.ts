import * as THREE from 'three';
import { RNG, clamp, lerp, smoothstep } from '../core/math';
import { tube, curvePts, merge, setColor, mergeVertices, placed } from './geom';

/** Cheap seeded 3D value noise for shaping organic geometry. */
export class Noise3 {
  private p = new Uint8Array(512);
  constructor(seed: number) {
    const r = new RNG(seed);
    const a = new Uint8Array(256);
    for (let i = 0; i < 256; i++) a[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    for (let i = 0; i < 512; i++) this.p[i] = a[i & 255];
  }
  private h(x: number, y: number, z: number) {
    const p = this.p;
    return p[(p[(p[x & 255] + y) & 255] + z) & 255] / 255;
  }
  noise(x: number, y: number, z: number) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    return l(
      l(l(this.h(xi, yi, zi), this.h(xi + 1, yi, zi), u), l(this.h(xi, yi + 1, zi), this.h(xi + 1, yi + 1, zi), u), v),
      l(l(this.h(xi, yi, zi + 1), this.h(xi + 1, yi, zi + 1), u), l(this.h(xi, yi + 1, zi + 1), this.h(xi + 1, yi + 1, zi + 1), u), v),
      w,
    ) * 2 - 1;
  }
  fbm(x: number, y: number, z: number, oct = 4) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * this.noise(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
}

// ------------------------------------------------------------------ cacti
export function makeSaguaro(seed: number, radial = 28, trunkSeg = 12, armSeg = 14): THREE.BufferGeometry {
  const r = new RNG(seed);
  const H = r.range(2.4, 5.6);
  const R = r.range(0.16, 0.26) * (0.8 + H / 12);
  const ribs = 14;
  const rib = (a: number) => 1 - 0.075 * Math.cos(a * ribs);
  const lean = new THREE.Vector3(r.range(-0.15, 0.15), 0, r.range(-0.15, 0.15));
  const trunk: THREE.Vector3[] = [];
  const n = trunkSeg;
  const low = radial < 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    trunk.push(new THREE.Vector3(lean.x * t * t, -0.3 + t * (H + 0.3), lean.z * t * t));
  }
  const ribK = low ? (_a: number) => 1 : rib;
  const geos: THREE.BufferGeometry[] = [tube(trunk, (t, a) => R * ribK(a) * (1 - 0.1 * t), radial, { capEnd: true, capRings: low ? 1 : 5 })];
  const arms = r.weighted([[0, 2], [1, 4], [2, 5], [3, 3], [4, 1]] as const);
  const phi0 = r.next() * Math.PI * 2;
  for (let k = 0; k < arms; k++) {
    const phi = phi0 + (k / Math.max(arms, 1)) * Math.PI * 2 + r.range(-0.4, 0.4);
    const dir = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
    const h0 = H * r.range(0.3, 0.65);
    const out = r.range(0.28, 0.55);
    const rise = r.range(0.7, Math.min(1.9, H - h0 + 0.4));
    const Ra = R * r.range(0.62, 0.8);
    const base = new THREE.Vector3(lean.x * (h0 / H) ** 2, h0, lean.z * (h0 / H) ** 2);
    const ctrl = [
      base.clone(),
      base.clone().addScaledVector(dir, R * 0.9 + out * 0.45).add(new THREE.Vector3(0, -0.04, 0)),
      base.clone().addScaledVector(dir, R + out).add(new THREE.Vector3(0, 0.22, 0)),
      base.clone().addScaledVector(dir, R + out * 1.05).add(new THREE.Vector3(0, rise * 0.6, 0)),
      base.clone().addScaledVector(dir, R + out * 1.02).add(new THREE.Vector3(0, rise, 0)),
    ];
    const pts = curvePts(ctrl, armSeg);
    geos.push(tube(pts, (t, a) => Ra * ribK(a) * (t < 0.15 ? lerp(0.9, 1, t / 0.15) : 1), low ? radial : Math.max(Math.min(10, radial), Math.round(radial * 0.75)), { capEnd: true, capRings: low ? 1 : 4 }));
  }
  return merge(geos);
}

export function makeBarrelCactus(seed: number, radial = 28): THREE.BufferGeometry {
  const r = new RNG(seed);
  const H = r.range(0.35, 0.8), R = r.range(0.2, 0.32);
  const pts: THREE.Vector3[] = [];
  const n = radial < 16 ? 4 : 8;
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(0, -0.05 + (i / n) * H, 0));
  return tube(pts, (t, a) => R * Math.sin(Math.PI * (0.25 + 0.6 * t)) * (radial < 16 ? 1 : 1 - 0.09 * Math.cos(a * 14)), radial, { capEnd: true, capRings: radial < 16 ? 1 : 4 });
}

// ------------------------------------------------------------------ grass, bushes
export function makeGrassTuft(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(1.1, 0.85, 1, 2);
    p.translate(0, 0.42, 0);
    p.rotateY((i / 3) * Math.PI);
    geos.push(p);
  }
  const g = merge(geos);
  // soften normals upward so crossed cards light like a volume
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, nrm.getX(i) * 0.3, 0.9, nrm.getZ(i) * 0.3);
  return g;
}

export function makeDryBush(seed: number, lod = 0): THREE.BufferGeometry {
  const r = new RNG(seed);
  const radial = lod ? 3 : 4;
  const maxDepth = lod ? 1 : 2;
  const geos: THREE.BufferGeometry[] = [];
  const size = r.range(0.5, 1.1);
  const stems = r.int(9, 15);
  const colA = new THREE.Color('#5a4a3a'), colB = new THREE.Color('#8a7a64');
  const addTwig = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(r.range(-0.05, 0.05), r.range(0, 0.04), r.range(-0.05, 0.05)).multiplyScalar(len));
    const g = tube(lod ? [from, to] : [from, mid, to], (t) => rad * (lod ? 1.6 : 1) * (1 - 0.7 * t), radial);
    setColor(g, colA.clone().lerp(colB, r.next()));
    geos.push(g);
    if (depth > 2 - maxDepth) {
      const k = r.int(1, 3);
      for (let i = 0; i < k; i++) {
        const d2 = dir.clone().add(new THREE.Vector3(r.range(-0.7, 0.7), r.range(-0.1, 0.5), r.range(-0.7, 0.7))).normalize();
        addTwig(from.clone().lerp(to, r.range(0.4, 0.9)), d2, len * r.range(0.4, 0.65), rad * 0.6, depth - 1);
      }
    }
  };
  for (let i = 0; i < stems; i++) {
    const a = r.next() * Math.PI * 2;
    const up = r.range(0.45, 1.2);
    const dir = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize();
    addTwig(new THREE.Vector3(r.range(-0.05, 0.05), -0.05, r.range(-0.05, 0.05)), dir, size * r.range(0.55, 1.0), 0.014, 2);
  }
  return merge(geos);
}

// ------------------------------------------------------------------ rocks
const ROCK_COLS = ['#b07a58', '#a86e4e', '#c49474', '#9a6448', '#b88a6a', '#8e5e46'];
export function makeRock(seed: number, detail = 3): THREE.BufferGeometry {
  const r = new RNG(seed);
  const n3 = new Noise3(seed);
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  g.computeVertexNormals();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const sx = r.range(0.8, 1.4), sy = r.range(0.45, 0.85), sz = r.range(0.8, 1.3);
  const flatK = r.range(0.2, 0.6);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = 1 + n3.fbm(v.x * 1.3 + 5, v.y * 1.3, v.z * 1.3, 4) * 0.45 + n3.noise(v.x * 4, v.y * 4, v.z * 4) * 0.06;
    v.multiplyScalar(d);
    // chiselled planar facets
    if (v.y > flatK) v.y = flatK + (v.y - flatK) * 0.35;
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  const base = new THREE.Color(r.pick(ROCK_COLS));
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const band = 0.9 + 0.2 * Math.sin(v.y * 9 + n3.noise(v.x * 2, v.y * 2, v.z * 2) * 2);
    const ao = clamp(0.55 + (v.y / sy + 0.35) * 0.55, 0.5, 1.05);
    cols[i * 3] = base.r * band * ao;
    cols[i * 3 + 1] = base.g * band * ao;
    cols[i * 3 + 2] = base.b * band * ao;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

// ------------------------------------------------------------------ dead trees
export function makeDeadTree(seed: number): THREE.BufferGeometry {
  const r = new RNG(seed);
  const geos: THREE.BufferGeometry[] = [];
  const H = r.range(2.2, 4.2);
  const R = r.range(0.1, 0.18);
  const branch = (start: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const ctrl: THREE.Vector3[] = [start.clone()];
    let p = start.clone(), d = dir.clone();
    for (let i = 1; i <= 3; i++) {
      d = d.clone().add(new THREE.Vector3(r.range(-0.35, 0.35), r.range(-0.1, 0.25), r.range(-0.35, 0.35))).normalize();
      p = p.clone().addScaledVector(d, len / 3);
      ctrl.push(p);
    }
    const pts = curvePts(ctrl, 8);
    geos.push(tube(pts, (t) => rad * (1 - 0.8 * t) + 0.004, depth > 1 ? 7 : 5, { capEnd: true, capRings: 2, vTile: 1.5 }));
    if (depth > 0) {
      const k = r.int(2, 3);
      for (let i = 0; i < k; i++) {
        const t = r.range(0.35, 0.9);
        const idx = Math.floor(t * (pts.length - 1));
        const nd = d.clone().add(new THREE.Vector3(r.range(-1, 1), r.range(0.1, 0.9), r.range(-1, 1))).normalize();
        branch(pts[idx], nd, len * r.range(0.4, 0.65), rad * (1 - 0.8 * t) * 0.75, depth - 1);
      }
    }
  };
  branch(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(r.range(-0.2, 0.2), 1, r.range(-0.2, 0.2)).normalize(), H, R, 3);
  return merge(geos);
}

// ------------------------------------------------------------------ mesas / buttes
const STRATA = ['#9a4a30', '#b8653e', '#c98a62', '#a8563a', '#d4a47c', '#8c4430', '#bf7650', '#c4906a'];
export type MesaKind = 'butte' | 'mesa' | 'stack' | 'spire' | 'hoodoo';

/** Layered sandstone formation, unit scale: radius ~1, height ~1 (scaled by instance). */
export function makeMesa(seed: number, kind: MesaKind, lod = 0): THREE.BufferGeometry {
  const r = new RNG(seed);
  const n3 = new Noise3(seed * 3 + 1);
  // silhouette profile: [y (0..1), radius scale]
  let prof: [number, number][];
  switch (kind) {
    case 'mesa':
      prof = [[-0.12, 2.3], [0, 2.1], [0.06, 1.8], [0.16, 1.45], [0.26, 1.2], [0.32, 1.08], [0.6, 1.03], [0.88, 1.0], [0.9, 0.97], [0.91, 0.9], [0.985, 0.88], [1.0, 0.8]];
      break;
    case 'stack':
      prof = [[-0.1, 2.0], [0, 1.85], [0.07, 1.6], [0.14, 1.42], [0.16, 1.4], [0.17, 1.18], [0.4, 1.12], [0.42, 1.1], [0.43, 0.9], [0.66, 0.86], [0.68, 0.85], [0.69, 0.66], [0.9, 0.62], [0.92, 0.6], [0.93, 0.48], [0.99, 0.46], [1.0, 0.36]];
      break;
    case 'spire':
      prof = [[-0.1, 1.6], [0, 1.45], [0.1, 1.05], [0.2, 0.75], [0.3, 0.6], [0.6, 0.52], [0.8, 0.46], [0.82, 0.5], [0.95, 0.45], [1.0, 0.3]];
      break;
    case 'hoodoo':
      prof = [[-0.1, 1.5], [0, 1.35], [0.12, 0.95], [0.25, 0.6], [0.55, 0.45], [0.72, 0.42], [0.75, 0.75], [0.78, 0.82], [0.92, 0.8], [1.0, 0.55]];
      break;
    default: // butte
      prof = [[-0.12, 2.0], [0, 1.85], [0.08, 1.5], [0.2, 1.15], [0.28, 1.0], [0.55, 0.95], [0.82, 0.92], [0.84, 0.9], [0.85, 0.8], [0.97, 0.76], [1.0, 0.62]];
  }
  // densify the profile
  const rows: [number, number, number][] = []; // y, r, tier
  let tier = 0;
  for (let i = 0; i < prof.length - 1; i++) {
    const [y0, r0] = prof[i], [y1, r1] = prof[i + 1];
    const ledge = Math.abs(y1 - y0) < 0.015;
    if (ledge) tier++;
    const steps = ledge ? 1 : Math.max(lod ? 1 : 2, Math.ceil((y1 - y0) / (lod ? 0.08 : 0.035)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      rows.push([lerp(y0, y1, t), lerp(r0, r1, t), tier]);
    }
  }
  rows.push([prof[prof.length - 1][0], prof[prof.length - 1][1], tier]);
  const seg = lod ? 36 : 80;
  const outlineOff = r.next() * 100;
  const outline = (a: number, t: number) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    return 1 + n3.fbm(ca * 1.2 + outlineOff, sa * 1.2, t * 0.35, 4) * 0.42 + n3.noise(ca * 3.2, sa * 3.2 + outlineOff, t) * 0.07;
  };
  const pos: number[] = [], col: number[] = [];
  const sand = new THREE.Color('#c9a07a');
  const tmp = new THREE.Color();
  const colorAt = (y: number, x: number, z: number, talus: number) => {
    const s = y * 11 + n3.noise(x * 2, y * 3, z * 2) * 0.8;
    const band = Math.floor(s);
    const h = (Math.sin(band * 127.1 + seed) * 43758.5453) % 1;
    const c = new THREE.Color(STRATA[Math.floor(Math.abs(h) * STRATA.length) % STRATA.length]);
    const f = s - band;
    const next = new THREE.Color(STRATA[Math.floor(Math.abs((Math.sin((band + 1) * 127.1 + seed) * 43758.5453) % 1) * STRATA.length) % STRATA.length]);
    c.lerp(next, smoothstep(0.85, 1.0, f) * 0.6);
    const streak = 0.9 + 0.12 * n3.noise(x * 6, y * 0.5, z * 6);
    c.multiplyScalar(streak);
    tmp.copy(c).lerp(sand, talus);
    return tmp;
  };
  for (let j = 0; j < rows.length; j++) {
    const [y, rr, t] = rows[j];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const o = outline(a, t * 0.9 + (y > 0.3 ? 0.4 : 0));
      const gully = 1 + n3.noise(Math.cos(a) * 9, y * 6, Math.sin(a) * 9) * 0.05 * smoothstep(0.15, 0.4, y);
      const R = rr * o * gully;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      pos.push(x, y, z);
      const talus = clamp((0.22 - y) / 0.18, 0, 1) * (0.55 + 0.35 * n3.noise(x * 3, 0, z * 3));
      const c = colorAt(y, x, z, talus);
      const ao = 0.72 + 0.28 * smoothstep(-0.05, 0.4, y);
      col.push(c.r * ao, c.g * ao, c.b * ao);
    }
  }
  // top cap
  const topY = rows[rows.length - 1][0];
  const capStart = pos.length / 3;
  pos.push(0, topY + 0.004, 0);
  const ct = colorAt(topY, 0, 0, 0.35);
  col.push(ct.r, ct.g, ct.b);
  const idx: number[] = [];
  const V = seg + 1;
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const lastRow = (rows.length - 1) * V;
  for (let i = 0; i < seg; i++) idx.push(lastRow + i, capStart, lastRow + i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function scaleGeo(g: THREE.BufferGeometry, s: number) {
  return placed(g, 0, 0, 0, 0, 0, 0, s, s, s);
}
