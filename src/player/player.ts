import * as THREE from 'three';
import { RAPIER, Physics, GROUPS } from '../physics/physics';
import { Input } from '../core/input';
import { clamp, clamp01, damp, lerp } from '../core/math';
import { Car } from '../vehicle/car';

export interface PlayerStats {
  health: number;
  hunger: number;
  thirst: number;
  energy: number;
  stamina: number;
}

export type Surface = 'sand' | 'asphalt' | 'wood' | 'concrete' | 'metal';

const RADIUS = 0.3;
const HALF = 0.6;
const EYE = 1.62;
const EYE_CROUCH = 1.02;

export class Player {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  private ctrl: RAPIER.KinematicCharacterController;
  camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0;
  vel = new THREE.Vector3();
  grounded = false;
  crouch = 0;
  sprinting = false;
  stats: PlayerStats = { health: 100, hunger: 100, thirst: 100, energy: 100, stamina: 100 };
  car: Car | null = null;
  seat: 'driver' | 'passenger' = 'driver';
  carYaw = 0;
  carPitch = 0;
  thirdPerson = false;
  private tpDist = 7;
  bob = 0;
  private bobAmt = 0;
  headBob = true;
  stepDist = 0;
  onStep: ((surface: Surface) => void) | null = null;
  onLand: ((speed: number) => void) | null = null;
  onDamage: ((amount: number, cause: string) => void) | null = null;
  surface: Surface = 'sand';
  prevPos = new THREE.Vector3();
  curPos = new THREE.Vector3();
  carryMass = 0;
  dead = false;
  private fallSpeed = 0;
  leaning = 0;
  shake = 0;
  private shakeT = 0;
  inShelter = false;

  constructor(private physics: Physics, pos: THREE.Vector3, fov = 75) {
    this.camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 9000);
    this.camera.rotation.order = 'YXZ';
    this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + HALF + RADIUS, pos.z));
    this.collider = physics.world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(GROUPS.player).setFriction(0), this.body);
    physics.setOwner(this.collider, { kind: 'player' });
    this.ctrl = physics.world.createCharacterController(0.02);
    this.ctrl.setUp({ x: 0, y: 1, z: 0 });
    this.ctrl.enableAutostep(0.38, 0.18, false);
    this.ctrl.enableSnapToGround(0.35);
    this.ctrl.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    this.ctrl.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    this.ctrl.setApplyImpulsesToDynamicBodies(true);
    this.ctrl.setCharacterMass(80);
    this.curPos.copy(pos);
    this.prevPos.copy(pos);
  }

  /** Feet position (local coords). */
  get feet() {
    return this.curPos;
  }

  teleport(p: THREE.Vector3) {
    this.body.setTranslation({ x: p.x, y: p.y + HALF + RADIUS, z: p.z }, true);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + HALF + RADIUS, z: p.z });
    this.curPos.copy(p);
    this.prevPos.copy(p);
    this.vel.set(0, 0, 0);
  }

  look(input: Input, dt: number) {
    const s = 0.0022 * input.sensitivity;
    const dx = input.mouse.dx * s, dy = input.mouse.dy * s * (input.invertY ? -1 : 1);
    if (this.car) {
      this.carYaw = clamp(this.carYaw - dx, -2.4, 2.4);
      this.carPitch = clamp(this.carPitch - dy, -1.35, 1.2);
    } else {
      this.yaw -= dx;
      this.pitch = clamp(this.pitch - dy, -1.5, 1.5);
    }
  }

  fixedUpdate(dt: number, input: Input, blocked: boolean) {
    this.prevPos.copy(this.curPos);
    if (this.car || this.dead) return;
    const fwd = (input.down('forward') ? 1 : 0) - (input.down('back') ? 1 : 0);
    const str = (input.down('left') ? 1 : 0) - (input.down('right') ? 1 : 0);
    const wantCrouch = input.down('crouch');
    this.crouch = damp(this.crouch, wantCrouch ? 1 : 0, 10, dt);
    const st = this.stats;
    const heavy = clamp01((this.carryMass - 10) / 90);
    const tired = st.energy < 12 ? 0.75 : 1;
    this.sprinting = input.down('sprint') && fwd > 0 && st.stamina > 2 && !wantCrouch && heavy < 0.9;
    let speed = (this.sprinting ? 6.2 : 3.4) * lerp(1, 0.45, heavy) * tired * lerp(1, 0.5, this.crouch);
    if (blocked) speed = 0;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // camera looks along -Z at yaw 0: forward = (-sin, 0, -cos)
    const dir = new THREE.Vector3(-s * fwd - c * str, 0, -c * fwd + s * str);
    if (dir.lengthSq() > 1) dir.normalize();
    const target = dir.multiplyScalar(speed);
    const accel = this.grounded ? 14 : 2.5;
    this.vel.x = damp(this.vel.x, target.x, accel, dt);
    this.vel.z = damp(this.vel.z, target.z, accel, dt);
    if (this.grounded) {
      this.vel.y = -1.5;
      if (input.pressedA('jump') && st.stamina > 8 && !blocked && heavy < 0.8) {
        this.vel.y = 4.7 * lerp(1, 0.7, heavy);
        st.stamina -= 8;
        this.grounded = false;
      }
    } else {
      this.vel.y -= 9.81 * dt;
      this.fallSpeed = Math.max(this.fallSpeed, -this.vel.y);
    }
    if (this.sprinting && dir.lengthSq() > 0) st.stamina = Math.max(0, st.stamina - 16 * dt);
    else st.stamina = Math.min(100, st.stamina + (this.grounded ? 14 : 4) * dt * (st.energy < 20 ? 0.5 : 1));

    const delta = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.ctrl.computeColliderMovement(this.collider, delta, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, GROUPS.player);
    const mv = this.ctrl.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.ctrl.computedGrounded();
    const t = this.body.translation();
    const np = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
    this.body.setNextKinematicTranslation(np);
    this.curPos.set(np.x, np.y - HALF - RADIUS, np.z);
    if (this.grounded && !wasGrounded) {
      if (this.fallSpeed > 3) this.onLand?.(this.fallSpeed);
      if (this.fallSpeed > 9.5) this.onDamage?.((this.fallSpeed - 9.5) * 14, 'fall');
      this.fallSpeed = 0;
    }
    if (this.grounded && mv.y > -0.001 && Math.abs(mv.y) < 0.5) this.vel.y = Math.min(this.vel.y, 0);
    // horizontal velocity from actual movement (sliding along walls)
    const hs = Math.hypot(mv.x, mv.z) / dt;
    if (this.grounded) {
      this.stepDist += hs * dt;
      const stride = this.sprinting ? 2.1 : 1.55;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        this.onStep?.(this.surface);
      }
    }
    this.bobAmt = damp(this.bobAmt, this.grounded ? clamp01(hs / 6) : 0, 8, dt);
    this.bob += hs * dt * 2.1;
    if (this.curPos.y < -500) this.onDamage?.(1000, 'fall');
  }

  /** Place the camera; alpha interpolates between fixed steps. */
  updateCamera(alpha: number, dt: number) {
    const cam = this.camera;
    this.shakeT += dt;
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const sh = this.shake * this.shake;
    const shx = (Math.sin(this.shakeT * 37) + Math.sin(this.shakeT * 23.1)) * 0.02 * sh;
    const shy = (Math.sin(this.shakeT * 41.3) + Math.sin(this.shakeT * 17.7)) * 0.02 * sh;
    if (this.car) {
      const car = this.car;
      const root = car.visual.root;
      if (this.thirdPerson) {
        const back = new THREE.Vector3(0, 0, -1).applyQuaternion(root.quaternion);
        back.y = 0;
        back.normalize();
        const yaw = Math.atan2(back.x, back.z) + this.carYaw;
        const d = this.tpDist;
        const p = root.position.clone().add(new THREE.Vector3(Math.sin(yaw) * d * Math.cos(this.carPitch * 0.5 + 0.25), 1.2 + Math.sin(this.carPitch * 0.5 + 0.25) * d, Math.cos(yaw) * d * Math.cos(this.carPitch * 0.5 + 0.25)));
        cam.position.lerp(p, 1 - Math.exp(-dt * 12));
        cam.lookAt(root.position.clone().add(new THREE.Vector3(0, 1.0, 0)));
        return;
      }
      const seat = car.anchor(this.seat);
      seat.x += this.leaning * (this.seat === 'driver' ? 0.25 : -0.25);
      root.updateMatrixWorld();
      cam.position.copy(seat).applyMatrix4(root.matrixWorld);
      // bumpy ride: small camera lag from acceleration
      const q = root.quaternion.clone();
      const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.carPitch + shy, this.carYaw + Math.PI + shx, 0, 'YXZ'));
      cam.quaternion.copy(q).multiply(local);
      return;
    }
    const p = new THREE.Vector3().lerpVectors(this.prevPos, this.curPos, alpha);
    const eye = lerp(EYE, EYE_CROUCH, this.crouch);
    const bob = this.headBob ? Math.sin(this.bob * Math.PI) * 0.045 * this.bobAmt : 0;
    const sway = this.headBob ? Math.cos(this.bob * Math.PI * 0.5) * 0.03 * this.bobAmt : 0;
    cam.position.set(p.x + Math.cos(this.yaw) * sway, p.y + eye + bob, p.z - Math.sin(this.yaw) * sway);
    cam.rotation.set(this.pitch + shy, this.yaw + shx, 0, 'YXZ');
  }

  enterCar(car: Car, seat: 'driver' | 'passenger') {
    this.car = car;
    this.seat = seat;
    this.carYaw = 0;
    this.carPitch = -0.12;
    this.collider.setEnabled(false);
    this.vel.set(0, 0, 0);
  }
  exitCar(pos: THREE.Vector3, yaw: number) {
    this.car = null;
    this.collider.setEnabled(true);
    this.teleport(pos);
    this.yaw = yaw;
    this.pitch = 0;
  }
  shiftOrigin(dx: number, dz: number) {
    this.curPos.x -= dx; this.curPos.z -= dz;
    this.prevPos.x -= dx; this.prevPos.z -= dz;
  }
  /** Where the player looks (world ray). */
  viewRay(out: THREE.Ray) {
    out.origin.copy(this.camera.position);
    out.direction.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return out;
  }
}
