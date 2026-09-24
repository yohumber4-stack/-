import { RAPIER, Physics, StaticHandle } from '../physics/physics';
import { World } from '../world/world';

/** Keeps static colliders for vegetation, rocks and poles near active bodies. */
export class PropColliders {
  private active = new Map<string, StaticHandle>();
  private timer = 0;

  constructor(private physics: Physics, private world: World) {}

  update(dt: number, centers: { x: number; z: number }[], force = false) {
    this.timer -= dt;
    if (this.timer > 0 && !force) return;
    this.timer = 0.5;
    const want = new Set<string>();
    for (const c of centers) {
      for (const { inst, kind } of this.world.scatter.collidersNear(c.x, c.z, 70)) {
        const key = `${kind.id}:${inst.x.toFixed(2)}:${inst.z.toFixed(2)}`;
        want.add(key);
        if (this.active.has(key)) continue;
        const r = kind.collider!.r * inst.s, h = kind.collider!.h * inst.s * inst.sy;
        let desc: RAPIER.ColliderDesc;
        if (kind.id.startsWith('rock')) desc = RAPIER.ColliderDesc.ball(r * 0.95).setTranslation(0, r * 0.25 - 0.1, 0);
        else desc = RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(0, h / 2 - 0.2, 0);
        desc.setFriction(0.8);
        this.active.set(key, this.physics.addStatic(inst.x, inst.y, inst.z, 0, [desc], { kind: 'prop', id: kind.id }));
      }
      for (const p of this.world.roadside.polesNear(c.x, c.z, 70)) {
        const key = `pole:${p.x.toFixed(2)}:${p.z.toFixed(2)}`;
        want.add(key);
        if (this.active.has(key)) continue;
        this.active.set(key, this.physics.addStatic(p.x, p.y, p.z, 0, [RAPIER.ColliderDesc.cylinder(4.2, 0.14).setTranslation(0, 4.0, 0)], { kind: 'prop', id: 'pole' }));
      }
    }
    for (const [k, h] of this.active) {
      if (!want.has(k)) {
        this.physics.removeStatic(h);
        this.active.delete(k);
      }
    }
  }
}
