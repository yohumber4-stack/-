import * as THREE from 'three';
import { WorldFn, ROAD_HALF, ROAD_START_Z, SEGMENT_LEN, Pad } from './worldfn';
import { RNG, hashSeed, clamp } from '../core/math';

export interface PropLod {
  geo: THREE.BufferGeometry;
  maxDist: number;
  castShadow: boolean;
  capacity: number;
}
export interface PropKind {
  id: string;
  lods: PropLod[];
  material: THREE.Material;
  collider?: { r: number; h: number };
}
export interface Inst {
  kind: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  s: number;
  sy: number;
  tilt: number;
}

type Rule = (fn: WorldFn, rng: RNG, cx: number, cz: number, size: number, out: Inst[], kindIndex: (id: string) => number, ok: (x: number, z: number, margin: number) => boolean) => void;

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

/** Deterministic cell-based instanced scattering with distance LODs. */
export class Scatter {
  group = new THREE.Group();
  private meshes: THREE.InstancedMesh[][] = [];
  private cells = new Map<string, Inst[]>();
  private lastKey = '';
  originX = 0;
  originZ = 0;
  private kindIdx = new Map<string, number>();
  radius: number;

  constructor(private fn: WorldFn, public kinds: PropKind[], private rules: Rule[], public cellSize = 128, private seed = 1) {
    this.radius = Math.max(...kinds.map((k) => k.lods[k.lods.length - 1].maxDist));
    kinds.forEach((k, i) => {
      this.kindIdx.set(k.id, i);
      this.meshes[i] = k.lods.map((l) => {
        const m = new THREE.InstancedMesh(l.geo, k.material, l.capacity);
        m.castShadow = l.castShadow;
        m.receiveShadow = true;
        m.count = 0;
        m.frustumCulled = false;
        m.name = k.id;
        this.group.add(m);
        return m;
      });
    });
  }

  kindIndex = (id: string) => this.kindIdx.get(id) ?? -1;

  private okFn = (x: number, z: number, margin: number) => {
    const fn = this.fn;
    if (z > ROAD_START_Z - 30 && Math.abs(fn.roadDist(x, z)) < ROAD_HALF + margin) return false;
    const seg = Math.floor(z / SEGMENT_LEN);
    for (let s = seg - 1; s <= seg + 1; s++) {
      const pads = fn.getPads(s);
      for (const p of pads) if (inPad(p, x, z, 3 + margin)) return false;
    }
    return true;
  };

  private cell(ix: number, iz: number): Inst[] {
    const key = ix + ',' + iz;
    let c = this.cells.get(key);
    if (c) return c;
    c = [];
    const rng = new RNG(hashSeed(ix, iz, this.seed, 77));
    for (const rule of this.rules) rule(this.fn, rng, ix * this.cellSize, iz * this.cellSize, this.cellSize, c, this.kindIndex, this.okFn);
    this.cells.set(key, c);
    if (this.cells.size > 4000) {
      // drop far cells
      for (const k of this.cells.keys()) { this.cells.delete(k); if (this.cells.size < 2500) break; }
    }
    return c;
  }

  setOrigin(ox: number, oz: number) {
    this.originX = ox;
    this.originZ = oz;
    this.lastKey = '';
  }

  invalidate() {
    this.cells.clear();
    this.lastKey = '';
  }

  private lastX = 1e9;
  private lastZ = 1e9;
  /** Minimum camera travel before instances are re-bucketed into LODs. */
  step = 24;

  update(camX: number, camZ: number) {
    const cs = this.cellSize;
    const cx = Math.floor(camX / cs), cz = Math.floor(camZ / cs);
    if (this.lastKey !== '' && Math.hypot(camX - this.lastX, camZ - this.lastZ) < this.step) return;
    this.lastKey = cx + ',' + cz;
    this.lastX = camX;
    this.lastZ = camZ;
    const R = Math.ceil(this.radius / cs);
    const counts = this.meshes.map((l) => l.map(() => 0));
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++) {
        const ix = cx + dx, iz = cz + dz;
        const ccx = (ix + 0.5) * cs, ccz = (iz + 0.5) * cs;
        const dist = Math.max(0, Math.hypot(ccx - camX, ccz - camZ) - cs * 0.5);
        if (dist > this.radius) continue;
        const insts = this.cell(ix, iz);
        for (const it of insts) {
          const kind = this.kinds[it.kind];
          const d = Math.hypot(it.x - camX, it.z - camZ);
          let li = -1;
          for (let l = 0; l < kind.lods.length; l++) if (d <= kind.lods[l].maxDist) { li = l; break; }
          if (li < 0) continue;
          const mesh = this.meshes[it.kind][li];
          const n = counts[it.kind][li];
          if (n >= kind.lods[li].capacity) continue;
          tmpE.set(it.tilt * Math.cos(it.rot * 3), it.rot, it.tilt * Math.sin(it.rot * 3), 'YXZ');
          tmpQ.setFromEuler(tmpE);
          tmpS.set(it.s, it.s * it.sy, it.s);
          tmpP.set(it.x - this.originX, it.y, it.z - this.originZ);
          tmpM.compose(tmpP, tmpQ, tmpS);
          mesh.setMatrixAt(n, tmpM);
          counts[it.kind][li] = n + 1;
        }
      }
    this.meshes.forEach((l, k) =>
      l.forEach((m, li) => {
        m.count = counts[k][li];
        m.instanceMatrix.needsUpdate = true;
      }),
    );
  }

  /** Instances with colliders within radius r of (x,z) (world coordinates). */
  collidersNear(x: number, z: number, r: number, out: { inst: Inst; kind: PropKind }[] = []) {
    const cs = this.cellSize;
    const ix0 = Math.floor((x - r) / cs), ix1 = Math.floor((x + r) / cs);
    const iz0 = Math.floor((z - r) / cs), iz1 = Math.floor((z + r) / cs);
    for (let iz = iz0; iz <= iz1; iz++)
      for (let ix = ix0; ix <= ix1; ix++)
        for (const it of this.cell(ix, iz)) {
          const k = this.kinds[it.kind];
          if (!k.collider) continue;
          if ((it.x - x) ** 2 + (it.z - z) ** 2 < r * r) out.push({ inst: it, kind: k });
        }
    return out;
  }
}

export function inPad(p: Pad, x: number, z: number, margin: number) {
  const dx = x - p.x, dz = z - p.z;
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return Math.abs(dx * c - dz * s) < p.hw + margin && Math.abs(dx * s + dz * c) < p.hd + margin;
}

/** Desert vegetation / rock rules. */
export function desertRules(): Rule[] {
  const place = (fn: WorldFn, rng: RNG, cx: number, cz: number, size: number, count: number, margin: number, f: (x: number, y: number, z: number) => void, ok: (x: number, z: number, m: number) => boolean) => {
    for (let i = 0; i < count; i++) {
      const x = cx + rng.next() * size, z = cz + rng.next() * size;
      if (!ok(x, z, margin)) continue;
      f(x, fn.height(x, z), z);
    }
  };
  return [
    (fn, rng, cx, cz, size, out, K, ok) => {
      const veg = fn.vegetation(cx + size / 2, cz + size / 2);
      const dune = fn.duneMask(cx + size / 2, cz + size / 2);
      const kS = ['saguaro0', 'saguaro1', 'saguaro2', 'saguaro3', 'saguaro4', 'saguaro5'].map(K);
      const nC = Math.round(veg * 9 * (1 - dune * 0.7) + rng.next() * 2);
      place(fn, rng, cx, cz, size, nC, 4, (x, y, z) => out.push({ kind: rng.pick(kS), x, y: y - 0.05, z, rot: rng.next() * 6.28, s: rng.range(0.85, 1.35), sy: rng.range(0.9, 1.1), tilt: rng.range(0, 0.06) }), ok);
      const kB = K('barrel');
      place(fn, rng, cx, cz, size, Math.round(veg * 2.5 * (1 - dune * 0.6)), 3, (x, y, z) => out.push({ kind: kB, x, y: y - 0.03, z, rot: rng.next() * 6.28, s: rng.range(0.7, 1.3), sy: 1, tilt: 0.05 }), ok);
      const kBu = [K('bush0'), K('bush1'), K('bush2')];
      place(fn, rng, cx, cz, size, Math.round(4 + veg * 12), 2.5, (x, y, z) => out.push({ kind: rng.pick(kBu), x, y: y - 0.02, z, rot: rng.next() * 6.28, s: rng.range(0.6, 1.4), sy: rng.range(0.7, 1.1), tilt: 0 }), ok);
      const kG = K('grass');
      const nG = Math.round(30 + veg * 70 * (1 - dune * 0.5));
      // clumped grass
      for (let c = 0; c < 5; c++) {
        const gx = cx + rng.next() * size, gz = cz + rng.next() * size;
        const nn = Math.round(nG / 5);
        for (let i = 0; i < nn; i++) {
          const x = gx + rng.gauss() * 9, z = gz + rng.gauss() * 9;
          if (!ok(x, z, 1.2)) continue;
          out.push({ kind: kG, x, y: fn.height(x, z) - 0.02, z, rot: rng.next() * 6.28, s: rng.range(0.55, 1.2), sy: rng.range(0.7, 1.25), tilt: 0 });
        }
      }
      const kR = [K('rock0'), K('rock1'), K('rock2'), K('rock3')];
      place(fn, rng, cx, cz, size, 5 + rng.int(0, 5), 2, (x, y, z) => out.push({ kind: rng.pick(kR), x, y: y - 0.05, z, rot: rng.next() * 6.28, s: rng.range(0.12, 0.45), sy: 1, tilt: 0.2 }), ok);
      if (rng.chance(0.55)) place(fn, rng, cx, cz, size, 1 + rng.int(0, 1), 4, (x, y, z) => out.push({ kind: rng.pick(kR), x, y: y - 0.15, z, rot: rng.next() * 6.28, s: rng.range(0.6, 1.6), sy: 1, tilt: 0.15 }), ok);
      if (rng.chance(0.06)) place(fn, rng, cx, cz, size, 1, 6, (x, y, z) => out.push({ kind: rng.pick(kR), x, y: y - 0.5, z, rot: rng.next() * 6.28, s: rng.range(2.2, 4.5), sy: 1, tilt: 0.1 }), ok);
      const kT = [K('tree0'), K('tree1'), K('tree2')];
      if (rng.chance(0.14 + veg * 0.1)) place(fn, rng, cx, cz, size, 1, 5, (x, y, z) => out.push({ kind: rng.pick(kT), x, y: y - 0.1, z, rot: rng.next() * 6.28, s: rng.range(0.8, 1.2), sy: 1, tilt: rng.range(0, 0.12) }), ok);
    },
  ];
}

/** Big rock formations on a coarse grid, visible from kilometres away. */
export function mesaRules(): Rule[] {
  return [
    (fn, rng, cx, cz, size, out, K, ok) => {
      const n = rng.chance(0.55) ? (rng.chance(0.4) ? 2 : 1) : 0;
      for (let i = 0; i < n; i++) {
        const x = cx + rng.range(0.15, 0.85) * size, z = cz + rng.range(0.15, 0.85) * size;
        const kind = K('mesa' + rng.int(0, 11));
        const R = rng.range(35, 150) * (rng.chance(0.15) ? 1.8 : 1);
        const H = clamp(R * rng.range(0.55, 1.2), 30, 190);
        if (!ok(x, z, R * 2.4 + 40)) continue;
        if (z < ROAD_START_Z + 400 && Math.abs(x) < 800) continue;
        out.push({ kind, x, y: fn.height(x, z) - H * 0.02, z, rot: rng.next() * 6.28, s: R, sy: H / R, tilt: 0 });
      }
    },
  ];
}
