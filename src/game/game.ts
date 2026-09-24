import * as THREE from 'three';
import { installShaderPatches } from '../gfx/fog';
import { generateTextures, TexSet } from '../gfx/textures';
import { Materials, WIND } from '../gfx/materials';
import { Sky } from '../gfx/sky';
import { Post } from '../gfx/post';
import { Environment, WeatherKind } from '../world/environment';
import { World } from '../world/world';
import { WORLD_UNIFORMS } from '../world/terrain';
import { Physics, initRapier } from '../physics/physics';
import { Player } from '../player/player';
import { Input } from '../core/input';
import { Car, CarControls, defaultCarParts } from '../vehicle/car';
import { randomLook } from '../vehicle/carModel';
import { PropColliders } from './propColliders';
import { ROAD_UNIFORMS } from '../world/road';
import { clamp, clamp01, damp, lerp, RNG } from '../core/math';

export interface GameOptions {
  seed: number;
  quality: number; // 0 low, 1 medium, 2 high, 3 ultra
  test?: Record<string, string>;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  tex!: TexSet;
  mats!: Materials;
  sky!: Sky;
  env!: Environment;
  world!: World;
  physics!: Physics;
  player!: Player;
  input: Input;
  post!: Post;
  cars: Car[] = [];
  playerCar: Car | null = null;
  props!: PropColliders;
  fixedDt = 1 / 60;
  private acc = 0;
  private last = 0;
  time = 0;
  frames = 0;
  paused = false;
  running = false;
  quality: number;
  seed: number;
  shadowRadius = 60;
  shadowSize = 2048;
  timeScale = 1;
  onFrame: ((dt: number) => void) | null = null;
  test: Record<string, string>;
  stats = { fps: 60, frameMs: 16, calls: 0, tris: 0 };
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(renderer: THREE.WebGLRenderer, public opts: GameOptions) {
    this.renderer = renderer;
    this.quality = opts.quality;
    this.seed = opts.seed;
    this.test = opts.test || {};
    this.input = new Input(renderer.domElement);
  }

  async init(progress: (p: number, label: string) => void) {
    installShaderPatches();
    progress(0.05, 'physics');
    await initRapier();
    progress(0.15, 'textures');
    await tick();
    this.tex = generateTextures(this.renderer, this.test.tq ? Number(this.test.tq) : this.quality >= 2 ? 2 : 1);
    this.mats = new Materials(this.tex);
    progress(0.35, 'sky');
    await tick();
    this.sky = new Sky(this.renderer);
    this.scene.add(this.sky.mesh);
    this.env = new Environment(this.scene, this.sky, this.seed);
    progress(0.45, 'world');
    await tick();
    this.world = new World(this.seed, this.mats, this.quality);
    this.scene.add(this.world.group);
    this.physics = new Physics(this.world.fn);
    this.props = new PropColliders(this.physics, this.world);
    const fn = this.world.fn;
    const z0 = this.test.z ? Number(this.test.z) : 30;
    const start = new THREE.Vector3(fn.roadX(z0) + 3.2, 0, z0);
    start.y = fn.height(start.x, start.z);
    this.player = new Player(this.physics, start);
    this.player.yaw = Math.PI;
    this.post = new Post(this.renderer, this.scene, this.player.camera, innerWidth, innerHeight, this.quality >= 1 ? 4 : 0);
    this.applyQuality();
    progress(0.6, 'car');
    await tick();
    const rng = new RNG(this.seed * 7 + 3);
    const cz = z0 + 6;
    const cx = fn.roadX(cz) + 1.9;
    const look = randomLook(this.seed);
    const car = new Car(this.physics, this.mats, fn, look, defaultCarParts(0.85, () => rng.next()), new THREE.Vector3(cx, fn.roadY(cz) + 0.35, cz), fn.roadHeading(cz));
    car.isPlayerCar = true;
    car.enableHeadlightLights(true);
    car.visual.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.scene.add(car.visual.root);
    this.cars.push(car);
    this.playerCar = car;
    progress(0.7, 'terrain');
    await tick();
    this.env.time = this.test.t ? Number(this.test.t) : 9.5;
    if (this.test.w) this.env.setWeather(this.test.w as WeatherKind, 0.01);
    this.env.update(0, 0);
    this.streamWorld(true);
    progress(0.95, 'env');
    this.env.maybeUpdateEnv(0, true);
    this.renderer.info.autoReset = false;
    progress(1, 'done');
  }

  applyQuality() {
    const q = this.quality;
    this.shadowSize = q >= 3 ? 4096 : q >= 1 ? 2048 : 1024;
    this.shadowRadius = q >= 2 ? 70 : 50;
    this.renderer.shadowMap.enabled = true;
    this.post.setAO(q >= 3);
    this.post.bloom.enabled = q >= 1;
  }

  /** Player's focus in local coordinates (camera or car). */
  get focus(): THREE.Vector3 {
    return this.player.camera.position;
  }

  streamWorld(force = false) {
    const c = this.player.car ? this.player.car.position : this.player.feet;
    const wx = c.x + this.physics.originX, wz = c.z + this.physics.originZ;
    const cam = this.player.camera.position;
    this.world.update(cam.x + this.physics.originX, cam.y, cam.z + this.physics.originZ, force ? 1e9 : 5, force);
    const centers: { x: number; z: number; r: number }[] = [{ x: wx, z: wz, r: 90 }];
    for (const car of this.cars) {
      const d = Math.hypot(car.worldX - wx, car.worldZ - wz);
      car.enabled = d < 200;
      car.body.setEnabled(car.enabled && this.physics.hasTerrainAt(car.worldX, car.worldZ));
      if (car !== this.player.car && d < 200) centers.push({ x: car.worldX, z: car.worldZ, r: 40 });
    }
    this.physics.ensureTerrain(centers, force ? 100 : 2);
    this.props.update(force ? 1 : 0.016, centers, force);
  }

  private checkOrigin() {
    const c = this.player.car ? this.player.car.position : this.player.feet;
    if (Math.abs(c.x) < 1200 && Math.abs(c.z) < 1200) return;
    const dx = Math.round(c.x / 64) * 64, dz = Math.round(c.z / 64) * 64;
    this.physics.shiftOrigin(dx, dz);
    this.world.setOrigin(this.physics.originX, this.physics.originZ);
    this.player.shiftOrigin(dx, dz);
    for (const car of this.cars) car.shiftOrigin(dx, dz);
    this.player.camera.position.x -= dx;
    this.player.camera.position.z -= dz;
  }

  controls(): CarControls {
    const i = this.input;
    return {
      throttle: i.down('forward') ? 1 : 0,
      brake: i.down('back') ? 1 : 0,
      steer: (i.down('left') ? 1 : 0) - (i.down('right') ? 1 : 0),
      handbrake: i.down('handbrake'),
    };
  }

  private fixedStep(dt: number) {
    this.player.fixedUpdate(dt, this.input, false);
    const ctl = this.controls();
    for (const car of this.cars) {
      car.driverSeated = this.player.car === car && this.player.seat === 'driver';
      car.fixedUpdate(dt, car.driverSeated ? ctl : { throttle: 0, brake: 0, steer: 0, handbrake: car.handbrake }, this.env.temperature);
    }
    this.physics.step(dt);
    for (const car of this.cars) car.postStep();
  }

  update(dt: number) {
    const inp = this.input;
    this.player.look(inp, dt);
    // temporary car enter/exit
    const car = this.playerCar;
    if (car && inp.pressedA('interact')) {
      if (this.player.car) {
        const out = car.localToWorld(new THREE.Vector3(1.4, 0.2, -0.1));
        this.player.exitCar(out, this.player.yaw);
        car.driverSeated = false;
      } else if (car.position.distanceTo(this.player.feet) < 3.5) {
        this.player.enterCar(car, 'driver');
      }
    }
    if (this.player.car) {
      const c = this.player.car;
      if (inp.pressedA('ignition')) c.setCrank(true);
      if (inp.releasedA('ignition')) c.setCrank(false);
      if (inp.pressedA('headlights')) c.lights = (c.lights + 1) % 3;
      if (inp.pressedA('camera')) this.player.thirdPerson = !this.player.thirdPerson;
      if (!c.auto) {
        if (inp.pressedA('shiftUp')) c.shift(1);
        if (inp.pressedA('shiftDown')) c.shift(-1);
      }
    }
    this.acc += dt;
    let steps = 0;
    while (this.acc >= this.fixedDt && steps < 6) {
      this.fixedStep(this.fixedDt);
      this.acc -= this.fixedDt;
      steps++;
    }
    if (steps >= 6) this.acc = 0;
    const alpha = this.acc / this.fixedDt;
    for (const c of this.cars) c.render(dt, alpha, this.env.night);
    this.player.updateCamera(alpha, dt);
    this.streamWorld();
    this.env.update(dt * this.timeScale, dt);
    WORLD_UNIFORMS.uTime.value += dt;
    WIND.uWind.value.copy(this.env.wind);
    ROAD_UNIFORMS.uSandCover.value = damp(ROAD_UNIFORMS.uSandCover.value, this.env.cur.sand, 0.02, dt);
    ROAD_UNIFORMS.uWet.value = damp(ROAD_UNIFORMS.uWet.value, this.env.cur.rain, 0.05, dt);
    this.checkOrigin();
  }

  render(dt: number) {
    const cam = this.player.camera;
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
    this.env.updateShadow(this.player.car ? this.player.car.visual.root.position : cam.position, this.shadowRadius, this.shadowSize);
    this.env.maybeUpdateEnv(dt);
    this.sky.follow(cam);
    this.renderer.info.reset();
    this.post.render(dt);
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.tris = this.renderer.info.render.triangles;
  }

  frame = (now: number) => {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.time += dt;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc > 0.5) {
      this.stats.fps = this.fpsFrames / this.fpsAcc;
      this.stats.frameMs = (this.fpsAcc / this.fpsFrames) * 1000;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    if (!this.paused) this.update(dt);
    this.onFrame?.(dt);
    this.render(dt);
    this.input.endFrame();
    this.frames++;
  };

  /** Headless physics run for tests: advance `seconds` of simulation without rendering. */
  simulate(seconds: number, ctl: Partial<CarControls>, sampleEvery = 1) {
    const out: any[] = [];
    const base = { throttle: 0, brake: 0, steer: 0, handbrake: false, ...ctl };
    const n = Math.round(seconds / this.fixedDt);
    let tAcc = 0;
    for (let i = 0; i < n; i++) {
      this.player.fixedUpdate(this.fixedDt, this.input, false);
      for (const car of this.cars) {
        car.driverSeated = this.player.car === car;
        car.fixedUpdate(this.fixedDt, car.driverSeated ? base : { throttle: 0, brake: 0, steer: 0, handbrake: true }, this.env.temperature);
      }
      this.physics.step(this.fixedDt);
      for (const car of this.cars) car.postStep();
      tAcc += this.fixedDt;
      if (i % 30 === 0) { this.streamWorld(); this.checkOrigin(); }
      if (tAcc >= sampleEvery - 1e-6) {
        tAcc = 0;
        const c = this.player.car || this.playerCar!;
        out.push({ kmh: +(c.speed * 3.6).toFixed(1), rpm: Math.round(c.rpm), gear: c.gear, run: c.running, fuel: +c.fuelTotal.toFixed(2), temp: +c.temp.toFixed(1), x: +c.worldX.toFixed(1), z: +c.worldZ.toFixed(1), y: +c.position.y.toFixed(2), sand: +c.onSand.toFixed(2), skid: +c.skid.toFixed(2) });
      }
    }
    return out;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.post.setSize(w * pr, h * pr);
  }
}

function tick() {
  return new Promise((r) => setTimeout(r, 0));
}
