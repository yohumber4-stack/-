import * as THREE from 'three';
import { WorldFn, Pad, SEGMENT_LEN, ROAD_HALF } from './worldfn';
import { Kit, DoorDef } from './buildkit';
import { buildPoi, PoiType, POI_SIZE } from './pois';
import { pumpGeometry, mailboxGeometry } from './buildkit';
import { Materials } from '../gfx/materials';
import { RAPIER, Physics, StaticHandle } from '../physics/physics';
import { RNG, hashSeed, hash2, clamp } from '../core/math';
import { ItemManager } from '../game/items';
import { LOOT_TABLES, ITEMS } from '../game/itemDefs';
import { Car, defaultCarParts } from '../vehicle/car';
import { randomLook, SlotId, ALL_SLOTS } from '../vehicle/carModel';
import { makePart, PartKind, SLOT_KIND } from '../vehicle/parts';
import { merge } from '../models/geom';

export interface PoiPlan {
  key: string;
  type: PoiType;
  x: number;
  z: number;
  y: number;
  ry: number;
  seed: number;
  seg: number;
}

interface DoorRT {
  def: DoorDef;
  pivot: THREE.Object3D;
  t: number;
  target: number;
  handle: StaticHandle | null;
  key: string;
}

export interface Interactable {
  kind: string;
  poi: BuiltPoi;
  data?: any;
  key: string;
  obj: THREE.Object3D;
}

export interface BuiltPoi {
  plan: PoiPlan;
  group: THREE.Group;
  kit: Kit;
  physics: StaticHandle | null;
  doors: DoorRT[];
  lights: THREE.PointLight[];
  bulbs: THREE.MeshStandardMaterial | null;
  interacts: Interactable[];
  active: boolean;
  wrecks: Car[];
  spawned: boolean;
  interiors: THREE.Box3[];
  blinkers: THREE.Mesh[];
  neons: THREE.Mesh[];
}

export interface WorldGenCtx {
  fn: WorldFn;
  mats: Materials;
  physics: Physics;
  items: ItemManager;
  scene: THREE.Group;
  cars: Car[];
  seed: number;
  addCar: (c: Car) => void;
  removeCar: (c: Car) => void;
}

const UP = new THREE.Vector3(0, 1, 0);

export class WorldGen {
  private plans = new Map<number, PoiPlan[]>();
  built = new Map<string, BuiltPoi>();
  collected = new Set<string>();
  wreckState = new Map<string, any>();
  pumpFuel = new Map<string, number>();
  doorState = new Map<string, number>();
  originX = 0;
  originZ = 0;
  private buildQueue: PoiPlan[] = [];
  night = 0;
  private time = 0;

  constructor(private c: WorldGenCtx) {
    c.fn.padProvider = (seg) => this.plan(seg).map((p) => this.padOf(p));
  }

  padOf(p: PoiPlan): Pad {
    const s = POI_SIZE[p.type];
    return { x: p.x, z: p.z, hw: s.hw, hd: s.hd, rot: p.ry, y: p.y, blend: 12 };
  }

  plan(seg: number): PoiPlan[] {
    let pl = this.plans.get(seg);
    if (pl) return pl;
    pl = [];
    const fn = this.c.fn;
    const rng = new RNG(hashSeed(seg, this.c.seed, 911));
    const place = (type: PoiType, z: number, side: number, extra = 0) => {
      const s = POI_SIZE[type];
      const dx = fn.roadDX(z);
      const l = Math.hypot(dx, 1);
      const rx = -1 / l, rz = dx / l; // right vector
      const off = side * (ROAD_HALF + s.hd + 6 + extra);
      const x = fn.roadX(z) + rx * off, pz = z + rz * off;
      // +z of the POI must face the road
      const heading = Math.atan2(dx, 1);
      const ry = heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      const y = fn.roadY(z) - 0.02;
      pl!.push({ key: `p${seg}_${pl!.length}`, type, x, z: pz, y, ry, seed: hashSeed(seg, pl!.length, this.c.seed), seg });
    };
    if (seg === 0) {
      place('homestead', 70, 1, 2);
    } else if (seg > 0) {
      const block = Math.floor(seg / 18);
      const stationSeg = block * 18 + 3 + Math.floor(hash2(block, this.c.seed, 5) * 12);
      const z0 = seg * SEGMENT_LEN;
      if (seg === stationSeg || seg === 2) place('station', z0 + rng.range(60, 140), rng.sign());
      else {
        const t = rng.weighted<PoiType | 'none'>([
          ['none', 40], ['wrecks', 14], ['garage', 9], ['house', 9], ['trailer', 5], ['shack', 6], ['billboard', 6], ['busstop', 3], ['military', 2.5], ['motel', 1.8], ['tower', 2.2],
        ]);
        if (t !== 'none') place(t, z0 + rng.range(40, 160), rng.sign(), t === 'wrecks' ? -2 : rng.range(0, 14));
        if (t !== 'billboard' && rng.chance(0.08)) place('billboard', z0 + rng.range(10, 190), rng.sign(), 2);
      }
    }
    this.plans.set(seg, pl);
    if (this.plans.size > 400) for (const k of this.plans.keys()) { if (Math.abs(k - seg) > 60) this.plans.delete(k); }
    return pl;
  }

  setOrigin(ox: number, oz: number) {
    this.originX = ox;
    this.originZ = oz;
    this.poolT = 0;
    for (const b of this.built.values()) b.group.position.set(b.plan.x - ox, b.plan.y, b.plan.z - oz);
  }

  private buildVisual(p: PoiPlan): BuiltPoi {
    const kit = new Kit(this.c.mats);
    const rng = new RNG(p.seed);
    buildPoi(p.type, kit, rng);
    const group = new THREE.Group();
    group.name = 'poi:' + p.type;
    for (const [mat, list] of kit.geos) {
      const mesh = new THREE.Mesh(merge(list), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const e of kit.extra) group.add(e);
    group.position.set(p.x - this.originX, p.y, p.z - this.originZ);
    group.rotation.y = p.ry;
    group.updateMatrixWorld(true);
    const bp: BuiltPoi = { plan: p, group, kit, physics: null, doors: [], lights: [], bulbs: null, interacts: [], active: false, wrecks: [], spawned: false, interiors: [], blinkers: [], neons: [] };
    // doors (visual always, colliders when active)
    kit.doors.forEach((d, i) => {
      const pivot = new THREE.Object3D();
      pivot.position.set(d.x, d.y, d.z);
      pivot.rotation.y = d.ry;
      const dir = d.hinge === 'l' ? 1 : -1;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, d.t), d.mat);
      panel.position.set((dir * d.w) / 2, d.h / 2, 0);
      panel.castShadow = true;
      panel.receiveShadow = true;
      pivot.add(panel);
      if (d.handle) {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), this.c.mats.chrome);
        h.position.set(dir * (d.w - 0.1), 1.0, 0.05);
        const h2 = h.clone();
        h2.position.z = -0.05;
        pivot.add(h, h2);
      }
      group.add(pivot);
      const key = `${p.key}:D${i}`;
      const st = this.doorState.get(key) ?? 0;
      const rt: DoorRT = { def: d, pivot, t: st, target: st, handle: null, key };
      pivot.rotation.y = d.ry + (d.hinge === 'l' ? -1 : 1) * d.open * st;
      pivot.traverse((o) => (o.userData.door = rt));
      bp.doors.push(rt);
    });
    // interactables
    kit.interact.forEach((ip, i) => {
      let obj: THREE.Object3D;
      if (ip.kind === 'pump') {
        obj = pumpGeometry(this.c.mats, ip.data.color);
        obj.position.set(ip.x, 0.22, ip.z);
        obj.rotation.y = Math.PI / 2;
      } else if (ip.kind === 'mailbox') {
        obj = mailboxGeometry(this.c.mats);
        obj.position.set(ip.x, 0, ip.z);
        obj.rotation.y = Math.PI;
      } else {
        obj = new THREE.Mesh(new THREE.BoxGeometry(ip.r * 1.6, 0.9, ip.r * 1.6), this.c.mats.black);
        obj.position.set(ip.x, ip.y, ip.z);
        obj.visible = false;
      }
      const key = `${p.key}:X${i}`;
      const it: Interactable = { kind: ip.kind, poi: bp, data: ip.data ? { ...ip.data } : {}, key, obj };
      if (ip.kind === 'pump' && this.pumpFuel.has(key)) it.data.fuel = this.pumpFuel.get(key);
      obj.traverse((o) => (o.userData.interact = it));
      group.add(obj);
      bp.interacts.push(it);
    });
    for (const e of kit.extra) {
      e.traverse((o) => {
        if (o.userData.blink) bp.blinkers.push(o as THREE.Mesh);
        if (o.userData.neon) bp.neons.push(o as THREE.Mesh);
      });
    }
    // bulbs
    if (kit.lights.length) {
      const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0 });
      for (const l of kit.lights) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bm);
        b.position.set(l.x, l.y, l.z);
        group.add(b);
      }
      bp.bulbs = bm;
    }
    for (const r of kit.interior) {
      const box = new THREE.Box3(new THREE.Vector3(r.x0, 0, r.z0), new THREE.Vector3(r.x1, r.y1, r.z1));
      bp.interiors.push(box);
    }
    this.c.scene.add(group);
    return bp;
  }

  private activate(bp: BuiltPoi) {
    if (bp.active) return;
    bp.active = true;
    const p = bp.plan;
    const descs = bp.kit.cols.map((c) => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.ry);
      return RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.8);
    });
    bp.physics = this.c.physics.addStatic(p.x, p.y, p.z, p.ry, descs, { kind: 'structure', poi: bp });
    for (const d of bp.doors) this.updateDoorCollider(bp, d, true);
    if (!bp.spawned) this.spawnContents(bp);
  }

  private deactivate(bp: BuiltPoi) {
    if (!bp.active) return;
    bp.active = false;
    this.c.physics.removeStatic(bp.physics);
    bp.physics = null;
    for (const d of bp.doors) {
      this.c.physics.removeStatic(d.handle);
      d.handle = null;
    }
    for (const w of bp.wrecks) {
      if (w.modified && w.spawnKey) this.wreckState.set(w.spawnKey, w.serialize());
      this.c.removeCar(w);
    }
    bp.wrecks = [];
    bp.spawned = false;
    for (const l of bp.lights) bp.group.remove(l);
    bp.lights = [];
  }

  private destroy(bp: BuiltPoi) {
    this.deactivate(bp);
    this.c.scene.remove(bp.group);
    bp.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as any).geometry) (o as THREE.Mesh).geometry.dispose(); });
    this.built.delete(bp.plan.key);
  }

  updateDoorCollider(bp: BuiltPoi, d: DoorRT, create = false) {
    const p = bp.plan;
    const def = d.def;
    const ang = def.ry + (def.hinge === 'l' ? -1 : 1) * def.open * d.t;
    const dir = def.hinge === 'l' ? 1 : -1;
    // door centre in POI local space
    const lc = new THREE.Vector3((dir * def.w) / 2, def.h / 2, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).add(new THREE.Vector3(def.x, def.y, def.z));
    const wc = lc.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
    const wx = p.x + wc.x, wz = p.z + wc.z;
    const yaw = ang + p.ry;
    if (!d.handle && create) {
      d.handle = this.c.physics.addStatic(wx, p.y + wc.y, wz, yaw, [RAPIER.ColliderDesc.cuboid(def.w / 2, def.h / 2, Math.max(0.03, def.t / 2))], { kind: 'door', door: d });
    } else if (d.handle) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      d.handle.body.setTranslation({ x: wx - this.c.physics.originX, y: p.y + wc.y, z: wz - this.c.physics.originZ }, true);
      d.handle.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      d.handle.wx = wx;
      d.handle.wz = wz;
    }
  }

  toggleDoor(d: DoorRT) {
    d.target = d.target > 0.5 ? 0 : 1;
    this.doorState.set(d.key, d.target);
    return d.target > 0.5;
  }

  private spawnContents(bp: BuiltPoi) {
    bp.spawned = true;
    const p = bp.plan;
    const rng = new RNG(p.seed ^ 0x51f7);
    const toWorld = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
      return [p.x + v.x, p.y + v.y, p.z + v.z];
    };
    const items = this.c.items;
    bp.kit.items.forEach((it, i) => {
      const key = `${p.key}:I${i}`;
      if (this.collected.has(key)) return;
      if ([...items.items].some((e) => e.spawnKey === key)) return;
      const [x, y, z] = toWorld(it.x, it.y, it.z);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (it.ry ?? 0) + p.ry);
      let state = it.state ? { ...it.state } : {};
      let id = it.id;
      if (id === 'part') {
        const kind = (state.partKind ?? 'wheel') as PartKind;
        const part = makePart(kind, state.cond ?? rng.range(0.2, 0.85), { paint: rng.pick(['#8fb3b0', '#c8561e', '#e2d8bf', '#5c7a4a', '#a8392c', '#3e5f8a', '#7a8c92']), rust: rng.range(0.3, 0.8) });
        if (state.charge !== undefined) part.charge = state.charge;
        state = { part };
      }
      if (id === 'crate' || id === 'box') state.loot = this.rollLoot('crate', rng, rng.int(1, 3));
      if (ITEMS[id]?.liquid && state.amount === undefined) state.amount = 0;
      items.spawn(id, x, y, z, q, state, { spawnKey: key, frozen: true });
    });
    bp.kit.loot.forEach((lp, i) => {
      const key = `${p.key}:L${i}`;
      if (this.collected.has(key)) return;
      if (!rng.chance(lp.chance ?? 0.6)) return;
      if ([...items.items].some((e) => e.spawnKey === key)) return;
      const drop = this.rollLoot(lp.table, rng, 1)[0];
      if (!drop) return;
      const sp = lp.spread ?? 0.2;
      const [x, y, z] = toWorld(lp.x + rng.range(-sp, sp), lp.y + (ITEMS[drop.id]?.half[1] ?? 0.1) + 0.02, lp.z + rng.range(-0.08, 0.08));
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.next() * 6.28);
      items.spawn(drop.id, x, y, z, q, drop.state ?? {}, { spawnKey: key, frozen: true });
    });
    bp.kit.wrecks.forEach((w, i) => {
      const key = `${p.key}:W${i}`;
      const [x, y, z] = toWorld(w.x, 0.5, w.z);
      const saved = this.wreckState.get(key);
      const wr = new RNG(hashSeed(p.seed, i, 77));
      const look = saved?.look ?? randomLook(p.seed + i * 31);
      if (!saved) { look.rust = wr.range(0.5, 0.95); look.dust = wr.range(0.5, 0.9); }
      let parts = saved?.parts;
      if (!parts) {
        parts = defaultCarParts(wr.range(0.15, 0.6), () => wr.next());
        const keep = w.parts ?? 0.6;
        for (const s of ALL_SLOTS) if (!wr.chance(keep) && s !== 'bumper_r') delete parts[s];
        for (const s of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] as SlotId[]) if (parts[s] && wr.chance(0.4)) parts[s].flat = true;
        if (parts.engine) parts.engine.cond = wr.range(0.05, 0.5);
        if (parts.battery) parts.battery.charge = wr.range(0, 0.4);
      }
      const gy = this.c.fn.height(x, z);
      const car = new Car(this.c.physics, this.c.mats, this.c.fn, look, parts, new THREE.Vector3(x - this.c.physics.originX, gy + 0.55, z - this.c.physics.originZ), p.ry + w.ry);
      car.dead = !saved ? wr.chance(0.7) : saved.dead;
      car.fuel = saved?.fuel ?? { petrol: wr.chance(0.5) ? wr.range(0, 12) : 0, diesel: 0, water: 0 };
      car.handbrake = true;
      car.spawnKey = key;
      if (saved?.odo) car.odometer = saved.odo;
      car.visual.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      for (const pv of Object.values(car.visual.parts)) for (const gm of pv!.glass ?? []) if (wr.chance(0.4)) gm.visible = false;
      this.c.addCar(car);
      bp.wrecks.push(car);
    });
  }

  rollLoot(table: string, rng: RNG, n: number) {
    const t = LOOT_TABLES[table] ?? LOOT_TABLES.shelf;
    const out: { id: string; state?: any }[] = [];
    for (let i = 0; i < n; i++) {
      const id = rng.weighted(t as any) as string;
      const def = ITEMS[id];
      const state: any = {};
      if (def.money) state.money = rng.pick([5, 10, 10, 15, 20, 25, 40]);
      if (def.ammo) state.ammo = rng.int(4, 12);
      if (def.liquid) {
        const k = def.liquid.kinds[0];
        state.liquid = rng.chance(0.75) ? k : null;
        state.amount = state.liquid ? +(def.liquid.cap * rng.range(0.3, 1)).toFixed(1) : 0;
      }
      if (id === 'revolver') state.loaded = rng.int(0, 6);
      out.push({ id, state });
    }
    return out;
  }

  /** Player world position; streams POIs and animates them. */
  update(dt: number, px: number, pz: number) {
    this.time += dt;
    const seg = Math.floor(pz / SEGMENT_LEN);
    const want = new Set<string>();
    for (let s = seg - 6; s <= seg + 6; s++) {
      for (const p of this.plan(s)) {
        const d = Math.hypot(p.x - px, p.z - pz);
        if (d < 950) {
          want.add(p.key);
          if (!this.built.has(p.key) && !this.buildQueue.includes(p)) this.buildQueue.push(p);
        }
      }
    }
    if (this.buildQueue.length) {
      this.buildQueue.sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
      const p = this.buildQueue.shift()!;
      if (!this.built.has(p.key) && Math.hypot(p.x - px, p.z - pz) < 1000) this.built.set(p.key, this.buildVisual(p));
    }
    for (const bp of [...this.built.values()]) {
      const d = Math.hypot(bp.plan.x - px, bp.plan.z - pz);
      if (d > 1300 && !want.has(bp.plan.key)) { this.destroy(bp); continue; }
      if (d < 170 && this.c.physics.hasTerrainAt(bp.plan.x, bp.plan.z)) this.activate(bp);
      else if (d > 240) this.deactivate(bp);
      // doors
      for (const door of bp.doors) {
        if (door.t === door.target) continue;
        door.t += clamp(door.target - door.t, -dt * 2.2, dt * 2.2);
        const e = door.t;
        door.pivot.rotation.y = door.def.ry + (door.def.hinge === 'l' ? -1 : 1) * door.def.open * e;
        this.updateDoorCollider(bp, door);
      }
      const dark = this.night > 0.35;
      if (bp.bulbs) bp.bulbs.emissiveIntensity = dark ? 4 : 0;
      for (const b of bp.blinkers) (b.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(this.time * 3) > 0.3 ? 6 : 0.2;
      for (const n of bp.neons) {
        const m = (Array.isArray(n.material) ? n.material : [n.material]) as THREE.MeshStandardMaterial[];
        for (const mm of m) if (mm.emissiveMap) mm.emissiveIntensity = dark ? (Math.random() < 0.02 ? 0.2 : 1.6) : 0;
      }
    }
    this.updateLightPool(px, pz);
    this.c.items.cullSpawned((key) => {
      const pk = key.split(':')[0];
      return this.built.has(pk);
    });
  }

  /**
   * Lamps of nearby buildings share a fixed pool of point lights: the number of lights in the scene
   * never changes, so switching lamps on at dusk does not force every shader to recompile.
   */
  readonly lightPool: THREE.PointLight[] = [];
  private poolT = 0;
  initLightPool(scene: THREE.Object3D, n = 4) {
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffd9a0, 0, 14, 1.6);
      l.position.set(0, -1000, 0);
      scene.add(l);
      this.lightPool.push(l);
    }
  }
  private updateLightPool(px: number, pz: number) {
    if (!this.lightPool.length) return;
    this.poolT -= 1;
    if (this.poolT > 0) return;
    this.poolT = 10;
    const cand: { d: number; x: number; y: number; z: number; c: number; i: number; r: number }[] = [];
    if (this.night > 0.35) {
      const v = new THREE.Vector3();
      for (const bp of this.built.values()) {
        const d = Math.hypot(bp.plan.x - px, bp.plan.z - pz);
        if (d > 70 || !bp.active) continue;
        for (const l of bp.kit.lights) {
          v.set(l.x, l.y - 0.1, l.z).applyAxisAngle(UP, bp.plan.ry);
          const wx = bp.plan.x + v.x, wz = bp.plan.z + v.z;
          cand.push({ d: Math.hypot(wx - px, wz - pz), x: wx - this.originX, y: bp.plan.y + v.y, z: wz - this.originZ, c: l.color, i: l.intensity, r: l.dist });
        }
      }
      cand.sort((a, b) => a.d - b.d);
    }
    this.lightPool.forEach((pl, i) => {
      const c = cand[i];
      if (!c) { pl.intensity = 0; pl.position.set(0, -1000, 0); return; }
      pl.position.set(c.x, c.y, c.z);
      pl.color.setHex(c.c);
      pl.intensity = c.i;
      pl.distance = c.r;
    });
  }

  /** Is the local-space point inside any building interior? */
  insideBuilding(local: THREE.Vector3): boolean {
    for (const bp of this.built.values()) {
      if (!bp.interiors.length) continue;
      const lp = local.clone();
      lp.x += this.originX - bp.plan.x;
      lp.z += this.originZ - bp.plan.z;
      lp.y -= bp.plan.y;
      lp.applyAxisAngle(new THREE.Vector3(0, 1, 0), -bp.plan.ry);
      for (const b of bp.interiors) if (b.containsPoint(lp)) return true;
    }
    return false;
  }

  /** Nearest planned POI of a type ahead of z (for road signs / hints). */
  nextPoi(type: PoiType, z: number, maxSeg = 40): PoiPlan | null {
    const s0 = Math.floor(z / SEGMENT_LEN);
    for (let s = s0; s < s0 + maxSeg; s++) for (const p of this.plan(s)) if (p.type === type && p.z > z) return p;
    return null;
  }
  homestead(): PoiPlan {
    return this.plan(0)[0];
  }
}
