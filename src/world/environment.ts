import * as THREE from 'three';
import { clamp, clamp01, lerp, smoothstep, RNG, DEG } from '../core/math';
import { FOG } from '../gfx/fog';
import { Sky } from '../gfx/sky';

export type WeatherKind = 'clear' | 'cloudy' | 'overcast' | 'sandstorm' | 'rain';

interface WeatherParams {
  cloud: number;
  cloudDark: number;
  fog: number;
  sun: number;
  sand: number;
  rain: number;
  wind: number;
  haze: number;
}
const WEATHER: Record<WeatherKind, WeatherParams> = {
  clear: { cloud: 0.18, cloudDark: 0, fog: 1, sun: 1, sand: 0, rain: 0, wind: 3, haze: 0.5 },
  cloudy: { cloud: 0.55, cloudDark: 0.1, fog: 1.2, sun: 0.85, sand: 0, rain: 0, wind: 5, haze: 0.55 },
  overcast: { cloud: 0.95, cloudDark: 0.45, fog: 1.7, sun: 0.28, sand: 0, rain: 0, wind: 6, haze: 0.8 },
  sandstorm: { cloud: 0.7, cloudDark: 0.3, fog: 30, sun: 0.35, sand: 1, rain: 0, wind: 17, haze: 1 },
  rain: { cloud: 1, cloudDark: 0.7, fog: 5, sun: 0.18, sand: 0, rain: 1, wind: 8, haze: 0.9 },
};

interface SkyKey {
  el: number;
  zen: string;
  hor: string;
  horSun: string;
  sun: string;
  sunI: number;
  amb: number;
  fog: string;
  fogSun: string;
  ground: string;
  cloudLit: string;
  cloudShade: string;
}
const KEYS: SkyKey[] = [
  { el: -20, zen: '#020409', hor: '#070b14', horSun: '#080c16', sun: '#000000', sunI: 0, amb: 0.06, fog: '#070b13', fogSun: '#080c15', ground: '#07080a', cloudLit: '#0d1119', cloudShade: '#07090e' },
  { el: -10, zen: '#060c1c', hor: '#161b2c', horSun: '#2a2230', sun: '#000000', sunI: 0, amb: 0.1, fog: '#141926', fogSun: '#241e2a', ground: '#0e0d10', cloudLit: '#1c1e2a', cloudShade: '#0e1018' },
  { el: -4, zen: '#15254a', hor: '#56506a', horSun: '#b8705a', sun: '#ff7040', sunI: 0, amb: 0.22, fog: '#4c4a5e', fogSun: '#a0644e', ground: '#2a211e', cloudLit: '#b07060', cloudShade: '#383448' },
  { el: 1, zen: '#2c4a80', hor: '#b08878', horSun: '#f2944e', sun: '#ff8a48', sunI: 0.9, amb: 0.36, fog: '#a88478', fogSun: '#ee9458', ground: '#6a4a36', cloudLit: '#ffa878', cloudShade: '#6a5a6a' },
  { el: 6, zen: '#3f67a4', hor: '#d0aa8c', horSun: '#ffc088', sun: '#ffb070', sunI: 2.1, amb: 0.55, fog: '#d2b096', fogSun: '#ffc690', ground: '#9a7456', cloudLit: '#ffd8b0', cloudShade: '#8a8090' },
  { el: 14, zen: '#4f80c4', hor: '#d8c8b4', horSun: '#f4dcb8', sun: '#ffdcae', sunI: 3.0, amb: 0.72, fog: '#d9ccbb', fogSun: '#f2dcbc', ground: '#b89272', cloudLit: '#fff0dc', cloudShade: '#9a9eac' },
  { el: 30, zen: '#5a8ed2', hor: '#d2dae0', horSun: '#ebe6dc', sun: '#fff1de', sunI: 3.5, amb: 0.85, fog: '#d8d9d6', fogSun: '#efe7da', ground: '#c09a78', cloudLit: '#ffffff', cloudShade: '#a8b0c0' },
  { el: 70, zen: '#5f96da', hor: '#d6dee6', horSun: '#eeebe4', sun: '#fff8ee', sunI: 3.8, amb: 0.95, fog: '#dadcdc', fogSun: '#f0ebe2', ground: '#c6a07c', cloudLit: '#ffffff', cloudShade: '#b0b8c6' },
];

const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function lerpHex(a: string, b: string, t: number, out: THREE.Color) {
  tmpA.set(a);
  tmpB.set(b);
  return out.copy(tmpA).lerp(tmpB, t);
}

export class Environment {
  /** hours 0..24 */
  time = 9.5;
  day = 1;
  /** real seconds per in-game hour */
  secondsPerHour = 60;
  weather: WeatherKind = 'clear';
  private wFrom: WeatherParams = { ...WEATHER.clear };
  private wTo: WeatherParams = { ...WEATHER.clear };
  private wT = 1;
  private wDuration = 1;
  cur: WeatherParams = { ...WEATHER.clear };
  private weatherTimer = 400;
  private rng: RNG;
  frozenWeather = false;

  sunDir = new THREE.Vector3(0, 1, 0);
  moonDir = new THREE.Vector3(0, -1, 0);
  lightDir = new THREE.Vector3(0, 1, 0);
  sunColor = new THREE.Color();
  sunIntensity = 3;
  ambient = 1;
  fogColor = new THREE.Color();
  fogSun = new THREE.Color();
  sunElevation = 0;
  night = 0; // 0 day .. 1 full night
  /** 0 outdoors .. 1 inside a building; the sky IBL is not occluded by roofs, so dim it by hand. */
  indoor = 0;
  wind = new THREE.Vector3(3, 0, 1);
  windSpeed = 3;
  private windPhase = 0;
  lightning = 0;
  private lightningTimer = 5;
  onThunder: ((delay: number, strength: number) => void) | null = null;
  temperature = 30;
  cloudOffset = new THREE.Vector2();
  private envTimer = 0;
  private lastEnvSun = new THREE.Vector3();
  totalTime = 0;

  sunLight: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;

  constructor(private scene: THREE.Scene, private sky: Sky, seed: number) {
    this.rng = new RNG(seed ^ 0x5eed);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.035;
    scene.add(this.sunLight, this.sunLight.target);
    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0xc09a78, 0.3);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xd0d8e0, 0.0003);
  }

  setWeather(kind: WeatherKind, transitionSeconds = 60) {
    this.weather = kind;
    this.wFrom = { ...this.cur };
    this.wTo = { ...WEATHER[kind] };
    this.wT = 0;
    this.wDuration = Math.max(0.01, transitionSeconds);
    this.weatherTimer = 300 + this.rng.next() * 600;
  }

  private pickWeather(): WeatherKind {
    const r = this.rng;
    return r.weighted<WeatherKind>([
      ['clear', 50],
      ['cloudy', 24],
      ['overcast', 10],
      ['sandstorm', 10],
      ['rain', 6],
    ]);
  }

  get isNight() {
    return this.night > 0.5;
  }

  update(dt: number, realDt: number) {
    this.totalTime += realDt;
    this.time += dt / this.secondsPerHour;
    if (this.time >= 24) {
      this.time -= 24;
      this.day++;
    }
    // weather
    if (!this.frozenWeather) {
      this.weatherTimer -= realDt;
      if (this.weatherTimer <= 0) this.setWeather(this.pickWeather(), 90);
    }
    if (this.wT < 1) {
      this.wT = Math.min(1, this.wT + realDt / this.wDuration);
      const t = smoothstep(0, 1, this.wT);
      for (const k of Object.keys(this.cur) as (keyof WeatherParams)[]) {
        // fog transitions in log space so storms roll in gradually
        if (k === 'fog') this.cur.fog = Math.exp(lerp(Math.log(this.wFrom.fog), Math.log(this.wTo.fog), t));
        else this.cur[k] = lerp(this.wFrom[k], this.wTo[k], t);
      }
    }
    // wind: slowly rotating direction plus gusts
    this.windPhase += realDt;
    const baseAng = 0.6 + Math.sin(this.windPhase * 0.013) * 0.8;
    const gust = 1 + 0.35 * Math.sin(this.windPhase * 0.7) * Math.sin(this.windPhase * 0.23 + 1.3);
    this.windSpeed = this.cur.wind * gust;
    this.wind.set(Math.sin(baseAng), 0, Math.cos(baseAng)).multiplyScalar(this.windSpeed);
    this.cloudOffset.x += this.wind.x * realDt * 0.0006;
    this.cloudOffset.y += this.wind.z * realDt * 0.0006;

    this.computeSun();
    this.computeColors();
    this.updateLightning(realDt);
    this.applyToScene();
  }

  private computeSun() {
    const lat = 33 * DEG;
    const dec = (16 + Math.sin(this.day * 0.05) * 4) * DEG;
    const H = ((this.time - 12) / 24) * Math.PI * 2;
    const east = -Math.cos(dec) * Math.sin(H);
    const north = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.cos(H) * Math.sin(lat);
    const up = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(H) * Math.cos(lat);
    // world: east = -x, north = +z
    this.sunDir.set(-east, up, north).normalize();
    const Hm = H + Math.PI + 0.35 + Math.sin(this.day * 0.21) * 0.3;
    const mdec = -dec * 0.6;
    const me = -Math.cos(mdec) * Math.sin(Hm);
    const mn = Math.sin(mdec) * Math.cos(lat) - Math.cos(mdec) * Math.cos(Hm) * Math.sin(lat);
    const mu = Math.sin(mdec) * Math.sin(lat) + Math.cos(mdec) * Math.cos(Hm) * Math.cos(lat);
    this.moonDir.set(-me, mu, mn).normalize();
    this.sunElevation = Math.asin(clamp(this.sunDir.y, -1, 1)) / DEG;
  }

  private zen = new THREE.Color();
  private hor = new THREE.Color();
  private horSun = new THREE.Color();
  private ground = new THREE.Color();
  private cloudLit = new THREE.Color();
  private cloudShade = new THREE.Color();

  private computeColors() {
    const el = this.sunElevation;
    let i = 0;
    while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp01((el - a.el) / (b.el - a.el));
    lerpHex(a.zen, b.zen, t, this.zen);
    lerpHex(a.hor, b.hor, t, this.hor);
    lerpHex(a.horSun, b.horSun, t, this.horSun);
    lerpHex(a.sun, b.sun, t, this.sunColor);
    lerpHex(a.fog, b.fog, t, this.fogColor);
    lerpHex(a.fogSun, b.fogSun, t, this.fogSun);
    lerpHex(a.ground, b.ground, t, this.ground);
    lerpHex(a.cloudLit, b.cloudLit, t, this.cloudLit);
    lerpHex(a.cloudShade, b.cloudShade, t, this.cloudShade);
    const w = this.cur;
    this.sunIntensity = lerp(a.sunI, b.sunI, t) * w.sun;
    this.ambient = lerp(a.amb, b.amb, t) * lerp(1, 0.75, w.cloudDark);
    this.night = 1 - smoothstep(-9, 2, el);

    // overcast / rain desaturate; sandstorm tints everything ochre
    const grey = (c: THREE.Color, k: number) => {
      const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
      c.r = lerp(c.r, l, k); c.g = lerp(c.g, l, k); c.b = lerp(c.b, l, k);
    };
    const overc = clamp01(w.cloudDark * 1.2);
    for (const c of [this.zen, this.hor, this.horSun, this.fogColor, this.fogSun, this.cloudLit]) grey(c, overc * 0.75);
    if (overc > 0) {
      const dim = 1 - overc * 0.45;
      this.zen.multiplyScalar(dim); this.hor.multiplyScalar(dim); this.horSun.multiplyScalar(dim);
      this.fogColor.multiplyScalar(dim); this.fogSun.multiplyScalar(dim);
    }
    if (w.sand > 0.001) {
      const dayL = clamp01((el + 6) / 20);
      const storm = new THREE.Color('#b07a45').multiplyScalar(0.25 + 0.75 * dayL);
      const storm2 = new THREE.Color('#d09a5c').multiplyScalar(0.25 + 0.75 * dayL);
      this.fogColor.lerp(storm, w.sand);
      this.fogSun.lerp(storm2, w.sand);
      this.hor.lerp(storm, w.sand);
      this.horSun.lerp(storm2, w.sand);
      this.zen.lerp(storm.clone().multiplyScalar(0.8), w.sand * 0.85);
      this.sunColor.lerp(new THREE.Color('#ffb070'), w.sand * 0.6);
    }
    // ambient desert temperature
    const dayHeat = smoothstep(-5, 50, el);
    this.temperature = lerp(4, 46, dayHeat) - w.cloudDark * 8 - w.rain * 10;
  }

  private updateLightning(dt: number) {
    this.lightning = Math.max(0, this.lightning - dt * 6);
    if (this.cur.rain > 0.6) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 6 + this.rng.next() * 18;
        this.lightning = 1;
        const dist = 0.5 + this.rng.next() * 4;
        this.onThunder?.(dist, 1 / dist);
      }
    }
  }

  private applyToScene() {
    const w = this.cur;
    const sky = this.sky.uniforms;
    const sunUp = this.sunDir.y > -0.04;
    const moonI = clamp01(this.moonDir.y * 4) * 0.34 * (1 - w.cloudDark * 0.8);
    // single shadow-casting light: sun by day, moon at night
    const sunFade = smoothstep(-0.04, 0.03, this.sunDir.y);
    if (sunUp && sunFade > 0.02) {
      this.lightDir.copy(this.sunDir);
      this.sunLight.color.copy(this.sunColor);
      this.sunLight.intensity = this.sunIntensity * sunFade;
    } else {
      this.lightDir.copy(this.moonDir.y > 0.02 ? this.moonDir : new THREE.Vector3(0.3, 1, 0.2).normalize());
      this.sunLight.color.set('#9fb6e6');
      this.sunLight.intensity = moonI;
    }
    if (this.lightning > 0) {
      this.sunLight.intensity += this.lightning * 6;
      this.sunLight.color.lerp(new THREE.Color('#dfe6ff'), this.lightning);
    }
    this.hemi.color.copy(this.zen).lerp(this.hor, 0.5);
    this.hemi.groundColor.copy(this.ground);
    const shelter = 1 - this.indoor * 0.68;
    this.hemi.intensity = (0.25 * this.ambient + this.lightning * 1.5) * shelter;
    (this.scene as any).environmentIntensity = (this.ambient * 0.9 + this.lightning) * shelter;

    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.fogColor);
    fog.density = 0.00028 * w.fog * lerp(1, 1.6, this.night);
    FOG.sunColor[0] = this.fogSun.r; FOG.sunColor[1] = this.fogSun.g; FOG.sunColor[2] = this.fogSun.b;
    FOG.sunDir[0] = this.sunDir.x; FOG.sunDir[1] = this.sunDir.y; FOG.sunDir[2] = this.sunDir.z;
    FOG.params[0] = w.sand > 0.3 ? 0.0012 : 0.0035;
    FOG.params[1] = 0;
    FOG.params[2] = 7;
    FOG.params[3] = w.sand > 0.2 ? 1 : 0.985;

    sky.uSunDir.value.copy(this.sunDir);
    sky.uMoonDir.value.copy(this.moonDir);
    sky.uZenith.value.copy(this.zen);
    sky.uHorizon.value.copy(this.hor);
    sky.uHorizonSun.value.copy(this.horSun);
    sky.uSunColor.value.copy(this.sunColor);
    sky.uGround.value.copy(this.ground);
    sky.uFogColor.value.copy(this.fogColor);
    sky.uFogSun.value.copy(this.fogSun);
    sky.uSunVis.value = smoothstep(-0.06, 0.02, this.sunDir.y) * (1 - w.cloudDark * 0.9);
    sky.uMoonVis.value = smoothstep(-0.05, 0.1, this.moonDir.y) * (1 - w.cloudDark) * (1 - w.sand);
    sky.uStars.value = this.night * (1 - w.cloud * 0.8) * (1 - w.sand);
    sky.uCloud.value = w.cloud;
    sky.uCloudDark.value = w.cloudDark;
    sky.uCloudLit.value.copy(this.cloudLit);
    sky.uCloudShade.value.copy(this.cloudShade);
    sky.uHaze.value = w.haze;
    sky.uStorm.value = w.sand;
    sky.uFogAmt.value = clamp01((w.fog - 1) / 12) + w.rain * 0.3;
    sky.uTime.value = this.totalTime;
    sky.uCloudOffset.value.copy(this.cloudOffset);
    sky.uMoonPhase.value = 1.0 + this.day * 0.21;
    if (this.lightning > 0) {
      sky.uZenith.value.lerp(new THREE.Color('#8890b8'), this.lightning * 0.6);
      sky.uHorizon.value.lerp(new THREE.Color('#a0a8c8'), this.lightning * 0.6);
    }
  }

  /** Refresh the IBL environment map when lighting changed noticeably. */
  maybeUpdateEnv(dt: number, force = false) {
    this.envTimer -= dt;
    const moved = this.lastEnvSun.distanceToSquared(this.sunDir) > 0.0004 || this.wT < 1;
    if (force || (this.envTimer <= 0 && moved)) {
      this.envTimer = 1.5;
      this.lastEnvSun.copy(this.sunDir);
      this.scene.environment = this.sky.updateEnv();
    }
  }

  /** Keep the sun shadow frustum centred on the player with texel snapping (no shimmering). */
  updateShadow(focus: THREE.Vector3, radius: number, mapSize: number) {
    const L = this.sunLight;
    const cam = L.shadow.camera as THREE.OrthographicCamera;
    if (cam.right !== radius) {
      cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
      cam.near = 1; cam.far = 700;
      cam.updateProjectionMatrix();
    }
    if (L.shadow.mapSize.x !== mapSize) {
      L.shadow.mapSize.set(mapSize, mapSize);
      L.shadow.map?.dispose();
      (L.shadow as any).map = null;
    }
    const dir = this.lightDir;
    const upRef = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(upRef, dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    const texel = (radius * 2) / mapSize;
    const fx = focus.dot(right), fy = focus.dot(up);
    const sx = Math.round(fx / texel) * texel - fx, sy = Math.round(fy / texel) * texel - fy;
    const f = focus.clone().addScaledVector(right, sx).addScaledVector(up, sy);
    L.target.position.copy(f);
    L.position.copy(f).addScaledVector(dir, 300);
    L.target.updateMatrixWorld();
    L.updateMatrixWorld();
  }

  timeString() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
