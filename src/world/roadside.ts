import * as THREE from 'three';
import { WorldFn, ROAD_START_Z } from './worldfn';
import { Materials } from '../gfx/materials';
import { tube, merge, placed } from '../models/geom';
import { RNG, hashSeed } from '../core/math';
import { roadSignTex } from '../gfx/canvasTex';

const POLE_STEP = 48;
const CHUNK = POLE_STEP * 10;
const POLE_OFFSET = 9.6;
const INSULATORS = [-1.02, -0.38, 0.38, 1.02];
const ARM_Y = 7.85;

function poleGeometry(detail: boolean): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const post = new THREE.CylinderGeometry(0.105, 0.15, 8.6, detail ? 10 : 6, 1);
  const uv = post.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 4.3);
  post.translate(0, 4.3 - 0.35, 0);
  geos.push(post);
  const arm = new THREE.BoxGeometry(2.5, 0.11, 0.12);
  arm.translate(0, ARM_Y, 0.13);
  geos.push(arm);
  if (detail) {
    for (const s of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.05, 0.9, 0.05);
      b.rotateZ(s * 0.75);
      b.translate(s * 0.33, ARM_Y - 0.33, 0.13);
      geos.push(b);
    }
    const top = new THREE.CylinderGeometry(0.1, 0.105, 0.06, 8);
    top.translate(0, 8.25 - 0.35 + 0.03, 0);
    geos.push(top);
  }
  return merge(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
}

function insulatorGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (const x of INSULATORS) {
    const pin = new THREE.CylinderGeometry(0.012, 0.012, 0.1, 5);
    pin.translate(x, ARM_Y + 0.1, 0.13);
    const ins = new THREE.LatheGeometry(
      [[0.001, 0], [0.045, 0.0], [0.05, 0.03], [0.036, 0.05], [0.042, 0.075], [0.03, 0.1], [0.022, 0.13], [0.001, 0.135]].map(([r, y]) => new THREE.Vector2(r, y)),
      8,
    );
    ins.translate(x, ARM_Y + 0.12, 0.13);
    geos.push(pin.toNonIndexed(), ins.toNonIndexed());
  }
  return merge(geos);
}

interface Chunk {
  poles: THREE.Matrix4[];
  wires: THREE.Mesh | null;
  signs: THREE.Object3D[];
  worldPoles: { x: number; y: number; z: number }[];
}

/** Telephone poles with sagging wires along the right side of the road, km posts and signs. */
export class Roadside {
  group = new THREE.Group();
  private poleMesh: THREE.InstancedMesh;
  private poleLow: THREE.InstancedMesh;
  private insMesh: THREE.InstancedMesh;
  private chunks = new Map<number, Chunk>();
  originX = 0;
  originZ = 0;
  range = 2600;
  private lastKey = '';
  private signMats = new Map<string, THREE.Material>();

  constructor(private fn: WorldFn, private mats: Materials, private seed: number) {
    this.poleMesh = new THREE.InstancedMesh(poleGeometry(true), mats.pole, 200);
    this.poleMesh.castShadow = true;
    this.poleLow = new THREE.InstancedMesh(poleGeometry(false), mats.pole, 400);
    this.insMesh = new THREE.InstancedMesh(insulatorGeometry(), mats.ceramic, 200);
    for (const m of [this.poleMesh, this.poleLow, this.insMesh]) {
      m.count = 0;
      m.frustumCulled = false;
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  private poleFrame(z: number) {
    const fn = this.fn;
    const dx = fn.roadDX(z);
    const l = Math.hypot(dx, 1);
    const fx = dx / l, fz = 1 / l;
    const rx = -fz, rz = fx; // right
    const cx = fn.roadX(z);
    const x = cx + rx * POLE_OFFSET, pz = z + rz * POLE_OFFSET;
    const y = fn.height(x, pz);
    return { x, y, z: pz, yaw: Math.atan2(fx, fz) };
  }

  private buildChunk(ci: number): Chunk {
    const rng = new RNG(hashSeed(ci, this.seed, 31));
    const poles: THREE.Matrix4[] = [];
    const worldPoles: { x: number; y: number; z: number }[] = [];
    const tops: THREE.Vector3[][] = [];
    const z0 = ci * CHUNK;
    for (let k = 0; k <= 10; k++) {
      const z = z0 + k * POLE_STEP;
      if (z < ROAD_START_Z + 10) { tops.push([]); continue; }
      const f = this.poleFrame(z);
      const lean = new THREE.Euler(rng.range(-0.04, 0.04), f.yaw + rng.range(-0.05, 0.05), rng.range(-0.035, 0.035), 'YXZ');
      const m = new THREE.Matrix4().compose(new THREE.Vector3(f.x, f.y, f.z), new THREE.Quaternion().setFromEuler(lean), new THREE.Vector3(1, 1, 1));
      if (k < 10) {
        poles.push(m);
        worldPoles.push({ x: f.x, y: f.y, z: f.z });
      }
      tops.push(INSULATORS.map((ix) => new THREE.Vector3(ix, ARM_Y + 0.24, 0.13).applyMatrix4(m)));
    }
    // wires
    const geos: THREE.BufferGeometry[] = [];
    const bx = this.fn.roadX(z0), bz = z0;
    for (let k = 0; k < 10; k++) {
      const a = tops[k], b = tops[k + 1];
      if (!a.length || !b.length) continue;
      for (let w = 0; w < a.length; w++) {
        const pts: THREE.Vector3[] = [];
        const sag = 0.55 + ((k * 7 + w * 3) % 5) * 0.06;
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          const p = a[w].clone().lerp(b[w], t);
          p.y -= sag * 4 * t * (1 - t);
          p.x -= bx;
          p.z -= bz;
          pts.push(p);
        }
        geos.push(tube(pts, () => 0.011, 3));
      }
    }
    let wires: THREE.Mesh | null = null;
    if (geos.length) {
      wires = new THREE.Mesh(merge(geos), this.mats.wire);
      wires.userData.base = [bx, bz];
      wires.position.set(bx - this.originX, 0, bz - this.originZ);
      wires.matrixAutoUpdate = false;
      wires.updateMatrix();
      this.group.add(wires);
    }
    // km post every 1000 m, occasional roadside signs
    const signs: THREE.Object3D[] = [];
    for (let z = Math.ceil(z0 / 1000) * 1000; z < z0 + CHUNK; z += 1000) {
      if (z <= 0) continue;
      signs.push(this.makeKmPost(z));
    }
    return { poles, wires, signs, worldPoles };
  }

  private signMat(text: string) {
    let m = this.signMats.get(text);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: roadSignTex([text], { w: 256, h: 160 }), roughness: 0.6, metalness: 0.2 });
      this.signMats.set(text, m);
    }
    return m;
  }

  private makeKmPost(z: number): THREE.Object3D {
    const fn = this.fn;
    const dx = fn.roadDX(z);
    const l = Math.hypot(dx, 1);
    const fx = dx / l, fz = 1 / l;
    const rx = -fz, rz = fx;
    const x = fn.roadX(z) + rx * 5.6, pz = z + rz * 5.6;
    const g = new THREE.Group();
    const post = new THREE.Mesh(placed(new THREE.BoxGeometry(0.08, 1.6, 0.06), 0, 0.8, 0), this.mats.painted('#d8d8d0', 0.4));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), this.signMat(String(z / 1000)));
    plate.position.set(0, 1.45, -0.035);
    plate.rotation.y = Math.PI;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.41, 0.02), this.mats.metalDark);
    back.position.set(0, 1.45, -0.02);
    post.castShadow = true;
    g.add(post, back, plate);
    g.position.set(x - this.originX, fn.height(x, pz), pz - this.originZ);
    g.userData.world = [x, pz];
    g.rotation.y = Math.atan2(fx, fz);
    this.group.add(g);
    return g;
  }

  setOrigin(ox: number, oz: number) {
    this.originX = ox;
    this.originZ = oz;
    for (const c of this.chunks.values()) {
      if (c.wires) {
        const [bx, bz] = c.wires.userData.base;
        c.wires.position.set(bx - ox, 0, bz - oz);
        c.wires.updateMatrix();
      }
      for (const s of c.signs) {
        const [x, z] = s.userData.world;
        s.position.x = x - ox;
        s.position.z = z - oz;
      }
    }
    this.lastKey = '';
  }

  /** World positions of poles near a point (for physics colliders). */
  polesNear(x: number, z: number, r: number) {
    const out: { x: number; y: number; z: number }[] = [];
    for (const c of this.chunks.values()) for (const p of c.worldPoles) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) out.push(p);
    return out;
  }

  update(camX: number, camZ: number) {
    const i0 = Math.floor((camZ - this.range) / CHUNK), i1 = Math.floor((camZ + this.range) / CHUNK);
    const key = i0 + ':' + Math.floor(camZ / 60);
    if (key === this.lastKey) return;
    this.lastKey = key;
    for (let i = i0; i <= i1; i++) if (!this.chunks.has(i) && (i + 1) * CHUNK > ROAD_START_Z) this.chunks.set(i, this.buildChunk(i));
    for (const [i, c] of this.chunks) {
      if (i < i0 - 1 || i > i1 + 1) {
        if (c.wires) { this.group.remove(c.wires); c.wires.geometry.dispose(); }
        for (const s of c.signs) this.group.remove(s);
        this.chunks.delete(i);
      }
    }
    let n0 = 0, n1 = 0;
    const tmp = new THREE.Matrix4();
    for (const c of this.chunks.values())
      for (const m of c.poles) {
        tmp.copy(m);
        tmp.elements[12] -= this.originX;
        tmp.elements[14] -= this.originZ;
        const d = Math.abs(m.elements[14] - camZ);
        if (d < 450 && n0 < 200) {
          this.poleMesh.setMatrixAt(n0, tmp);
          this.insMesh.setMatrixAt(n0, tmp);
          n0++;
        } else if (n1 < 400) this.poleLow.setMatrixAt(n1++, tmp);
      }
    this.poleMesh.count = n0;
    this.insMesh.count = n0;
    this.poleLow.count = n1;
    this.poleMesh.instanceMatrix.needsUpdate = true;
    this.insMesh.instanceMatrix.needsUpdate = true;
    this.poleLow.instanceMatrix.needsUpdate = true;
  }
}
