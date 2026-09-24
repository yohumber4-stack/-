import * as THREE from 'three';
import { C, lowPoint, ghPoint, lowSec, archV, surfPatch, sweep, roundRectProfile, PatchResult } from './carSurface';
import { Materials } from '../gfx/materials';
import { merge, tube, placed, lathe, extrude, roundRectShape } from '../models/geom';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvas, toTex, FONT, FONT_COND } from '../gfx/canvasTex';
import { RNG } from '../core/math';

export type SlotId =
  | 'door_fl' | 'door_fr' | 'door_rl' | 'door_rr' | 'hood' | 'trunk'
  | 'wheel_fl' | 'wheel_fr' | 'wheel_rl' | 'wheel_rr'
  | 'engine' | 'battery' | 'radiator' | 'headlight_l' | 'headlight_r'
  | 'bumper_f' | 'bumper_r' | 'seat_d' | 'seat_p' | 'seat_r';

export const ALL_SLOTS: SlotId[] = ['door_fl', 'door_fr', 'door_rl', 'door_rr', 'hood', 'trunk', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr', 'engine', 'battery', 'radiator', 'headlight_l', 'headlight_r', 'bumper_f', 'bumper_r', 'seat_d', 'seat_p', 'seat_r'];

/** Visual of one removable part, built in its own local frame (origin = attach/hinge point). */
export interface PartVisual {
  root: THREE.Group;
  paint?: THREE.MeshPhysicalMaterial;
  hinge?: { axis: THREE.Vector3; open: number };
  lamp?: THREE.MeshStandardMaterial;
  glass?: THREE.Mesh[];
  mirror?: THREE.Mesh;
  size: THREE.Vector3;
  center: THREE.Vector3;
}

export interface CarLook {
  paint: string;
  rust: number;
  dust: number;
  seat: string;
  interior: string;
  plate: string;
  seed: number;
}

// ------------------------------------------------------------------ geometry cache
const geoCache = new Map<string, any>();
function cached<T>(key: string, make: () => T): T {
  let v = geoCache.get(key);
  if (!v) {
    v = make();
    geoCache.set(key, v);
  }
  return v as T;
}

export const SLOT_POS: Record<SlotId, THREE.Vector3> = {
  door_fl: new THREE.Vector3(0.785, 0.58, 0.662),
  door_fr: new THREE.Vector3(-0.785, 0.58, 0.662),
  door_rl: new THREE.Vector3(0.79, 0.58, -0.298),
  door_rr: new THREE.Vector3(-0.79, 0.58, -0.298),
  hood: new THREE.Vector3(0, 0.918, 0.782),
  trunk: new THREE.Vector3(0, 0.93, -1.352),
  wheel_fl: new THREE.Vector3(C.track, C.wheelR, C.axleF),
  wheel_fr: new THREE.Vector3(-C.track, C.wheelR, C.axleF),
  wheel_rl: new THREE.Vector3(C.track, C.wheelR, C.axleR),
  wheel_rr: new THREE.Vector3(-C.track, C.wheelR, C.axleR),
  engine: new THREE.Vector3(0, 0.36, 1.28),
  battery: new THREE.Vector3(0.47, 0.6, 1.62),
  radiator: new THREE.Vector3(0, 0.6, 1.86),
  headlight_l: new THREE.Vector3(0.505, 0.625, C.zF + 0.004),
  headlight_r: new THREE.Vector3(-0.505, 0.625, C.zF + 0.004),
  bumper_f: new THREE.Vector3(0, 0.43, C.zF + 0.04),
  bumper_r: new THREE.Vector3(0, 0.45, C.zR - 0.04),
  seat_d: new THREE.Vector3(0.36, 0.34, -0.12),
  seat_p: new THREE.Vector3(-0.36, 0.34, -0.12),
  seat_r: new THREE.Vector3(0, 0.34, -0.88),
};

// ------------------------------------------------------------------ materials
export function makePaint(mats: Materials, color: THREE.ColorRepresentation, rust: number, dust: number, inner = 0x2a2724): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0.08, clearcoat: 0.55, clearcoatRoughness: 0.28, side: THREE.DoubleSide });
  const tex = mats.tex;
  m.userData.rust = { value: rust };
  m.userData.dust = { value: dust };
  m.userData.inner = { value: new THREE.Color(inner) };
  m.userData.dirt = { value: 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWear = { value: tex.wear };
    shader.uniforms.uRustTex = { value: tex.rust };
    shader.uniforms.uRustAmt = m.userData.rust;
    shader.uniforms.uDustAmt = m.userData.dust;
    shader.uniforms.uInner = m.userData.inner;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOPos;\nvarying vec3 vONrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vOPos = position;\n vONrm = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vOPos; varying vec3 vONrm;
        uniform sampler2D uWear; uniform sampler2D uRustTex; uniform float uRustAmt; uniform float uDustAmt; uniform vec3 uInner;
        float rustK = 0.0; float innerK = 0.0;
        vec4 triS(sampler2D t, vec3 p, vec3 n, float s){
          vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-4);
          return texture2D(t, p.zy * s) * w.x + texture2D(t, p.xz * s) * w.y + texture2D(t, p.xy * s) * w.z;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec4 wr = triS(uWear, vOPos, vONrm, 0.55);
          vec4 wr2 = triS(uWear, vOPos * 1.7 + 3.1, vONrm, 1.9);
          float low = 1.0 - smoothstep(0.25, 0.75, vOPos.y);
          float edge = smoothstep(0.55, 0.8, abs(vOPos.x)) * 0.12;
          float m = wr.r * 0.72 + wr2.r * 0.28 + low * 0.2 + edge;
          rustK = smoothstep(1.0 - uRustAmt * 0.8, 1.06 - uRustAmt * 0.78, m);
          rustK = max(rustK, wr2.g * uRustAmt * 0.8);
          vec3 rc = triS(uRustTex, vOPos, vONrm, 1.4).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, rc, rustK);
          float dustK = uDustAmt * (0.3 + 0.7 * wr.b) * (0.35 + 0.65 * low) + uDustAmt * 0.25 * max(vONrm.y, 0.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.54, 0.40), clamp(dustK * 0.6, 0.0, 0.85));
          if (!gl_FrontFacing) { innerK = 1.0; diffuseColor.rgb = uInner * (0.8 + 0.2 * wr.b); }
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.9, max(max(rustK, uDustAmt * 0.4), innerK));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor *= 1.0 - rustK;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n material.clearcoat *= (1.0 - rustK) * (1.0 - innerK) * (1.0 - clamp(uDustAmt, 0.0, 1.0) * 0.6);');
  };
  m.customProgramCacheKey = () => 'carpaint';
  return m;
}

export function setPaint(m: THREE.MeshPhysicalMaterial, color: THREE.ColorRepresentation, rust: number, dust: number) {
  m.color.set(color);
  m.userData.rust.value = rust;
  m.userData.dust.value = dust;
}

function lampMat(color: string, glassTint: string) {
  return new THREE.MeshStandardMaterial({ color: glassTint, emissive: color, emissiveIntensity: 0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
}

// ------------------------------------------------------------------ helpers
function pr(res: PatchResult[], key: 'outer' | 'inner' | 'edge'): THREE.BufferGeometry[] {
  return res.map((r) => r[key]).filter(Boolean) as THREE.BufferGeometry[];
}
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
};
function vpts(z0: number, z1: number, n: number, f: (z: number) => THREE.Vector3) {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) out.push(f(z0 + ((z1 - z0) * i) / n));
  return out;
}

// ------------------------------------------------------------------ shell (non-removable body)
function bottomHi(z: number) {
  const inArch = Math.abs(z - C.axleF) < C.archR + 0.01 || Math.abs(z - C.axleR) < C.archR + 0.01;
  if (!inArch) return 0.15;
  const s = lowSec(z);
  return (0.15 * 0.5) / (s.w - s.rb);
}

function buildShellGeometry() {
  return cached('shell', () => {
    const paint: THREE.BufferGeometry[] = [];
    const under: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const aF0 = C.axleF - C.archR, aF1 = C.axleF + C.archR, aR0 = C.axleR - C.archR, aR1 = C.axleR + C.archR;
    const g = 0.003;
    for (const side of [1, -1]) {
      const P = (z0: number, z1: number, lo: any, hi: any, o: any) => paint.push(surfPatch(lowPoint, z0, z1, lo, hi, { side, ...o }).outer);
      // front fender: door line -> arch -> front end
      P(0.672, aF0, 0.15, 0.8, { nz: 6, nv: 24, gap: [0, 0, 0, g] });
      P(aF0, aF1, (z: number) => archV(z, C.axleF) ?? 0.15, 0.8, { nz: 30, nv: 24, zCluster: 'both', gap: [0, 0, 0, g] });
      P(aF1, C.zF, 0.15, 0.8, { nz: 22, nv: 24, zCluster: 'end1', gap: [0, 0, 0, g] });
      // front end top corners beside the hood (above headlights, the hood covers v 0.8..1)
      // cowl strip between windshield and hood
      P(C.zWS0 - 0.01, 0.776, 0.78, 1.0, { nz: 2, nv: 10 });
      // sills under the doors
      P(aR1, 0.672, 0.15, 0.2, { nz: 10, nv: 3 });
      // rear quarter: arch part behind rear door, overhang
      P(aR0, -1.0, (z: number) => archV(z, C.axleR) ?? 0.15, 0.8, { nz: 16, nv: 24, zCluster: 'both', gap: [0, 0.0025, 0, g] });
      P(C.zR, aR0, 0.15, 0.8, { nz: 20, nv: 24, zCluster: 'end1', gap: [0, 0, 0, g] });
      // trunk surround strips
      P(C.zR, -1.972, 0.8, 1.0, { nz: 6, nv: 10 });
      P(-1.348, C.zRW0 + 0.02, 0.8, 1.0, { nz: 2, nv: 10 });
      // underside
      const U = (z0: number, z1: number) => under.push(surfPatch(lowPoint, z0, z1, 0, bottomHi, { side, nz: 6, nv: 4 }).outer);
      U(C.zR, aR0); U(aR0, aR1); U(aR1, aF0); U(aF0, aF1); U(aF1, C.zF);
      // greenhouse: A pillar, B pillar, C pillar / sail, roof side
      const G = (z0: number, z1: number, lo: number, hi: number, o: any) => paint.push(surfPatch(ghPoint, z0, z1, lo, hi, { side, ...o }).outer);
      G(C.zWS1, C.zWS0, 0.585, 0.69, { nz: 16, nv: 5 });
      G(-0.318, -0.242, -0.03, 0.62, { nz: 2, nv: 10 });
      G(C.zRW0, -1.0, -0.03, 0.62, { nz: 10, nv: 10 });
      G(C.zRW0, C.zRW1, 0.585, 0.72, { nz: 14, nv: 5 });
      G(C.zRW1, C.zWS1, 0.56, 1.0, { nz: 20, nv: 12 });
      // wheel well liners and inner walls
      for (const ax of [C.axleF, C.axleR]) {
        const liner = new THREE.CylinderGeometry(C.archR + 0.012, C.archR + 0.012, C.hw - 0.5, 20, 1, true, 0, Math.PI);
        // half-tunnel over the wheel (axle along x, y ≥ 0); an extra rotateX here swung it to the rear half
        // so it hung below the sill behind every wheel like a loose flap
        liner.rotateZ(Math.PI / 2);
        liner.translate(side * (0.5 + (C.hw - 0.5) / 2), C.archY, ax);
        dark.push(liner);
        const disc = new THREE.CircleGeometry(C.archR + 0.012, 20, 0, Math.PI);
        disc.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
        disc.translate(side * 0.5, C.archY, ax);
        dark.push(disc);
      }
    }
    // front and rear end caps
    for (const [z, dir] of [[C.zF, 1], [C.zR, -1]] as [number, number][]) {
      const shape = new THREE.Shape();
      const v = new THREE.Vector3();
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 40; i++) { lowPoint(z, i / 40, 1, v); pts.push(new THREE.Vector2(v.x, v.y)); }
      for (let i = 40; i >= 0; i--) { lowPoint(z, i / 40, -1, v); pts.push(new THREE.Vector2(v.x, v.y)); }
      shape.setFromPoints(pts);
      const cap = new THREE.ShapeGeometry(shape, 1);
      if (dir < 0) { cap.rotateY(Math.PI); cap.translate(0, 0, z); cap.scale(-1, 1, 1); cap.translate(0, 0, 0); }
      else cap.translate(0, 0, z);
      if (dir < 0) { const idx = cap.index!; for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); } }
      cap.computeVertexNormals();
      paint.push(cap);
    }
    return { paint: merge(paint.map(nonIdx)), under: merge(under.map(nonIdx)), dark: merge(dark.map(nonIdx)) };
  });
}
function nonIdx(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
}

function buildGlassGeometry() {
  return cached('glassFixed', () => {
    const gs: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) {
      gs.push(surfPatch(ghPoint, C.zWS1 - 0.02, C.zWS0 - 0.012, 0.675, 1.0, { side, nz: 14, nv: 10, offset: -0.006 }).outer);
      gs.push(surfPatch(ghPoint, C.zRW0 + 0.012, C.zRW1 + 0.02, 0.705, 1.0, { side, nz: 14, nv: 10, offset: -0.006 }).outer);
    }
    return merge(gs.map(nonIdx));
  });
}

// chrome trim along window openings, drip rails, belt line
function buildTrimGeometry() {
  return cached('trim', () => {
    const gs: THREE.BufferGeometry[] = [];
    const v = new THREE.Vector3();
    for (const side of [1, -1]) {
      // drip rail
      gs.push(tube(vpts(C.zRW1 - 0.05, C.zWS1 + 0.06, 30, (z) => ghPoint(z, 0.64, side, new THREE.Vector3()).add(new THREE.Vector3(side * 0.004, 0.006, 0))), () => 0.0065, 5));
      // windshield and rear window surround (rubber/chrome)
      const ws = vpts(C.zWS1 - 0.01, C.zWS0 - 0.005, 18, (z) => ghPoint(z, 0.685, side, new THREE.Vector3()));
      gs.push(tube(ws, () => 0.007, 5));
      const rw = vpts(C.zRW0 + 0.005, C.zRW1 + 0.01, 16, (z) => ghPoint(z, 0.715, side, new THREE.Vector3()));
      gs.push(tube(rw, () => 0.007, 5));
    }
    // windshield top & bottom cross members
    const across = (z: number, vv: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16; const s = t < 0.5 ? 1 : -1; const vvv = t < 0.5 ? vv + (1 - vv) * (t / 0.5) : vv + (1 - vv) * ((1 - t) / 0.5); pts.push(ghPoint(z, vvv, s, new THREE.Vector3())); }
      return pts;
    };
    gs.push(tube(across(C.zWS1 - 0.012, 0.685), () => 0.007, 5));
    gs.push(tube(across(C.zRW1 + 0.012, 0.715), () => 0.007, 5));
    void v;
    return merge(gs.map(nonIdx));
  });
}

// ------------------------------------------------------------------ doors
interface DoorDef { slot: SlotId; side: number; z0: number; z1: number; rear: boolean }
const DOORS: DoorDef[] = [
  { slot: 'door_fl', side: 1, z0: -0.268, z1: 0.668, rear: false },
  { slot: 'door_fr', side: -1, z0: -0.268, z1: 0.668, rear: false },
  { slot: 'door_rl', side: 1, z0: -0.998, z1: -0.292, rear: true },
  { slot: 'door_rr', side: -1, z0: -0.998, z1: -0.292, rear: true },
];

function doorGeometry(d: DoorDef) {
  return cached('door' + d.side + d.rear, () => {
    const lo = d.rear ? (z: number) => archV(z, C.axleR) ?? 0.2 : 0.2;
    const skin = surfPatch(lowPoint, d.z0, d.z1, lo, 0.842, { side: d.side, nz: 22, nv: 20, thickness: 0.07, gap: [0.0025, 0.0025, 0.002, 0.0], zCluster: d.rear ? 'both' : 'none' });
    const glass = surfPatch(ghPoint, d.z0 + 0.03, d.rear ? d.z1 - 0.03 : C.zWS0 - 0.01, -0.12, 0.6, { side: d.side, nz: 12, nv: 8, offset: -0.018 }).outer;
    // window frame (chrome): top rail following the roof / A-pillar, and vertical posts
    const fr: THREE.BufferGeometry[] = [];
    const topZ1 = d.rear ? d.z1 - 0.012 : C.zWS0 - 0.004;
    const top = vpts(d.z0 + 0.012, topZ1, 24, (z) => ghPoint(z, 0.615, d.side, new THREE.Vector3()).add(new THREE.Vector3(-d.side * 0.004, 0, 0)));
    fr.push(tube(top, () => 0.011, 6));
    const post = (z: number) => vpts(-0.1, 0.62, 8, (vv) => ghPoint(z, Math.max(0, vv), d.side, new THREE.Vector3()).add(new THREE.Vector3(-d.side * 0.004, vv < 0 ? vv * 0.3 : 0, 0)));
    fr.push(tube(post(d.z0 + 0.012), () => 0.011, 6));
    if (d.rear) fr.push(tube(post(d.z1 - 0.012), () => 0.011, 6));
    // belt strip
    const belt = vpts(d.z0 + 0.004, d.z1 - 0.004, 20, (z) => lowPoint(z, 0.842, d.side, new THREE.Vector3()).add(new THREE.Vector3(0, 0.008, 0)));
    fr.push(tube(belt, () => 0.008, 6));
    // handle
    const hz = d.rear ? d.z0 + 0.12 : d.z0 + 0.13;
    const hp = lowPoint(hz, 0.69, d.side, new THREE.Vector3());
    const handle = new RoundedBoxGeometry(0.018, 0.028, 0.15, 2, 0.008);
    handle.translate(hp.x + d.side * 0.012, hp.y, hp.z + 0.04);
    fr.push(handle);
    // interior: armrest, pull handle, window crank
    const inner: THREE.BufferGeometry[] = [];
    const ip = lowPoint((d.z0 + d.z1) / 2, 0.5, d.side, new THREE.Vector3());
    const arm = new RoundedBoxGeometry(0.07, 0.05, (d.z1 - d.z0) * 0.5, 2, 0.015);
    arm.translate(ip.x - d.side * 0.1, 0.62, (d.z0 + d.z1) / 2 + 0.02);
    inner.push(arm);
    const crankC = new THREE.Vector3(ip.x - d.side * 0.085, 0.52, d.z0 + 0.25);
    const crank = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10);
    crank.rotateZ(Math.PI / 2);
    crank.translate(crankC.x, crankC.y, crankC.z);
    const crankArm = new THREE.BoxGeometry(0.012, 0.012, 0.09);
    crankArm.translate(crankC.x - d.side * 0.012, crankC.y + 0.02, crankC.z + 0.035);
    const lever = new RoundedBoxGeometry(0.02, 0.03, 0.08, 2, 0.008);
    lever.translate(ip.x - d.side * 0.085, 0.76, d.z0 + 0.14);
    const chromeIn = [crank, crankArm, lever];
    return { skin, glass, frame: merge(fr.map(nonIdx)), inner: merge(inner.map(nonIdx)), chromeIn: merge(chromeIn.map(nonIdx)) };
  });
}

function sideMirrorGeometry(side: number) {
  return cached('smirror' + side, () => {
    const g: THREE.BufferGeometry[] = [];
    const stalk = tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.05, 0.04, -0.02), new THREE.Vector3(side * 0.09, 0.07, -0.03)], () => 0.009, 6);
    g.push(stalk);
    const head = new THREE.CylinderGeometry(0.058, 0.066, 0.04, 20);
    head.rotateX(Math.PI / 2);
    head.scale(1.35, 1, 1);
    head.translate(side * 0.12, 0.085, -0.045);
    g.push(head);
    const glass = new THREE.CircleGeometry(0.055, 20);
    glass.scale(1.35, 1, 1);
    glass.rotateY(Math.PI);
    glass.translate(side * 0.12, 0.085, -0.0665);
    return { body: merge(g.map(nonIdx)), glass };
  });
}

// ------------------------------------------------------------------ hood / trunk
function hoodGeometry() {
  return cached('hood', () => {
    const parts = [1, -1].map((side) => surfPatch(lowPoint, 0.782, C.zF - 0.006, 0.8, 1.0, { side, nz: 30, nv: 12, thickness: 0.018, gap: [0.004, 0, 0.003, 0], zCluster: 'end1' }));
    return { outer: merge(pr(parts, 'outer').map(nonIdx)), inner: merge([...pr(parts, 'inner'), ...pr(parts, 'edge')].map(nonIdx)) };
  });
}
function trunkGeometry() {
  return cached('trunk', () => {
    const parts = [1, -1].map((side) => surfPatch(lowPoint, -1.968, -1.352, 0.8, 1.0, { side, nz: 16, nv: 12, thickness: 0.018, gap: [0.003, 0.003, 0.003, 0] }));
    const lock = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12);
    lock.rotateX(Math.PI / 2);
    const lp = lowPoint(-1.96, 0.97, 1, new THREE.Vector3());
    lock.translate(0, lp.y - 0.03, C.zR + 0.02);
    return { outer: merge(pr(parts, 'outer').map(nonIdx)), inner: merge([...pr(parts, 'inner'), ...pr(parts, 'edge')].map(nonIdx)), lock };
  });
}

// ------------------------------------------------------------------ bumpers, lights, grille
function bumperGeometry(front: boolean) {
  return cached('bumper' + front, () => {
    const z = front ? C.zF + 0.04 : C.zR - 0.04;
    const dir = front ? 1 : -1;
    const path: THREE.Vector3[] = [];
    const hw = C.hw + 0.01;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const x = (t - 0.5) * 2 * hw;
      const k = Math.max(0, Math.abs(x) - (hw - 0.2)) / 0.2;
      path.push(new THREE.Vector3(x, 0, z - dir * (k * k * 0.16)));
    }
    const prof = roundRectProfile(0.062, 0.1, 0.025, 3);
    const bar = sweep(prof, path, new THREE.Vector3(0, 1, 0));
    // rubber strip
    const strip = sweep(roundRectProfile(0.02, 0.028, 0.008, 2), path.map((p) => p.clone().add(new THREE.Vector3(0, 0, dir * 0.032))));
    const brackets: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.05, 0.05, 0.1);
      b.translate(s * 0.45, 0, z - dir * 0.07);
      brackets.push(b);
    }
    const g = { bar: bar, strip, brackets: merge(brackets) };
    for (const k of Object.keys(g)) (g as any)[k].translate(0, 0, -z);
    return g;
  });
}

function headlightGeometry() {
  return cached('headlight', () => {
    const w = 0.25, h = 0.15;
    const frameShape = roundRectShape(w + 0.03, h + 0.03, 0.03);
    frameShape.holes.push(roundRectShape(w, h, 0.022) as any);
    const bezel = extrude(frameShape, 0.02, 0.006, 2, 8);
    bezel.translate(0, 0, 0.012);
    const lens = new THREE.ShapeGeometry(roundRectShape(w, h, 0.022), 6);
    lens.translate(0, 0, 0.014);
    // subtle outward bulge
    const lp = lens.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) { const x = lp.getX(i) / (w / 2), y = lp.getY(i) / (h / 2); lp.setZ(i, 0.014 + 0.008 * (1 - Math.min(1, x * x * 0.6 + y * y * 0.6))); }
    lens.computeVertexNormals();
    const refl = new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    refl.rotateX(-Math.PI / 2);
    refl.scale(1.15, 0.7, 0.35);
    refl.translate(0, 0, 0.0);
    const bulb = new THREE.SphereGeometry(0.012, 8, 6);
    bulb.translate(0, 0, 0.02);
    return { bezel, lens, refl, bulb };
  });
}

function grilleGeometry() {
  return cached('grille', () => {
    const gs: THREE.BufferGeometry[] = [];
    const back = new THREE.PlaneGeometry(0.5, 0.14);
    back.translate(0, 0.625, C.zF + 0.002);
    const bars: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const b = new RoundedBoxGeometry(0.5, 0.012, 0.012, 1, 0.005);
      b.translate(0, 0.568 + i * 0.028, C.zF + 0.012);
      bars.push(b);
    }
    const frameShape = roundRectShape(0.53, 0.165, 0.02);
    frameShape.holes.push(roundRectShape(0.5, 0.14, 0.012) as any);
    const frame = extrude(frameShape, 0.018, 0.004, 1, 6);
    frame.translate(0, 0.625, C.zF + 0.012);
    gs.push(frame);
    // turn indicators under headlights
    const ind: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const l = new RoundedBoxGeometry(0.1, 0.045, 0.02, 2, 0.01);
      l.translate(s * 0.62, 0.5, C.zF - 0.02);
      ind.push(l);
    }
    return { back, bars: merge(bars.map(nonIdx)), frame: merge(gs.map(nonIdx)), indicators: merge(ind.map(nonIdx)) };
  });
}

function taillightGeometry() {
  return cached('tail', () => {
    const red: THREE.BufferGeometry[] = [], amber: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [], chrome: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const x = s * 0.52, y = 0.665, z = C.zR - 0.006;
      const f = extrude(Object.assign(roundRectShape(0.27, 0.15, 0.02), { holes: [roundRectShape(0.25, 0.13, 0.015)] }) as any, 0.02, 0.004, 1, 6);
      f.rotateY(Math.PI);
      f.translate(x, y, z);
      chrome.push(f);
      const r = new RoundedBoxGeometry(0.25, 0.07, 0.03, 2, 0.01); r.translate(x, y + 0.03, z); red.push(r);
      const a = new RoundedBoxGeometry(0.12, 0.055, 0.03, 2, 0.01); a.translate(x + s * 0.065, y - 0.035, z); amber.push(a);
      const w = new RoundedBoxGeometry(0.12, 0.055, 0.03, 2, 0.01); w.translate(x - s * 0.065, y - 0.035, z); white.push(w);
    }
    return { red: merge(red.map(nonIdx)), amber: merge(amber.map(nonIdx)), white: merge(white.map(nonIdx)), chrome: merge(chrome.map(nonIdx)) };
  });
}

function plateTex(text: string) {
  const [c, x] = canvas(512, 112);
  x.fillStyle = '#e8e6de';
  x.fillRect(0, 0, 512, 112);
  x.strokeStyle = '#111';
  x.lineWidth = 6;
  x.strokeRect(5, 5, 502, 102);
  x.fillStyle = '#141414';
  x.font = `700 78px ${FONT_COND}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 60);
  x.fillStyle = 'rgba(120,90,50,0.25)';
  for (let i = 0; i < 60; i++) x.fillRect(Math.random() * 512, Math.random() * 112, Math.random() * 30, Math.random() * 6);
  return toTex(c);
}

// ------------------------------------------------------------------ wheels
/**
 * Steel wheel, axle along x, outer face +x. A lathe faces +y when its profile runs outer→inner and
 * +y becomes +x once turned onto the axle, so every outward-visible rim profile runs inward.
 */
export function wheelGeometry() {
  return cached('wheel', () => {
    const R = C.wheelR, W = 0.165, rimR = 0.168, sw = W / 2;
    const toAxle = (g: THREE.BufferGeometry) => g.rotateZ(-Math.PI / 2);
    // tyre section [radius, axial, v]: the tread texture keeps its pattern in v ∈ [0.3, 0.7], sidewalls outside
    const sec: [number, number, number][] = [
      [rimR, -sw * 0.82, 0], [rimR + 0.02, -sw * 0.95, 0.07], [R - 0.045, -sw, 0.18], [R - 0.018, -sw * 0.92, 0.26], [R - 0.004, -sw * 0.72, 0.31], [R, -sw * 0.45, 0.36],
      [R, sw * 0.45, 0.64], [R - 0.004, sw * 0.72, 0.69], [R - 0.018, sw * 0.92, 0.74], [R - 0.045, sw, 0.82], [rimR + 0.02, sw * 0.95, 0.93], [rimR, sw * 0.82, 1],
    ];
    const tire = lathe(sec.map(([r, y]) => [r, y] as [number, number]), 48);
    const uv = tire.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, sec[i % sec.length][2]);
    toAxle(tire);
    // steel rim: lip and well, raised face ring with four real slots, domed centre, barrel behind
    const lip = lathe([[rimR + 0.006, 0.076], [rimR + 0.006, 0.07], [rimR, 0.062], [rimR - 0.004, 0.024], [0.156, 0.022], [0.155, 0.031]], 48);
    const ring = new THREE.Shape().absarc(0, 0, 0.155, 0, Math.PI * 2, false);
    ring.holes.push(new THREE.Path().absarc(0, 0, 0.095, 0, Math.PI * 2, true));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      ring.holes.push(new THREE.Path().absellipse(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0.021, 0.014, 0, Math.PI * 2, true, a));
    }
    const face = new THREE.ShapeGeometry(ring, 24);
    face.rotateY(Math.PI / 2);
    face.translate(0.031, 0, 0);
    const hub = lathe([[0.095, 0.031], [0.09, 0.042], [0.075, 0.048], [0.001, 0.05]], 32);
    const barrel = new THREE.CylinderGeometry(rimR - 0.003, rimR - 0.003, W * 0.95, 32, 1, true);
    barrel.rotateZ(Math.PI / 2);
    // brake drum fills the slots (they reach r = 0.146) so nothing shows through the wheel
    const drum = new THREE.CylinderGeometry(0.152, 0.152, 0.07, 32);
    drum.rotateZ(Math.PI / 2);
    drum.translate(-0.012, 0, 0);
    const cap = lathe([[0.068, 0.049], [0.067, 0.06], [0.06, 0.071], [0.045, 0.078], [0.022, 0.082], [0.001, 0.083]], 32);
    toAxle(cap);
    const nuts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const n = new THREE.CylinderGeometry(0.0085, 0.0085, 0.012, 6);
      n.rotateZ(Math.PI / 2);
      n.translate(0.051, Math.cos(a) * 0.08, Math.sin(a) * 0.08);
      nuts.push(n);
    }
    return { tire, rim: merge([toAxle(lip), face, toAxle(hub), barrel].map(nonIdx)), cap, drum, nuts: merge(nuts.map(nonIdx)) };
  });
}

// ------------------------------------------------------------------ seats
function seatGeometry(kind: 'front' | 'rear') {
  return cached('seat' + kind, () => {
    const w = kind === 'front' ? 0.5 : 1.28;
    const cushion = new RoundedBoxGeometry(w, 0.13, 0.5, 4, 0.05);
    const cp = cushion.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i) / (w / 2), y = cp.getY(i), z = cp.getZ(i);
      if (y > 0.03) cp.setY(i, y - 0.02 * (1 - x * x) * (kind === 'front' ? 1 : 0.5) + (kind === 'front' ? Math.abs(x) ** 4 * 0.02 : 0));
      if (z > 0.2 && y > 0) cp.setY(i, cp.getY(i) + 0.01);
    }
    cushion.computeVertexNormals();
    cushion.rotateX(-0.06);
    cushion.translate(0, 0.07, 0.04);
    const back = new RoundedBoxGeometry(w, kind === 'front' ? 0.6 : 0.55, 0.13, 4, 0.05);
    const bp = back.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i) / (w / 2), z = bp.getZ(i);
      if (z > 0.02) bp.setZ(i, z - 0.02 * (1 - x * x) * (kind === 'front' ? 1 : 0.4) + (kind === 'front' ? Math.abs(x) ** 4 * 0.03 : 0));
    }
    back.computeVertexNormals();
    back.translate(0, kind === 'front' ? 0.3 : 0.27, 0);
    back.rotateX(kind === 'front' ? -0.22 : -0.3);
    back.translate(0, 0.1, -0.2);
    const parts = [cushion, back];
    const metal: THREE.BufferGeometry[] = [];
    if (kind === 'front') {
      const head = new RoundedBoxGeometry(0.27, 0.19, 0.09, 3, 0.04);
      head.translate(0, 0.76, -0.33);
      parts.push(head);
      for (const s of [-1, 1]) {
        const post = new THREE.CylinderGeometry(0.007, 0.007, 0.12, 6);
        post.translate(s * 0.08, 0.66, -0.315);
        metal.push(post);
        const rail = new THREE.BoxGeometry(0.03, 0.03, 0.5);
        rail.translate(s * 0.2, -0.02, 0.02);
        metal.push(rail);
      }
    }
    return { uph: merge(parts.map(nonIdx)), metal: metal.length ? merge(metal.map(nonIdx)) : null };
  });
}

// ------------------------------------------------------------------ engine bay parts
function engineGeometry() {
  return cached('engine', () => {
    const block: THREE.BufferGeometry[] = [], black: THREE.BufferGeometry[] = [], chrome: THREE.BufferGeometry[] = [], paint: THREE.BufferGeometry[] = [], rubber: THREE.BufferGeometry[] = [];
    const b = new RoundedBoxGeometry(0.34, 0.26, 0.52, 3, 0.03); b.translate(0, 0.13, 0); block.push(b);
    const pan = new RoundedBoxGeometry(0.3, 0.08, 0.48, 2, 0.02); pan.translate(0, -0.02, -0.01); black.push(pan);
    const head = new RoundedBoxGeometry(0.3, 0.08, 0.5, 2, 0.02); head.translate(0.02, 0.3, 0); block.push(head);
    const valve = new RoundedBoxGeometry(0.2, 0.06, 0.48, 3, 0.025); valve.translate(0.03, 0.37, 0); paint.push(valve);
    const oilCap = new THREE.CylinderGeometry(0.028, 0.028, 0.03, 16); oilCap.translate(0.03, 0.41, 0.12); black.push(oilCap);
    // air filter housing (big round pan) with wing nut
    const af = lathe([[0.001, 0.0], [0.15, 0.0], [0.16, 0.01], [0.16, 0.05], [0.15, 0.062], [0.03, 0.068], [0.001, 0.07]], 28); af.translate(-0.07, 0.38, -0.02); black.push(af);
    const wing = new THREE.BoxGeometry(0.07, 0.018, 0.012); wing.translate(-0.07, 0.458, -0.02); chrome.push(wing);
    const carb = new RoundedBoxGeometry(0.1, 0.07, 0.1, 2, 0.01); carb.translate(-0.07, 0.35, -0.02); block.push(carb);
    // exhaust manifold
    for (let i = 0; i < 4; i++) {
      const p = tube([new THREE.Vector3(-0.14, 0.28, -0.18 + i * 0.12), new THREE.Vector3(-0.21, 0.23, -0.15 + i * 0.1), new THREE.Vector3(-0.22, 0.08, -0.02)], () => 0.018, 8);
      block.push(p);
    }
    // alternator, fan, pulleys, belt
    const alt = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16); alt.rotateX(Math.PI / 2); alt.translate(0.2, 0.25, 0.2); block.push(alt);
    const pul = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20); pul.rotateX(Math.PI / 2); pul.translate(0, 0.08, 0.28); chrome.push(pul);
    const fanHub = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16); fanHub.rotateX(Math.PI / 2); fanHub.translate(0, 0.22, 0.3); black.push(fanHub);
    for (let i = 0; i < 4; i++) {
      const bl = new THREE.BoxGeometry(0.06, 0.16, 0.01); bl.translate(0, 0.1, 0); bl.rotateZ((i / 4) * Math.PI * 2 + 0.3); bl.rotateY(0.25 * 0); bl.translate(0, 0.22, 0.33); black.push(bl);
    }
    const belt = new THREE.TorusGeometry(0.1, 0.006, 4, 24); belt.scale(1, 1.3, 1); belt.translate(0.08, 0.17, 0.285); rubber.push(belt);
    // distributor + plug wires
    const dist = new THREE.CylinderGeometry(0.035, 0.03, 0.08, 12); dist.translate(0.15, 0.33, -0.2); black.push(dist);
    for (let i = 0; i < 4; i++) rubber.push(tube([new THREE.Vector3(0.15, 0.37, -0.2), new THREE.Vector3(0.17, 0.41, -0.1 + i * 0.05), new THREE.Vector3(0.12, 0.36, -0.18 + i * 0.12)], () => 0.005, 5));
    // dipstick
    const dip = new THREE.TorusGeometry(0.015, 0.004, 6, 12); dip.translate(-0.13, 0.36, 0.14); chrome.push(dip);
    return { block: merge(block.map(nonIdx)), black: merge(black.map(nonIdx)), chrome: merge(chrome.map(nonIdx)), paint: merge(paint.map(nonIdx)), rubber: merge(rubber.map(nonIdx)) };
  });
}
function radiatorGeometry() {
  return cached('radiator', () => {
    const core = new THREE.BoxGeometry(0.62, 0.32, 0.045);
    const uv = core.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 3);
    const tanks: THREE.BufferGeometry[] = [];
    const topT = new RoundedBoxGeometry(0.64, 0.06, 0.07, 2, 0.015); topT.translate(0, 0.19, 0); tanks.push(topT);
    const botT = new RoundedBoxGeometry(0.64, 0.05, 0.07, 2, 0.015); botT.translate(0, -0.185, 0); tanks.push(botT);
    const neck = new THREE.CylinderGeometry(0.02, 0.022, 0.035, 12); neck.translate(0.2, 0.235, 0); tanks.push(neck);
    const cap = new THREE.CylinderGeometry(0.03, 0.03, 0.015, 16); cap.translate(0.2, 0.258, 0);
    const hose = tube([new THREE.Vector3(-0.22, 0.2, -0.03), new THREE.Vector3(-0.2, 0.22, -0.15), new THREE.Vector3(-0.08, 0.14, -0.35)], () => 0.018, 8);
    return { core, tanks: merge(tanks.map(nonIdx)), cap, hose };
  });
}
function batteryGeometry() {
  return cached('battery', () => {
    const box = new RoundedBoxGeometry(0.24, 0.18, 0.17, 2, 0.01);
    box.translate(0, 0.09, 0);
    const lid = new RoundedBoxGeometry(0.245, 0.02, 0.175, 2, 0.006); lid.translate(0, 0.185, 0);
    const tp = new THREE.CylinderGeometry(0.012, 0.014, 0.025, 10); tp.translate(0.08, 0.205, 0.05);
    const tn = new THREE.CylinderGeometry(0.012, 0.014, 0.025, 10); tn.translate(-0.08, 0.205, 0.05);
    const handle = tube([new THREE.Vector3(-0.06, 0.195, -0.04), new THREE.Vector3(0, 0.235, -0.04), new THREE.Vector3(0.06, 0.195, -0.04)], () => 0.006, 5);
    return { box, lid: merge([lid, handle].map(nonIdx)), tp, tn };
  });
}

// ------------------------------------------------------------------ interior
export interface Gauges {
  speed: THREE.Object3D;
  fuel: THREE.Object3D;
  temp: THREE.Object3D;
  lights: { oil: THREE.MeshStandardMaterial; batt: THREE.MeshStandardMaterial; beam: THREE.MeshStandardMaterial; hand: THREE.MeshStandardMaterial };
  odo: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; last: number };
  faceMat: THREE.MeshStandardMaterial;
}

function clusterFaceTex() {
  return cached('clusterFace', () => {
    const [c, x] = canvas(1024, 384);
    x.fillStyle = '#0d0e10';
    x.fillRect(0, 0, 1024, 384);
    const cx = 512, cy = 350, R = 300;
    const a0 = Math.PI * 1.14, a1 = Math.PI * 1.86;
    x.strokeStyle = '#d8d4c8';
    x.fillStyle = '#e8e4d6';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (let v = 0; v <= 160; v += 5) {
      const a = a0 + (a1 - a0) * (v / 160);
      const major = v % 20 === 0;
      const r0 = R - (major ? 34 : v % 10 === 0 ? 24 : 14);
      x.lineWidth = major ? 5 : 2.5;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      x.stroke();
      if (major) {
        x.font = `600 38px ${FONT_COND}`;
        x.fillText(String(v), cx + Math.cos(a) * (R - 66), cy + Math.sin(a) * (R - 66));
      }
    }
    x.font = `500 22px ${FONT}`;
    x.fillStyle = '#b8b4a6';
    x.fillText('km/h', cx, cy - 150);
    // red zone arc
    x.strokeStyle = '#c03020';
    x.lineWidth = 8;
    x.beginPath();
    x.arc(cx, cy, R + 8, a0 + (a1 - a0) * (140 / 160), a1);
    x.stroke();
    // small gauges: fuel (left) and temp (right)
    const small = (gx: number, label: string, lo: string, hi: string, redLow: boolean) => {
      const gy = 300, r = 70;
      const b0 = Math.PI * 1.2, b1 = Math.PI * 1.8;
      x.strokeStyle = '#d8d4c8';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(gx, gy, r, b0, b1);
      x.stroke();
      for (let i = 0; i <= 4; i++) {
        const a = b0 + ((b1 - b0) * i) / 4;
        x.beginPath();
        x.moveTo(gx + Math.cos(a) * (r - 12), gy + Math.sin(a) * (r - 12));
        x.lineTo(gx + Math.cos(a) * r, gy + Math.sin(a) * r);
        x.stroke();
      }
      x.strokeStyle = '#c03020';
      x.lineWidth = 6;
      x.beginPath();
      if (redLow) x.arc(gx, gy, r + 4, b0, b0 + (b1 - b0) * 0.18);
      else x.arc(gx, gy, r + 4, b1 - (b1 - b0) * 0.18, b1);
      x.stroke();
      x.fillStyle = '#e8e4d6';
      x.font = `600 22px ${FONT_COND}`;
      x.fillText(lo, gx + Math.cos(b0) * (r + 22), gy + Math.sin(b0) * (r + 22));
      x.fillText(hi, gx + Math.cos(b1) * (r + 22), gy + Math.sin(b1) * (r + 22));
      x.font = `500 20px ${FONT}`;
      x.fillStyle = '#b8b4a6';
      x.fillText(label, gx, gy - 28);
    };
    small(120, 'TANK', 'E', 'F', true);
    small(904, 'TEMP', 'C', 'H', false);
    return toTex(c);
  });
}

function radioScaleTex() {
  return cached('radioScale', () => {
    const [c, x] = canvas(512, 96);
    const g = x.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#2a1a08');
    g.addColorStop(1, '#140c04');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 96);
    x.fillStyle = '#f0b040';
    x.strokeStyle = '#f0b040';
    x.textAlign = 'center';
    x.font = `600 20px ${FONT_COND}`;
    for (let f = 88; f <= 108; f += 1) {
      const px = 26 + ((f - 87.5) / 20.5) * 460;
      x.lineWidth = f % 2 === 0 ? 2.5 : 1.2;
      x.beginPath();
      x.moveTo(px, 56);
      x.lineTo(px, f % 2 === 0 ? 40 : 48);
      x.stroke();
      if (f % 4 === 0) x.fillText(String(f), px, 28);
    }
    x.font = `600 14px ${FONT}`;
    x.fillText('FM  MHz', 256, 82);
    return toTex(c);
  });
}

function odoCanvas() {
  const [c, ctx] = canvas(256, 48);
  const tex = toTex(c);
  return { canvas: c, ctx, tex, last: -1 };
}
export function drawOdo(o: Gauges['odo'], km: number) {
  const v = Math.floor(km * 10);
  if (v === o.last) return;
  o.last = v;
  const x = o.ctx;
  x.fillStyle = '#060606';
  x.fillRect(0, 0, 256, 48);
  const s = String(Math.floor(km) % 100000).padStart(5, '0');
  x.font = `600 34px ${FONT_COND}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    x.fillStyle = '#1a1a1a';
    x.fillRect(8 + i * 40, 4, 36, 40);
    x.fillStyle = '#e8e4d6';
    x.fillText(s[i], 26 + i * 40, 26);
  }
  x.fillStyle = '#e8e4d6';
  x.fillRect(208, 4, 36, 40);
  x.fillStyle = '#111';
  x.fillText(String(v % 10), 226, 26);
  o.tex.needsUpdate = true;
}

function dashProfile(): THREE.Shape {
  // side profile in (z, y); extruded across the car
  const s = new THREE.Shape();
  s.moveTo(0.66, 0.9);
  s.bezierCurveTo(0.56, 0.925, 0.44, 0.93, 0.36, 0.905);
  s.bezierCurveTo(0.32, 0.895, 0.3, 0.88, 0.305, 0.85);
  s.lineTo(0.33, 0.66);
  s.bezierCurveTo(0.34, 0.6, 0.38, 0.56, 0.44, 0.55);
  s.lineTo(0.66, 0.53);
  s.lineTo(0.66, 0.9);
  return s;
}

// ------------------------------------------------------------------ assembly
export interface CarVisual {
  root: THREE.Group;
  body: THREE.Group;
  paint: THREE.MeshPhysicalMaterial;
  parts: Partial<Record<SlotId, PartVisual>>;
  steering: THREE.Object3D;
  gauges: Gauges;
  lamps: { tail: THREE.MeshStandardMaterial; brake: THREE.MeshStandardMaterial; reverse: THREE.MeshStandardMaterial; indicator: THREE.MeshStandardMaterial; dash: THREE.MeshStandardMaterial; dome: THREE.MeshStandardMaterial };
  rearMirror: THREE.Mesh;
  radio: { needle: THREE.Object3D; knobL: THREE.Object3D; knobR: THREE.Object3D; scaleMat: THREE.MeshStandardMaterial; body: THREE.Object3D };
  key: THREE.Object3D;
  gearLever: THREE.Object3D;
  handbrake: THREE.Object3D;
  glovebox: THREE.Object3D;
  fuelCap: THREE.Object3D;
  interiorGroup: THREE.Group;
  wipers: THREE.Object3D[];
  freshener: THREE.Object3D;
  look: CarLook;
}

export interface CarMats {
  paint: THREE.MeshPhysicalMaterial;
  interior: THREE.MeshStandardMaterial;
  seat: THREE.MeshStandardMaterial;
  dash: THREE.MeshStandardMaterial;
  headliner: THREE.MeshStandardMaterial;
}

export function randomLook(seed: number): CarLook {
  const r = new RNG(seed);
  const paints = ['#c8561e', '#d06a24', '#8fb3b0', '#e2d8bf', '#5c7a4a', '#a8392c', '#3e5f8a', '#d9c36a', '#7a8c92', '#f0ece0', '#6a4a38'];
  const seats = ['#4a2a1a', '#2a2a2c', '#6a3024', '#8a7456', '#2e3a4a'];
  const letters = 'ABEKMHOPCTYX';
  const plate = `${letters[r.int(0, 11)]} ${r.int(1000, 9999)} ${letters[r.int(0, 11)]}${letters[r.int(0, 11)]}`;
  return { paint: r.pick(paints), rust: r.range(0.1, 0.45), dust: r.range(0.2, 0.6), seat: r.pick(seats), interior: r.pick(['#c9b89a', '#3a3632', '#9a8a70']), plate, seed };
}

export function buildPartVisual(slot: SlotId, mats: Materials, look: CarLook): PartVisual {
  const pivot = SLOT_POS[slot];
  const root = new THREE.Group();
  root.name = slot;
  const addLocal = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
    const o = mesh(g, m, shadow);
    o.position.set(-pivot.x, -pivot.y, -pivot.z);
    root.add(o);
    return o;
  };
  const res: PartVisual = { root, size: new THREE.Vector3(), center: new THREE.Vector3() };
  if (slot.startsWith('door')) {
    const d = DOORS.find((q) => q.slot === slot)!;
    const g = doorGeometry(d);
    const paint = makePaint(mats, look.paint, look.rust, look.dust);
    res.paint = paint;
    addLocal(g.skin.outer, paint);
    addLocal(g.skin.edge!, paint);
    addLocal(g.skin.inner!, mats.vinyl(look.interior, 0.7));
    addLocal(g.inner, mats.vinyl(look.interior, 0.6));
    addLocal(g.chromeIn, mats.chrome, false);
    addLocal(g.frame, mats.chrome);
    const glass = addLocal(g.glass, mats.glass, false);
    res.glass = [glass];
    if (!d.rear) {
      const sm = sideMirrorGeometry(d.side);
      const mp = lowPoint(d.z1 - 0.1, 0.8, d.side, new THREE.Vector3());
      const body = mesh(sm.body, mats.chrome);
      body.position.set(mp.x - pivot.x, mp.y - pivot.y + 0.01, mp.z - pivot.z);
      root.add(body);
      const mg = mesh(sm.glass, new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 1, roughness: 0.05 }), false);
      mg.position.copy(body.position);
      root.add(mg);
      res.mirror = mg;
    }
    res.hinge = { axis: new THREE.Vector3(0, 1, 0), open: d.side > 0 ? -1.2 : 1.2 };
  } else if (slot === 'hood') {
    const g = hoodGeometry();
    const paint = makePaint(mats, look.paint, look.rust, look.dust);
    res.paint = paint;
    addLocal(g.outer, paint);
    addLocal(g.inner, paint);
    res.hinge = { axis: new THREE.Vector3(1, 0, 0), open: -1.05 };
  } else if (slot === 'trunk') {
    const g = trunkGeometry();
    const paint = makePaint(mats, look.paint, look.rust, look.dust);
    res.paint = paint;
    addLocal(g.outer, paint);
    addLocal(g.inner, paint);
    addLocal(g.lock, mats.chrome, false);
    res.hinge = { axis: new THREE.Vector3(1, 0, 0), open: 1.2 };
  } else if (slot.startsWith('wheel')) {
    const g = wheelGeometry();
    const w = new THREE.Group();
    w.add(mesh(g.tire, mats.tire), mesh(g.rim, mats.painted('#9a9a96', 0.35, 0.45, true)), mesh(g.cap, mats.chrome), mesh(g.nuts, mats.chrome, false), mesh(g.drum, mats.rust, false));
    // right side wheels face outward on -x
    if (slot.endsWith('r')) w.rotation.y = Math.PI;
    root.add(w);
    root.userData.spin = w;
  } else if (slot === 'engine') {
    const g = engineGeometry();
    root.add(mesh(g.block, mats.painted('#4a5256', 0.25, 0.6)), mesh(g.black, mats.plasticBlack), mesh(g.chrome, mats.chrome), mesh(g.paint, mats.painted('#8a2a1e', 0.2, 0.45)), mesh(g.rubber, mats.rubber, false));
  } else if (slot === 'radiator') {
    const g = radiatorGeometry();
    const fins = new THREE.MeshStandardMaterial({ map: mats.tex.metalDark, normalMap: mats.tex.corrugatedNormal, color: 0x6a5a48, roughness: 0.7, metalness: 0.6 });
    root.add(mesh(g.core, fins), mesh(g.tanks, mats.painted('#2a2a2a', 0.4, 0.6)), mesh(g.cap, mats.metalBare), mesh(g.hose, mats.rubber, false));
  } else if (slot === 'battery') {
    const g = batteryGeometry();
    root.add(mesh(g.box, mats.flat('#20252a', 0.5)), mesh(g.lid, mats.flat('#1a1a1a', 0.6)), mesh(g.tp, mats.flat('#b02a20', 0.5)), mesh(g.tn, mats.flat('#222', 0.5)));
  } else if (slot === 'headlight_l' || slot === 'headlight_r') {
    const g = headlightGeometry();
    const lens = lampMat('#fff4e0', '#8a9498');
    res.lamp = lens;
    root.add(mesh(g.bezel, mats.chrome), mesh(g.refl, mats.chrome, false), mesh(g.lens, lens, false), mesh(g.bulb, mats.emissive('#fff0d0', 0.5), false));
  } else if (slot === 'bumper_f' || slot === 'bumper_r') {
    const g = bumperGeometry(slot === 'bumper_f');
    root.add(mesh(g.bar, mats.chrome), mesh(g.strip, mats.rubber), mesh(g.brackets, mats.metalDark));
  } else if (slot.startsWith('seat')) {
    const g = seatGeometry(slot === 'seat_r' ? 'rear' : 'front');
    root.add(mesh(g.uph, mats.vinyl(look.seat, 0.62)));
    if (g.metal) root.add(mesh(g.metal, mats.metalDark));
  }
  const box = new THREE.Box3().setFromObject(root);
  box.getSize(res.size);
  box.getCenter(res.center);
  return res;
}

/** Build the full car visual. Parts listed in `without` are not attached. */
export function buildCar(mats: Materials, look: CarLook, without: SlotId[] = []): CarVisual {
  const root = new THREE.Group();
  root.name = 'car';
  const body = new THREE.Group();
  root.add(body);
  const paint = makePaint(mats, look.paint, look.rust, look.dust);
  const shell = buildShellGeometry();
  body.add(mesh(shell.paint, paint), mesh(shell.under, mats.painted('#2a2622', 0.7, 0.9)), mesh(shell.dark, new THREE.MeshStandardMaterial({ color: 0x151414, roughness: 0.95, side: THREE.DoubleSide }), false));
  body.add(mesh(buildGlassGeometry(), mats.glass, false));
  body.add(mesh(buildTrimGeometry(), mats.chrome, false));
  const gr = grilleGeometry();
  body.add(mesh(gr.back, mats.black, false), mesh(gr.bars, mats.chrome, false), mesh(gr.frame, mats.chrome, false));
  const indicator = lampMat('#ff9a20', '#e8a040');
  body.add(mesh(gr.indicators, indicator, false));
  const tl = taillightGeometry();
  const tail = lampMat('#ff2010', '#a01810');
  const brake = tail;
  const reverse = lampMat('#ffffff', '#e0e0e0');
  body.add(mesh(tl.red, tail, false), mesh(tl.amber, indicator, false), mesh(tl.white, reverse, false), mesh(tl.chrome, mats.chrome, false));
  // license plates
  const pm = new THREE.MeshStandardMaterial({ map: plateTex(look.plate), roughness: 0.5, metalness: 0.3 });
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.1), pm);
  pf.position.set(0, 0.47, C.zF + 0.075);
  const pb = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.1), pm);
  pb.position.set(0, 0.56, C.zR - 0.012);
  pb.rotation.y = Math.PI;
  body.add(pf, pb);

  // fuel filler cap (right rear quarter) — pivot object for interaction/animation
  const fuelCap = new THREE.Group();
  const fcp = lowPoint(-1.58, 0.62, -1, new THREE.Vector3());
  fuelCap.position.copy(fcp).add(new THREE.Vector3(-0.006, 0, 0));
  const capMesh = mesh(new THREE.CylinderGeometry(0.038, 0.04, 0.018, 20), mats.chrome, false);
  capMesh.rotation.z = Math.PI / 2;
  fuelCap.add(capMesh);
  body.add(fuelCap);

  // wipers
  const wipers: THREE.Object3D[] = [];
  for (const x of [0.28, -0.22]) {
    const w = new THREE.Group();
    const arm = mesh(new THREE.BoxGeometry(0.012, 0.008, 0.42), mats.black, false);
    arm.position.set(0, 0.004, 0.0);
    arm.rotation.y = 0;
    const blade = mesh(new THREE.BoxGeometry(0.006, 0.014, 0.4), mats.rubber, false);
    blade.position.set(0.01, 0.01, 0);
    const inner = new THREE.Group();
    inner.add(arm, blade);
    inner.position.z = -0.2;
    w.add(inner);
    w.position.set(x, 0.925, C.zWS0 + 0.03);
    w.rotation.set(-0.62, Math.PI / 2 - 0.08, 0, 'YXZ');
    body.add(w);
    wipers.push(w);
  }
  // antenna
  const ant = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.8, 5), mats.chrome, false);
  ant.position.set(-0.7, 0.93 + 0.4, 1.1);
  ant.rotation.x = -0.12;
  body.add(ant);

  // ------------------------------------------------ interior
  const interior = new THREE.Group();
  interior.name = 'interior';
  root.add(interior);
  const intMat = mats.vinyl(look.interior, 0.7);
  const dashTop = mats.vinyl('#1e1d1c', 0.65);
  const dashFace = mats.vinyl(look.interior === '#3a3632' ? '#2a2826' : '#c9b89a', 0.55);
  const dashGeo = cached('dash', () => {
    const g = extrude(dashProfile(), 1.44, 0.012, 2, 16);
    g.rotateY(-Math.PI / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 6);
    return g;
  });
  const dash = mesh(dashGeo, dashTop);
  interior.add(dash);
  // face panel (wood/vinyl insert) across the passenger side + glovebox
  const facePanel = mesh(new RoundedBoxGeometry(0.7, 0.13, 0.02, 2, 0.008), dashFace);
  facePanel.position.set(-0.3, 0.78, 0.318);
  facePanel.rotation.x = -0.12;
  interior.add(facePanel);
  const glovebox = new THREE.Group();
  const gbLid = mesh(new RoundedBoxGeometry(0.34, 0.12, 0.02, 2, 0.006), dashTop);
  gbLid.position.set(0, 0.06, 0);
  const gbHandle = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), mats.chrome, false);
  gbHandle.position.set(0, 0.1, 0.012);
  glovebox.add(gbLid, gbHandle);
  glovebox.position.set(-0.36, 0.64, 0.338);
  glovebox.rotation.x = -0.12;
  interior.add(glovebox);
  // instrument cluster
  const clusterX = 0.36;
  const cluster = new THREE.Group();
  cluster.position.set(clusterX, 0.79, 0.3);
  cluster.rotation.set(-0.3, Math.PI, 0, 'YXZ');
  interior.add(cluster);
  const hoodG = cached('clusterHood', () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.2, Math.PI * 0.04, Math.PI * 0.96, false);
    s.absarc(0, 0, 0.185, Math.PI * 0.96, Math.PI * 0.04, true);
    const g = extrude(s, 0.1, 0.005, 2, 24);
    g.scale(1.0, 0.42, 1);
    return g;
  });
  const chood = mesh(hoodG, dashTop);
  chood.position.set(0, -0.035, 0.03);
  cluster.add(chood);
  const faceMat = new THREE.MeshStandardMaterial({ map: clusterFaceTex(), roughness: 0.4, emissive: 0xffffff, emissiveMap: clusterFaceTex(), emissiveIntensity: 0.0 });
  const face = mesh(new THREE.PlaneGeometry(0.4, 0.15), faceMat, false);
  face.position.set(0, 0.03, 0.02);
  cluster.add(face);
  const glassC = mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false }), false);
  glassC.position.set(0, 0.03, 0.035);
  cluster.add(glassC);
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xff3a1a, emissive: 0xff3a1a, emissiveIntensity: 0.3, roughness: 0.4 });
  const mkNeedle = (len: number, x: number, y: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0.024);
    const n = mesh(new THREE.BoxGeometry(0.003, len, 0.002), needleMat, false);
    n.position.y = len / 2;
    pivot.add(n);
    const hub = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), mats.black, false);
    hub.rotation.x = Math.PI / 2;
    pivot.add(hub);
    cluster.add(pivot);
    return pivot;
  };
  // face uv: 0.4 x 0.15 -> canvas 1024x384; speedo centre at canvas (512, 350)
  const speed = mkNeedle(0.108, 0, 0.03 - 0.075 + (1 - 350 / 384) * 0.15);
  const fuel = mkNeedle(0.03, -0.2 + (120 / 1024) * 0.4, 0.03 - 0.075 + (1 - 300 / 384) * 0.15);
  const temp = mkNeedle(0.03, -0.2 + (904 / 1024) * 0.4, 0.03 - 0.075 + (1 - 300 / 384) * 0.15);
  const odo = odoCanvas();
  drawOdo(odo, 0);
  const odoMesh = mesh(new THREE.PlaneGeometry(0.075, 0.014), new THREE.MeshStandardMaterial({ map: odo.tex, emissive: 0xffffff, emissiveMap: odo.tex, emissiveIntensity: 0.0, roughness: 0.5 }), false);
  odoMesh.position.set(0, -0.005, 0.022);
  cluster.add(odoMesh);
  const wl = (color: string, x: number) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 0, roughness: 0.3 });
    const o = mesh(new THREE.CircleGeometry(0.006, 10), m, false);
    o.position.set(x, -0.03, 0.023);
    cluster.add(o);
    return m;
  };
  const gauges: Gauges = {
    speed, fuel, temp, odo, faceMat,
    lights: { oil: wl('#ff3020', -0.05), batt: wl('#ff3020', -0.025), beam: wl('#2a6aff', 0.025), hand: wl('#ff3020', 0.05) },
  };
  // steering column + wheel
  const steering = new THREE.Group();
  steering.position.set(clusterX, 0.78, 0.2);
  steering.rotation.x = -0.42;
  const colG = new THREE.CylinderGeometry(0.035, 0.04, 0.38, 12);
  colG.rotateX(Math.PI / 2);
  const column = mesh(colG, dashTop);
  column.position.set(clusterX, 0.75, 0.33);
  column.rotation.x = -0.42;
  interior.add(column);
  const wheelG = cached('steerWheel', () => {
    const rim = new THREE.TorusGeometry(0.19, 0.013, 10, 48);
    const spokes: THREE.BufferGeometry[] = [rim];
    for (const a of [-0.35, Math.PI + 0.35]) {
      const sp = new THREE.BoxGeometry(0.18, 0.024, 0.012);
      sp.translate(0.09, 0, 0);
      sp.rotateZ(a);
      spokes.push(sp);
    }
    const hub = new THREE.CylinderGeometry(0.05, 0.055, 0.04, 20);
    hub.rotateX(Math.PI / 2);
    hub.translate(0, 0, 0.01);
    spokes.push(hub);
    return merge(spokes.map(nonIdx));
  });
  const sw = mesh(wheelG, mats.vinyl('#141414', 0.5));
  steering.add(sw);
  const horn = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), mats.chrome, false);
  horn.rotation.x = Math.PI / 2;
  horn.position.z = -0.03;
  steering.add(horn);
  interior.add(steering);
  // ignition key
  const key = new THREE.Group();
  key.position.set(clusterX - 0.07, 0.69, 0.3);
  key.rotation.x = -0.42;
  const kb = mesh(new THREE.BoxGeometry(0.02, 0.028, 0.004), mats.chrome, false);
  kb.position.z = 0.03;
  const kr = mesh(new THREE.TorusGeometry(0.01, 0.002, 6, 12), mats.chrome, false);
  kr.position.set(0, 0.022, 0.03);
  key.add(kb, kr);
  interior.add(key);
  // radio
  const radio = new THREE.Group();
  radio.position.set(0.0, 0.73, 0.305);
  radio.rotation.set(-0.12, Math.PI, 0, 'YXZ');
  const rbody = mesh(new RoundedBoxGeometry(0.19, 0.055, 0.05, 2, 0.006), mats.metalBare);
  const scaleMat = new THREE.MeshStandardMaterial({ map: radioScaleTex(), emissive: 0xffffff, emissiveMap: radioScaleTex(), emissiveIntensity: 0, roughness: 0.3 });
  const rscale = mesh(new THREE.PlaneGeometry(0.12, 0.024), scaleMat, false);
  rscale.position.set(0, 0.006, 0.026);
  const rneedle = new THREE.Group();
  const rn = mesh(new THREE.BoxGeometry(0.0015, 0.02, 0.001), needleMat, false);
  rneedle.add(rn);
  rneedle.position.set(0, 0.006, 0.027);
  const knobG = new THREE.CylinderGeometry(0.011, 0.012, 0.014, 16);
  knobG.rotateX(Math.PI / 2);
  const knobL = mesh(knobG, mats.plasticBlack, false);
  knobL.position.set(-0.078, -0.004, 0.03);
  const knobR = mesh(knobG, mats.plasticBlack, false);
  knobR.position.set(0.078, -0.004, 0.03);
  radio.add(rbody, rscale, rneedle, knobL, knobR);
  interior.add(radio);
  // center console & heater controls
  const console_ = mesh(new RoundedBoxGeometry(0.22, 0.26, 0.2, 2, 0.02), dashTop);
  console_.position.set(0, 0.55, 0.45);
  interior.add(console_);
  // floor, tunnel, firewall, parcel shelf, trunk floor
  const carpet = mats.carpet;
  const floor = mesh(new THREE.BoxGeometry(1.46, 0.02, 1.9), carpet);
  floor.position.set(0, 0.27, -0.33);
  const tunnelG = new THREE.CylinderGeometry(0.11, 0.11, 1.7, 12, 1, false, -Math.PI / 2, Math.PI);
  tunnelG.rotateX(Math.PI / 2);
  const tunnel = mesh(tunnelG, carpet);
  tunnel.position.set(0, 0.28, -0.25);
  const firewall = mesh(new THREE.BoxGeometry(1.5, 0.62, 0.02), mats.painted('#2a2724', 0.3, 0.8));
  firewall.position.set(0, 0.6, 0.68);
  const parcel = mesh(new THREE.BoxGeometry(1.5, 0.02, 0.3), mats.vinyl('#2a2826', 0.8));
  parcel.position.set(0, 0.935, -1.16);
  const bulk = mesh(new THREE.BoxGeometry(1.5, 0.5, 0.02), mats.painted('#2a2724', 0.3, 0.8));
  bulk.position.set(0, 0.68, -1.3);
  const trunkFloor = mesh(new THREE.BoxGeometry(1.44, 0.02, 0.7), mats.carpet);
  trunkFloor.position.set(0, 0.44, -1.66);
  const bayFloor = mesh(new THREE.BoxGeometry(1.3, 0.02, 1.3), mats.painted('#1e1c1a', 0.5, 0.9));
  bayFloor.position.set(0, 0.3, 1.33);
  interior.add(floor, tunnel, firewall, parcel, bulk, trunkFloor, bayFloor);
  // inner fender aprons in the engine bay
  for (const s of [-1, 1]) {
    const ap = mesh(new THREE.BoxGeometry(0.02, 0.36, 1.2), mats.painted('#2a2724', 0.4, 0.8));
    ap.position.set(s * 0.63, 0.66, 1.3);
    interior.add(ap);
  }
  // headliner
  const hl = cached('headliner', () => merge([1, -1].map((side) => nonIdx(surfPatch(ghPoint, C.zRW1 - 0.08, C.zWS1 + 0.04, 0.5, 1.0, { side, nz: 16, nv: 10, offset: -0.016 }).outer))));
  const headliner = mesh(hl, new THREE.MeshStandardMaterial({ color: new THREE.Color(look.interior).lerp(new THREE.Color('#d8d0c0'), 0.6), map: mats.tex.fabric, roughness: 1, side: THREE.BackSide }), false);
  interior.add(headliner);
  // pedals
  for (const [x, h] of [[0.46, 0.08], [0.36, 0.08], [0.26, 0.06]] as [number, number][]) {
    const p = mesh(new RoundedBoxGeometry(0.07, h, 0.012, 1, 0.004), mats.rubber, false);
    p.position.set(x, 0.38, 0.55);
    p.rotation.x = -0.5;
    interior.add(p);
  }
  // gear lever & handbrake
  const gearLever = new THREE.Group();
  gearLever.position.set(0, 0.36, 0.2);
  const gl = mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.36, 8), mats.chrome, false);
  gl.position.y = 0.18;
  const knob = mesh(new THREE.SphereGeometry(0.024, 14, 10), mats.plasticBlack, false);
  knob.position.y = 0.37;
  const boot = mesh(new THREE.ConeGeometry(0.05, 0.08, 12), mats.rubber, false);
  boot.position.y = 0.03;
  gearLever.add(gl, knob, boot);
  gearLever.rotation.x = -0.15;
  interior.add(gearLever);
  const handbrake = new THREE.Group();
  handbrake.position.set(0, 0.4, -0.2);
  const hb = mesh(new RoundedBoxGeometry(0.035, 0.03, 0.26, 2, 0.01), mats.plasticBlack, false);
  hb.position.set(0, 0.0, 0.12);
  handbrake.add(hb);
  interior.add(handbrake);
  // rear-view mirror
  const rmG = new RoundedBoxGeometry(0.24, 0.07, 0.02, 3, 0.012);
  const rmBody = mesh(rmG, mats.plasticBlack, false);
  rmBody.position.set(0, 1.28, 0.19);
  rmBody.rotation.x = 0.12;
  const rearMirror = mesh(new THREE.PlaneGeometry(0.22, 0.056), new THREE.MeshBasicMaterial({ color: 0x777777 }), false);
  rearMirror.position.set(0, 1.28, 0.179);
  rearMirror.rotation.set(0.12, Math.PI, 0);
  const rmStem = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), mats.chrome, false);
  rmStem.position.set(0, 1.335, 0.2);
  interior.add(rmBody, rearMirror, rmStem);
  // air freshener hanging under the mirror (pendulum)
  const freshener = new THREE.Group();
  freshener.position.set(0.05, 1.25, 0.18);
  const string = mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.09, 3), mats.flat('#eee', 0.9), false);
  string.position.y = -0.045;
  const tree = mesh(new THREE.ConeGeometry(0.022, 0.055, 3), mats.flat('#2f8a3a', 0.8), false);
  tree.position.y = -0.11;
  tree.scale.z = 0.12;
  freshener.add(string, tree);
  interior.add(freshener);
  // sun visors
  for (const s of [1, -1]) {
    const v = mesh(new RoundedBoxGeometry(0.38, 0.15, 0.015, 2, 0.006), mats.vinyl(look.interior, 0.9), false);
    v.position.set(s * 0.35, 1.335, 0.02);
    v.rotation.x = 0.08;
    interior.add(v);
  }
  // dome light
  const dome = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0xfff2d8, emissiveIntensity: 0, roughness: 0.3 });
  const domeM = mesh(new RoundedBoxGeometry(0.12, 0.02, 0.07, 2, 0.008), dome, false);
  domeM.position.set(0, 1.355, -0.4);
  interior.add(domeM);

  // ------------------------------------------------ removable parts
  const parts: Partial<Record<SlotId, PartVisual>> = {};
  for (const slot of ALL_SLOTS) {
    if (without.includes(slot)) continue;
    const pv = buildPartVisual(slot, mats, look);
    pv.root.position.copy(SLOT_POS[slot]);
    root.add(pv.root);
    parts[slot] = pv;
  }
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  return {
    root, body, paint, parts, steering, gauges,
    lamps: { tail, brake, reverse, indicator, dash: dashMat, dome },
    rearMirror,
    radio: { needle: rneedle, knobL, knobR, scaleMat, body: radio },
    key, gearLever, handbrake, glovebox, fuelCap, interiorGroup: interior, wipers, freshener, look,
  };
}
