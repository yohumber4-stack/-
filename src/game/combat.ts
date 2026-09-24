import * as THREE from 'three';
import type { Game } from './game';
import { ItemEntity } from './items';
import { groups, G } from '../physics/physics';
import { tr } from '../ui/i18n';
import type { Interaction } from './interaction';
import { RNG } from '../core/math';

export interface Mine {
  x: number;
  z: number;
  armed: boolean;
  t: number;
}

export class Combat {
  mines: Mine[] = [];
  private mineKeys = new Set<string>();
  private rng = new RNG(4242);

  constructor(private g: Game) {}

  shoot(gun: ItemEntity) {
    const g = this.g;
    const ia = g.interaction;
    if ((gun.state.loaded ?? 0) <= 0) {
      g.audio.play('empty_click');
      g.ui.toast(tr('Пусто — R для перезарядки', 'Empty — R to reload'));
      return;
    }
    if ((ia as any)._gunCool > g.time) return;
    (ia as any)._gunCool = g.time + (gun.def.weapon?.rate ?? 0.4);
    gun.state.loaded = (gun.state.loaded ?? 0) - 1;
    const cam = g.player.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const spread = ia.aiming ? 0.004 : 0.02;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.normalize();
    const muzzle = cam.position.clone().addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.06, 0).applyQuaternion(cam.quaternion));
    g.fx.muzzle(muzzle, dir);
    g.audio.play('gunshot');
    ia.kickRecoil();
    g.player.pitch += 0.025;
    // enemies (mesh raycast for precision)
    const rc = new THREE.Raycaster(cam.position, dir, 0.1, 150);
    const wall = g.physics.castRay(cam.position, dir, 150, groups(0xffff, G.STATIC | G.HEAVY | G.CAR));
    const wallD = wall ? wall.timeOfImpact : 150;
    const hits = rc.intersectObjects(g.enemies.list.filter((e) => e.alive).map((e) => e.obj), true);
    if (hits.length && hits[0].distance < wallD) {
      const e = hits[0].object.userData.enemy;
      const head = e.kind === 'husk' && hits[0].point.y - e.obj.position.y > 1.55;
      g.enemies.damage(e, (gun.def.weapon?.damage ?? 60) * (head ? 2 : 1), dir, 'gun');
      return;
    }
    if (wall) {
      const p = cam.position.clone().addScaledVector(dir, wall.timeOfImpact);
      const owner = g.physics.ownerOf(wall.collider);
      if (owner?.kind === 'terrain') { g.fx.sandHit(p); g.audio.play('impact_soft', { pos: p, volume: 0.4 }); }
      else { g.fx.sparks(p, 8); g.audio.play('impact_metal', { pos: p, volume: 0.5 }); }
      if (owner?.kind === 'item' && owner.item.def.breakable) this.breakContainer(owner.item);
      if (owner?.kind === 'item' && owner.item.body) owner.item.body.applyImpulseAtPoint({ x: dir.x * 6, y: dir.y * 6, z: dir.z * 6 }, { x: p.x, y: p.y, z: p.z }, true);
    }
  }

  reload(gun: ItemEntity, ia: Interaction) {
    const need = 6 - (gun.state.loaded ?? 0);
    if (need <= 0) return;
    const box = ia.slots.find((s) => s?.def.ammo && (s.state.ammo ?? 0) > 0);
    if (!box) {
      this.g.ui.toast(tr('Нет патронов', 'No ammo'));
      return;
    }
    const n = Math.min(need, box.state.ammo ?? 0);
    box.state.ammo = (box.state.ammo ?? 0) - n;
    gun.state.loaded = (gun.state.loaded ?? 0) + n;
    this.g.audio.play('reload');
    if ((box.state.ammo ?? 0) <= 0) ia.consume(box);
  }

  melee(w: ItemEntity) {
    const g = this.g;
    const cam = g.player.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const range = w.def.weapon?.range ?? 1.8;
    let hit = false;
    for (const e of g.enemies.list) {
      if (!e.alive) continue;
      const c = e.obj.position.clone().add(new THREE.Vector3(0, e.kind === 'rabbit' ? 0.4 : 1.1, 0));
      const to = c.sub(cam.position);
      const d = to.length();
      if (d > range + 0.4) continue;
      if (to.normalize().dot(dir) < 0.6) continue;
      g.enemies.damage(e, w.def.weapon?.damage ?? 20, dir, 'melee');
      g.audio.play('flesh_hit', { pos: e.obj.position });
      hit = true;
    }
    if (!hit) {
      const r = g.physics.castRay(cam.position, dir, range, groups(0xffff, G.STATIC | G.ITEM | G.HEAVY | G.CAR));
      if (r) {
        const p = cam.position.clone().addScaledVector(dir, r.timeOfImpact);
        const owner = g.physics.ownerOf(r.collider);
        if (owner?.kind === 'item' && owner.item.def.breakable) {
          owner.item.state.used = (owner.item.state.used ?? 0) + 1;
          g.audio.play('impact_wood', { pos: p });
          g.fx.woodBurst(p);
          if ((owner.item.state.used ?? 0) >= (owner.item.def.id === 'box' ? 1 : 2)) this.breakContainer(owner.item);
        } else if (owner?.kind === 'terrain') {
          g.fx.sandHit(p);
          g.audio.play('impact_soft', { pos: p });
        } else {
          g.fx.sparks(p, 5);
          g.audio.play(owner?.kind === 'car' ? 'impact_metal' : 'melee_hit', { pos: p });
          if (owner?.kind === 'item' && owner.item.body) owner.item.body.applyImpulse({ x: dir.x * 4, y: 1, z: dir.z * 4 }, true);
        }
      }
    }
  }

  breakContainer(e: ItemEntity) {
    const g = this.g;
    const p = e.obj.position.clone();
    g.fx.woodBurst(p);
    g.audio.play(e.def.id === 'crate' ? 'crate_break' : 'paper', { pos: p });
    const loot = e.state.loot ?? [];
    if (e.spawnKey) g.worldgen.collected.add(e.spawnKey);
    g.items.remove(e);
    loot.forEach((l, i) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
      const it = g.items.spawn(l.id, p.x + g.physics.originX + (i - loot.length / 2) * 0.2, p.y + 0.1, p.z + g.physics.originZ, q, l.state ?? {});
      it.touched = true;
    });
    if (!loot.length) g.ui.toast(tr('Пусто', 'Empty'));
  }

  /** Minefields near military sites and random stretches of desert. */
  update(dt: number) {
    const g = this.g;
    for (const bp of g.worldgen.built.values()) {
      if (bp.plan.type !== 'military' || this.mineKeys.has(bp.plan.key)) continue;
      this.mineKeys.add(bp.plan.key);
      const r = new RNG(bp.plan.seed);
      const back = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), bp.plan.ry);
      const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), bp.plan.ry);
      for (let i = 0; i < 14; i++) {
        const a = r.range(-18, 18), b = r.range(12, 40);
        this.mines.push({ x: bp.plan.x + side.x * a + back.x * b, z: bp.plan.z + side.z * a + back.z * b, armed: true, t: 0 });
      }
    }
    const px = (g.player.car ? g.player.car.worldX : g.player.feet.x + g.physics.originX);
    const pz = (g.player.car ? g.player.car.worldZ : g.player.feet.z + g.physics.originZ);
    for (const m of this.mines) {
      if (!m.armed) continue;
      const d = Math.hypot(m.x - px, m.z - pz);
      if (d > 60) continue;
      let trig = false;
      if (d < (g.player.car ? 1.8 : 0.9)) trig = true;
      for (const c of g.cars) if (c !== g.player.car && c.enabled && Math.hypot(c.worldX - m.x, c.worldZ - m.z) < 1.6 && Math.abs(c.speed) > 0.5) trig = true;
      if (trig && m.t === 0) {
        m.t = 0.35;
        g.audio.play('mine_beep', { pos: new THREE.Vector3(m.x - g.physics.originX, g.world.fn.height(m.x, m.z), m.z - g.physics.originZ) });
      }
      if (m.t > 0) {
        m.t -= dt;
        if (m.t <= 0) {
          m.armed = false;
          this.explode(new THREE.Vector3(m.x - g.physics.originX, g.world.fn.height(m.x, m.z) + 0.2, m.z - g.physics.originZ), 7);
        }
      }
    }
  }

  explode(p: THREE.Vector3, radius: number) {
    const g = this.g;
    g.fx.explosion(p);
    g.audio.play('explosion', { pos: p });
    g.audio.duck(0.6, 1.5);
    const pp = g.player.car ? g.player.car.visual.root.position : g.player.feet;
    const d = pp.distanceTo(p);
    if (d < radius * 3) g.player.shake = Math.max(g.player.shake, 2.2 - d / (radius * 1.5));
    if (!g.player.car && d < radius) g.damagePlayer(110 * (1 - d / radius), tr('Подорвался на мине', 'Stepped on a mine'));
    for (const c of g.cars) {
      const cd = c.visual.root.position.distanceTo(p);
      if (cd > radius) continue;
      const dir = c.visual.root.position.clone().sub(p).normalize();
      c.body.applyImpulseAtPoint({ x: dir.x * 4000, y: 9000, z: dir.z * 4000 }, { x: p.x, y: p.y, z: p.z }, true);
      const lost = c.applyImpact(c.worldToLocal(p.clone()), 60000 * (1 - cd / radius));
      for (const s of lost) g.detachAndThrow(c, s);
      if (c === g.player.car) g.damagePlayer(45 * (1 - cd / radius), tr('Подорвался на мине', 'Blown up by a mine'));
    }
    for (const e of g.enemies.list) if (e.alive && e.obj.position.distanceTo(p) < radius) g.enemies.damage(e, 200, e.obj.position.clone().sub(p).normalize(), 'blast');
    for (const it of g.items.items) {
      if (!it.body) continue;
      const t = it.body.translation();
      const v = new THREE.Vector3(t.x, t.y, t.z).sub(p);
      const l = v.length();
      if (l < radius) it.body.applyImpulse({ x: (v.x / l) * it.mass * 8, y: it.mass * 8, z: (v.z / l) * it.mass * 8 }, true);
    }
  }
}
