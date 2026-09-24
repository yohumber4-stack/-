import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { WorldFn } from '../world/worldfn';

export { RAPIER };

/** Collision group bits. */
export const G = {
  STATIC: 1,
  CAR: 2,
  ITEM: 4,
  PLAYER: 8,
  ENEMY: 16,
  HEAVY: 32,
  SENSOR: 64,
  DEBRIS: 128,
};
export const groups = (member: number, filter: number) => ((member & 0xffff) << 16) | (filter & 0xffff);

export const GROUPS = {
  static: groups(G.STATIC, 0xffff),
  car: groups(G.CAR, G.STATIC | G.CAR | G.ITEM | G.HEAVY | G.ENEMY | G.PLAYER | G.DEBRIS),
  item: groups(G.ITEM, G.STATIC | G.CAR | G.ITEM | G.HEAVY | G.DEBRIS),
  heavy: groups(G.HEAVY, G.STATIC | G.CAR | G.ITEM | G.HEAVY | G.PLAYER | G.ENEMY),
  player: groups(G.PLAYER, G.STATIC | G.CAR | G.HEAVY | G.ENEMY),
  enemy: groups(G.ENEMY, G.STATIC | G.CAR | G.HEAVY | G.PLAYER | G.ENEMY),
  wheelRay: groups(0xffff, G.STATIC | G.HEAVY),
  debris: groups(G.DEBRIS, G.STATIC | G.CAR | G.ITEM),
};

export const TILE = 64;
const TILE_N = 32;

export interface StaticHandle {
  body: RAPIER.RigidBody;
  wx: number;
  wz: number;
}

export type ContactCallback = (a: RAPIER.Collider, b: RAPIER.Collider, force: number, point: THREE.Vector3 | null) => void;

export async function initRapier() {
  await RAPIER.init();
}

export class Physics {
  world: RAPIER.World;
  events: RAPIER.EventQueue;
  private tiles = new Map<string, { body: RAPIER.RigidBody; used: number; wx: number; wz: number }>();
  private statics = new Set<StaticHandle>();
  originX = 0;
  originZ = 0;
  time = 0;
  onContact: ContactCallback | null = null;
  /** userData lookup: collider handle -> owner object */
  owners = new Map<number, any>();

  constructor(private fn: WorldFn) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.integrationParameters.numSolverIterations = 6;
    this.events = new RAPIER.EventQueue(true);
  }

  setOwner(c: RAPIER.Collider, owner: any) {
    this.owners.set(c.handle, owner);
  }
  ownerOf(c: RAPIER.Collider | null | undefined) {
    return c ? this.owners.get(c.handle) : undefined;
  }

  step(dt: number) {
    this.world.timestep = dt;
    this.world.step(this.events);
    this.time += dt;
    if (this.onContact) {
      this.events.drainContactForceEvents((e) => {
        const c1 = this.world.getCollider(e.collider1());
        const c2 = this.world.getCollider(e.collider2());
        if (!c1 || !c2) return;
        this.onContact!(c1, c2, e.totalForceMagnitude(), null);
      });
    } else this.events.drainContactForceEvents(() => {});
    this.events.drainCollisionEvents(() => {});
  }

  // ---------------------------------------------------------------- terrain tiles
  private buildTile(ix: number, iz: number) {
    const n = TILE_N, step = TILE / n;
    const x0 = ix * TILE, z0 = iz * TILE;
    const H = new Float32Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) H[j * (n + 1) + i] = this.fn.height(x0 + j * step, z0 + i * step);
    const cx = x0 + TILE / 2, cz = z0 + TILE / 2;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx - this.originX, 0, cz - this.originZ));
    const col = this.world.createCollider(RAPIER.ColliderDesc.heightfield(n, n, H, { x: TILE, y: 1, z: TILE }).setCollisionGroups(GROUPS.static).setFriction(0.9), body);
    this.setOwner(col, { kind: 'terrain' });
    this.tiles.set(ix + ',' + iz, { body, used: this.time, wx: cx, wz: cz });
  }

  /** Make sure terrain collision exists around given world points. Returns number of tiles built. */
  ensureTerrain(points: { x: number; z: number; r: number }[], maxBuild = 3): number {
    let built = 0;
    for (const p of points) {
      const ix0 = Math.floor((p.x - p.r) / TILE), ix1 = Math.floor((p.x + p.r) / TILE);
      const iz0 = Math.floor((p.z - p.r) / TILE), iz1 = Math.floor((p.z + p.r) / TILE);
      // build the tile directly under the point first
      const order: [number, number, number][] = [];
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const d = Math.hypot((ix + 0.5) * TILE - p.x, (iz + 0.5) * TILE - p.z);
        order.push([d, ix, iz]);
      }
      order.sort((a, b) => a[0] - b[0]);
      for (const [, ix, iz] of order) {
        const k = ix + ',' + iz;
        const t = this.tiles.get(k);
        if (t) { t.used = this.time; continue; }
        if (built >= maxBuild) continue;
        this.buildTile(ix, iz);
        built++;
      }
    }
    // unload stale tiles
    for (const [k, t] of this.tiles) {
      if (this.time - t.used > 8) {
        this.world.removeRigidBody(t.body);
        this.tiles.delete(k);
      }
    }
    return built;
  }

  hasTerrainAt(x: number, z: number) {
    return this.tiles.has(Math.floor(x / TILE) + ',' + Math.floor(z / TILE));
  }

  // ---------------------------------------------------------------- statics
  /** Create a fixed body at world position with colliders from descs (local to the body). */
  addStatic(wx: number, wy: number, wz: number, yaw: number, descs: RAPIER.ColliderDesc[], owner?: any): StaticHandle {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(wx - this.originX, wy, wz - this.originZ).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    for (const d of descs) {
      if (!(d as any).keepGroups) d.setCollisionGroups(GROUPS.static);
      const c = this.world.createCollider(d, body);
      if (owner) this.setOwner(c, owner);
    }
    const h = { body, wx, wz };
    this.statics.add(h);
    return h;
  }
  removeStatic(h: StaticHandle | null | undefined) {
    if (!h) return;
    if (this.statics.delete(h)) {
      const n = h.body.numColliders();
      for (let i = 0; i < n; i++) this.owners.delete(h.body.collider(i).handle);
      this.world.removeRigidBody(h.body);
    }
  }

  removeBody(b: RAPIER.RigidBody | null | undefined) {
    if (!b) return;
    const n = b.numColliders();
    for (let i = 0; i < n; i++) this.owners.delete(b.collider(i).handle);
    this.world.removeRigidBody(b);
  }

  // ---------------------------------------------------------------- floating origin
  shiftOrigin(dx: number, dz: number) {
    this.originX += dx;
    this.originZ += dz;
    this.world.forEachRigidBody((b) => {
      const t = b.translation();
      if (b.isKinematic()) b.setNextKinematicTranslation({ x: t.x - dx, y: t.y, z: t.z - dz });
      b.setTranslation({ x: t.x - dx, y: t.y, z: t.z - dz }, false);
    });
  }

  // ---------------------------------------------------------------- queries
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  castRay(o: THREE.Vector3, d: THREE.Vector3, maxDist: number, filterGroups: number, exclude?: RAPIER.RigidBody, excludeCollider?: RAPIER.Collider) {
    this.ray.origin = { x: o.x, y: o.y, z: o.z };
    this.ray.dir = { x: d.x, y: d.y, z: d.z };
    return this.world.castRayAndGetNormal(this.ray, maxDist, true, undefined, filterGroups, excludeCollider, exclude);
  }

  /** Ground height by raycast against static geometry (local coords); falls back to terrain function. */
  groundY(x: number, z: number, fromY: number): number {
    const hit = this.castRay(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0), 400, groups(0xffff, G.STATIC));
    if (hit) return fromY - hit.timeOfImpact;
    return this.fn.height(x + this.originX, z + this.originZ);
  }
}
