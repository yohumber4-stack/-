import * as THREE from 'three';
import { RAPIER, Physics, GROUPS } from '../physics/physics';
import { ITEMS, ItemDef, ItemState } from './itemDefs';
import { Materials } from '../gfx/materials';
import { PartVisual, buildPartVisual, CarLook } from '../vehicle/carModel';
import { PartState, PART_INFO, KIND_SLOT } from '../vehicle/parts';

let nextItemId = 1;

export class ItemEntity {
  id = nextItemId++;
  obj: THREE.Object3D;
  body: RAPIER.RigidBody | null = null;
  held = false;
  inInventory = false;
  materialized = true;
  wx = 0;
  wy = 0;
  wz = 0;
  quat = new THREE.Quaternion();
  spawnKey: string | null = null;
  touched = false;
  partVisual: PartVisual | null = null;
  mass: number;
  half = new THREE.Vector3();
  lastSound = 0;
  constructor(public def: ItemDef, public state: ItemState, obj: THREE.Object3D) {
    this.obj = obj;
    this.mass = def.mass;
    obj.traverse((o) => (o.userData.item = this));
  }
  get part(): PartState | undefined {
    return this.state.part;
  }
}

export class ItemManager {
  items = new Set<ItemEntity>();
  group = new THREE.Group();
  originX = 0;
  originZ = 0;
  onImpact: ((e: ItemEntity, force: number) => void) | null = null;

  constructor(private physics: Physics, private mats: Materials) {
    this.group.name = 'items';
  }

  /** Spawn at world position. */
  spawn(defId: string, wx: number, wy: number, wz: number, quat?: THREE.Quaternion, state: ItemState = {}, opts: { spawnKey?: string; frozen?: boolean; partVisual?: PartVisual; look?: Partial<CarLook> } = {}): ItemEntity {
    const def = ITEMS[defId] ?? ITEMS.box;
    let obj: THREE.Object3D;
    let pv = opts.partVisual ?? null;
    if (defId === 'part' && state.part) {
      const ps = state.part as PartState;
      if (!pv) pv = buildPartVisual(KIND_SLOT[ps.kind], this.mats, { paint: ps.paint ?? '#8a8a80', rust: ps.rust ?? 0.4, dust: 0.4, seat: '#4a2a1a', interior: '#c9b89a', plate: '', seed: 1, ...(opts.look ?? {}) } as CarLook);
      const holder = new THREE.Group();
      pv.root.quaternion.identity();
      if (pv.root.userData.spin) (pv.root.userData.spin as THREE.Object3D).rotation.set(0, 0, 0);
      pv.root.position.set(0, 0, 0);
      pv.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(pv.root);
      box.getSize(pv.size);
      box.getCenter(pv.center);
      pv.root.position.copy(pv.center).negate();
      holder.add(pv.root);
      obj = holder;
    } else {
      obj = def.build(this.mats, state);
    }
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const e = new ItemEntity(def, state, obj);
    e.partVisual = pv;
    if (pv) {
      e.half.copy(pv.size).multiplyScalar(0.5).max(new THREE.Vector3(0.03, 0.03, 0.03));
      e.mass = PART_INFO[(state.part as PartState).kind].mass;
    } else e.half.set(def.half[0], def.half[1], def.half[2]);
    e.spawnKey = opts.spawnKey ?? null;
    e.wx = wx;
    e.wy = wy;
    e.wz = wz;
    if (quat) e.quat.copy(quat);
    obj.position.set(wx - this.originX, wy, wz - this.originZ);
    obj.quaternion.copy(e.quat);
    this.group.add(obj);
    this.items.add(e);
    if (!opts.frozen) this.makeBody(e);
    return e;
  }

  makeBody(e: ItemEntity, vel?: THREE.Vector3) {
    if (e.body) return;
    const p = e.obj.position, q = e.obj.quaternion;
    const heavy = e.def.heavy || (e.part && PART_INFO[e.part.kind].heavy) || e.mass > 25;
    const bd = RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setLinearDamping(0.1).setAngularDamping(0.4).setCcdEnabled(e.mass < 20).setCanSleep(true);
    const body = this.physics.world.createRigidBody(bd);
    let desc: RAPIER.ColliderDesc;
    const h = e.half;
    if (e.part?.kind === 'wheel') {
      const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      desc = RAPIER.ColliderDesc.cylinder(0.08, 0.3).setRotation({ x: rq.x, y: rq.y, z: rq.z, w: rq.w });
    } else if (e.def.shape === 'cyl' && !e.partVisual) desc = RAPIER.ColliderDesc.cylinder(h.y, h.x);
    else if (e.def.shape === 'ball') desc = RAPIER.ColliderDesc.ball(h.x);
    else desc = RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z);
    const vol = Math.max(0.0005, h.x * h.y * h.z * 8);
    desc.setDensity(e.mass / vol).setFriction(0.7).setRestitution(0.12).setCollisionGroups(heavy ? GROUPS.heavy : GROUPS.item);
    desc.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(Math.max(15, e.mass * 25));
    const c = this.physics.world.createCollider(desc, body);
    this.physics.setOwner(c, { kind: 'item', item: e });
    if (vel) body.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
    e.body = body;
  }
  removeBody(e: ItemEntity) {
    if (!e.body) return;
    this.physics.removeBody(e.body);
    e.body = null;
  }
  remove(e: ItemEntity) {
    this.removeBody(e);
    e.obj.parent?.remove(e.obj);
    this.items.delete(e);
  }
  /** Take the item out of the world simulation (into hands / inventory). */
  pick(e: ItemEntity) {
    this.removeBody(e);
    e.touched = true;
    e.spawnKey = null;
  }
  /** Put an item back into the world at a local position. */
  place(e: ItemEntity, pos: THREE.Vector3, quat: THREE.Quaternion, vel?: THREE.Vector3) {
    e.held = false;
    e.inInventory = false;
    if (e.obj.parent !== this.group) this.group.add(e.obj);
    e.obj.position.copy(pos);
    e.obj.quaternion.copy(quat);
    e.obj.scale.setScalar(1);
    e.obj.visible = true;
    e.materialized = true;
    e.wx = pos.x + this.originX;
    e.wy = pos.y;
    e.wz = pos.z + this.originZ;
    this.makeBody(e, vel);
  }
  setOrigin(ox: number, oz: number) {
    const dx = ox - this.originX, dz = oz - this.originZ;
    this.originX = ox;
    this.originZ = oz;
    for (const e of this.items) {
      if (!e.body && e.materialized && !e.held && !e.inInventory) {
        e.obj.position.x -= dx;
        e.obj.position.z -= dz;
      }
    }
  }
  /** Freeze far items, (re)materialize near ones. px/pz are world coords. */
  update(px: number, pz: number, hasTerrain: (x: number, z: number) => boolean) {
    for (const e of this.items) {
      if (e.held || e.inInventory) continue;
      if (e.body) {
        const t = e.body.translation(), r = e.body.rotation();
        e.obj.position.set(t.x, t.y, t.z);
        e.obj.quaternion.set(r.x, r.y, r.z, r.w);
        e.wx = t.x + this.originX;
        e.wy = t.y;
        e.wz = t.z + this.originZ;
        e.quat.copy(e.obj.quaternion);
        if (t.y < -200) {
          this.remove(e);
          continue;
        }
      }
      const d = Math.hypot(e.wx - px, e.wz - pz);
      if (e.body && (d > 90 || !hasTerrain(e.wx, e.wz))) this.removeBody(e);
      else if (!e.body && d < 70 && hasTerrain(e.wx, e.wz) && e.materialized) {
        e.obj.position.set(e.wx - this.originX, e.wy, e.wz - this.originZ);
        this.makeBody(e);
      }
      const vis = d < 450;
      if (vis !== e.materialized) {
        e.materialized = vis;
        if (vis) {
          this.group.add(e.obj);
          e.obj.position.set(e.wx - this.originX, e.wy, e.wz - this.originZ);
          e.obj.quaternion.copy(e.quat);
        } else this.group.remove(e.obj);
      }
    }
  }
  /** Items whose spawn segment was unloaded and never touched get deleted. */
  cullSpawned(keep: (key: string) => boolean) {
    for (const e of this.items) if (e.spawnKey && !e.touched && !keep(e.spawnKey)) this.remove(e);
  }
  serialize() {
    const out: any[] = [];
    for (const e of this.items) {
      if (e.spawnKey && !e.touched) continue;
      if (e.inInventory || e.held) continue;
      out.push({ id: e.def.id, s: e.state, p: [+e.wx.toFixed(2), +e.wy.toFixed(2), +e.wz.toFixed(2)], q: [e.quat.x, e.quat.y, e.quat.z, e.quat.w] });
    }
    return out;
  }
  impact(e: ItemEntity, force: number, now: number) {
    if (now - e.lastSound < 0.12) return;
    e.lastSound = now;
    this.onImpact?.(e, force);
  }
}
