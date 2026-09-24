import * as THREE from 'three';
import { boxUV, merge, lathe, tube } from '../models/geom';
import { Materials } from '../gfx/materials';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface Opening {
  at: number; // distance along the wall to the opening centre
  w: number;
  y0: number;
  y1: number;
  kind: 'door' | 'window' | 'gap' | 'gate';
  hinge?: 'l' | 'r';
  doorMat?: THREE.Material;
  double?: boolean;
}
export interface DoorDef {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  t: number;
  ry: number; // wall direction angle
  hinge: 'l' | 'r';
  mat: THREE.Material;
  open: number; // max open angle
  kind: 'door' | 'gate' | 'cabinet';
  handle?: boolean;
}
export interface LootPoint {
  x: number;
  y: number;
  z: number;
  table: string;
  spread?: number;
  chance?: number;
}
export interface InteractPoint {
  kind: 'pump' | 'bed' | 'tap' | 'mailbox' | 'switch' | 'well' | 'sign' | 'vending' | 'phone' | 'radio';
  x: number;
  y: number;
  z: number;
  r: number;
  data?: any;
}
export interface LightDef {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  dist: number;
  bulb?: boolean;
}
export interface ColDef {
  hx: number;
  hy: number;
  hz: number;
  x: number;
  y: number;
  z: number;
  ry: number;
}

/** Accumulates building geometry (merged per material), colliders and gameplay points. */
export class Kit {
  geos = new Map<THREE.Material, THREE.BufferGeometry[]>();
  cols: ColDef[] = [];
  doors: DoorDef[] = [];
  loot: LootPoint[] = [];
  lights: LightDef[] = [];
  interact: InteractPoint[] = [];
  wrecks: { x: number; z: number; ry: number; parts?: number }[] = [];
  items: { id: string; x: number; y: number; z: number; ry?: number; state?: any }[] = [];
  extra: THREE.Object3D[] = [];
  interior: { x0: number; z0: number; x1: number; z1: number; y1: number }[] = [];
  /** Floor height used by furniture helpers. */
  baseY = 0;
  constructor(public m: Materials) {}

  add(mat: THREE.Material, g: THREE.BufferGeometry) {
    let l = this.geos.get(mat);
    if (!l) this.geos.set(mat, (l = []));
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    if (!n.attributes.normal) n.computeVertexNormals();
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    l.push(n);
  }
  col(hx: number, hy: number, hz: number, x: number, y: number, z: number, ry = 0) {
    this.cols.push({ hx, hy, hz, x, y, z, ry });
  }
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, collide = true, tile = 1) {
    const g = boxUV(w, h, d, tile);
    g.rotateY(ry);
    g.translate(x, y, z);
    this.add(mat, g);
    if (collide) this.col(w / 2, h / 2, d / 2, x, y, z, ry);
  }
  /** Wall from (x0,z0) to (x1,z1) with openings; thickness t, height h, base y0. */
  wall(mat: THREE.Material, x0: number, z0: number, x1: number, z1: number, h: number, t: number, openings: Opening[] = [], y0 = 0, tile = 2, frameMat?: THREE.Material) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    const ry = Math.atan2(-uz, ux);
    const at = (s: number) => [x0 + ux * s, z0 + uz * s] as [number, number];
    const seg = (s0: number, s1: number, ya: number, yb: number, collide = true) => {
      if (s1 - s0 < 0.01 || yb - ya < 0.01) return;
      const [cx, cz] = at((s0 + s1) / 2);
      this.box(mat, s1 - s0, yb - ya, t, cx, y0 + (ya + yb) / 2, cz, ry, collide, tile);
    };
    const ops = [...openings].sort((a, b) => a.at - b.at);
    let s = 0;
    const fm = frameMat ?? this.m.woodLight;
    for (const o of ops) {
      const a = o.at - o.w / 2, b = o.at + o.w / 2;
      seg(s, a, 0, h);
      if (o.y0 > 0) seg(a, b, 0, o.y0);
      if (o.y1 < h) seg(a, b, o.y1, h);
      // frame
      const ft = 0.07;
      const [cx, cz] = at(o.at);
      const fr = (w: number, hh: number, ss: number, yy: number) => {
        const [px, pz] = at(ss);
        this.box(fm, w, hh, t + 0.04, px, y0 + yy, pz, ry, false, 1);
      };
      fr(ft, o.y1 - o.y0, a + ft / 2, (o.y0 + o.y1) / 2);
      fr(ft, o.y1 - o.y0, b - ft / 2, (o.y0 + o.y1) / 2);
      fr(o.w, ft, o.at, o.y1 - ft / 2);
      if (o.kind === 'window') {
        fr(o.w + 0.1, ft, o.at, o.y0 + ft / 2);
        // cross bars
        fr(0.035, o.y1 - o.y0, o.at, (o.y0 + o.y1) / 2);
        fr(o.w, 0.035, o.at, (o.y0 + o.y1) / 2);
        const gl = new THREE.PlaneGeometry(o.w - 0.1, o.y1 - o.y0 - 0.1);
        gl.rotateY(ry);
        gl.translate(cx, y0 + (o.y0 + o.y1) / 2, cz);
        this.add(this.m.glassDirty, gl);
        this.col(o.w / 2, (o.y1 - o.y0) / 2, t / 2, cx, y0 + (o.y0 + o.y1) / 2, cz, ry);
      } else if (o.kind === 'door' || o.kind === 'gate') {
        const dm = o.doorMat ?? this.m.woodDark;
        if (o.double) {
          const hw = o.w / 2;
          const [lx, lz] = at(a);
          const [rx, rz] = at(b);
          this.doors.push({ x: lx, y: y0 + o.y0, z: lz, w: hw - 0.01, h: o.y1 - o.y0 - 0.02, t: 0.05, ry, hinge: 'l', mat: dm, open: 1.75, kind: o.kind });
          this.doors.push({ x: rx, y: y0 + o.y0, z: rz, w: hw - 0.01, h: o.y1 - o.y0 - 0.02, t: 0.05, ry, hinge: 'r', mat: dm, open: 1.75, kind: o.kind });
        } else {
          const hl = o.hinge ?? 'l';
          const [hx, hz] = at(hl === 'l' ? a + 0.02 : b - 0.02);
          this.doors.push({ x: hx, y: y0 + o.y0, z: hz, w: o.w - 0.04, h: o.y1 - o.y0 - 0.02, t: 0.045, ry, hinge: hl, mat: dm, open: 1.6, kind: 'door', handle: true });
        }
      }
      s = b;
    }
    seg(s, L, 0, h);
  }
  /** Pitched roof over a w×d rectangle centred at (cx,cz); ridge along the local x axis. */
  gableRoof(mat: THREE.Material, cx: number, cz: number, w: number, d: number, eaveY: number, rise: number, over = 0.4, gableMat?: THREE.Material) {
    const hd = d / 2 + over, hw = w / 2 + over;
    const slope = Math.hypot(hd, rise);
    const ang = Math.atan2(rise, hd);
    for (const s of [-1, 1]) {
      const g = boxUV(w + over * 2, 0.06, slope, 1.2);
      g.rotateX(s * ang);
      g.translate(cx, eaveY + rise / 2, cz + (s * hd) / 2);
      this.add(mat, g);
      this.col(hw, 0.05, slope / 2, cx, eaveY + rise / 2, cz + (s * hd) / 2, 0);
    }
    // gable triangles
    const gm = gableMat ?? this.m.woodDark;
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-d / 2, 0);
      sh.lineTo(d / 2, 0);
      sh.lineTo(0, rise * (d / 2) / hd);
      sh.lineTo(-d / 2, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false });
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
      g.rotateY(Math.PI / 2);
      g.translate(cx + s * (w / 2) - (s > 0 ? 0.1 : 0), eaveY, cz);
      this.add(gm, g);
    }
    // ridge cap
    this.box(this.m.metalDark, w + over * 2, 0.06, 0.18, cx, eaveY + rise + 0.02, cz, 0, false);
  }
  /** Single slope roof; high side at z = cz - d/2. */
  shedRoof(mat: THREE.Material, cx: number, cz: number, w: number, d: number, lowY: number, highY: number, over = 0.35) {
    const L = Math.hypot(d + over * 2, highY - lowY);
    const ang = Math.atan2(highY - lowY, d + over * 2);
    const g = boxUV(w + over * 2, 0.05, L, 1.2);
    g.rotateX(-ang);
    g.translate(cx, (lowY + highY) / 2 + 0.03, cz);
    this.add(mat, g);
    this.col((w + over * 2) / 2, 0.05, L / 2, cx, (lowY + highY) / 2, cz, 0);
  }
  floor(mat: THREE.Material, cx: number, cz: number, w: number, d: number, y = 0, th = 0.12, tile = 2) {
    this.box(mat, w, th, d, cx, y - th / 2, cz, 0, true, tile);
  }

  // ---------------------------------------------------------------- furniture
  shelf(x: number, z: number, ry: number, w = 1.6, levels = 4, table = 'shelf', depth = 0.45) {
    const m = this.m.woodLight;
    const c = Math.cos(ry), s = Math.sin(ry);
    const L = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
    const H = 1.9;
    for (const px of [-w / 2 + 0.03, w / 2 - 0.03]) for (const pz of [-depth / 2 + 0.03, depth / 2 - 0.03]) {
      const [ax, az] = L(px, pz);
      this.box(m, 0.05, H, 0.05, ax, this.baseY + H / 2, az, ry, false);
    }
    for (let i = 0; i < levels; i++) {
      const y = this.baseY + 0.12 + i * ((H - 0.2) / (levels - 1));
      const [ax, az] = L(0, 0);
      this.box(m, w, 0.025, depth, ax, y, az, ry, true);
      if (i < levels) this.loot.push({ x: ax, y: y + 0.05, z: az, table, spread: w * 0.35, chance: 0.55 });
    }
  }
  table(x: number, z: number, ry: number, w = 1.2, d = 0.7, h = 0.76, mat?: THREE.Material, loot?: string) {
    const m = mat ?? this.m.woodLight;
    const b = this.baseY;
    this.box(m, w, 0.04, d, x, b + h, z, ry, true);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const px of [-w / 2 + 0.05, w / 2 - 0.05]) for (const pz of [-d / 2 + 0.05, d / 2 - 0.05]) this.box(m, 0.05, h, 0.05, x + px * c + pz * s, b + h / 2, z - px * s + pz * c, ry, false);
    if (loot) this.loot.push({ x, y: b + h + 0.05, z, table: loot, spread: w * 0.3, chance: 0.6 });
  }
  bed(x: number, z: number, ry: number) {
    const b = this.baseY;
    this.box(this.m.metalDark, 0.95, 0.35, 2.0, x, b + 0.18, z, ry, true);
    this.box(this.m.fabric('#7a6a5a'), 0.9, 0.16, 1.95, x, b + 0.43, z, ry, false);
    const c = Math.cos(ry), s = Math.sin(ry);
    this.box(this.m.fabric('#d8d0c0'), 0.6, 0.1, 0.35, x + 0.8 * s, b + 0.56, z + 0.8 * c, ry, false);
    this.interact.push({ kind: 'bed', x, y: b + 0.5, z, r: 1.1 });
  }
  counter(x: number, z: number, ry: number, w: number, loot?: string) {
    const b = this.baseY;
    this.box(this.m.woodDark, w, 0.9, 0.6, x, b + 0.45, z, ry, true, 2);
    this.box(this.m.concrete, w + 0.04, 0.04, 0.64, x, b + 0.92, z, ry, false, 2);
    if (loot) this.loot.push({ x, y: b + 0.97, z, table: loot, spread: w * 0.35, chance: 0.7 });
  }
  fridge(x: number, z: number, ry: number) {
    const b = this.baseY;
    this.box(this.m.flat('#e6e2d6', 0.4), 0.7, 1.7, 0.65, x, b + 0.85, z, ry, true);
    this.box(this.m.chrome, 0.03, 0.4, 0.03, x + 0.28 * Math.cos(ry) + 0.34 * Math.sin(ry), b + 1.1, z - 0.28 * Math.sin(ry) + 0.34 * Math.cos(ry), ry, false);
    this.loot.push({ x: x + Math.sin(ry) * 0.55, y: b + 0.05, z: z + Math.cos(ry) * 0.55, table: 'kitchen', spread: 0.2, chance: 0.5 });
  }
  crates(x: number, z: number, n: number) {
    for (let i = 0; i < n; i++) this.items.push({ id: 'crate', x: x + (i % 2) * 0.62, y: 0.3 + Math.floor(i / 2) * 0.58, z: z + (i % 3) * 0.1, ry: i * 0.2 });
  }
  barrel(x: number, z: number, color = '#3a5a8a', state?: any) {
    this.items.push({ id: 'barrel', x, y: 0.45, z, state: { color, ...(state || {}) } });
  }
  lamp(x: number, y: number, z: number, color = 0xffd9a0, intensity = 18, dist = 14) {
    const cord = new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4);
    cord.translate(x, y + 0.2, z);
    this.add(this.m.black, cord);
    const shade = new THREE.ConeGeometry(0.16, 0.12, 12, 1, true);
    shade.translate(x, y + 0.02, z);
    this.add(this.m.painted('#3a4a3a', 0.4, 0.5), shade);
    this.lights.push({ x, y: y - 0.06, z, color, intensity, dist, bulb: true });
  }
}

/** Petrol pump model (1970s): body, display, nozzle and hose. */
export function pumpGeometry(m: Materials, color: string) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.62, 1.55, 0.42, 3, 0.04), m.painted(color, 0.5, 0.5));
  body.position.y = 0.78;
  const top = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.32, 0.46, 3, 0.05), m.flat('#e8e4d8', 0.5));
  top.position.y = 1.7;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.5), m.metalDark);
  base.position.y = 0.05;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a1a14, emissive: 0x506030, emissiveIntensity: 0.2, roughness: 0.3 }));
  disp.position.set(0, 1.22, 0.212);
  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.08), m.metalDark);
  holster.position.set(0.2, 0.9, 0.24);
  const nozzle = new THREE.Mesh(tube([new THREE.Vector3(0.2, 0.98, 0.26), new THREE.Vector3(0.2, 0.86, 0.3), new THREE.Vector3(0.2, 0.82, 0.36)], () => 0.018, 6), m.metalBare);
  const hose = new THREE.Mesh(tube([new THREE.Vector3(0.28, 1.35, 0.2), new THREE.Vector3(0.36, 0.9, 0.26), new THREE.Vector3(0.33, 0.45, 0.3), new THREE.Vector3(0.22, 0.8, 0.28)], () => 0.016, 6), m.rubber);
  g.add(body, top, base, disp, holster, nozzle, hose);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function mailboxGeometry(m: Materials) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), m.woodDark);
  post.position.y = 0.55;
  const sh = new THREE.Shape();
  sh.moveTo(-0.12, 0);
  sh.lineTo(0.12, 0);
  sh.lineTo(0.12, 0.14);
  sh.absarc(0, 0.14, 0.12, 0, Math.PI, false);
  sh.lineTo(-0.12, 0);
  const box = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: false }), m.painted('#7a8a90', 0.6, 0.5));
  box.position.set(0, 1.1, -0.22);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.06), m.flat('#b02020', 0.6));
  flag.position.set(0.13, 1.28, 0.05);
  g.add(post, box, flag);
  return g;
}
