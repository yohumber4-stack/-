import * as THREE from 'three';
import type { Game } from './game';
import { ParticlePool, Precipitation } from '../gfx/particles';
import { clamp } from '../core/math';

/** Visual effects: dust, smoke, sparks, blood, explosions, muzzle flash, weather particles. */
export class Fx {
  smoke: ParticlePool;
  dust: ParticlePool;
  glow: ParticlePool;
  precip: Precipitation;
  private flash: THREE.PointLight;
  private flashT = 0;
  group = new THREE.Group();
  private dustAcc = 0;
  private stormAcc = 0;

  constructor(private g: Game) {
    const puff = g.tex.puff;
    this.smoke = new ParticlePool(900, puff, false);
    this.dust = new ParticlePool(1500, puff, false);
    this.glow = new ParticlePool(400, puff, true);
    this.precip = new Precipitation();
    this.flash = new THREE.PointLight(0xffb060, 0, 18, 2);
    this.group.add(this.smoke.points, this.dust.points, this.glow.points, this.precip.mesh, this.flash);
  }

  shift(dx: number, dz: number) {
    this.smoke.shift(dx, dz);
    this.dust.shift(dx, dz);
    this.glow.shift(dx, dz);
  }

  blood(p: THREE.Vector3, dir: THREE.Vector3) {
    this.dust.emit({ pos: p, vel: dir.clone().multiplyScalar(1.5), count: 10, spread: 1.6, life: [0.3, 0.8], size: [0.08, 0.2], grow: 0.3, color: 0x6a0c08, alpha: 0.85, grav: 6, drag: 2 });
  }
  sandHit(p: THREE.Vector3) {
    this.dust.emit({ pos: p, vel: new THREE.Vector3(0, 1.2, 0), count: 8, spread: 1.2, life: [0.5, 1.2], size: [0.15, 0.4], grow: 0.8, color: 0xc8a47a, alpha: 0.6, grav: 1.5, drag: 2 });
  }
  sparks(p: THREE.Vector3, n = 10) {
    this.glow.emit({ pos: p, count: n, spread: 5, life: [0.15, 0.45], size: [0.03, 0.07], grow: -0.05, color: 0xffb050, alpha: 1, grav: 9, drag: 1 });
  }
  muzzle(p: THREE.Vector3, dir: THREE.Vector3) {
    this.glow.emit({ pos: p, vel: dir.clone().multiplyScalar(3), count: 6, spread: 1, life: [0.04, 0.09], size: [0.12, 0.3], grow: 2, color: 0xffc070, alpha: 1 });
    this.smoke.emit({ pos: p, vel: dir.clone().multiplyScalar(1.5), count: 4, spread: 0.3, life: [0.6, 1.2], size: [0.1, 0.25], grow: 0.6, color: 0xb0aca4, alpha: 0.35 });
    this.flash.position.copy(p);
    this.flash.color.set(0xffb060);
    this.flash.intensity = 25;
    this.flash.distance = 14;
    this.flashT = 0.06;
  }
  explosion(p: THREE.Vector3) {
    this.glow.emit({ pos: p, count: 30, spread: 9, life: [0.2, 0.6], size: [0.6, 1.8], grow: 4, color: 0xff8030, alpha: 1, drag: 3 });
    this.sparks(p, 40);
    this.smoke.emit({ pos: p, vel: new THREE.Vector3(0, 3, 0), count: 40, spread: 5, life: [2, 5], size: [1, 2.5], grow: 1.8, color: 0x3a342e, alpha: 0.7, drag: 1.5, grav: -0.5 });
    this.dust.emit({ pos: p, vel: new THREE.Vector3(0, 5, 0), count: 50, spread: 10, life: [1, 3], size: [0.5, 1.4], grow: 1.5, color: 0xb89a70, alpha: 0.7, drag: 1.8, grav: 2 });
    this.flash.position.copy(p);
    this.flash.color.set(0xff9040);
    this.flash.intensity = 300;
    this.flash.distance = 60;
    this.flashT = 0.25;
  }
  woodBurst(p: THREE.Vector3) {
    this.dust.emit({ pos: p, count: 16, spread: 3.5, life: [0.4, 1.0], size: [0.05, 0.14], grow: 0, color: 0x8a6a44, alpha: 0.95, grav: 9, drag: 0.8 });
    this.dust.emit({ pos: p, count: 8, spread: 1.2, life: [0.5, 1.2], size: [0.3, 0.6], grow: 0.8, color: 0xb8a080, alpha: 0.4, drag: 2 });
  }

  update(dt: number) {
    const g = this.g;
    const fog = g.scene.fog as THREE.FogExp2;
    const h = g.renderer.domElement.height;
    this.smoke.update(dt, fog, h);
    this.dust.update(dt, fog, h);
    this.glow.update(dt, fog, h);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.intensity = 0;
      else this.flash.intensity *= 0.85;
    }
    const env = g.env;
    this.precip.update(dt, g.player.camera.position, env.cur.rain, env.cur.sand * 0.8, env.wind);
    // car effects: exhaust, wheel dust on sand, tyre smoke
    for (const car of g.cars) {
      if (!car.enabled) continue;
      const d = car.visual.root.position.distanceTo(g.player.camera.position);
      if (d > 120) continue;
      if (car.running && Math.random() < dt * (6 + car.throttle * 20)) {
        const ex = car.localToWorld(car.anchor('exhaust'));
        const back = new THREE.Vector3(0, 0, -1).applyQuaternion(car.visual.root.quaternion);
        const dark = car.misfire > 0.3 || (car.parts.engine?.cond ?? 1) < 0.3;
        this.smoke.emit({ pos: ex, vel: back.multiplyScalar(1.2).add(new THREE.Vector3(0, 0.3, 0)), count: 1, spread: 0.3, life: [0.8, 1.8], size: [0.08, 0.16], grow: 0.9 + car.throttle, color: dark ? 0x40403c : 0xd0ccc4, alpha: dark ? 0.5 : 0.16 + car.throttle * 0.15, drag: 1.2, grav: -0.3 });
      }
      const spd = Math.abs(car.speed);
      if (spd > 2) {
        this.dustAcc += dt * spd * (car.onSand > 0.4 ? 1.8 : 0.15);
        while (this.dustAcc > 1) {
          this.dustAcc -= 1;
          const w = car.wheels[2 + Math.floor(Math.random() * 2)];
          if (!w.contact) continue;
          const p = w.cp.clone();
          const onSand = w.surface === 'sand';
          this.dust.emit({ pos: p.add(new THREE.Vector3(0, 0.1, 0)), vel: new THREE.Vector3(0, 0.8, 0).addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(car.visual.root.quaternion), spd * 0.12), count: 1, spread: 1.2, life: [1.2, 3.2], size: [0.4, 0.9], grow: 1.4 + spd * 0.04, color: onSand ? 0xcaa77c : 0xb0a490, alpha: onSand ? 0.34 : 0.12, drag: 1.4, grav: -0.05 });
        }
      }
      if (car.skid > 0.3 && car.onSand < 0.5 && spd > 4 && Math.random() < dt * 30 * car.skid) {
        const w = car.wheels[Math.floor(Math.random() * 4)];
        if (w.contact) this.smoke.emit({ pos: w.cp.clone(), count: 1, spread: 0.6, life: [1, 2.2], size: [0.3, 0.6], grow: 1.2, color: 0xd8d4cc, alpha: 0.25, drag: 1.5 });
      }
      if (car.temp > 118 && car.running && Math.random() < dt * 12) {
        const p = car.localToWorld(new THREE.Vector3(0, 0.9, 1.7));
        this.smoke.emit({ pos: p, vel: new THREE.Vector3(0, 1.5, 0), count: 1, spread: 0.5, life: [1, 2], size: [0.2, 0.4], grow: 1, color: 0xf0f0f0, alpha: 0.3, drag: 1 });
      }
    }
    // blowing sand clouds in storms
    if (env.cur.sand > 0.3) {
      this.stormAcc += dt * 25 * env.cur.sand;
      const cam = g.player.camera.position;
      while (this.stormAcc > 1) {
        this.stormAcc -= 1;
        const p = cam.clone().add(new THREE.Vector3((Math.random() - 0.5) * 50, Math.random() * 4 - 1, (Math.random() - 0.5) * 50));
        this.dust.emit({ pos: p, vel: env.wind.clone().multiplyScalar(0.9), count: 1, spread: 2, life: [2, 4], size: [2.5, 5], grow: 1.5, color: 0xb88a58, alpha: 0.14 * env.cur.sand, drag: 0.2 });
      }
    }
  }
}
