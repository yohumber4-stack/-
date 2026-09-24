import * as THREE from 'three';
import type { Game } from './game';
import { RAPIER, GROUPS, groups, G } from '../physics/physics';
import { clamp, damp, dampAngle, RNG, lerp, wrapAngle } from '../core/math';
import { tube, lathe } from '../models/geom';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tr } from '../ui/i18n';

export type EnemyKind = 'rabbit' | 'husk';

export class Enemy {
  obj = new THREE.Group();
  body: RAPIER.RigidBody;
  hp: number;
  state: 'idle' | 'wander' | 'chase' | 'attack' | 'dead' | 'flee' = 'wander';
  yaw = 0;
  vel = new THREE.Vector3();
  t = Math.random() * 10;
  attackCool = 0;
  deadT = 0;
  wanderTarget = new THREE.Vector3();
  parts: Record<string, THREE.Object3D> = {};
  eyes: THREE.MeshStandardMaterial | null = null;
  groundY = 0;
  groundTimer = 0;
  hopPhase = 0;
  grounded = true;
  vy = 0;
  constructor(public kind: EnemyKind, pos: THREE.Vector3, public game: Game) {
    this.hp = kind === 'rabbit' ? 45 : 130;
    this.obj.position.copy(pos);
    this.groundY = pos.y;
    const phys = game.physics;
    this.body = phys.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + 0.5, pos.z));
    const desc = kind === 'rabbit' ? RAPIER.ColliderDesc.ball(0.38).setTranslation(0, 0.0, 0) : RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(0, 0.45, 0);
    desc.setCollisionGroups(groups(G.ENEMY, G.STATIC | G.PLAYER | G.HEAVY));
    const c = phys.world.createCollider(desc, this.body);
    phys.setOwner(c, { kind: 'enemy', enemy: this });
    this.obj.userData.enemy = this;
    this.obj.traverse((o) => (o.userData.enemy = this));
  }
  get alive() {
    return this.state !== 'dead';
  }
}

// ------------------------------------------------------------------ models
function buildRabbit(g: Game, e: Enemy, rng: RNG) {
  const m = g.mats;
  const fur = new THREE.MeshStandardMaterial({ map: m.tex.fur, normalMap: m.tex.furNormal, color: new THREE.Color().setHSL(0.07, 0.25, rng.range(0.35, 0.6)), roughness: 1 });
  const pink = m.flat('#b88a80', 0.8);
  const root = new THREE.Group();
  const S = rng.range(0.95, 1.25);
  root.scale.setScalar(S);
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; o.receiveShadow = true; return o; };
  const body = new THREE.Group();
  const torso = mesh(new THREE.SphereGeometry(0.34, 20, 14), fur);
  torso.scale.set(0.85, 0.8, 1.25);
  torso.position.set(0, 0.42, -0.05);
  const haunch = mesh(new THREE.SphereGeometry(0.3, 18, 12), fur);
  haunch.scale.set(1.1, 0.95, 0.95);
  haunch.position.set(0, 0.36, -0.28);
  const chest = mesh(new THREE.SphereGeometry(0.24, 16, 12), fur);
  chest.position.set(0, 0.5, 0.22);
  body.add(torso, haunch, chest);
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.38);
  const skull = mesh(new THREE.SphereGeometry(0.17, 18, 14), fur);
  skull.scale.set(0.9, 0.95, 1.15);
  const snout = mesh(new THREE.SphereGeometry(0.1, 14, 10), fur);
  snout.position.set(0, -0.05, 0.14);
  snout.scale.set(1.1, 0.85, 1);
  const nose = mesh(new THREE.SphereGeometry(0.025, 8, 6), pink);
  nose.position.set(0, -0.02, 0.235);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, emissive: 0xff2010, emissiveIntensity: 0.4, roughness: 0.2 });
  e.eyes = eyeMat;
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.032, 10, 8), eyeMat);
    eye.position.set(s * 0.1, 0.03, 0.1);
    head.add(eye);
    const ear = new THREE.Group();
    ear.position.set(s * 0.06, 0.12, -0.02);
    const eg = new THREE.SphereGeometry(0.06, 12, 10);
    eg.scale(0.55, 2.9, 0.25);
    eg.translate(0, 0.16, 0);
    const earM = mesh(eg, fur);
    const inner = mesh(eg.clone().scale(0.6, 0.85, 0.5).translate(0, 0.01, 0.012), pink);
    ear.add(earM, inner);
    ear.rotation.set(-0.25, 0, s * 0.18);
    head.add(ear);
    e.parts['ear' + s] = ear;
  }
  // teeth
  const teeth = mesh(new THREE.BoxGeometry(0.04, 0.035, 0.01), m.flat('#f0ead8', 0.4));
  teeth.position.set(0, -0.1, 0.2);
  head.add(skull, snout, nose, teeth);
  // legs
  const legs: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const hind = new THREE.Group();
    hind.position.set(s * 0.2, 0.3, -0.3);
    const thigh = mesh(new THREE.SphereGeometry(0.15, 12, 10), fur);
    thigh.scale.set(0.8, 1.2, 1.3);
    const foot = mesh(new THREE.SphereGeometry(0.08, 10, 8), fur);
    foot.scale.set(0.8, 0.45, 2.6);
    foot.position.set(0, -0.26, 0.08);
    hind.add(thigh, foot);
    const front = new THREE.Group();
    front.position.set(s * 0.12, 0.38, 0.28);
    const fl = mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.34, 8), fur);
    fl.position.y = -0.17;
    const paw = mesh(new THREE.SphereGeometry(0.045, 8, 6), fur);
    paw.position.set(0, -0.34, 0.02);
    front.add(fl, paw);
    body.add(hind, front);
    e.parts['hind' + s] = hind;
    e.parts['front' + s] = front;
    legs.push(hind, front);
  }
  const tail = mesh(new THREE.SphereGeometry(0.09, 10, 8), m.flat('#e8e0d0', 1));
  tail.position.set(0, 0.45, -0.52);
  body.add(tail, head);
  root.add(body);
  e.parts.body = body;
  e.parts.head = head;
  e.obj.add(root);
}

function buildHusk(g: Game, e: Enemy, rng: RNG) {
  const m = g.mats;
  const cloth = m.fabric(rng.pick(['#5a5a48', '#4a5058', '#6a5a40', '#3a4a3a']));
  const skin = m.flat('#8a7a68', 0.9);
  const rubber = m.flat('#1e1e1c', 0.7);
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; o.receiveShadow = true; return o; };
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  const chest = mesh(new RoundedBoxGeometry(0.42, 0.55, 0.25, 3, 0.1), cloth);
  chest.position.y = 0.33;
  const belly = mesh(new RoundedBoxGeometry(0.38, 0.25, 0.23, 3, 0.09), cloth);
  belly.position.y = 0.05;
  torso.add(chest, belly);
  const head = new THREE.Group();
  head.position.y = 0.72;
  const skull = mesh(new THREE.SphereGeometry(0.13, 14, 12), rubber);
  skull.scale.set(1, 1.15, 1.05);
  const mask = mesh(new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), m.flat('#3a3e38', 0.6));
  mask.rotation.x = Math.PI / 2;
  mask.position.set(0, -0.02, 0.06);
  const filter = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), m.metalDark);
  filter.rotation.x = Math.PI / 2 + 0.4;
  filter.position.set(0, -0.08, 0.17);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222a22, emissive: 0x88ff66, emissiveIntensity: 0.15, roughness: 0.1, metalness: 0.5 });
  e.eyes = eyeMat;
  for (const s of [-1, 1]) {
    const lens = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), eyeMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(s * 0.05, 0.02, 0.12);
    head.add(lens);
  }
  const hood = mesh(new THREE.SphereGeometry(0.16, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cloth);
  hood.position.y = 0.02;
  head.add(skull, mask, filter, hood);
  torso.add(head);
  e.parts.head = head;
  e.parts.torso = torso;
  const limb = (len: number, r0: number, r1: number, mat: THREE.Material) => {
    const gg = new THREE.CylinderGeometry(r1, r0, len, 10);
    gg.translate(0, -len / 2, 0);
    return mesh(gg, mat);
  };
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.26, 0.55, 0);
    const ua = limb(0.32, 0.07, 0.06, cloth);
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    const fa = limb(0.3, 0.055, 0.045, cloth);
    const hand = mesh(new THREE.SphereGeometry(0.05, 8, 6), skin);
    hand.position.y = -0.33;
    hand.scale.set(0.8, 1.2, 0.6);
    elbow.add(fa, hand);
    sh.add(ua, elbow);
    torso.add(sh);
    e.parts['arm' + s] = sh;
    e.parts['elbow' + s] = elbow;
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, -0.05, 0);
    const th = limb(0.45, 0.09, 0.075, cloth);
    const knee = new THREE.Group();
    knee.position.y = -0.45;
    const sn = limb(0.43, 0.065, 0.05, cloth);
    const boot = mesh(new RoundedBoxGeometry(0.12, 0.09, 0.24, 2, 0.03), rubber);
    boot.position.set(0, -0.46, 0.04);
    knee.add(sn, boot);
    hip.add(th, knee);
    hips.add(hip);
    e.parts['hip' + s] = hip;
    e.parts['knee' + s] = knee;
  }
  e.parts.hips = hips;
  e.obj.add(root);
}

// ------------------------------------------------------------------ manager
export class Enemies {
  list: Enemy[] = [];
  group = new THREE.Group();
  private spawnTimer = 5;
  private rng = new RNG(99);
  difficulty = 1;
  enabled = true;

  constructor(private g: Game) {
    this.group.name = 'enemies';
  }

  spawn(kind: EnemyKind, pos: THREE.Vector3) {
    const e = new Enemy(kind, pos, this.g);
    if (kind === 'rabbit') buildRabbit(this.g, e, this.rng);
    else buildHusk(this.g, e, this.rng);
    e.obj.traverse((o) => (o.userData.enemy = e));
    e.yaw = this.rng.next() * 6.28;
    this.group.add(e.obj);
    this.list.push(e);
    return e;
  }

  remove(e: Enemy) {
    this.g.physics.removeBody(e.body);
    this.group.remove(e.obj);
    this.list.splice(this.list.indexOf(e), 1);
  }

  shiftOrigin(dx: number, dz: number) {
    for (const e of this.list) {
      e.obj.position.x -= dx;
      e.obj.position.z -= dz;
      e.wanderTarget.x -= dx;
      e.wanderTarget.z -= dz;
    }
  }

  damage(e: Enemy, amount: number, dir: THREE.Vector3, cause: string) {
    if (!e.alive) return;
    e.hp -= amount;
    const p = e.obj.position.clone().add(new THREE.Vector3(0, e.kind === 'rabbit' ? 0.5 : 1.3, 0));
    this.g.fx.blood(p, dir);
    e.vel.addScaledVector(dir, e.kind === 'rabbit' ? 3 : 1.2);
    if (e.hp <= 0) this.kill(e, dir);
    else {
      e.state = 'chase';
      this.g.audio.play(e.kind === 'rabbit' ? 'rabbit_squeal' : 'husk_growl', { pos: p });
    }
  }

  kill(e: Enemy, dir: THREE.Vector3) {
    e.state = 'dead';
    e.deadT = 0;
    e.vel.copy(dir).multiplyScalar(4).add(new THREE.Vector3(0, 2, 0));
    this.g.audio.play(e.kind === 'rabbit' ? 'rabbit_die' : 'husk_die', { pos: e.obj.position });
    this.g.physics.removeBody(e.body);
    (e as any).body = null;
    if (e.eyes) e.eyes.emissiveIntensity = 0;
    this.g.stats.kills++;
  }

  /** Spawning around the player; more at night, fewer inside settlements. */
  private spawnLogic(dt: number) {
    const g = this.g;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || !this.enabled) return;
    this.spawnTimer = 6 + this.rng.next() * 8;
    const night = g.env.night;
    const alive = this.list.filter((e) => e.alive);
    const maxN = Math.round((night > 0.5 ? 5 : 1) * this.difficulty);
    if (alive.length >= maxN) return;
    const chance = (night > 0.5 ? 0.65 : 0.12) * this.difficulty;
    if (!this.rng.chance(chance)) return;
    const p = g.player.car ? g.player.car.position : g.player.feet;
    const ang = this.rng.next() * Math.PI * 2;
    const dist = g.player.car ? 110 + this.rng.next() * 60 : 55 + this.rng.next() * 50;
    const x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist;
    const wx = x + g.physics.originX, wz = z + g.physics.originZ;
    if (g.world.fn.onRoad(wx, wz, 2)) return;
    const nearBuilding = [...g.worldgen.built.values()].some((b) => Math.hypot(b.plan.x - wx, b.plan.z - wz) < 40);
    const kind: EnemyKind = nearBuilding || (night > 0.5 && this.rng.chance(0.3)) ? 'husk' : 'rabbit';
    const count = kind === 'rabbit' && this.rng.chance(0.4) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const y = g.world.fn.height(wx + i * 2, wz);
      this.spawn(kind, new THREE.Vector3(x + i * 2, y, z));
    }
  }

  update(dt: number) {
    const g = this.g;
    this.spawnLogic(dt);
    const player = g.player;
    const target = player.car ? player.car.visual.root.position : player.feet;
    const inCar = !!player.car;
    const car = g.playerCar;
    for (const e of [...this.list]) {
      e.t += dt;
      const pos = e.obj.position;
      const dist = pos.distanceTo(target);
      if (dist > 320) { this.remove(e); continue; }
      if (e.state === 'dead') {
        e.deadT += dt;
        e.vel.y -= 9.8 * dt;
        pos.addScaledVector(e.vel, dt);
        const gy = g.world.fn.height(pos.x + g.physics.originX, pos.z + g.physics.originZ);
        if (pos.y < gy) { pos.y = gy; e.vel.multiplyScalar(0.5); e.vel.y = 0; }
        const tgt = Math.min(1, e.deadT * 3);
        e.obj.rotation.z = damp(e.obj.rotation.z, 1.5, 6, dt) * tgt;
        if (e.deadT > 45) this.remove(e);
        continue;
      }
      // eyes glow at night
      if (e.eyes) e.eyes.emissiveIntensity = e.kind === 'rabbit' ? 0.3 + g.env.night * 5 : 0.1 + g.env.night * 1.5;
      // perception
      const sees = dist < (e.kind === 'rabbit' ? 42 : 30) + g.env.night * 10;
      if (e.state !== 'flee') e.state = sees ? (dist < (e.kind === 'rabbit' ? 1.5 : 1.7) ? 'attack' : 'chase') : 'wander';
      if (player.dead) e.state = 'wander';
      let desired = new THREE.Vector3();
      let speed = 0;
      if (e.state === 'chase' || e.state === 'attack') {
        desired.subVectors(target, pos).setY(0);
        if (desired.lengthSq() > 0.01) desired.normalize();
        speed = e.kind === 'rabbit' ? 7.5 : dist < 8 ? 3.4 : 1.8;
        if (inCar && (car?.speed ?? 0) > 12) speed = e.kind === 'rabbit' ? 9 : 2;
      } else {
        if (pos.distanceTo(e.wanderTarget) < 2 || e.t % 12 < dt) e.wanderTarget.set(pos.x + (Math.random() - 0.5) * 30, 0, pos.z + (Math.random() - 0.5) * 30);
        desired.subVectors(e.wanderTarget, pos).setY(0);
        if (desired.lengthSq() > 0.01) desired.normalize();
        speed = e.kind === 'rabbit' ? (Math.sin(e.t * 0.7) > 0.3 ? 2.5 : 0) : 0.9;
      }
      // obstacle avoidance
      if (speed > 0 && e.t % 0.25 < dt) {
        const o = pos.clone().add(new THREE.Vector3(0, 0.5, 0));
        const hit = g.physics.castRay(o, desired, 1.6, groups(0xffff, G.STATIC));
        if (hit) desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.2);
      }
      e.yaw = dampAngle(e.yaw, Math.atan2(desired.x, desired.z), 6, dt);
      const fwd = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      // rabbits move in hops
      let move = speed;
      if (e.kind === 'rabbit' && speed > 0) {
        e.hopPhase += dt * (speed > 4 ? 3.2 : 2.2);
        const ph = e.hopPhase % 1;
        move = ph < 0.55 ? speed * 1.7 : speed * 0.15;
      }
      e.vel.x = damp(e.vel.x, fwd.x * move, 8, dt);
      e.vel.z = damp(e.vel.z, fwd.z * move, 8, dt);
      pos.x += e.vel.x * dt;
      pos.z += e.vel.z * dt;
      e.groundTimer -= dt;
      if (e.groundTimer <= 0) {
        e.groundTimer = 0.15;
        e.groundY = g.physics.groundY(pos.x, pos.z, pos.y + 1.6);
      }
      let hopY = 0;
      if (e.kind === 'rabbit' && speed > 0) {
        const ph = e.hopPhase % 1;
        hopY = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI) * (speed > 4 ? 0.45 : 0.2) : 0;
      }
      pos.y = damp(pos.y, e.groundY, 20, dt);
      e.obj.rotation.set(0, e.yaw, 0);
      e.body?.setNextKinematicTranslation({ x: pos.x, y: pos.y + (e.kind === 'rabbit' ? 0.4 : 0), z: pos.z });
      this.animate(e, speed, hopY, dt);
      // attacks
      e.attackCool -= dt;
      if (e.state === 'attack' && e.attackCool <= 0 && !inCar) {
        e.attackCool = e.kind === 'rabbit' ? 1.1 : 1.8;
        const dmg = (e.kind === 'rabbit' ? 11 : 24) * this.difficulty;
        g.damagePlayer(dmg, e.kind === 'rabbit' ? tr('Загрызен кроликом', 'Mauled by a rabbit') : tr('Убит оборванцем', 'Killed by a husk'));
        g.audio.play(e.kind === 'rabbit' ? 'rabbit_attack' : 'husk_attack', { pos });
        player.shake = Math.max(player.shake, 0.8);
      } else if (e.state === 'attack' && inCar && e.attackCool <= 0 && e.kind === 'husk') {
        e.attackCool = 2;
        g.audio.play('impact_metal', { pos, volume: 0.8 });
      }
      // run over by a car
      for (const c of g.cars) {
        if (!c.enabled || Math.abs(c.speed) < 4) continue;
        const cp = c.visual.root.position;
        const d = pos.distanceTo(cp);
        if (d > 3) continue;
        const local = c.worldToLocal(pos.clone());
        if (Math.abs(local.x) < 1.0 && Math.abs(local.z) < 2.3 && local.y < 1.6) {
          const v = new THREE.Vector3(0, 0, Math.sign(c.speed)).applyQuaternion(c.visual.root.quaternion);
          this.damage(e, 999, v, 'car');
          g.audio.play('crash_light', { pos, volume: 0.9 });
          c.body.applyImpulse({ x: -v.x * 250, y: 0, z: -v.z * 250 }, true);
        }
      }
      if (e.kind === 'rabbit' && Math.random() < dt * 0.08 && dist < 30) g.audio.play('rabbit_squeal', { pos, volume: 0.5 });
      if (e.kind === 'husk' && Math.random() < dt * 0.12 && dist < 35) g.audio.play('husk_growl', { pos, volume: 0.7 });
    }
  }

  private animate(e: Enemy, speed: number, hopY: number, dt: number) {
    const P = e.parts;
    if (e.kind === 'rabbit') {
      const ph = e.hopPhase % 1;
      const moving = speed > 0.1;
      P.body.position.y = hopY;
      const stretch = moving ? Math.sin(ph * Math.PI * 2) : 0;
      P.body.rotation.x = moving ? -stretch * 0.25 : Math.sin(e.t * 2) * 0.02;
      for (const s of [-1, 1]) {
        P['hind' + s].rotation.x = moving ? (ph < 0.55 ? -1.0 * Math.sin((ph / 0.55) * Math.PI) : 0.2) : 0.1;
        P['front' + s].rotation.x = moving ? (ph < 0.55 ? 0.9 * Math.sin((ph / 0.55) * Math.PI) : -0.2) : 0;
        P['ear' + s].rotation.x = -0.25 + (moving ? -0.4 * stretch : Math.sin(e.t * 3 + s) * 0.08) - (e.state === 'chase' ? 0.5 : 0);
      }
      P.head.rotation.x = e.state === 'attack' ? -0.3 + Math.sin(e.t * 20) * 0.2 : Math.sin(e.t * 1.3) * 0.05;
    } else {
      const w = e.t * (speed > 2 ? 7 : 4.5);
      const a = Math.min(1, speed / 1.5);
      for (const s of [-1, 1]) {
        P['hip' + s].rotation.x = Math.sin(w + (s > 0 ? 0 : Math.PI)) * 0.5 * a;
        P['knee' + s].rotation.x = Math.max(0, Math.sin(w + (s > 0 ? 0 : Math.PI) + 1.2)) * 0.8 * a;
        P['arm' + s].rotation.x = e.state === 'attack' ? -1.4 + Math.sin(e.t * 9) * 0.6 : -0.9 + Math.sin(w + (s > 0 ? Math.PI : 0)) * 0.25 * a;
        P['arm' + s].rotation.z = s * 0.15;
        P['elbow' + s].rotation.x = -0.4;
      }
      P.torso.rotation.x = 0.25 + Math.sin(w * 2) * 0.03;
      P.torso.rotation.z = Math.sin(w) * 0.06;
      P.head.rotation.z = Math.sin(e.t * 0.9) * 0.2;
      P.hips.position.y = 0.95 + Math.abs(Math.sin(w)) * 0.03 * a;
    }
  }

  clear() {
    for (const e of [...this.list]) this.remove(e);
  }
}
