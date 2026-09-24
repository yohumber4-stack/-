import * as THREE from 'three';
import { WorldFn, ROAD_START_Z } from './worldfn';
import { TexSet } from '../gfx/textures';
import { WORLD_UNIFORMS } from './terrain';

export const ROAD_SEG = 64;
const OFFS = [-4.62, -4.36, -4.0, -2.2, 0, 2.2, 4.0, 4.36, 4.62];

export function makeRoadMaterial(tex: TexSet): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: tex.asphaltAlbedo,
    normalMap: tex.asphaltNormal,
    roughnessMap: tex.asphaltORM,
    roughness: 1,
    metalness: 0,
    alphaTest: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -6,
  });
  m.normalScale.set(0.8, 0.8);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSandMacro = { value: tex.sandMacro };
    shader.uniforms.uSandA = { value: tex.sandAlbedo };
    shader.uniforms.uOriginMod = WORLD_UNIFORMS.uOriginMod;
    shader.uniforms.uSandCover = ROAD_UNIFORMS.uSandCover;
    shader.uniforms.uWet = ROAD_UNIFORMS.uWet;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRPos;\nvarying vec2 vRUv;\nuniform vec2 uOriginMod;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vRPos = (modelMatrix * vec4(transformed, 1.0)).xyz + vec3(uOriginMod.x, 0.0, uOriginMod.y);\n vRUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRPos;\nvarying vec2 vRUv;\nuniform sampler2D uSandMacro;\nuniform sampler2D uSandA;\nuniform float uSandCover;\nuniform float uWet;\nfloat rSand = 0.0;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float ed = abs(vRUv.x - 0.5) * 9.2;
          vec4 mac = texture2D(uSandMacro, vRPos.xz / 57.0);
          vec4 mac2 = texture2D(uSandMacro, vRPos.xz / 13.0 + 0.3);
          float dn = mac.g * 0.75 + mac2.b * 0.35 + (mac2.a - 0.5) * 0.25;
          float drift = smoothstep(0.78 - uSandCover * 0.35, 0.86 - uSandCover * 0.35, dn) * smoothstep(1.5, 4.0, ed + mac.r * 2.0);
          float edge = smoothstep(3.75, 4.3, ed + (mac2.a - 0.5) * 0.9);
          rSand = clamp(max(drift, edge * 0.95), 0.0, 1.0);
          vec3 sandC = texture2D(uSandA, vRPos.xz / 5.0).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, sandC, rSand);
          diffuseColor.rgb *= 1.0 - uWet * 0.45 * (1.0 - rSand);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.97, rSand);\n roughnessFactor = mix(roughnessFactor, 0.25, uWet * (1.0 - rSand));',
      );
  };
  return m;
}

export const ROAD_UNIFORMS = {
  uSandCover: { value: 0 },
  uWet: { value: 0 },
};

interface SegEntry {
  mesh: THREE.Mesh;
  z0: number;
  lod: number;
  x0: number;
}

/** Streams ribbon meshes that follow the road centreline. */
export class Road {
  group = new THREE.Group();
  private segs = new Map<number, SegEntry>();
  originX = 0;
  originZ = 0;
  ahead = 3400;

  constructor(private fn: WorldFn, private material: THREE.Material) {
    this.group.name = 'road';
  }

  buildGeometry(z0: number, step: number): THREE.BufferGeometry {
    const fn = this.fn;
    const rows = Math.round(ROAD_SEG / step) + 1;
    const cols = OFFS.length;
    const pos = new Float32Array(rows * cols * 3);
    const nrm = new Float32Array(rows * cols * 3);
    const uv = new Float32Array(rows * cols * 2);
    const vBase = Math.floor(z0 / 1024) * 1024;
    const x0 = fn.roadX(z0);
    for (let r = 0; r < rows; r++) {
      const z = z0 + r * step;
      const cx = fn.roadX(z), cy = fn.roadY(z);
      const dx = fn.roadDX(z);
      const dy = fn.roadY(z + 0.5) - fn.roadY(z - 0.5);
      // forward and right (right = -x when heading +z)
      let tx = dx, ty = dy, tz = 1;
      const tl = Math.hypot(tx, ty, tz);
      tx /= tl; ty /= tl; tz /= tl;
      let rx = -tz, rz = tx;
      const rl = Math.hypot(rx, rz);
      rx /= rl; rz /= rl;
      // normal = right x forward
      let nx = -rz * ty, ny = rz * tx - rx * tz, nz = rx * ty;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      for (let c = 0; c < cols; c++) {
        const s = OFFS[c];
        const px = cx + rx * s, pz = z + rz * s;
        let py = cy + 0.035;
        if (Math.abs(s) > 4.5) py = Math.min(cy, fn.height(px, pz)) - 0.08;
        const i = r * cols + c;
        pos[i * 3] = px - x0;
        pos[i * 3 + 1] = py;
        pos[i * 3 + 2] = pz - z0;
        nrm[i * 3] = nx; nrm[i * 3 + 1] = ny; nrm[i * 3 + 2] = nz;
        uv[i * 2] = (s + 4.6) / 9.2;
        uv[i * 2 + 1] = (z - vBase) / 16;
      }
    }
    const idx: number[] = [];
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx.push(a, b, d, b, e, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  setOrigin(ox: number, oz: number) {
    this.originX = ox;
    this.originZ = oz;
    for (const s of this.segs.values()) {
      s.mesh.position.set(s.x0 - ox, 0, s.z0 - oz);
      s.mesh.updateMatrix();
    }
  }

  update(camX: number, camZ: number, budget = 6) {
    const i0 = Math.floor(Math.max(ROAD_START_Z, camZ - this.ahead) / ROAD_SEG);
    const i1 = Math.floor((camZ + this.ahead) / ROAD_SEG);
    let built = 0;
    const want = new Set<number>();
    // nearest first so the road under the car always exists
    const order: number[] = [];
    for (let i = i0; i <= i1; i++) order.push(i);
    const ci = Math.floor(camZ / ROAD_SEG);
    order.sort((a, b) => Math.abs(a - ci) - Math.abs(b - ci));
    for (const i of order) {
      const z0 = i * ROAD_SEG;
      if (z0 + ROAD_SEG < ROAD_START_Z) continue;
      want.add(i);
      const dist = Math.abs(z0 + ROAD_SEG / 2 - camZ) + Math.abs(this.fn.roadX(z0) - camX) * 0.5;
      const lod = dist < 500 ? 0 : 1;
      const cur = this.segs.get(i);
      if (cur && cur.lod === lod) continue;
      if (built >= budget && cur) continue;
      const zs = Math.max(z0, ROAD_START_Z);
      const geo = this.buildGeometry(zs, lod === 0 ? 2 : 8);
      built++;
      if (cur) {
        cur.mesh.geometry.dispose();
        cur.mesh.geometry = geo;
        cur.lod = lod;
      } else {
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        const x0 = this.fn.roadX(zs);
        mesh.position.set(x0 - this.originX, 0, zs - this.originZ);
        mesh.updateMatrix();
        this.group.add(mesh);
        this.segs.set(i, { mesh, z0: zs, lod, x0 });
      }
    }
    for (const [i, s] of this.segs) {
      if (!want.has(i)) {
        this.group.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.segs.delete(i);
      }
    }
  }
}
