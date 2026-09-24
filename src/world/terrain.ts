import * as THREE from 'three';
import { WorldFn } from './worldfn';
import { TexSet } from '../gfx/textures';

export const LEAF_SIZE = 64;
export const LEVELS = 6; // 64 .. 2048
export const ROOT_SIZE = LEAF_SIZE * (1 << (LEVELS - 1));
const N = 32; // cells per node side
const SPLIT_K = 1.75;

/** Shared uniforms used by every ground-like shader. */
export const WORLD_UNIFORMS = {
  uOriginMod: { value: new THREE.Vector2() },
  uWindDir: { value: new THREE.Vector2(0.94, 0.34) },
  uTime: { value: 0 },
};

export const TERRAIN_PARS = /* glsl */ `
uniform sampler2D uSandA;
uniform sampler2D uSandN;
uniform sampler2D uSandMacro;
uniform vec2 uWindDir;
varying vec3 vTPos;
varying vec3 vTNrm;
vec3 sandAlbedo(vec2 wp, float dist, vec3 nW){
  vec4 mac = texture2D(uSandMacro, wp / 1024.0);
  vec4 mac2 = texture2D(uSandMacro, wp / 173.0 + vec2(0.37, 0.61));
  vec3 d1 = texture2D(uSandA, wp / 5.0).rgb;
  vec3 d2 = texture2D(uSandA, wp / 29.0 + 0.5).rgb;
  float farT = smoothstep(12.0, 140.0, dist);
  vec3 c = mix(d1, (d1 + d2) * 0.5, 0.3 + 0.45 * farT);
  c *= mix(vec3(1.0), vec3(1.07, 0.92, 0.82), smoothstep(0.35, 0.75, mac.r) * 0.85);
  c *= mix(vec3(1.0), vec3(1.03, 1.02, 0.99), smoothstep(0.5, 0.8, mac.g) * 0.7);
  c *= mix(vec3(1.0), vec3(0.84, 0.78, 0.72), smoothstep(0.58, 0.86, mac2.b) * 0.45);
  c *= 0.93 + 0.14 * mac2.a;
  float slope = 1.0 - nW.y;
  c *= 1.0 - smoothstep(0.08, 0.45, slope) * 0.1;
  return c;
}
vec3 sandNormalW(vec2 wp, float dist, vec3 nW){
  float fade = 1.0 - smoothstep(20.0, 120.0, dist);
  vec2 a = uWindDir;
  vec2 b = vec2(a.x * 0.95 - a.y * 0.31, a.x * 0.31 + a.y * 0.95);
  vec4 mac = texture2D(uSandMacro, wp / 1024.0 + vec2(0.13, 0.71));
  vec2 uv1 = vec2(dot(wp, a), dot(wp, vec2(-a.y, a.x))) / 3.4;
  vec2 uv2 = vec2(dot(wp, b), dot(wp, vec2(-b.y, b.x))) / 10.5;
  vec3 n1 = texture2D(uSandN, uv1).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uSandN, uv2).xyz * 2.0 - 1.0;
  float ripAmt = 0.35 + 0.65 * smoothstep(0.3, 0.7, mac.b);
  vec3 Tu1 = vec3(a.x, 0.0, a.y), Tv1 = vec3(-a.y, 0.0, a.x);
  vec3 Tu2 = vec3(b.x, 0.0, b.y), Tv2 = vec3(-b.y, 0.0, b.x);
  vec3 p = (Tu1 * n1.x + Tv1 * n1.y) * fade * ripAmt + (Tu2 * n2.x + Tv2 * n2.y) * (0.35 + 0.4 * fade);
  p -= nW * dot(p, nW);
  return normalize(nW + p * 0.9);
}
`;

export function makeTerrainMaterial(tex: TexSet): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSandA = { value: tex.sandAlbedo };
    shader.uniforms.uSandN = { value: tex.sandNormal };
    shader.uniforms.uSandMacro = { value: tex.sandMacro };
    shader.uniforms.uOriginMod = WORLD_UNIFORMS.uOriginMod;
    shader.uniforms.uWindDir = WORLD_UNIFORMS.uWindDir;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTPos;\nvarying vec3 vTNrm;\nuniform vec2 uOriginMod;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n vec4 tWorld = modelMatrix * vec4(transformed, 1.0);\n vTPos = tWorld.xyz + vec3(uOriginMod.x, 0.0, uOriginMod.y);\n vTNrm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + TERRAIN_PARS)
      .replace(
        '#include <map_fragment>',
        'float tDist = length(vViewPosition);\n vec3 tNW = normalize(vTNrm);\n diffuseColor.rgb *= sandAlbedo(vTPos.xz, tDist, tNW);',
      )
      .replace(
        '#include <normal_fragment_maps>',
        'vec3 tN = sandNormalW(vTPos.xz, tDist, tNW);\n normal = normalize((viewMatrix * vec4(tN, 0.0)).xyz);',
      );
  };
  return mat;
}

interface NodeEntry {
  mesh: THREE.Mesh;
  x0: number;
  z0: number;
  size: number;
  lastUsed: number;
  minY: number;
  maxY: number;
}

let sharedIndex: THREE.BufferAttribute | null = null;
function getIndex(): THREE.BufferAttribute {
  if (sharedIndex) return sharedIndex;
  const V = N + 1;
  const idx: number[] = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  // skirts: vertices after the grid, one per edge vertex, in order: bottom(z0), top(z1), left(x0), right(x1)
  const base = V * V;
  const edge = (k: number, e: number) => base + e * V + k;
  for (let k = 0; k < N; k++) {
    // z = z0 edge (outward -z)
    const e0 = k, e1 = k + 1;
    idx.push(e0, e1, edge(k, 0), e1, edge(k + 1, 0), edge(k, 0));
    // z = z1 edge (outward +z)
    const t0 = N * V + k, t1 = t0 + 1;
    idx.push(t0, edge(k, 1), t1, t1, edge(k, 1), edge(k + 1, 1));
    // x = x0 edge (outward -x)
    const l0 = k * V, l1 = (k + 1) * V;
    idx.push(l0, edge(k, 2), l1, l1, edge(k, 2), edge(k + 1, 2));
    // x = x1 edge (outward +x)
    const r0 = k * V + N, r1 = (k + 1) * V + N;
    idx.push(r0, r1, edge(k, 3), r1, edge(k + 1, 3), edge(k, 3));
  }
  sharedIndex = new THREE.BufferAttribute(new Uint16Array(idx), 1);
  return sharedIndex;
}

/** Build the geometry of one quadtree node. Positions are relative to the node corner. */
export function buildNodeGeometry(fn: WorldFn, x0: number, z0: number, size: number): { geo: THREE.BufferGeometry; minY: number; maxY: number } {
  const V = N + 1, S = N + 3;
  const step = size / N;
  const H = new Float32Array(S * S);
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) H[j * S + i] = fn.height(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const total = V * V + 4 * V;
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let j = 0; j < V; j++)
    for (let i = 0; i < V; i++) {
      const h = H[(j + 1) * S + (i + 1)];
      const o = (j * V + i) * 3;
      pos[o] = i * step;
      pos[o + 1] = h;
      pos[o + 2] = j * step;
      const hx = H[(j + 1) * S + i + 2] - H[(j + 1) * S + i];
      const hz = H[(j + 2) * S + i + 1] - H[j * S + i + 1];
      let nx = -hx, ny = 2 * step, nz = -hz;
      const l = Math.hypot(nx, ny, nz);
      nrm[o] = nx / l; nrm[o + 1] = ny / l; nrm[o + 2] = nz / l;
      if (h < minY) minY = h;
      if (h > maxY) maxY = h;
    }
  const drop = step * 1.5 + 1.5;
  const base = V * V;
  const edgeSrc = (e: number, k: number) => (e === 0 ? k : e === 1 ? N * V + k : e === 2 ? k * V : k * V + N);
  for (let e = 0; e < 4; e++)
    for (let k = 0; k < V; k++) {
      const s = edgeSrc(e, k) * 3, d = (base + e * V + k) * 3;
      pos[d] = pos[s]; pos[d + 1] = pos[s + 1] - drop; pos[d + 2] = pos[s + 2];
      nrm[d] = nrm[s]; nrm[d + 1] = nrm[s + 1]; nrm[d + 2] = nrm[s + 2];
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setIndex(getIndex());
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(0, minY - drop, 0), new THREE.Vector3(size, maxY, size));
  geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
  return { geo, minY, maxY };
}

export class Terrain {
  group = new THREE.Group();
  private cache = new Map<string, NodeEntry>();
  private pending = new Map<string, { level: number; ix: number; iz: number; prio: number }>();
  private frame = 0;
  private visibleKeys = new Set<string>();
  viewRadius = 4200;
  maxCache = 700;
  originX = 0;
  originZ = 0;

  constructor(private fn: WorldFn, public material: THREE.Material) {
    this.group.name = 'terrain';
  }

  private key(level: number, ix: number, iz: number) {
    return level + ':' + ix + ':' + iz;
  }
  private sizeOf(level: number) {
    return LEAF_SIZE * (1 << level);
  }

  private build(level: number, ix: number, iz: number): NodeEntry {
    const size = this.sizeOf(level);
    const x0 = ix * size, z0 = iz * size;
    const { geo, minY, maxY } = buildNodeGeometry(this.fn, x0, z0, size);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.position.set(x0 - this.originX, 0, z0 - this.originZ);
    mesh.updateMatrix();
    mesh.visible = false;
    this.group.add(mesh);
    const e: NodeEntry = { mesh, x0, z0, size, lastUsed: this.frame, minY, maxY };
    this.cache.set(this.key(level, ix, iz), e);
    return e;
  }

  setOrigin(ox: number, oz: number) {
    this.originX = ox;
    this.originZ = oz;
    for (const e of this.cache.values()) {
      e.mesh.position.set(e.x0 - ox, 0, e.z0 - oz);
      e.mesh.updateMatrix();
    }
  }

  private request(level: number, ix: number, iz: number, prio: number) {
    const k = this.key(level, ix, iz);
    if (this.cache.has(k)) return;
    const p = this.pending.get(k);
    if (p) p.prio = Math.min(p.prio, prio);
    else this.pending.set(k, { level, ix, iz, prio });
  }

  /** camX/camZ in absolute world coordinates. */
  update(camX: number, camY: number, camZ: number, budgetMs: number, force = false) {
    this.frame++;
    const want = new Set<string>();
    const top = LEVELS - 1;
    const rs = ROOT_SIZE;
    const r = this.viewRadius;
    const ix0 = Math.floor((camX - r) / rs), ix1 = Math.floor((camX + r) / rs);
    const iz0 = Math.floor((camZ - r) / rs), iz1 = Math.floor((camZ + r) / rs);
    const visit = (level: number, ix: number, iz: number) => {
      const size = this.sizeOf(level);
      const x0 = ix * size, z0 = iz * size;
      const dx = Math.max(x0 - camX, 0, camX - (x0 + size));
      const dz = Math.max(z0 - camZ, 0, camZ - (z0 + size));
      const e = this.cache.get(this.key(level, ix, iz));
      const dy = e ? Math.max(0, camY - e.maxY - 20) : 0;
      const dist = Math.hypot(dx, dz, dy);
      if (level === top && dist > r) return;
      const wantSplit = level > 0 && dist < size * SPLIT_K;
      if (wantSplit) {
        const cl = level - 1;
        let ready = true;
        for (let c = 0; c < 4; c++) {
          const cx = ix * 2 + (c & 1), cz = iz * 2 + (c >> 1);
          if (!this.cache.has(this.key(cl, cx, cz))) {
            ready = false;
            this.request(cl, cx, cz, dist / size + level);
          }
        }
        if (ready || !e) {
          if (ready) {
            for (let c = 0; c < 4; c++) visit(cl, ix * 2 + (c & 1), iz * 2 + (c >> 1));
            return;
          }
        }
      }
      if (e) {
        want.add(this.key(level, ix, iz));
        e.lastUsed = this.frame;
      } else {
        this.request(level, ix, iz, -10 + dist / size);
      }
    };
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) visit(top, ix, iz);

    // build queued nodes within the time budget (coarse / near first)
    if (this.pending.size) {
      const list = [...this.pending.values()].sort((a, b) => a.prio - b.prio);
      const t0 = performance.now();
      for (const p of list) {
        if (!force && performance.now() - t0 > budgetMs) break;
        this.pending.delete(this.key(p.level, p.ix, p.iz));
        this.build(p.level, p.ix, p.iz);
      }
      if (force && this.pending.size) return this.update(camX, camY, camZ, budgetMs, true);
    }

    for (const k of this.visibleKeys) if (!want.has(k)) { const e = this.cache.get(k); if (e) e.mesh.visible = false; }
    for (const k of want) { const e = this.cache.get(k); if (e) e.mesh.visible = true; }
    this.visibleKeys = want;

    if (this.cache.size > this.maxCache) {
      const old = [...this.cache.entries()].filter(([k]) => !want.has(k)).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      const n = this.cache.size - this.maxCache;
      for (let i = 0; i < n && i < old.length; i++) {
        const [k, e] = old[i];
        this.group.remove(e.mesh);
        e.mesh.geometry.dispose();
        this.cache.delete(k);
      }
    }
  }

  get pendingCount() {
    return this.pending.size;
  }
}
