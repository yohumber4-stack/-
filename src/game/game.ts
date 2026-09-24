import * as THREE from 'three';
import { installShaderPatches } from '../gfx/fog';
import { generateTextures, TexSet } from '../gfx/textures';
import { Materials, WIND } from '../gfx/materials';
import { Sky } from '../gfx/sky';
import { Post } from '../gfx/post';
import { Environment, WeatherKind } from '../world/environment';
import { World } from '../world/world';
import { WORLD_UNIFORMS } from '../world/terrain';
import { ROAD_UNIFORMS } from '../world/road';
import { WorldGen, PoiPlan } from '../world/worldgen';
import { Physics, initRapier, groups, G } from '../physics/physics';
import { Player, PlayerStats, Surface } from '../player/player';
import { Input, DEFAULT_BINDINGS } from '../core/input';
import { Car, CarControls, CarSave, defaultCarParts } from '../vehicle/car';
import { randomLook, SLOT_POS, SlotId, ALL_SLOTS } from '../vehicle/carModel';
import { FUEL_CAP, ENGINE_OIL_CAP, RADIATOR_CAP, SLOT_KIND, bumpPartId } from '../vehicle/parts';
import { PropColliders } from './propColliders';
import { ItemManager, ItemEntity } from './items';
import { Fx } from './fx';
import { Enemies } from './enemies';
import { Combat } from './combat';
import { Interaction } from './interaction';
import { Hints } from './hints';
import { IconRenderer } from './icons';
import { AudioSystem, EngineSound } from '../audio/audio';
import { UI, Settings, HudState, UiHooks } from '../ui/ui';
import { tr, setLang, partName } from '../ui/i18n';
import { clamp, clamp01, damp, lerp, RNG } from '../core/math';

export const GOAL_KM = 5000;
export const SAVE_KEY = 'tlr_save_v1';
export const BOOT_KEY = 'tlr_boot';
const MENU_Z = 2310;
const Y = new THREE.Vector3(0, 1, 0);

export interface GameOptions {
  seed: number;
  quality: number; // 0 low, 1 medium, 2 high, 3 ultra
  test?: Record<string, string>;
}

interface ItemSave {
  id: string;
  s: any;
}

export interface SaveData {
  v: 1;
  seed: number;
  difficulty: number;
  time: number;
  day: number;
  weather: WeatherKind;
  player: { p: [number, number, number]; yaw: number; pitch: number; stats: PlayerStats; seat: 'driver' | 'passenger' | null };
  inv: { hand: ItemSave | null; slots: (ItemSave | null)[] };
  car: CarSave | null;
  items: any[];
  collected: string[];
  wrecks: [string, any][];
  pumps: [string, number][];
  doors: [string, number][];
  mines: string[];
  stats: { kills: number; playTime: number; maxKm: number; won: boolean; homeZ: number };
  hints: string[];
  savedAt: number;
}

export type StartSpec = { kind: 'menu' } | { kind: 'new'; difficulty: number; auto: boolean } | { kind: 'load'; save: SaveData };

export interface BootInfo {
  mode: 'new' | 'load';
  seed?: number;
  difficulty?: number;
  auto?: boolean;
}

export function readSave(): SaveData | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    return s && s.v === 1 ? s : null;
  } catch {
    return null;
  }
}
export function takeBoot(): BootInfo | null {
  try {
    const b = JSON.parse(sessionStorage.getItem(BOOT_KEY) || 'null');
    sessionStorage.removeItem(BOOT_KEY);
    return b;
  } catch {
    return null;
  }
}
export function rebootInto(b: BootInfo | null) {
  try {
    if (b) sessionStorage.setItem(BOOT_KEY, JSON.stringify(b));
    else sessionStorage.removeItem(BOOT_KEY);
  } catch {}
  location.reload();
}

const WEATHER_NAME: Record<WeatherKind, [string, string]> = {
  clear: ['Ясно', 'Clear'],
  cloudy: ['Облачно', 'Cloudy'],
  overcast: ['Пасмурно', 'Overcast'],
  sandstorm: ['Песчаная буря', 'Sandstorm'],
  rain: ['Дождь', 'Rain'],
};

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
  ui: UI;
  audio: AudioSystem;
  items!: ItemManager;
  worldgen!: WorldGen;
  fx!: Fx;
  enemies!: Enemies;
  combat!: Combat;
  interaction!: Interaction;
  hints!: Hints;
  icons!: IconRenderer;
  cars: Car[] = [];
  playerCar: Car | null = null;
  props!: PropColliders;
  poiGroup = new THREE.Group();
  fixedDt = 1 / 60;
  private acc = 0;
  private last = 0;
  time = 0;
  frames = 0;
  quality: number;
  seed: number;
  mode: 'menu' | 'play' = 'menu';
  shadowRadius = 60;
  shadowSize = 2048;
  timeScale = 1;
  baseFov = 75;
  baseExposure = 1;
  difficulty = 1;
  onFrame: ((dt: number) => void) | null = null;
  test: Record<string, string>;
  stats = { fps: 60, frameMs: 16, calls: 0, tris: 0, kills: 0 };
  journey = { homeZ: 0, maxKm: 0, playTime: 0, won: false };
  hurt = 0;
  insideBuilding = false;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private engine: EngineSound | null = null;
  private deathT = -1;
  private deathCause = '';
  private sleepSeq: { t: number; hours: number; applied: boolean } | null = null;
  private menuT = 0;
  private menuCar: Car | null = null;
  private preVel = new Map<Car, THREE.Vector3>();
  private crashCool = 0;
  private heartT = 0;
  private tuneT = 0;
  private autosaveT = 300;
  private shelterT = 0;
  private lockLostT = 0;
  private disarmed = new Set<string>();
  private menuMusic = false;

  constructor(renderer: THREE.WebGLRenderer, ui: UI, public opts: GameOptions) {
    this.renderer = renderer;
    this.ui = ui;
    this.audio = new AudioSystem();
    this.quality = opts.quality;
    this.seed = opts.seed;
    this.test = opts.test || {};
    this.input = new Input(renderer.domElement);
  }

  // ================================================================== init
  async init(progress: (p: number, label: string) => void, start: StartSpec) {
    installShaderPatches();
    progress(0.04, 'physics');
    await initRapier();
    progress(0.1, 'textures');
    await tick();
    this.tex = generateTextures(this.renderer, this.test.tq ? Number(this.test.tq) : this.quality >= 2 ? 2 : 1);
    this.mats = new Materials(this.tex);
    progress(0.3, 'sky');
    await tick();
    this.sky = new Sky(this.renderer);
    this.scene.add(this.sky.mesh);
    this.env = new Environment(this.scene, this.sky, this.seed);
    progress(0.38, 'world');
    await tick();
    this.world = new World(this.seed, this.mats, this.quality);
    this.scene.add(this.world.group);
    this.physics = new Physics(this.world.fn);
    this.props = new PropColliders(this.physics, this.world);
    this.items = new ItemManager(this.physics, this.mats);
    this.scene.add(this.items.group, this.poiGroup);
    this.worldgen = new WorldGen({
      fn: this.world.fn, mats: this.mats, physics: this.physics, items: this.items, scene: this.poiGroup, cars: this.cars, seed: this.seed,
      addCar: (c) => this.addCar(c),
      removeCar: (c) => this.removeCar(c),
    });
    this.worldgen.initLightPool(this.scene, this.quality >= 2 ? 4 : 2);
    this.physics.onContact = (a, b, force) => {
      for (const o of [this.physics.ownerOf(a), this.physics.ownerOf(b)]) {
        if (o?.kind === 'item') this.items.impact(o.item, force / Math.max(1, o.item.mass * 9.81), this.time);
      }
    };
    this.items.onImpact = (e, f) => this.itemImpact(e, f);

    // --- where do we start (world coordinates)
    const fn = this.world.fn;
    const home = this.worldgen.homestead();
    this.journey.homeZ = home.z;
    let spawn: THREE.Vector3;
    let yaw = 0;
    if (start.kind === 'load') {
      const s = start.save.player.p;
      spawn = new THREE.Vector3(s[0], s[1], s[2]);
      yaw = start.save.player.yaw;
    } else if (start.kind === 'new') {
      const sp = this.homeSpawn(home);
      spawn = sp.pos;
      yaw = sp.yaw;
    } else {
      spawn = new THREE.Vector3(fn.roadX(MENU_Z) + 6, 0, MENU_Z);
      spawn.y = fn.height(spawn.x, spawn.z);
    }
    if (this.test.z) {
      const z = Number(this.test.z);
      spawn.set(fn.roadX(z) + 3.2, 0, z);
      spawn.y = fn.height(spawn.x, spawn.z);
    }
    const ox = Math.round(spawn.x / 64) * 64, oz = Math.round(spawn.z / 64) * 64;
    if (ox || oz) {
      this.physics.shiftOrigin(ox, oz);
      this.world.setOrigin(ox, oz);
      this.worldgen.setOrigin(ox, oz);
      this.items.setOrigin(ox, oz);
    }
    this.player = new Player(this.physics, new THREE.Vector3(spawn.x - ox, spawn.y, spawn.z - oz), this.baseFov);
    this.player.yaw = yaw;
    this.scene.add(this.player.camera);
    this.post = new Post(this.renderer, this.scene, this.player.camera, innerWidth, innerHeight, this.quality >= 1 ? 4 : 0);
    this.fx = new Fx(this);
    this.scene.add(this.fx.group);
    this.enemies = new Enemies(this);
    this.scene.add(this.enemies.group);
    this.combat = new Combat(this);
    this.interaction = new Interaction(this);
    this.hints = new Hints(this);
    this.icons = new IconRenderer(this.renderer);
    this.player.onStep = () => this.footstep();
    this.player.onLand = (v) => this.audio.play('land', { volume: clamp(v / 9, 0.2, 1) });
    this.player.onDamage = (a, c) => this.damagePlayer(a, c === 'fall' ? tr('Разбился, упав с высоты', 'Fell to death') : c);
    this.env.onThunder = (delay, strength) => this.audio.play('thunder', { delay, volume: strength });

    progress(0.6, 'car');
    await tick();
    this.mode = start.kind === 'menu' ? 'menu' : 'play';
    if (start.kind === 'new') this.setupNew(home, start.difficulty, start.auto);
    else if (start.kind === 'load') this.applySave(start.save);
    else this.setupMenu();
    if (this.test.t) this.env.time = Number(this.test.t);
    if (this.test.w) this.env.setWeather(this.test.w as WeatherKind, 0.01);

    progress(0.7, 'terrain');
    await tick();
    this.env.update(0, 0);
    this.streamWorld(true);
    // build the start area completely before the first frame
    const pw = this.playerWorld();
    for (let i = 0; i < 40; i++) this.worldgen.update(0, pw.x, pw.z);
    this.items.update(pw.x, pw.z, (x, z) => this.physics.hasTerrainAt(x, z));
    progress(0.95, 'env');
    this.env.maybeUpdateEnv(0, true);
    this.renderer.info.autoReset = false;
    this.applyQuality();
    this.applySettings(this.ui.settings);
    // warm up shaders so the first real frame does not hitch
    this.renderer.compile(this.scene, this.player.camera);
    progress(1, 'done');
  }

  private homeSpawn(home: PoiPlan) {
    const P = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyAxisAngle(Y, home.ry).add(new THREE.Vector3(home.x, 0, home.z));
    // on the porch, looking out over the yard towards the garage and the highway
    const pos = P(7.6, 2.7);
    pos.y = home.y + 0.42;
    const look = P(1.5, 12).sub(pos);
    return { pos, yaw: Math.atan2(-look.x, -look.z) };
  }

  private setupNew(home: PoiPlan, difficulty: number, auto: boolean) {
    this.difficulty = difficulty;
    this.env.time = 7.4;
    this.env.day = 1;
    this.env.setWeather('clear', 0.01);
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(Y, home.ry).add(new THREE.Vector3(home.x - this.physics.originX, home.y, home.z - this.physics.originZ));
    const rng = new RNG(this.seed * 7 + 3);
    const parts = defaultCarParts(0.8, () => rng.next());
    delete parts.battery;
    parts.engine!.oil = ENGINE_OIL_CAP * 0.8;
    parts.radiator!.coolant = RADIATOR_CAP * 0.7;
    if (this.test.z) {
      // test start: a ready-to-drive car on the road next to the player
      const fn = this.world.fn;
      const z = Number(this.test.z) + 6;
      const car = this.makePlayerCar(randomLook(this.seed), defaultCarParts(0.85, () => rng.next()), new THREE.Vector3(fn.roadX(z) - 1.9 - this.physics.originX, fn.roadY(z) + 0.35, z - this.physics.originZ), fn.roadHeading(z));
      car.fuel = { petrol: 30, diesel: 0, water: 0 };
      car.auto = auto;
      return;
    }
    const car = this.makePlayerCar(randomLook(this.seed), parts, P(-8, 0.55, 1.4), home.ry);
    car.fuel = { petrol: 1.2, diesel: 0, water: 0 };
    car.auto = auto;
    this.hints.trigger('intro');
  }

  private setupMenu() {
    const fn = this.world.fn;
    const z = MENU_Z;
    const pos = new THREE.Vector3(fn.roadX(z) - 2.1 - this.physics.originX, fn.roadY(z) + 0.45, z - this.physics.originZ);
    const car = this.makePlayerCar(randomLook(this.seed + 11), defaultCarParts(0.75, Math.random), pos, fn.roadHeading(z));
    car.lights = 1;
    this.menuCar = car;
    this.env.time = 18.25;
    this.env.setWeather('clear', 0.01);
    this.env.frozenWeather = true;
    this.timeScale = 0;
    this.enemies.enabled = false;
  }

  private makePlayerCar(look: any, parts: any, localPos: THREE.Vector3, heading: number) {
    const car = new Car(this.physics, this.mats, this.world.fn, look, parts, localPos, heading);
    car.isPlayerCar = true;
    car.enableHeadlightLights(true);
    this.addCar(car);
    this.playerCar = car;
    return car;
  }

  addCar(c: Car) {
    c.visual.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.scene.add(c.visual.root);
    if (!this.cars.includes(c)) this.cars.push(c);
  }
  removeCar(c: Car) {
    if (c === this.playerCar) return;
    if (this.player?.car === c) this.exitCar();
    c.dispose();
    const i = this.cars.indexOf(c);
    if (i >= 0) this.cars.splice(i, 1);
    this.preVel.delete(c);
  }

  // ================================================================== settings / quality
  applyQuality() {
    const q = this.quality;
    this.shadowSize = q >= 3 ? 4096 : q >= 1 ? 2048 : 1024;
    this.shadowRadius = q >= 2 ? 70 : 50;
    this.renderer.shadowMap.enabled = true;
    this.post.setAO(q >= 3);
    this.post.bloom.enabled = q >= 1;
  }

  applySettings(s: Settings) {
    setLang(s.lang);
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    const b: any = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    for (const [k, v] of Object.entries(s.bindings || {})) if (Array.isArray(v) && v.length) b[k] = v;
    this.input.bindings = b;
    this.baseFov = s.fov;
    this.baseExposure = (this.test.exp ? Number(this.test.exp) : 1) * (s.brightness ?? 1);
    this.audio.setVolumes({ master: s.master, sfx: s.sfx, ambient: s.ambient, radio: s.radio, music: s.music, engine: s.engine });
    if (!this.env) return;
    this.env.secondsPerHour = (s.dayLength * 60) / 24;
    if (this.player) {
      this.player.camera.fov = s.fov;
      this.player.headBob = s.headBob;
    }
    if (this.playerCar && this.mode === 'play') this.playerCar.auto = s.auto;
    this.difficulty = s.difficulty;
    if (this.enemies) this.enemies.difficulty = s.difficulty;
    if (s.quality !== this.quality) {
      this.quality = s.quality;
      this.applyQuality();
    }
    const pr = Math.min(devicePixelRatio, 1.5) * s.renderScale;
    if (Math.abs(pr - this.renderer.getPixelRatio()) > 1e-3 && !this.test.pr) {
      this.renderer.setPixelRatio(pr);
      this.resize(innerWidth, innerHeight);
    }
  }

  // ================================================================== UI hooks
  uiHooks(): UiHooks {
    return {
      newGame: (seed) => rebootInto({ mode: 'new', seed, difficulty: this.ui.settings.difficulty, auto: this.ui.settings.auto }),
      continueGame: () => rebootInto({ mode: 'load' }),
      resume: () => this.resume(),
      save: () => this.save(),
      load: () => rebootInto({ mode: 'load' }),
      quitToMenu: () => {
        if (this.mode === 'play' && !this.player.dead && !this.journey.won) this.save();
        rebootInto(null);
      },
      applySettings: (s) => this.applySettings(s),
      hasSave: () => !!readSave(),
      journal: () => this.journal(),
      click: () => this.audio.play('ui_click', { volume: 0.7 }),
      hover: () => this.audio.play('ui_hover', { volume: 0.4 }),
      captureKey: (cb) => { this.input.onKeyCapture = cb; },
    };
  }

  /** Called on the first user gesture: audio can start, the game can take the mouse. */
  start() {
    // everything that needs the user gesture happens synchronously here
    if (this.mode === 'menu') this.ui.showMenu();
    else {
      this.ui.showHud(true);
      this.input.requestLock();
    }
    this.audio.init().then(() => {
      this.applySettings(this.ui.settings);
      if (this.mode === 'menu') {
        this.audio.playMenuMusic();
        this.menuMusic = true;
      } else this.audio.play('ui_open', { volume: 0.5 });
    });
  }

  resume() {
    this.ui.hideOverlays();
    this.ui.hideDeath();
    this.ui.showHud(true);
    this.audio.setPaused(false);
    this.input.requestLock();
    this.lockLostT = 0;
  }

  openPause() {
    if (this.mode !== 'play' || this.ui.state !== 'game') return;
    this.ui.showPause();
    this.input.exitLock();
    this.audio.setPaused(true);
    this.audio.play('ui_open', { volume: 0.5 });
  }

  private uiKeys(dt: number) {
    if (this.mode !== 'play') return;
    const i = this.input;
    const st = this.ui.state;
    if (i.onKeyCapture) return;
    if (i.rawPressed('Escape')) {
      if (st === 'game') this.openPause();
      else if (st === 'pause' || st === 'journal' || st === 'note') this.resume();
      else if (st === 'settings') this.ui.showPause();
      return;
    }
    if (st === 'game' && !this.player.dead && i.pressedA('journal')) {
      this.ui.showJournal(false);
      this.input.exitLock();
      this.audio.play('paper', { volume: 0.6 });
    } else if (st === 'journal' && (i.rawPressed('Tab') || i.rawPressed('KeyJ'))) this.resume();
    else if (st === 'note' && (i.rawPressed('KeyE') || i.rawPressed('Space'))) this.resume();
    // the mouse got released (alt-tab, Esc consumed by the browser): pause instead of a dead screen
    if (st === 'game' && !i.locked && !i.noLock && !this.player.dead) {
      this.lockLostT += dt;
      if (this.lockLostT > 0.4) this.openPause();
    } else this.lockLostT = 0;
  }

  // ================================================================== player / car actions
  enterCar(car: Car, seat: 'driver' | 'passenger', silent = false) {
    const p = this.player;
    if (p.car || p.dead) return;
    const hand = this.interaction.hand;
    if (hand && !hand.def.storable) this.interaction.drop(false);
    p.enterCar(car, seat);
    p.thirdPerson = false;
    car.driverSeated = seat === 'driver';
    if (!silent) {
      this.audio.play('impact_soft', { volume: 0.35 });
      this.hints.trigger('firstCar');
    }
  }

  exitCar() {
    const p = this.player;
    const c = p.car;
    if (!c) return;
    const side = p.seat === 'driver' ? 1 : -1;
    const root = c.visual.root;
    root.updateMatrixWorld();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
    const yaw = Math.atan2(-fwd.x, -fwd.z) + Math.PI;
    const seatW = c.localToWorld(c.anchor(p.seat));
    const cands = [new THREE.Vector3(1.55 * side, 0.6, -0.2), new THREE.Vector3(-1.55 * side, 0.6, -0.2), new THREE.Vector3(0.4 * side, 0.6, -3.1), new THREE.Vector3(0.4 * side, 0.6, 3.1)];
    const mask = groups(0xffff, G.STATIC | G.HEAVY | G.CAR);
    let out: THREE.Vector3 | null = null;
    for (const lp of cands) {
      const wp = c.localToWorld(lp);
      const dir = wp.clone().sub(seatW);
      const len = dir.length();
      dir.normalize();
      const hit = this.physics.castRay(seatW, dir, len + 0.35, mask, c.body);
      if (hit) continue;
      const gy = this.physics.groundY(wp.x, wp.z, wp.y + 1.2);
      if (gy < wp.y - 3) continue;
      out = new THREE.Vector3(wp.x, gy + 0.03, wp.z);
      break;
    }
    if (!out) {
      const top = c.localToWorld(new THREE.Vector3(0, 1.75, -0.3));
      out = top;
    }
    p.exitCar(out, yaw);
    c.driverSeated = false;
    c.horn = false;
    c.setCrank(false);
    c.handbrake = true;
    p.leaning = 0;
    this.audio.play('impact_soft', { volume: 0.3 });
  }

  detachAndThrow(car: Car, slot: SlotId) {
    const r = car.detach(slot);
    if (!r) return;
    const wp = car.localToWorld(SLOT_POS[slot]);
    const outDir = wp.clone().sub(car.visual.root.position).setY(0);
    if (outDir.lengthSq() > 1e-4) outDir.normalize();
    wp.addScaledVector(outDir, 0.45);
    const q = car.visual.root.quaternion.clone();
    const e = this.items.spawn('part', wp.x + this.physics.originX, wp.y + 0.1, wp.z + this.physics.originZ, q, { part: r.state }, { partVisual: r.visual });
    e.touched = true;
    if (e.body) {
      const lv = car.body.linvel();
      e.body.setLinvel({ x: lv.x * 0.7 + outDir.x * 3.5, y: 2.5 + Math.random() * 2, z: lv.z * 0.7 + outDir.z * 3.5 }, true);
      e.body.setAngvel({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 }, true);
    }
    this.audio.play('impact_metal', { pos: wp, volume: 0.9 });
  }

  damagePlayer(amount: number, cause: string) {
    const p = this.player;
    if (p.dead || this.mode !== 'play' || amount <= 0) return;
    p.stats.health -= amount;
    this.hurt = Math.min(1.2, this.hurt + amount / 30);
    p.shake = Math.max(p.shake, Math.min(1.6, amount / 22));
    this.audio.play('hurt', { volume: clamp(amount / 25, 0.35, 1) });
    if (p.stats.health <= 0) this.die(cause);
  }

  private die(cause: string) {
    const p = this.player;
    if (p.dead) return;
    p.stats.health = 0;
    p.dead = true;
    this.deathT = 0;
    this.deathCause = cause;
    this.audio.play('death');
    this.audio.duck(0.5, 3);
    if (p.car) {
      p.car.setCrank(false);
      p.car.horn = false;
    }
  }

  private deathCamera(dt: number) {
    if (this.deathT < 0) return;
    this.deathT += dt;
    const t = this.deathT;
    const cam = this.player.camera;
    if (!this.player.car) {
      const k = 1 - Math.pow(1 - clamp01(t / 1.1), 3);
      cam.position.y -= 1.35 * k;
      cam.rotation.z = 1.25 * k;
      cam.rotation.x += 0.3 * k;
    }
    this.ui.setBlackout(clamp01((t - 0.8) / 2.2) * 0.8);
    if (t > 3.2 && this.ui.state === 'game') {
      this.input.exitLock();
      this.ui.showDeath(this.deathCause, this.summary());
    }
  }

  sleep() {
    const p = this.player;
    if (this.sleepSeq || p.dead) return;
    const cam = p.camera.position;
    if (this.enemies.list.some((e) => e.alive && e.obj.position.distanceTo(cam) < 30)) {
      this.ui.toast(tr('Нельзя спать — рядом враги', 'You cannot sleep with enemies nearby'), true);
      return;
    }
    if (p.stats.energy > 80) {
      this.ui.toast(tr('Вы не хотите спать', 'You are not tired'));
      return;
    }
    const hours = clamp(Math.round((100 - p.stats.energy) / 12.5), 1, 9);
    this.sleepSeq = { t: 0, hours, applied: false };
    if (p.car) p.car.setIgnition(false);
    this.audio.play('sleep');
  }

  private updateSleep(dt: number) {
    const s = this.sleepSeq;
    if (!s) return;
    s.t += dt;
    if (s.t < 1.4) this.ui.setBlackout(s.t / 1.4);
    else if (!s.applied) {
      s.applied = true;
      this.advanceHours(s.hours);
      this.ui.setBlackout(1);
      this.ui.toast(tr(`Вы проспали ${s.hours} ч. День ${this.env.day}, ${this.env.timeString()}`, `You slept ${s.hours} h. Day ${this.env.day}, ${this.env.timeString()}`));
    } else if (s.t > 2.4 && s.t < 4) this.ui.setBlackout(1 - (s.t - 2.4) / 1.6);
    else if (s.t >= 4) {
      this.ui.setBlackout(0);
      this.sleepSeq = null;
      this.save();
    }
  }

  private advanceHours(h: number) {
    const env = this.env;
    env.time += h;
    while (env.time >= 24) {
      env.time -= 24;
      env.day++;
    }
    const st = this.player.stats;
    st.energy = Math.min(100, st.energy + h * 12.5);
    st.hunger = Math.max(3, st.hunger - h * 1.3);
    st.thirst = Math.max(3, st.thirst - h * 2.0);
    st.health = Math.min(100, st.health + h * 3);
    st.stamina = 100;
    for (const c of this.cars) c.temp = Math.min(c.temp, env.temperature + 5);
    env.update(0.01, 0.01);
    env.maybeUpdateEnv(0, true);
  }

  // ================================================================== survival / journey
  private survival(dt: number) {
    const p = this.player;
    const st = p.stats;
    if (p.dead || this.sleepSeq) return;
    const hours = dt / this.env.secondsPerHour;
    const heat = clamp01((this.env.temperature - 24) / 16);
    const k = lerp(0.75, 1.35, clamp01((this.difficulty - 0.6) / 0.9));
    const run = p.sprinting ? 1.6 : 1;
    st.hunger = Math.max(0, st.hunger - hours * 2.1 * k * (p.sprinting ? 1.25 : 1));
    st.thirst = Math.max(0, st.thirst - hours * 3.4 * k * (1 + heat * 0.8) * run);
    st.energy = Math.max(0, st.energy - hours * 3.1 * k * (p.sprinting ? 1.3 : 1));
    if (st.hunger <= 0 || st.thirst <= 0) {
      st.health -= dt * 0.28;
      if (st.health <= 0) this.die(st.thirst <= 0 ? tr('Умер от жажды', 'Died of thirst') : tr('Умер от голода', 'Starved to death'));
    } else if (st.hunger > 35 && st.thirst > 35 && st.health < 100) st.health = Math.min(100, st.health + dt * 0.05);
    if (st.energy <= 0) st.stamina = Math.min(st.stamina, 30);
    if (st.health < 25 && !p.dead) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = lerp(0.6, 1.1, st.health / 25);
        this.audio.play('heartbeat', { volume: 0.55 });
      }
    }
    this.hurt = Math.max(st.health < 25 ? 0.25 + Math.sin(this.time * 6) * 0.05 : 0, this.hurt - dt * 0.7);
  }

  playerWorld() {
    const p = this.player;
    const c = p.car ? p.car.position : p.feet;
    return { x: c.x + this.physics.originX, y: c.y, z: c.z + this.physics.originZ };
  }
  currentKm() {
    return Math.max(0, (this.playerWorld().z - this.journey.homeZ) / 1000);
  }
  private summary() {
    const t = this.journey.playTime;
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
    return { km: Math.max(this.journey.maxKm, this.currentKm()), days: this.env.day, kills: this.stats.kills, time: h ? `${h} ${tr('ч', 'h')} ${m} ${tr('мин', 'min')}` : `${m} ${tr('мин', 'min')}` };
  }
  private checkJourney() {
    const km = this.currentKm();
    this.journey.maxKm = Math.max(this.journey.maxKm, km);
    if (!this.journey.won && km >= GOAL_KM) {
      this.journey.won = true;
      this.input.exitLock();
      this.save();
      this.ui.showWin(this.summary());
      this.audio.play('bell');
    }
  }

  journal() {
    const car = this.playerCar;
    const missing = car ? [...new Set(ALL_SLOTS.filter((s) => !car.parts[s]).map((s) => partName(SLOT_KIND[s], s)))].join(', ') : '';
    return {
      km: this.currentKm(),
      goal: GOAL_KM,
      day: this.env.day,
      time: this.env.timeString(),
      weather: tr(...WEATHER_NAME[this.env.weather]),
      temp: this.env.temperature,
      money: this.interaction.totalMoney(),
      kills: this.stats.kills,
      car: car
        ? { fuel: car.fuelTotal, oil: car.parts.engine?.oil ?? 0, hasEngine: !!car.parts.engine, coolant: car.parts.radiator?.coolant ?? 0, hasRad: !!car.parts.radiator, batt: car.charge, hasBatt: !!car.parts.battery, engine: car.parts.engine?.cond ?? 0, odo: car.odometer, missing }
        : null,
    };
  }

  // ================================================================== save / load
  save(): boolean {
    if (this.mode !== 'play' || this.player.dead) return false;
    const wg = this.worldgen;
    for (const bp of wg.built.values()) for (const w of bp.wrecks) if (w.modified && w.spawnKey) wg.wreckState.set(w.spawnKey, w.serialize());
    const p = this.player;
    const pw = p.car ? p.car.localToWorld(new THREE.Vector3(1.6, 0.3, -0.2)) : p.feet.clone();
    const ia = this.interaction;
    const isave = (e: ItemEntity | null): ItemSave | null => (e ? { id: e.def.id, s: JSON.parse(JSON.stringify(e.state)) } : null);
    const data: SaveData = {
      v: 1,
      seed: this.seed,
      difficulty: this.difficulty,
      time: this.env.time,
      day: this.env.day,
      weather: this.env.weather,
      player: { p: [pw.x + this.physics.originX, pw.y, pw.z + this.physics.originZ], yaw: p.car ? p.yaw : p.yaw, pitch: p.pitch, stats: { ...p.stats }, seat: p.car === this.playerCar && p.car ? p.seat : null },
      inv: { hand: isave(ia.hand), slots: ia.slots.map(isave) },
      car: this.playerCar ? this.playerCar.serialize() : null,
      items: this.items.serialize(),
      collected: [...wg.collected],
      wrecks: [...wg.wreckState],
      pumps: [...wg.pumpFuel],
      doors: [...wg.doorState],
      mines: [...this.disarmed],
      stats: { kills: this.stats.kills, playTime: this.journey.playTime, maxKm: this.journey.maxKm, won: this.journey.won, homeZ: this.journey.homeZ },
      hints: [...this.hints.shown],
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('save failed', e);
      this.ui.toast(tr('Не удалось сохранить игру', 'Could not save the game'), true);
      return false;
    }
  }

  private applySave(s: SaveData) {
    this.difficulty = s.difficulty;
    this.env.time = s.time;
    this.env.day = s.day;
    this.env.setWeather(s.weather, 0.01);
    Object.assign(this.player.stats, s.player.stats);
    this.player.pitch = s.player.pitch;
    this.journey = { ...this.journey, ...s.stats };
    this.stats.kills = s.stats.kills;
    const wg = this.worldgen;
    for (const k of s.collected) wg.collected.add(k);
    for (const [k, v] of s.wrecks) wg.wreckState.set(k, v);
    for (const [k, v] of s.pumps) wg.pumpFuel.set(k, v);
    for (const [k, v] of s.doors) wg.doorState.set(k, v);
    for (const k of s.hints) this.hints.shown.add(k);
    this.disarmed = new Set(s.mines);
    let maxId = 0;
    const noteIds = (parts: any) => { for (const v of Object.values(parts || {})) maxId = Math.max(maxId, (v as any)?.id ?? 0); };
    if (s.car) {
      const car = this.restoreCar(s.car);
      noteIds(car.parts);
      if (s.player.seat) this.enterCar(car, s.player.seat, true);
    }
    const ox = this.physics.originX, oz = this.physics.originZ;
    for (const it of s.items) {
      const e = this.items.spawn(it.id, it.p[0], it.p[1] + 0.02, it.p[2], new THREE.Quaternion(it.q[0], it.q[1], it.q[2], it.q[3]), it.s, { frozen: true });
      e.touched = true;
      if (it.s?.part) maxId = Math.max(maxId, it.s.part.id ?? 0);
    }
    const feet = this.player.feet;
    const spawnInv = (is: ItemSave | null) => {
      if (!is) return null;
      if (is.s?.part) maxId = Math.max(maxId, is.s.part.id ?? 0);
      const e = this.items.spawn(is.id, feet.x + ox, feet.y + 1, feet.z + oz, undefined, is.s, { frozen: true });
      e.touched = true;
      return e;
    };
    s.inv.slots.forEach((is) => { const e = spawnInv(is); if (e) this.interaction.storeToSlot(e); });
    const h = spawnInv(s.inv.hand);
    if (h) {
      if (h.def.storable && !this.player.car) this.interaction.take(h);
      else if (!this.interaction.storeToSlot(h)) h.obj.position.y = feet.y + 0.3;
    }
    bumpPartId(maxId + 1);
  }

  private restoreCar(s: CarSave): Car {
    const pos = new THREE.Vector3(s.pos[0] - this.physics.originX, s.pos[1] + 0.08, s.pos[2] - this.physics.originZ);
    const car = this.makePlayerCar(s.look, s.parts, pos, 0);
    car.body.setRotation({ x: s.rot[0], y: s.rot[1], z: s.rot[2], w: s.rot[3] }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.fuel = { ...s.fuel };
    car.odometer = s.odo;
    car.temp = s.temp;
    car.lights = s.lights;
    car.radioOn = !!s.radio[0];
    car.radioFreq = Number(s.radio[1]) || 94.2;
    car.dead = s.dead;
    car.auto = s.auto;
    for (const [k, v] of Object.entries(s.hinge || {})) {
      if (car.hinge[k as SlotId]) car.hinge[k as SlotId] = { t: v as number, target: v as number };
    }
    car.postStep();
    return car;
  }

  // ================================================================== streaming / origin
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
    this.worldgen.setOrigin(this.physics.originX, this.physics.originZ);
    this.items.setOrigin(this.physics.originX, this.physics.originZ);
    this.player.shiftOrigin(dx, dz);
    for (const car of this.cars) car.shiftOrigin(dx, dz);
    this.enemies.shiftOrigin(dx, dz);
    this.fx.shift(dx, dz);
    this.player.camera.position.x -= dx;
    this.player.camera.position.z -= dz;
  }

  // ================================================================== per-frame
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
    const play = this.mode === 'play';
    this.player.fixedUpdate(dt, this.input, !play || this.player.dead || !!this.sleepSeq);
    const ctl = this.controls();
    const idle: CarControls = { throttle: 0, brake: 0, steer: 0, handbrake: true };
    for (const car of this.cars) {
      car.driverSeated = this.player.car === car && this.player.seat === 'driver' && !this.player.dead;
      car.fixedUpdate(dt, car.driverSeated ? ctl : { ...idle, handbrake: car.handbrake }, this.env.temperature);
      if (car.enabled && (car.driverSeated || Math.abs(car.speed) > 2.5)) {
        const v = car.body.linvel();
        let pv = this.preVel.get(car);
        if (!pv) this.preVel.set(car, (pv = new THREE.Vector3()));
        pv.set(v.x, v.y, v.z);
      } else this.preVel.delete(car);
    }
    this.physics.step(dt);
    this.crashCool -= dt;
    for (const car of this.cars) {
      car.postStep();
      const before = this.preVel.get(car);
      if (before && play) this.crashCheck(car, before, dt);
    }
  }

  private crashCheck(car: Car, before: THREE.Vector3, dt: number) {
    const v = car.body.linvel();
    const dvx = v.x - before.x, dvy = v.y - before.y + 9.81 * dt, dvz = v.z - before.z;
    const dv = Math.sqrt(dvx * dvx + dvz * dvz + 0.3 * dvy * dvy);
    if (dv < 3.4 || this.crashCool > 0) return;
    this.crashCool = 0.3;
    const pos = car.position.clone();
    const hitDir = new THREE.Vector3(-dvx, 0, -dvz);
    if (hitDir.lengthSq() < 1e-6) hitDir.set(0, -1, 0);
    hitDir.normalize();
    const point = pos.clone().addScaledVector(hitDir, 2.0).add(new THREE.Vector3(0, 0.55, 0));
    const lost = car.applyImpact(car.worldToLocal(point.clone()), dv * 1500);
    for (const s of lost) this.detachAndThrow(car, s);
    this.audio.play(dv > 8 ? 'crash_heavy' : 'crash_light', { pos: point, volume: clamp(dv / 11, 0.35, 1) });
    if (dv > 6) this.fx.sparks(point, Math.round(dv * 1.5));
    if (car === this.player.car) {
      this.player.shake = Math.max(this.player.shake, Math.min(2, dv / 6));
      if (dv > 11) this.damagePlayer((dv - 11) * 6, tr('Погиб в аварии', 'Died in a car crash'));
    }
  }

  private handleCarInput(dt: number) {
    const inp = this.input;
    const p = this.player;
    const c = p.car;
    if (!c || p.dead || this.sleepSeq) return;
    if (p.seat === 'driver') {
      if (inp.pressedA('ignition')) {
        this.audio.play('key_turn', { volume: 0.5 });
        if (c.running) c.setIgnition(false);
        else c.setCrank(true);
      }
      if (c.cranking && !inp.down('ignition') && !this.interaction.holdMax) c.setCrank(false);
      if (inp.pressedA('headlights')) {
        c.lights = (c.lights + 1) % 3;
        this.audio.play('switch', { volume: 0.5 });
      }
      c.horn = inp.down('horn') && !!c.parts.battery && c.charge > 0.05;
      if (!c.auto) {
        if (inp.pressedA('shiftUp')) c.shift(1);
        if (inp.pressedA('shiftDown')) c.shift(-1);
      }
    }
    if (inp.pressedA('radio')) {
      c.radioOn = !c.radioOn;
      this.audio.play('click', { volume: 0.5 });
      if (c.radioOn) this.showRadio(c);
    }
    const tu = inp.down('tuneUp'), td = inp.down('tuneDown');
    if (tu || td) {
      this.tuneT -= dt;
      if (this.tuneT <= 0) {
        c.radioFreq = clamp(Math.round((c.radioFreq + (tu ? 0.1 : -0.1)) * 10) / 10, 87.5, 108);
        this.tuneT = 0.07;
        this.showRadio(c);
      }
    } else this.tuneT = 0;
    p.leaning = damp(p.leaning, inp.down('lean') ? 1 : 0, 8, dt);
    if (inp.pressedA('camera')) p.thirdPerson = !p.thirdPerson;
    if (inp.pressedA('sleep')) this.sleep();
  }

  private showRadio(c: Car) {
    const name = this.audio.radio?.stationName;
    this.ui.radioName(`${c.radioFreq.toFixed(1)} MHz · ${name || tr('помехи', 'static')}`);
  }

  update(dt: number) {
    const inp = this.input;
    const play = this.mode === 'play';
    const p = this.player;
    if (play) {
      this.journey.playTime += dt;
      if (!p.dead && !this.sleepSeq) p.look(inp, dt);
      this.handleCarInput(dt);
      this.interaction.update(dt);
      if (p.car && !p.dead && inp.pressedA('interact') && !this.interaction.hasAction('E')) this.exitCar();
    }
    this.acc += dt;
    let steps = 0;
    while (this.acc >= this.fixedDt && steps < 5) {
      this.fixedStep(this.fixedDt);
      this.acc -= this.fixedDt;
      steps++;
    }
    if (steps >= 5) this.acc = 0;
    const alpha = this.acc / this.fixedDt;
    for (const c of this.cars) c.render(dt, alpha, this.env.night);
    this.carEvents();
    if (play) {
      p.updateCamera(alpha, dt);
      this.deathCamera(dt);
    } else this.menuCamera(dt);
    this.streamWorld();
    const pw = this.playerWorld();
    this.worldgen.night = this.env.night;
    this.worldgen.update(dt, pw.x, pw.z);
    this.items.update(pw.x, pw.z, (x, z) => this.physics.hasTerrainAt(x, z));
    this.shelterT -= dt;
    if (this.shelterT <= 0) {
      this.shelterT = 0.25;
      this.insideBuilding = !p.car && this.worldgen.insideBuilding(p.feet.clone().add(new THREE.Vector3(0, 1, 0)));
      p.inShelter = this.insideBuilding || !!p.car;
    }
    if (play) {
      this.enemies.update(dt);
      this.combat.update(dt);
      if (this.disarmed.size) for (const m of this.combat.mines) if (m.armed && this.disarmed.has(mineKey(m))) m.armed = false;
      for (const m of this.combat.mines) if (!m.armed) this.disarmed.add(mineKey(m));
      this.survival(dt);
      this.hints.update(dt);
      this.checkJourney();
      this.updateSleep(dt);
      this.autosaveT -= dt;
      if (this.autosaveT <= 0) {
        this.autosaveT = 300;
        if (!p.dead && this.save()) this.ui.toast(tr('Автосохранение', 'Autosaved'));
      }
    }
    this.fx.update(dt);
    this.env.indoor = damp(this.env.indoor, this.insideBuilding ? 1 : 0, 0.08, dt);
    // eye adaptation: interiors read dim and warm, openings glow
    this.renderer.toneMappingExposure = this.baseExposure * (1 + this.env.indoor * 0.45);
    this.env.update(dt * this.timeScale, dt);
    WORLD_UNIFORMS.uTime.value += dt;
    WIND.uWind.value.copy(this.env.wind);
    ROAD_UNIFORMS.uSandCover.value = damp(ROAD_UNIFORMS.uSandCover.value, this.env.cur.sand, 0.02, dt);
    ROAD_UNIFORMS.uWet.value = damp(ROAD_UNIFORMS.uWet.value, this.env.cur.rain, 0.05, dt);
    this.checkOrigin();
    this.updateAudio(dt);
    if (play && this.ui.state === 'game') this.ui.updateHud(this.hudState(), dt);
  }

  private menuCamera(dt: number) {
    const car = this.menuCar;
    if (!car) return;
    this.menuT += dt;
    const t = this.menuT;
    const cam = this.player.camera;
    const root = car.visual.root;
    const target = root.position.clone().add(new THREE.Vector3(0, 0.7, 0));
    const a = t * 0.035 + 2.45;
    const r = 7.4 + Math.sin(t * 0.05) * 1.1;
    cam.position.set(target.x + Math.sin(a) * r, target.y + 0.35 + Math.sin(t * 0.09) * 0.22, target.z + Math.cos(a) * r);
    const gy = this.world.fn.height(cam.position.x + this.physics.originX, cam.position.z + this.physics.originZ);
    cam.position.y = Math.max(cam.position.y, gy + 0.6);
    cam.lookAt(target);
    cam.rotateY(0.3);
    cam.fov = 52;
  }

  private carEvents() {
    for (const c of this.cars) {
      if (!c.events.length) continue;
      const mine = c === this.playerCar && this.mode === 'play';
      const pos = c.visual.root.position;
      for (const ev of c.events) {
        switch (ev.type) {
          case 'crank_fail':
            this.audio.play(c.parts.battery ? 'starter_fail' : 'battery_click', { pos });
            if (mine) {
              this.ui.toast(c.parts.battery ? tr('Аккумулятор разряжен', 'The battery is flat') : tr('Нет аккумулятора', 'No battery'), true);
              this.hints.trigger('noBattery');
            }
            break;
          case 'no_fuel':
            if (mine) {
              this.ui.toast(tr('Кончился бензин', 'Out of fuel'), true);
              this.hints.trigger('lowFuel');
            }
            break;
          case 'overheat':
            if (mine) {
              this.ui.toast(tr('Двигатель перегревается!', 'The engine is overheating!'), true);
              this.hints.trigger('overheat');
            }
            break;
          case 'seized':
            this.audio.play('crash_light', { pos, volume: 0.7 });
            if (mine) this.ui.toast(tr('Двигатель заклинило — нет масла', 'The engine seized — no oil'), true);
            break;
          case 'shift':
            if (c === this.player.car) this.audio.play('shift', { pos, volume: 0.35 });
            break;
          case 'backfire': {
            const ex = c.localToWorld(c.anchor('exhaust'));
            const back = new THREE.Vector3(0, 0, -1).applyQuaternion(c.visual.root.quaternion);
            this.audio.play('backfire', { pos: ex });
            this.fx.muzzle(ex, back);
            break;
          }
        }
      }
      c.events.length = 0;
    }
  }

  private footstep() {
    const p = this.player;
    const wx = p.feet.x + this.physics.originX, wz = p.feet.z + this.physics.originZ;
    let s: Surface = 'sand';
    const gy = this.world.fn.height(wx, wz);
    if (this.insideBuilding) s = 'wood';
    else if (p.feet.y > gy + 0.1) s = p.feet.y > gy + 0.6 ? 'metal' : 'concrete';
    else if (this.world.fn.onRoad(wx, wz, -0.3)) s = 'asphalt';
    this.audio.play('footstep_' + s, { volume: (p.sprinting ? 0.75 : 0.45) * (1 - p.crouch * 0.6) });
  }

  private itemImpact(e: ItemEntity, force: number) {
    if (force < 2.5) return;
    const m = e.def.material ?? 'metal';
    const name = m === 'wood' ? 'impact_wood' : m === 'soft' ? 'impact_soft' : m === 'glass' ? 'impact_glass' : m === 'plastic' ? 'impact_plastic' : 'impact_metal';
    this.audio.play(name, { pos: e.obj.position, volume: clamp((force - 2) / 25, 0.08, 1), pitch: clamp(1.4 - e.mass * 0.03, 0.6, 1.4) });
  }

  private updateAudio(dt: number) {
    const a = this.audio;
    if (!a.ready) return;
    const p = this.player;
    const cam = p.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    a.setListener(cam.position, fwd, up);
    const inCar = !!p.car && !p.thirdPerson;
    a.insideCar = inCar;
    const car = this.playerCar;
    if (!this.engine) this.engine = a.createEngine();
    if (this.engine && car) {
      this.engine.set({
        rpm: car.rpm,
        throttle: car.throttle,
        load: car.gear !== 0 ? car.throttle : car.throttle * 0.25,
        running: car.running,
        cranking: car.cranking,
        crankStrength: clamp01(car.charge * 1.25),
        misfire: car.misfire,
        damage: 1 - (car.parts.engine?.cond ?? 1),
        pos: car.localToWorld(SLOT_POS.engine),
        inside: p.car === car && !p.thirdPerson,
      });
    }
    const carNear = car && car.enabled && car.visual.root.position.distanceTo(cam.position) < 150;
    a.setCar(carNear ? { speed: car.speed, skid: car.skid, sand: car.onSand, inside: p.car === car && !p.thirdPerson, pos: car.visual.root.position, horn: car.horn, bumps: 0 } : null);
    a.setAmbient({ wind: this.env.windSpeed, carSpeed: p.car ? Math.abs(p.car.speed) : 0, insideCar: inCar, insideBuilding: this.insideBuilding, night: this.env.night, rain: this.env.cur.rain, sand: this.env.cur.sand }, dt);
    if (a.radio && car) {
      a.radio.on = this.mode === 'play' && car.radioOn && (car.ignition || car.running) && !!car.parts.battery && car.charge > 0.04;
      a.radio.freq = car.radioFreq;
      a.radio.setPos(car.localToWorld(new THREE.Vector3(0, 0.95, 0.75)), p.car === car);
    }
    if (this.mode === 'play' && this.menuMusic) {
      a.stopMenuMusic();
      this.menuMusic = false;
    }
    a.update(dt);
  }

  private qty(e: ItemEntity): string {
    const s = e.state;
    const d = e.def;
    if (d.liquid) return `${(s.amount ?? 0).toFixed(1)}${tr('л', 'L')}`;
    if (d.tool === 'gun') return `${s.loaded ?? 0}/6`;
    if (d.ammo) return String(s.ammo ?? d.ammo);
    if (d.money) return `$${Math.round(s.money ?? 0)}`;
    if (d.food && s.used) return `${Math.round((1 - s.used) * 100)}%`;
    return '';
  }

  private gearLabel(c: Car) {
    if (c.gear < 0) return 'R';
    if (c.gear === 0) return 'N';
    return (c.auto ? 'D' : '') + c.gear;
  }

  private carWarn(c: Car) {
    if (!c.parts.engine) return tr('НЕТ ДВИГАТЕЛЯ', 'NO ENGINE');
    if (c.temp > 112) return tr('ПЕРЕГРЕВ', 'OVERHEAT');
    if ((c.parts.engine.oil ?? 0) < 0.6) return tr('МАСЛО', 'OIL');
    if (!c.parts.battery) return tr('НЕТ АКБ', 'NO BATTERY');
    if (c.fuelTotal < 4) return tr('ТОПЛИВО', 'FUEL');
    if (c.charge < 0.2) return tr('АКБ', 'BATTERY');
    return '';
  }

  private hudState(): HudState {
    const ia = this.interaction;
    const p = this.player;
    const car = p.car;
    const env = this.scene.environment;
    const icon = (e: ItemEntity | null) => (e ? { name: ia.itemName(e), icon: this.icons.get(e, env), qty: this.qty(e) } : null);
    const hold = ia.holdMax > 0 && ia.holdMax < 900 ? clamp01(ia.holdT / ia.holdMax) : 0;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(p.camera.quaternion);
    return {
      target: this.sleepSeq ? null : ia.target,
      hold,
      stats: p.stats,
      hand: icon(ia.hand),
      slots: ia.slots.map(icon),
      compass: ia.hasCompass() ? Math.atan2(-dir.x, -dir.z) : null,
      car: car ? { speed: car.speed * 3.6, gear: this.gearLabel(car), fuel: car.fuelTotal / FUEL_CAP, temp: car.temp, batt: car.charge, running: car.running, warn: this.carWarn(car) } : null,
      fps: this.stats.fps,
      hurt: this.hurt,
      inCar: !!car,
    };
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
    this.uiKeys(dt);
    const st = this.ui.state;
    const simPaused = this.mode === 'play' && (st === 'pause' || st === 'settings' || st === 'journal' || st === 'note' || st === 'win' || st === 'loading');
    this.input.enabled = this.mode === 'play' && st === 'game' && !this.player.dead && !this.sleepSeq;
    if (!simPaused) this.update(dt);
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
      if (i % 30 === 0) {
        this.streamWorld();
        this.checkOrigin();
      }
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

function mineKey(m: { x: number; z: number }) {
  return `${Math.round(m.x)},${Math.round(m.z)}`;
}

function tick() {
  return new Promise((r) => setTimeout(r, 0));
}
