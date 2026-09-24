import * as THREE from 'three';
import { fogUniforms } from './fog';

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
attribute float aRot;
varying float vAlpha;
varying vec3 vColor;
varying float vRot;
varying vec3 vFogViewPos;
uniform float uScale;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  vAlpha = aAlpha;
  vColor = aColor;
  vRot = aRot;
  vFogViewPos = mv.xyz;
}`;
const FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec3 fogSunColor;
uniform vec3 fogSunDir;
uniform vec4 fogParams;
varying float vAlpha;
varying vec3 vColor;
varying float vRot;
varying vec3 vFogViewPos;
uniform float uAdditive;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  vec4 t = texture2D(uTex, p);
  float a = t.a * vAlpha;
  if (a < 0.003) discard;
  vec3 col = vColor * t.rgb;
  float d = length(vFogViewPos);
  float f = 1.0 - exp(-fogDensity * d);
  col = mix(col, fogColor, clamp(f, 0.0, 1.0) * (1.0 - uAdditive));
  gl_FragColor = vec4(col, a);
}`;

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number; grow: number;
  r: number; g: number; b: number;
  a: number; rot: number; spin: number;
  drag: number; grav: number;
}

export interface EmitOpts {
  count?: number;
  pos: THREE.Vector3;
  vel?: THREE.Vector3;
  spread?: number;
  life?: [number, number];
  size?: [number, number];
  grow?: number;
  color?: THREE.ColorRepresentation;
  alpha?: number;
  drag?: number;
  grav?: number;
  jitter?: number;
}

/** A pooled point-sprite particle system. */
export class ParticlePool {
  points: THREE.Points;
  private ps: P[] = [];
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private col: Float32Array;
  private rot: Float32Array;
  private tmpC = new THREE.Color();

  constructor(private max: number, tex: THREE.Texture, additive = false) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.rot = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTex: { value: tex }, uScale: { value: 600 }, uAdditive: { value: additive ? 1 : 0 }, ...fogUniforms() },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  emit(o: EmitOpts) {
    const n = o.count ?? 1;
    this.tmpC.set(o.color ?? 0xffffff);
    for (let i = 0; i < n; i++) {
      if (this.ps.length >= this.max) this.ps.shift();
      const sp = o.spread ?? 0.5;
      const j = o.jitter ?? 0.1;
      const life = (o.life?.[0] ?? 1) + Math.random() * ((o.life?.[1] ?? 2) - (o.life?.[0] ?? 1));
      this.ps.push({
        x: o.pos.x + (Math.random() - 0.5) * j, y: o.pos.y + (Math.random() - 0.5) * j, z: o.pos.z + (Math.random() - 0.5) * j,
        vx: (o.vel?.x ?? 0) + (Math.random() - 0.5) * sp, vy: (o.vel?.y ?? 0) + (Math.random() - 0.5) * sp, vz: (o.vel?.z ?? 0) + (Math.random() - 0.5) * sp,
        life, max: life,
        size: (o.size?.[0] ?? 0.5) + Math.random() * ((o.size?.[1] ?? 1) - (o.size?.[0] ?? 0.5)), grow: o.grow ?? 0.5,
        r: this.tmpC.r, g: this.tmpC.g, b: this.tmpC.b, a: o.alpha ?? 0.5,
        rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 1.5,
        drag: o.drag ?? 0.8, grav: o.grav ?? 0,
      });
    }
  }

  shift(dx: number, dz: number) {
    for (const p of this.ps) { p.x -= dx; p.z -= dz; }
  }

  update(dt: number, fog: THREE.FogExp2, height: number) {
    const u = (this.points.material as THREE.ShaderMaterial).uniforms;
    u.fogColor.value.copy(fog.color);
    u.fogDensity.value = fog.density;
    u.uScale.value = height * 0.9;
    let n = 0;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.ps.splice(i, 1); continue; }
    }
    for (const p of this.ps) {
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k - p.grav * dt; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.size += p.grow * dt;
      p.rot += p.spin * dt;
      const t = p.life / p.max;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.size[n] = p.size;
      this.alpha[n] = p.a * Math.min(1, t * 3) * Math.min(1, (1 - t) * 8 + 0.2);
      this.col[n * 3] = p.r; this.col[n * 3 + 1] = p.g; this.col[n * 3 + 2] = p.b;
      this.rot[n] = p.rot;
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'aSize', 'aAlpha', 'aColor', 'aRot']) (this.geo.attributes[a] as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Rain streaks / blowing sand around the camera. */
export class Precipitation {
  mesh: THREE.LineSegments;
  private pos: Float32Array;
  private n = 2400;
  private mat: THREE.LineBasicMaterial;
  constructor() {
    this.pos = new Float32Array(this.n * 6);
    for (let i = 0; i < this.n; i++) {
      const x = (Math.random() - 0.5) * 40, y = Math.random() * 24, z = (Math.random() - 0.5) * 40;
      this.pos.set([x, y, z, x, y - 0.5, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ color: 0xaab4c0, transparent: true, opacity: 0.35, depthWrite: false });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  update(dt: number, cam: THREE.Vector3, rain: number, sand: number, wind: THREE.Vector3) {
    const amount = Math.max(rain, sand);
    this.mesh.visible = amount > 0.02;
    if (!this.mesh.visible) return;
    const active = Math.floor(this.n * amount);
    const sandMode = sand > rain;
    this.mat.color.set(sandMode ? 0xc8a070 : 0xaab4c0);
    this.mat.opacity = sandMode ? 0.28 : 0.32;
    const vy = sandMode ? -2 : -18;
    const vx = wind.x * (sandMode ? 1.6 : 0.3), vz = wind.z * (sandMode ? 1.6 : 0.3);
    const len = sandMode ? 0.18 : 0.06;
    for (let i = 0; i < this.n; i++) {
      const o = i * 6;
      if (i >= active) { this.pos[o + 1] = -1000; this.pos[o + 4] = -1000; continue; }
      let x = this.pos[o] + vx * dt, y = this.pos[o + 1] + vy * dt, z = this.pos[o + 2] + vz * dt;
      if (y < cam.y - 4 || Math.abs(x - cam.x) > 20 || Math.abs(z - cam.z) > 20 || y < -500) {
        x = cam.x + (Math.random() - 0.5) * 40;
        z = cam.z + (Math.random() - 0.5) * 40;
        y = cam.y + (sandMode ? Math.random() * 6 - 2 : 10 + Math.random() * 12);
      }
      this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
      this.pos[o + 3] = x - vx * len; this.pos[o + 4] = y - vy * len; this.pos[o + 5] = z - vz * len;
    }
    (this.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
