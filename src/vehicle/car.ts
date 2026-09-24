import * as THREE from 'three';
import { RAPIER, Physics, GROUPS } from '../physics/physics';
import { CarVisual, SlotId, SLOT_POS, buildCar, buildPartVisual, CarLook, PartVisual, drawOdo, setPaint, ALL_SLOTS } from './carModel';
import { PartState, PART_INFO, SLOT_KIND, ENGINE_OIL_CAP, RADIATOR_CAP, FUEL_CAP, KIND_SLOT, PartKind } from './parts';
import { Materials } from '../gfx/materials';
import { clamp, clamp01, lerp, damp, smoothstep, sign } from '../core/math';
import { WorldFn } from '../world/worldfn';

export interface CarControls {
  throttle: number; // 0..1 (W)
  brake: number; // 0..1 (S)
  steer: number; // -1..1 (left positive)
  handbrake: boolean;
}

export type Surface = 'asphalt' | 'sand' | 'hard';
const SURF: Record<Surface, { mu: number; rr: number; lat: number }> = {
  asphalt: { mu: 1.05, rr: 0.014, lat: 9 },
  sand: { mu: 0.72, rr: 0.07, lat: 5.5 },
  hard: { mu: 0.95, rr: 0.018, lat: 8 },
};

interface Wheel {
  slot: SlotId;
  hp: THREE.Vector3;
  front: boolean;
  left: boolean;
  comp: number;
  prevComp: number;
  len: number;
  contact: boolean;
  cp: THREE.Vector3;
  n: THREE.Vector3;
  omega: number;
  rot: number;
  load: number;
  slip: number;
  surface: Surface;
}

const MAX_LEN = 0.3;
const MIN_LEN = 0.07;
const SPRING = 31000;
const DAMP_C = 1900;
const DAMP_R = 2700;
const GEARS = [-3.55, 0, 3.75, 2.3, 1.49, 1.0];
const FINAL = 4.1;
export const IDLE_RPM = 850;
export const MAX_RPM = 6000;

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();

export function torqueAt(rpm: number) {
  const x = (rpm - 3300) / 3300;
  return 112 * clamp(1 - 0.55 * x * x, 0.3, 1);
}

export interface CarEvent {
  type: 'stall' | 'start' | 'crank_fail' | 'overheat' | 'part_off' | 'impact' | 'no_fuel' | 'seized' | 'shift' | 'backfire';
  slot?: SlotId;
  force?: number;
  point?: THREE.Vector3;
}

let carIds = 1;

export class Car {
  id = carIds++;
  visual: CarVisual;
  body: RAPIER.RigidBody;
  private cols: Record<string, RAPIER.Collider> = {};
  parts: Partial<Record<SlotId, PartState>> = {};
  hinge: Partial<Record<SlotId, { t: number; target: number }>> = {};
  fuel = { petrol: 10, diesel: 0, water: 0 };
  capsOpen = { fuel: false, oil: false, radiator: false };
  running = false;
  ignition = false;
  cranking = false;
  private crankTime = 0;
  private crankNeed = 1;
  rpm = 0;
  temp = 25;
  gear = 0;
  auto = true;
  private shiftTimer = 0;
  private shiftTarget = 0;
  private revHold = 0;
  steerAngle = 0;
  throttle = 0;
  brake = 0;
  handbrake = true;
  lights = 0; // 0 off, 1 low, 2 high
  horn = false;
  radioOn = false;
  radioFreq = 94.2;
  odometer = 0;
  speed = 0; // forward speed m/s
  wheels: Wheel[] = [];
  misfire = 0;
  wheelspin = 0;
  skid = 0;
  onSand = 0;
  events: CarEvent[] = [];
  driverSeated = false;
  isPlayerCar = false;
  dead = false; // wreck that never runs
  gloveboxOpen = false;
  // interpolation
  private prevPos = new THREE.Vector3();
  private prevQuat = new THREE.Quaternion();
  private curPos = new THREE.Vector3();
  private curQuat = new THREE.Quaternion();
  headL: THREE.SpotLight | null = null;
  headR: THREE.SpotLight | null = null;
  private blink = 0;
  enabled = true;
  worldX = 0;
  worldZ = 0;
  accel = new THREE.Vector3();
  private lastVel = new THREE.Vector3();
  electricsKilled = 0;
  look: CarLook;
  spawnKey: string | null = null;
  modified = false;

  constructor(
    private physics: Physics,
    private mats: Materials,
    private fn: WorldFn,
    look: CarLook,
    parts: Partial<Record<SlotId, PartState>>,
    pos: THREE.Vector3,
    yaw: number,
  ) {
    this.look = look;
    const without = ALL_SLOTS.filter((s) => !parts[s]);
    this.visual = buildCar(mats, look, without);
    this.parts = { ...parts };
    for (const s of ALL_SLOTS) {
      const p = this.parts[s];
      const pv = this.visual.parts[s];
      if (p && pv) this.applyPartLook(pv, p);
      if (p?.kind === 'wheel' && pv) this.orientWheel(s, pv);
    }
    for (const s of ['door_fl', 'door_fr', 'door_rl', 'door_rr', 'hood', 'trunk'] as SlotId[]) this.hinge[s] = { t: 0, target: 0 };
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.02)
        .setAngularDamping(0.15)
        .setCcdEnabled(true)
        .setCanSleep(true),
    );
    this.buildColliders();
    this.updateMass();
    const hp = (x: number, z: number) => new THREE.Vector3(x, 0.52, z);
    const W = (slot: SlotId, x: number, z: number, front: boolean): Wheel => ({
      slot, hp: hp(x, z), front, left: x > 0, comp: 0, prevComp: 0, len: MAX_LEN, contact: false, cp: new THREE.Vector3(), n: new THREE.Vector3(0, 1, 0), omega: 0, rot: 0, load: 0, slip: 0, surface: 'sand',
    });
    this.wheels = [W('wheel_fl', 0.672, 1.22, true), W('wheel_fr', -0.672, 1.22, true), W('wheel_rl', 0.672, -1.21, false), W('wheel_rr', -0.672, -1.21, false)];
    this.curPos.copy(pos);
    this.prevPos.copy(pos);
    this.curQuat.copy(q);
    this.prevQuat.copy(q);
    this.visual.root.position.copy(pos);
    this.visual.root.quaternion.copy(q);
    this.visual.root.userData.car = this;
    for (const s of ALL_SLOTS) { const pv = this.visual.parts[s]; if (pv) pv.root.userData.slot = s; }
    this.visual.key.userData.control = 'key';
    this.visual.radio.body.userData.control = 'radio';
    this.visual.glovebox.userData.control = 'glovebox';
    this.visual.fuelCap.userData.control = 'fuelcap';
    this.visual.body.userData.control = 'body';
  }

  // ------------------------------------------------------------------ physics shapes
  private cuboid(name: string, hx: number, hy: number, hz: number, x: number, y: number, z: number) {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setDensity(0).setFriction(0.6).setCollisionGroups(GROUPS.car);
    if (name === 'floor') d.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(9000);
    const c = this.physics.world.createCollider(d, this.body);
    this.physics.setOwner(c, { kind: 'car', car: this, part: name });
    this.cols[name] = c;
    return c;
  }
  private buildColliders() {
    this.cuboid('floor', 0.78, 0.04, 1.96, 0, 0.285, 0);
    this.cuboid('bay', 0.76, 0.27, 0.62, 0, 0.6, 1.4);
    this.cuboid('tside_l', 0.035, 0.24, 0.36, 0.765, 0.62, -1.66);
    this.cuboid('tside_r', 0.035, 0.24, 0.36, -0.765, 0.62, -1.66);
    this.cuboid('trear', 0.78, 0.22, 0.04, 0, 0.6, -1.98);
    this.cuboid('tfloor', 0.72, 0.04, 0.34, 0, 0.405, -1.66);
    this.cuboid('roof', 0.66, 0.025, 0.5, 0, 1.37, -0.37);
    this.cuboid('pillar_fl', 0.03, 0.2, 0.03, 0.7, 1.15, 0.45);
    this.cuboid('pillar_fr', 0.03, 0.2, 0.03, -0.7, 1.15, 0.45);
    this.cuboid('pillar_rl', 0.04, 0.2, 0.05, 0.7, 1.15, -1.02);
    this.cuboid('pillar_rr', 0.04, 0.2, 0.05, -0.7, 1.15, -1.02);
    this.cuboid('bulk', 0.72, 0.25, 0.03, 0, 0.66, -1.3);
    this.cuboid('firewall', 0.72, 0.3, 0.02, 0, 0.6, 0.72);
    this.cuboid('dash', 0.7, 0.08, 0.14, 0, 0.84, 0.5);
    this.refreshPartColliders();
  }
  private setCol(name: string, want: boolean, make: () => void) {
    const c = this.cols[name];
    if (want && !c) make();
    else if (!want && c) {
      this.physics.owners.delete(c.handle);
      this.physics.world.removeCollider(c, true);
      delete this.cols[name];
    }
  }
  refreshPartColliders() {
    const p = this.parts;
    this.setCol('door_l', !!(p.door_fl && p.door_rl) && (this.hinge.door_fl?.t ?? 0) < 0.1 && (this.hinge.door_rl?.t ?? 0) < 0.1, () => this.cuboid('door_l', 0.03, 0.28, 0.82, 0.77, 0.62, -0.3));
    this.setCol('door_r', !!(p.door_fr && p.door_rr) && (this.hinge.door_fr?.t ?? 0) < 0.1 && (this.hinge.door_rr?.t ?? 0) < 0.1, () => this.cuboid('door_r', 0.03, 0.28, 0.82, -0.77, 0.62, -0.3));
    this.setCol('tlid', !!p.trunk && (this.hinge.trunk?.t ?? 0) < 0.1, () => this.cuboid('tlid', 0.74, 0.02, 0.31, 0, 0.93, -1.66));
    this.setCol('bumper_f', !!p.bumper_f, () => this.cuboid('bumper_f', 0.8, 0.05, 0.04, 0, 0.43, 2.07));
    this.setCol('bumper_r', !!p.bumper_r, () => this.cuboid('bumper_r', 0.8, 0.05, 0.04, 0, 0.45, -2.07));
    this.setCol('seat_d', !!p.seat_d, () => this.cuboid('seat_d', 0.24, 0.06, 0.24, 0.36, 0.43, -0.08));
    this.setCol('seat_p', !!p.seat_p, () => this.cuboid('seat_p', 0.24, 0.06, 0.24, -0.36, 0.43, -0.08));
    this.setCol('seat_r', !!p.seat_r, () => this.cuboid('seat_r', 0.62, 0.06, 0.24, 0, 0.43, -0.84));
  }
  updateMass() {
    let m = 780;
    for (const s of ALL_SLOTS) {
      const p = this.parts[s];
      if (p) m += PART_INFO[p.kind].mass;
    }
    m += (this.fuel.petrol + this.fuel.diesel + this.fuel.water) * 0.75;
    const comZ = this.parts.engine ? 0.12 : -0.08;
    this.body.setAdditionalMassProperties(m, { x: 0, y: 0.47, z: comZ }, { x: m * 1.58, y: m * 1.66, z: m * 0.4 }, { x: 0, y: 0, z: 0, w: 1 }, true);
  }

  // ------------------------------------------------------------------ parts
  applyPartLook(pv: PartVisual, p: PartState) {
    if (pv.paint && p.paint) setPaint(pv.paint, p.paint, p.rust ?? 0.3, this.look.dust);
    else if (pv.paint) pv.paint.userData.rust.value = p.rust ?? this.look.rust;
  }
  orientWheel(slot: SlotId, pv: PartVisual) {
    const spin = pv.root.userData.spin as THREE.Object3D;
    if (spin) spin.userData.baseYaw = slot.endsWith('r') ? Math.PI : 0;
  }
  /** Remove a part; returns its state and live visual so the caller can turn it into a loose item. */
  detach(slot: SlotId): { state: PartState; visual: PartVisual } | null {
    const st = this.parts[slot];
    const pv = this.visual.parts[slot];
    if (!st || !pv) return null;
    this.visual.root.remove(pv.root);
    delete this.parts[slot];
    delete this.visual.parts[slot];
    delete pv.root.userData.slot;
    this.modified = true;
    if (slot.startsWith('door') || slot === 'hood' || slot === 'trunk') this.hinge[slot] = { t: 0, target: 0 };
    pv.root.quaternion.identity();
    if (slot === 'engine' && this.running) this.stall();
    this.refreshPartColliders();
    this.updateMass();
    this.body.wakeUp();
    return { state: st, visual: pv };
  }
  canAttach(slot: SlotId, kind: PartKind) {
    return !this.parts[slot] && SLOT_KIND[slot] === kind;
  }
  attach(slot: SlotId, st: PartState, pv?: PartVisual) {
    if (this.parts[slot]) return false;
    if (!pv) {
      pv = buildPartVisual(KIND_SLOT[st.kind] === slot || st.kind === 'wheel' || st.kind === 'headlight' || st.kind === 'seat_f' ? slot : KIND_SLOT[st.kind], this.mats, { ...this.look, paint: st.paint ?? this.look.paint, rust: st.rust ?? this.look.rust });
    }
    this.applyPartLook(pv, st);
    pv.root.position.copy(SLOT_POS[slot]);
    pv.root.quaternion.identity();
    pv.root.visible = true;
    this.visual.root.add(pv.root);
    this.visual.parts[slot] = pv;
    this.parts[slot] = st;
    pv.root.userData.slot = slot;
    this.modified = true;
    if (st.kind === 'wheel') this.orientWheel(slot, pv);
    pv.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.refreshPartColliders();
    this.updateMass();
    this.body.wakeUp();
    return true;
  }
  toggleHinge(slot: SlotId) {
    const h = this.hinge[slot];
    if (!h || !this.parts[slot]) return false;
    h.target = h.target > 0.5 ? 0 : 1;
    return h.target > 0.5;
  }
  isOpen(slot: SlotId) {
    return (this.hinge[slot]?.target ?? 0) > 0.5;
  }

  // ------------------------------------------------------------------ fluids / electrics
  get fuelTotal() {
    return this.fuel.petrol + this.fuel.diesel + this.fuel.water;
  }
  addFuel(kind: 'petrol' | 'diesel' | 'water' | 'oil', litres: number): number {
    const room = FUEL_CAP - this.fuelTotal;
    const a = Math.min(room, litres);
    if (a <= 0) return 0;
    if (kind === 'oil') this.fuel.water += a * 0.5; // oil in the tank fouls the fuel (counted as contamination)
    else this.fuel[kind] += a;
    return a;
  }
  get battery() {
    return this.parts.battery;
  }
  get charge() {
    return this.parts.battery ? (this.parts.battery.charge ?? 0) * (0.3 + 0.7 * this.parts.battery.cond) : 0;
  }
  private drain(amount: number) {
    const b = this.parts.battery;
    if (b) b.charge = clamp01((b.charge ?? 0) - amount);
  }

  // ------------------------------------------------------------------ engine
  stall() {
    if (this.running) this.events.push({ type: 'stall' });
    this.running = false;
  }
  setIgnition(on: boolean) {
    this.ignition = on;
    if (!on) {
      this.stall();
      this.cranking = false;
    }
  }
  /** Key held in START position. */
  setCrank(on: boolean) {
    if (on && !this.ignition) this.ignition = true;
    if (on && !this.cranking && !this.running) {
      this.crankTime = 0;
      const eng = this.parts.engine;
      const cold = this.temp < 20 ? 0.6 : 0;
      this.crankNeed = 0.35 + (eng ? (1 - eng.cond) * 1.6 : 0) + cold + Math.random() * 0.5;
      if (this.charge < 0.18 || !this.parts.battery) this.events.push({ type: 'crank_fail' });
    }
    this.cranking = on && !this.running;
  }
  private engineCanRun(): boolean {
    const e = this.parts.engine;
    if (!e || e.cond <= 0.01 || this.dead) return false;
    if ((e.oil ?? 0) <= 0.02) return false;
    const good = this.fuel.petrol;
    const total = this.fuelTotal;
    if (good < 0.02) return false;
    if (total > 0 && good / total < 0.55) return false;
    return true;
  }
  get fuelQuality() {
    const t = this.fuelTotal;
    return t > 0 ? this.fuel.petrol / t : 0;
  }

  private updateEngine(dt: number, throttleIn: number, wheelOmega: number, ambient: number): number {
    const eng = this.parts.engine;
    const radiator = this.parts.radiator;
    // electrics
    const ch = this.charge;
    if (this.electricsKilled > 0) this.electricsKilled -= dt;
    // cranking
    if (this.cranking && !this.running) {
      if (ch > 0.15 && this.parts.battery && eng && (eng.oil ?? 0) > 0.02) {
        this.drain(dt * 0.006);
        this.rpm = lerp(this.rpm, 180 + 160 * ch, 1 - Math.exp(-dt * 8));
        this.crankTime += dt * clamp(ch * 1.3, 0.3, 1);
        if (this.crankTime > this.crankNeed) {
          if (this.engineCanRun() && this.electricsKilled <= 0) {
            this.running = true;
            this.cranking = false;
            this.rpm = 1300;
            this.events.push({ type: 'start' });
          } else if (this.crankTime > this.crankNeed + 5) {
            this.crankTime = this.crankNeed * 0.5;
          }
        }
      } else {
        this.rpm = damp(this.rpm, 0, 6, dt);
      }
    }
    let wheelTorque = 0;
    const ratio = GEARS[this.gear + 1] * FINAL;
    if (this.running) {
      if (!this.ignition || !this.engineCanRun() || this.electricsKilled > 0) {
        if (!this.engineCanRun() && this.fuel.petrol < 0.02) this.events.push({ type: 'no_fuel' });
        this.stall();
        return 0;
      }
      const q = this.fuelQuality;
      const cond = eng!.cond;
      const oilK = clamp01((eng!.oil ?? 0) / 1.0);
      this.misfire = clamp01((1 - cond) * 0.5 + (1 - q) * 1.6 + (this.temp > 118 ? 0.3 : 0));
      const mis = Math.random() < this.misfire * dt * 6;
      if (mis && Math.random() < 0.15) this.events.push({ type: 'backfire' });
      const thr = throttleIn * (mis ? 0.2 : 1);
      const power = (0.45 + 0.55 * cond) * (0.7 + 0.3 * oilK) * (this.temp > 125 ? 0.6 : 1);
      const shifting = this.shiftTimer > 0;
      if (this.gear === 0 || shifting) {
        const target = IDLE_RPM + thr * (MAX_RPM - IDLE_RPM) * 0.95;
        this.rpm = damp(this.rpm, target, thr > 0.05 ? 3.5 : 2.2, dt);
      } else {
        const rpmW = Math.abs(wheelOmega * ratio) * (30 / Math.PI);
        const lockRpm = 1250;
        if (rpmW < lockRpm) {
          const target = Math.max(IDLE_RPM, 1000 + thr * 1800);
          this.rpm = damp(this.rpm, target, 4, dt);
          const engage = 0.35 + 0.65 * clamp01(rpmW / lockRpm);
          const creep = this.auto ? 16 : 10;
          wheelTorque = (torqueAt(this.rpm) * thr * power + creep * (1 - thr)) * engage;
        } else {
          this.rpm = rpmW;
          const eb = (10 + this.rpm * 0.0045) * (1 - thr);
          wheelTorque = torqueAt(this.rpm) * thr * power - eb;
        }
        if (this.rpm > MAX_RPM) {
          this.revHold = 0.08;
        }
        if (this.revHold > 0) {
          this.revHold -= dt;
          wheelTorque = Math.min(wheelTorque, 0);
        }
        wheelTorque *= ratio * 0.9;
      }
      this.rpm = clamp(this.rpm, 500, MAX_RPM + 300);
      if (this.rpm < 520 && this.gear !== 0 && Math.abs(wheelOmega) < 0.5 && !this.auto) this.stall();
      // consumption
      const load = thr * this.rpm / MAX_RPM;
      const lph = 0.7 + load * 16 + (this.rpm / MAX_RPM) * 2.5;
      let burn = (lph / 3600) * dt;
      const tot = this.fuelTotal;
      if (tot > 0) {
        const k = Math.min(1, burn / tot);
        this.fuel.petrol -= this.fuel.petrol * k;
        this.fuel.diesel -= this.fuel.diesel * k;
        this.fuel.water -= this.fuel.water * k * 0.5;
      }
      eng!.oil = Math.max(0, (eng!.oil ?? 0) - dt * (0.0000012 * this.rpm + (cond < 0.3 ? 0.00008 : 0)));
      // wear
      let wear = dt * 0.0000004 * this.rpm;
      if ((eng!.oil ?? 0) < 0.8) wear += dt * 0.0006 * (1 - (eng!.oil ?? 0) / 0.8);
      if (this.temp > 122) wear += dt * 0.0025 * (this.temp - 122) / 10;
      if (this.rpm > MAX_RPM - 200) wear += dt * 0.0002;
      eng!.cond = Math.max(0, eng!.cond - wear);
      if (eng!.cond <= 0.01) {
        this.events.push({ type: 'seized' });
        this.stall();
      }
      // alternator
      if (this.parts.battery && this.rpm > 1100) {
        const b = this.parts.battery;
        b.charge = clamp01((b.charge ?? 0) + dt * 0.0012 * (1.1 - (b.charge ?? 0)));
      }
    } else if (!this.cranking) {
      this.rpm = damp(this.rpm, 0, 3, dt);
    }
    // electrical loads
    if (this.ignition && !this.running) this.drain(dt * 0.00002);
    if (this.lights > 0) this.drain(dt * (this.running ? 0.00008 : 0.0007));
    if (this.radioOn && this.ignition) this.drain(dt * (this.running ? 0 : 0.00015));
    // temperature
    const heat = this.running ? (0.35 + 0.65 * (this.rpm / MAX_RPM) * (0.4 + this.throttle * 0.6)) * 2.1 : 0;
    let coolK = 0.004;
    if (radiator) {
      const lvl = clamp01((radiator.coolant ?? 0) / RADIATOR_CAP);
      const eff = (0.25 + 0.75 * radiator.cond) * Math.min(1, lvl * 1.4);
      const air = 0.15 + clamp01(Math.abs(this.speed) / 30) * 0.85;
      const fan = this.temp > 98 && this.running && this.charge > 0.05 ? 0.5 : 0;
      const thermostat = smoothstep(82, 92, this.temp);
      coolK += eff * (air + fan) * 0.09 * (0.25 + 0.75 * thermostat);
      if (this.temp > 112 && (radiator.coolant ?? 0) > 0) radiator.coolant = Math.max(0, (radiator.coolant ?? 0) - dt * 0.004 * (this.temp - 110));
      if (radiator.cond < 0.3) radiator.coolant = Math.max(0, (radiator.coolant ?? 0) - dt * 0.0006 * (1 - radiator.cond));
    }
    this.temp += (heat - (this.temp - ambient) * coolK) * dt;
    if (this.temp > 130 && this.running && Math.random() < dt * 0.2) this.events.push({ type: 'overheat' });
    return wheelTorque;
  }

  shift(delta: number) {
    if (this.shiftTimer > 0) return;
    const g = clamp(this.gear + delta, -1, 4);
    if (g === this.gear) return;
    if (g === -1 && this.speed > 1.5) return;
    this.shiftTarget = g;
    this.shiftTimer = 0.22;
    this.events.push({ type: 'shift' });
  }

  // ------------------------------------------------------------------ simulation
  fixedUpdate(dt: number, ctl: CarControls, ambientTemp: number) {
    if (!this.enabled) return;
    this.prevPos.copy(this.curPos);
    this.prevQuat.copy(this.curQuat);
    const b = this.body;
    const t = b.translation(), r = b.rotation();
    const pos = _v3.set(t.x, t.y, t.z);
    _q.set(r.x, r.y, r.z, r.w);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(_q);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(_q);
    const lin = b.linvel();
    const vel = new THREE.Vector3(lin.x, lin.y, lin.z);
    this.accel.copy(vel).sub(this.lastVel).divideScalar(dt);
    this.lastVel.copy(vel);
    this.speed = vel.dot(fwd);
    const speedAbs = Math.abs(this.speed);
    this.odometer += (speedAbs * dt) / 1000;

    // --- driver inputs & automatic gearbox
    let thr = 0, brk = 0;
    const seated = this.driverSeated && !!this.parts.seat_d;
    if (seated) {
      if (this.auto) {
        if (this.gear >= 1 || this.gear === 0) {
          thr = ctl.throttle;
          brk = ctl.brake;
          if (ctl.throttle > 0.05 && this.gear === 0 && this.running) this.gear = 1;
          if (ctl.brake > 0.1 && ctl.throttle < 0.05 && this.speed < 0.6 && this.running) {
            this.revHold = 0;
            if (this.speed < 0.3) this.gear = -1;
          }
        } else if (this.gear === -1) {
          thr = ctl.brake;
          brk = ctl.throttle;
          if (ctl.throttle > 0.1 && this.speed > -0.6) this.gear = 1;
        }
        if (!this.running && this.gear !== 0) this.gear = 0;
      } else {
        thr = ctl.throttle;
        brk = ctl.brake;
      }
      this.handbrake = ctl.handbrake ? true : this.handbrake && ctl.throttle < 0.1;
    }
    this.throttle = thr;
    this.brake = brk;
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) this.gear = this.shiftTarget;
    }

    // --- steering
    const maxSteer = lerp(0.62, 0.075, Math.pow(clamp01(speedAbs / 30), 0.65));
    const target = seated ? ctl.steer * maxSteer : this.steerAngle;
    const rate = Math.abs(target) > Math.abs(this.steerAngle) ? 2.4 : 4.0;
    this.steerAngle += clamp(target - this.steerAngle, -rate * dt, rate * dt);

    // --- drivetrain
    const driven = this.wheels.filter((w) => !w.front && this.parts[w.slot]);
    let wo = 0;
    for (const w of driven) wo += w.omega;
    wo = driven.length ? wo / driven.length : 0;
    const wheelTorque = this.updateEngine(dt, thr, wo, ambientTemp);
    if (this.auto && this.running && this.shiftTimer <= 0 && this.gear >= 1) {
      const rpmW = Math.abs(wo * GEARS[this.gear + 1] * FINAL) * (30 / Math.PI);
      const upAt = 2500 + 2900 * thr, downAt = 1150 + 1000 * thr;
      if (rpmW > upAt && this.gear < 4) this.shift(1);
      else if (rpmW < downAt && this.gear > 1) this.shift(-1);
    }

    // --- wheels
    const com = b.worldCom();
    const comV = new THREE.Vector3(com.x, com.y, com.z);
    const ang = b.angvel();
    const angV = new THREE.Vector3(ang.x, ang.y, ang.z);
    const mass = b.mass();
    const down = up.clone().negate();
    let skid = 0, spin = 0, sand = 0, contacts = 0;
    const comp: number[] = [];
    for (const w of this.wheels) {
      const st = this.parts[w.slot];
      w.prevComp = w.comp;
      if (!st) {
        w.contact = false;
        w.comp = 0;
        comp.push(0);
        continue;
      }
      const radius = st.flat ? 0.23 : 0.3;
      const hpW = w.hp.clone().applyQuaternion(_q).add(pos);
      const hit = this.physics.castRay(hpW, down, MAX_LEN + radius, GROUPS.wheelRay, b);
      if (hit && hit.timeOfImpact > 0.0) {
        w.contact = true;
        w.len = Math.max(MIN_LEN, hit.timeOfImpact - radius);
        w.comp = MAX_LEN - w.len;
        w.cp.copy(down).multiplyScalar(hit.timeOfImpact).add(hpW);
        w.n.set(hit.normal.x, hit.normal.y, hit.normal.z);
        const owner = this.physics.ownerOf(hit.collider);
        if (owner?.kind === 'terrain') {
          const wx = w.cp.x + this.physics.originX, wz = w.cp.z + this.physics.originZ;
          w.surface = this.fn.onRoad(wx, wz, 0.1) ? 'asphalt' : 'sand';
        } else w.surface = 'hard';
      } else {
        w.contact = false;
        w.len = MAX_LEN;
        w.comp = 0;
      }
      comp.push(w.comp);
    }
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      const st = this.parts[w.slot];
      if (!st) continue;
      const radius = st.flat ? 0.23 : 0.3;
      if (!w.contact) {
        // free spinning wheel
        if (!w.front && this.running && this.gear !== 0) w.omega = damp(w.omega, (this.rpm / (GEARS[this.gear + 1] * FINAL)) * (Math.PI / 30), 3, dt);
        else w.omega = damp(w.omega, 0, 0.5, dt);
        if (w.front === false && brk > 0) w.omega = damp(w.omega, 0, 8, dt);
        w.rot += w.omega * dt;
        continue;
      }
      contacts++;
      // suspension
      const vComp = (w.comp - w.prevComp) / dt;
      let fs = SPRING * w.comp + (vComp > 0 ? DAMP_C : DAMP_R) * vComp;
      if (w.len <= MIN_LEN + 0.001) fs += 60000 * Math.max(0, MIN_LEN + 0.01 - w.len) + 4000 * Math.max(0, vComp);
      const other = comp[i ^ 1];
      fs += (w.front ? 13000 : 7000) * (w.comp - other);
      fs = Math.max(0, fs);
      w.load = fs;
      const hpW = w.hp.clone().applyQuaternion(_q).add(pos);
      b.applyImpulseAtPoint({ x: up.x * fs * dt, y: up.y * fs * dt, z: up.z * fs * dt }, { x: hpW.x, y: hpW.y, z: hpW.z }, true);
      // tyre frame
      const steer = w.front ? this.steerAngle * (1 + (w.left === this.steerAngle > 0 ? 0.08 : -0.06)) : 0;
      const wf = fwd.clone().applyAxisAngle(up, steer);
      wf.addScaledVector(w.n, -wf.dot(w.n)).normalize();
      const ws = new THREE.Vector3().crossVectors(w.n, wf).normalize(); // points to car's left
      const rp = w.cp.clone().sub(comV);
      const pv = new THREE.Vector3().crossVectors(angV, rp).add(vel);
      const vLong = pv.dot(wf), vLat = pv.dot(ws);
      const surf = SURF[w.surface];
      const condK = 0.75 + 0.25 * st.cond;
      const mu = surf.mu * condK * (st.flat ? 0.6 : 1);
      const fz = Math.min(fs, 9000);
      const share = mass / 4;
      // longitudinal
      let fx = 0;
      if (!w.front && driven.length) fx += wheelTorque / driven.length / radius;
      const hb = !w.front && this.handbrake;
      const brakeF = (w.front ? 3300 : 2300) * brk + (hb ? 5200 : 0);
      if (brakeF > 0) {
        const maxB = (Math.abs(vLong) * share) / dt;
        fx -= sign(vLong) * Math.min(brakeF, maxB);
      }
      const rr = surf.rr * fz * clamp01(Math.abs(vLong) / 0.6) * (st.flat ? 3 : 1);
      fx -= sign(vLong) * rr;
      // lateral
      const slipA = Math.atan2(vLat, Math.max(Math.abs(vLong), 2.2));
      let latMu = mu * (hb ? 0.45 : 1);
      let fy = -latMu * fz * clamp(slipA * surf.lat, -1, 1);
      // friction circle
      const lim = mu * fz;
      const tot = Math.hypot(fx, fy);
      let slipping = false;
      if (tot > lim && tot > 0) {
        const k = lim / tot;
        if (Math.abs(fx) > lim * 0.95 && !w.front) spin += Math.abs(fx) / lim - 0.9;
        fx *= k;
        fy *= k;
        slipping = true;
      }
      if (Math.abs(vLat) > 1.2 || (slipping && speedAbs > 3)) skid += Math.min(1, Math.abs(vLat) / 4 + (hb && speedAbs > 3 ? 0.5 : 0));
      if (w.surface === 'sand') sand++;
      const f = wf.clone().multiplyScalar(fx).addScaledVector(ws, fy);
      const ap = w.cp.clone().addScaledVector(up, 0.18);
      b.applyImpulseAtPoint({ x: f.x * dt, y: f.y * dt, z: f.z * dt }, { x: ap.x, y: ap.y, z: ap.z }, true);
      // wheel spin (visual + drivetrain feedback)
      const rollOmega = vLong / radius;
      if (!w.front && Math.abs(wheelTorque) / Math.max(1, driven.length) / radius > lim * 1.05 && this.running) {
        w.omega = damp(w.omega, rollOmega + sign(wheelTorque) * 18, 4, dt);
      } else if ((w.front ? brk > 0.95 : hb) && Math.abs(vLong) > 1 && brakeF > lim * 1.2) {
        w.omega = damp(w.omega, 0, 20, dt);
      } else w.omega = rollOmega;
      w.rot += w.omega * dt;
      w.slip = Math.abs(slipA);
    }
    this.skid = damp(this.skid, clamp01(skid / 2), 10, dt);
    this.wheelspin = damp(this.wheelspin, clamp01(spin), 8, dt);
    this.onSand = contacts ? sand / contacts : this.onSand;

    // aero drag + downforce-free yaw stabilisation (keyboard friendly)
    const drag = 0.5 * 1.2 * 0.42 * 1.95;
    const vv = vel.length();
    if (vv > 0.1) b.applyImpulse({ x: -vel.x * vv * drag * dt, y: -vel.y * vv * drag * dt, z: -vel.z * vv * drag * dt }, true);
    if (contacts >= 3 && speedAbs > 3) {
      // stability assist: only removes excess rotation (anti spin-out), never forces extra yaw
      const yawRate = angV.dot(up);
      const muAvg = this.onSand > 0.5 ? SURF.sand.mu : SURF.asphalt.mu;
      const maxYaw = (muAvg * 9.81 * 0.9) / Math.max(speedAbs, 1);
      let expected = (this.speed * Math.tan(this.steerAngle)) / 2.43;
      expected = clamp(expected, -maxYaw, maxYaw);
      const err = yawRate - expected;
      if (Math.sign(err) === Math.sign(yawRate) || Math.abs(yawRate) < 0.05) {
        const k = this.handbrake ? 0.15 : 0.6;
        const tq = -err * mass * k * dt;
        b.applyTorqueImpulse({ x: up.x * tq, y: up.y * tq, z: up.z * tq }, true);
      }
    }
    // keep a parked car parked
    if (contacts >= 3 && this.handbrake && speedAbs < 0.3 && thr < 0.05) {
      b.setLinvel({ x: lin.x * 0.8, y: lin.y, z: lin.z * 0.8 }, false);
    }
  }

  /** After physics step: record state for interpolation. */
  postStep() {
    const t = this.body.translation(), r = this.body.rotation();
    this.curPos.set(t.x, t.y, t.z);
    this.curQuat.set(r.x, r.y, r.z, r.w);
    this.worldX = t.x + this.physics.originX;
    this.worldZ = t.z + this.physics.originZ;
  }
  shiftOrigin(dx: number, dz: number) {
    this.curPos.x -= dx; this.curPos.z -= dz;
    this.prevPos.x -= dx; this.prevPos.z -= dz;
  }
  get position() {
    return this.curPos;
  }
  get quaternion() {
    return this.curQuat;
  }

  /** Per render frame: interpolate transform, animate parts, gauges and lights. */
  render(dt: number, alpha: number, night: number) {
    const root = this.visual.root;
    root.position.lerpVectors(this.prevPos, this.curPos, alpha);
    root.quaternion.slerpQuaternions(this.prevQuat, this.curQuat, alpha);
    // hinged panels
    for (const s of Object.keys(this.hinge) as SlotId[]) {
      const h = this.hinge[s]!;
      const pv = this.visual.parts[s];
      if (!pv || !pv.hinge) continue;
      const prev = h.t;
      h.t = damp(h.t, h.target, h.target > h.t ? 7 : 9, dt);
      if (Math.abs(h.t - h.target) < 0.002) h.t = h.target;
      if (prev !== h.t) {
        const e = h.t < 1 ? 1 - Math.pow(1 - h.t, 2) : 1;
        pv.root.setRotationFromAxisAngle(pv.hinge.axis, pv.hinge.open * e);
        if ((prev < 0.1) !== (h.t < 0.1)) this.refreshPartColliders();
      }
    }
    // wheels
    for (const w of this.wheels) {
      const pv = this.visual.parts[w.slot];
      if (!pv) continue;
      const y = w.hp.y - (w.contact ? w.len : MAX_LEN);
      pv.root.position.set(w.hp.x, y, w.hp.z);
      pv.root.rotation.set(0, w.front ? this.steerAngle : 0, 0);
      const spin = pv.root.userData.spin as THREE.Object3D;
      if (spin) {
        spin.rotation.set(w.rot * (spin.userData.baseYaw ? -1 : 1), spin.userData.baseYaw ?? 0, 0, 'YXZ');
      }
    }
    // interior controls
    const v = this.visual;
    v.steering.rotation.z = -this.steerAngle * 7.5;
    v.gearLever.rotation.set(-0.15 + (this.gear === -1 ? 0.25 : this.gear === 0 ? 0 : this.gear % 2 ? -0.2 : 0.2), 0, this.gear === -1 ? -0.25 : this.gear <= 2 ? 0.12 : -0.12);
    v.handbrake.rotation.x = this.handbrake ? -0.5 : 0;
    v.key.rotation.z = this.cranking ? -1.2 : this.ignition ? -0.7 : 0;
    v.glovebox.rotation.x = damp(v.glovebox.rotation.x, this.gloveboxOpen ? 0.9 : -0.12, 8, dt);
    v.fuelCap.visible = !this.capsOpen.fuel;
    // gauges
    const kmh = Math.abs(this.speed) * 3.6;
    const a0 = Math.PI * 1.14, a1 = Math.PI * 1.86;
    const powered = this.ignition && this.charge > 0.02 && this.electricsKilled <= 0;
    const needle = (a: number) => Math.atan2(-Math.cos(a), -Math.sin(a));
    v.gauges.speed.rotation.z = needle(a0 + (a1 - a0) * clamp01(kmh / 160));
    const b0 = Math.PI * 1.2, b1 = Math.PI * 1.8;
    const fuelFrac = powered ? clamp01(this.fuelTotal / FUEL_CAP) : 0;
    v.gauges.fuel.rotation.z = damp(v.gauges.fuel.rotation.z, needle(b0 + (b1 - b0) * fuelFrac), 3, dt);
    const tFrac = powered ? clamp01((this.temp - 40) / 90) : 0;
    v.gauges.temp.rotation.z = damp(v.gauges.temp.rotation.z, needle(b0 + (b1 - b0) * tFrac), 3, dt);
    drawOdo(v.gauges.odo, this.odometer);
    const L = v.gauges.lights;
    const eng = this.parts.engine;
    L.oil.emissiveIntensity = powered && (!this.running || !eng || (eng.oil ?? 0) < 0.6) ? 3 : 0;
    L.batt.emissiveIntensity = powered && (!this.running || this.charge < 0.2) ? 3 : 0;
    L.beam.emissiveIntensity = powered && this.lights === 2 ? 3 : 0;
    L.hand.emissiveIntensity = powered && this.handbrake ? 3 : 0;
    const lightsOn = this.lights > 0 && this.charge > 0.02 && this.electricsKilled <= 0;
    v.gauges.faceMat.emissiveIntensity = powered && lightsOn ? 0.35 : 0;
    (v.gauges.odo.tex as any).__mat && 0;
    // radio
    v.radio.needle.position.x = -0.06 + ((this.radioFreq - 87.5) / 20.5) * 0.12;
    v.radio.scaleMat.emissiveIntensity = powered && this.radioOn ? 1.2 : 0;
    // exterior lamps
    const bright = clamp01(this.charge * 4) * (this.running ? 1 : 0.8);
    const hl = this.visual.parts.headlight_l, hr = this.visual.parts.headlight_r;
    const hlOn = (p: PartVisual | undefined, st: PartState | undefined) => (p && st && st.cond > 0.05 ? (lightsOn ? (this.lights === 2 ? 14 : 8) * bright : 0) : 0);
    if (hl?.lamp) hl.lamp.emissiveIntensity = hlOn(hl, this.parts.headlight_l);
    if (hr?.lamp) hr.lamp.emissiveIntensity = hlOn(hr, this.parts.headlight_r);
    v.lamps.tail.emissiveIntensity = lightsOn ? 2.2 * bright : 0;
    if (this.brake > 0.05 && powered) v.lamps.tail.emissiveIntensity = 6;
    v.lamps.reverse.emissiveIntensity = powered && this.gear === -1 ? 4 : 0;
    this.blink += dt;
    v.lamps.indicator.emissiveIntensity = 0;
    v.lamps.dome.emissiveIntensity = (this.hinge.door_fl?.t ?? 0) > 0.2 && this.charge > 0.05 && night > 0.3 ? 1.5 : 0;
    if (this.headL && this.headR) {
      const il = hlOn(hl, this.parts.headlight_l) > 0 ? (this.lights === 2 ? 90 : 45) * bright : 0;
      const ir = hlOn(hr, this.parts.headlight_r) > 0 ? (this.lights === 2 ? 90 : 45) * bright : 0;
      this.headL.intensity = il;
      this.headR.intensity = ir;
      this.headL.visible = il > 0;
      this.headR.visible = ir > 0;
      const aim = this.lights === 2 ? 0.0 : -0.07;
      this.headL.target.position.set(0.5, 0.6 + aim * 40, 40);
      this.headR.target.position.set(-0.5, 0.6 + aim * 40, 40);
    }
    // air freshener pendulum
    const fr = v.freshener;
    const lateral = this.accel.clone().applyQuaternion(this.curQuat.clone().invert());
    fr.rotation.z = damp(fr.rotation.z, clamp(lateral.x * 0.05, -0.6, 0.6), 3, dt);
    fr.rotation.x = damp(fr.rotation.x, clamp(-lateral.z * 0.04, -0.5, 0.5), 3, dt);
  }

  /** Headlight spot lights (only for cars near the player). */
  enableHeadlightLights(on: boolean) {
    if (on && !this.headL) {
      const mk = (x: number) => {
        const l = new THREE.SpotLight(0xfff0d8, 0, 70, 0.52, 0.45, 1.3);
        l.position.set(x, 0.63, 2.02);
        l.target.position.set(x, 0.3, 30);
        this.visual.root.add(l, l.target);
        return l;
      };
      this.headL = mk(0.5);
      this.headR = mk(-0.5);
    } else if (!on && this.headL) {
      this.visual.root.remove(this.headL, this.headL.target, this.headR!, this.headR!.target);
      this.headL.dispose();
      this.headR!.dispose();
      this.headL = this.headR = null;
    }
  }

  /** Distribute impact damage to parts near the local impact point. */
  applyImpact(localPoint: THREE.Vector3, impulse: number): SlotId[] {
    const lost: SlotId[] = [];
    const dmg = clamp((impulse - 9000) / 60000, 0, 0.6);
    if (dmg <= 0) return lost;
    for (const s of ALL_SLOTS) {
      const p = this.parts[s];
      if (!p) continue;
      const d = SLOT_POS[s].distanceTo(localPoint);
      if (d > 1.3) continue;
      const k = dmg * (1 - d / 1.3) * (s === 'engine' ? 0.35 : s.startsWith('seat') ? 0.1 : 1);
      p.cond = Math.max(0, p.cond - k);
      if (p.kind === 'wheel' && k > 0.2 && Math.random() < 0.3) p.flat = true;
      if (p.cond <= 0.02 && ['bumper_f', 'bumper_r', 'hood', 'trunk', 'door_fl', 'door_fr', 'door_rl', 'door_rr', 'headlight_l', 'headlight_r'].includes(s) && impulse > 22000) lost.push(s);
    }
    return lost;
  }

  /** Local-space position of an interaction anchor. */
  anchor(name: string): THREE.Vector3 {
    switch (name) {
      case 'fuel': return this.visual.fuelCap.position.clone();
      case 'oil': return SLOT_POS.engine.clone().add(new THREE.Vector3(0.03, 0.41, 0.12));
      case 'radiator': return SLOT_POS.radiator.clone().add(new THREE.Vector3(0.2, 0.26, 0));
      case 'driver': return new THREE.Vector3(0.36, 1.1, -0.38);
      case 'passenger': return new THREE.Vector3(-0.36, 1.1, -0.38);
      case 'exhaust': return new THREE.Vector3(-0.35, 0.24, -2.08);
      default: return new THREE.Vector3();
    }
  }
  localToWorld(p: THREE.Vector3, out = new THREE.Vector3()) {
    return out.copy(p).applyQuaternion(this.visual.root.quaternion).add(this.visual.root.position);
  }
  worldToLocal(p: THREE.Vector3, out = new THREE.Vector3()) {
    return out.copy(p).sub(this.visual.root.position).applyQuaternion(this.visual.root.quaternion.clone().invert());
  }

  dispose() {
    this.enableHeadlightLights(false);
    this.physics.removeBody(this.body);
    this.visual.root.parent?.remove(this.visual.root);
  }

  // ------------------------------------------------------------------ save/load
  serialize() {
    const t = this.body.translation(), r = this.body.rotation();
    return {
      look: this.look,
      parts: this.parts,
      fuel: this.fuel,
      odo: this.odometer,
      temp: this.temp,
      pos: [t.x + this.physics.originX, t.y, t.z + this.physics.originZ],
      rot: [r.x, r.y, r.z, r.w],
      lights: this.lights,
      radio: [this.radioOn, this.radioFreq],
      hinge: Object.fromEntries(Object.entries(this.hinge).map(([k, v]) => [k, v!.target])),
      dead: this.dead,
      auto: this.auto,
    };
  }
}

export type CarSave = ReturnType<Car['serialize']>;

export function defaultCarParts(cond = 0.8, rng = Math.random): Partial<Record<SlotId, PartState>> {
  const out: Partial<Record<SlotId, PartState>> = {};
  let id = 1000 + Math.floor(rng() * 1e6);
  for (const s of ALL_SLOTS) {
    const kind = SLOT_KIND[s];
    const c = clamp(cond + (rng() - 0.5) * 0.3, 0.05, 1);
    const p: PartState = { id: id++, kind, cond: c };
    if (kind === 'engine') p.oil = ENGINE_OIL_CAP * (0.5 + rng() * 0.45);
    if (kind === 'radiator') p.coolant = RADIATOR_CAP * (0.4 + rng() * 0.6);
    if (kind === 'battery') p.charge = 0.5 + rng() * 0.5;
    out[s] = p;
  }
  return out;
}
