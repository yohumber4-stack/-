import * as THREE from 'three';
import { TexSet } from './textures';
import { WORLD_UNIFORMS } from '../world/terrain';

/** Common GLSL for materials that need world coordinates independent of the floating origin. */
const WPOS_VERT_PARS = 'varying vec3 vWPos;\nuniform vec2 uOriginMod;';
const WPOS_VERT = `
  vec4 wpX = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wpX = instanceMatrix * wpX;
  #endif
  wpX = modelMatrix * wpX;
  vWPos = wpX.xyz + vec3(uOriginMod.x, 0.0, uOriginMod.y);`;

export const WIND = { uWind: { value: new THREE.Vector3(3, 0, 1) }, uTime: WORLD_UNIFORMS.uTime };

function tri(tex: THREE.Texture, scale: number) {
  return { tex, scale };
}

export class Materials {
  private cache = new Map<string, THREE.Material>();
  readonly tex: TexSet;
  cactus: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  bush: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
  pole: THREE.MeshStandardMaterial;
  wire: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  woodLight: THREE.MeshStandardMaterial;
  woodRaw: THREE.MeshStandardMaterial;
  corrugated: THREE.MeshStandardMaterial;
  corrugatedRust: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  rust: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  tire: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  glassDirty: THREE.MeshStandardMaterial;
  plasticBlack: THREE.MeshStandardMaterial;
  metalDark: THREE.MeshStandardMaterial;
  metalBare: THREE.MeshStandardMaterial;
  carpet: THREE.MeshStandardMaterial;
  deadWood: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  cardboard: THREE.MeshStandardMaterial;

  constructor(tex: TexSet) {
    this.tex = tex;
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);

    this.cactus = std({ map: tex.cactus, normalMap: tex.cactusNormal, roughness: 0.75, color: 0xffffff });
    this.cactus.normalScale.set(1.2, 1.2);

    this.grass = std({ map: tex.grass, alphaTest: 0.32, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.9 });
    this.addWind(this.grass, 0.18);
    this.bush = std({ vertexColors: true, roughness: 0.95, map: tex.bark, color: 0xffffff });
    this.addWind(this.bush, 0.05);

    this.rock = std({ vertexColors: true, roughness: 0.92, color: 0xffffff });
    this.addTriplanar(this.rock, tri(tex.rockDetail, 8), tex.rockNormal, 1.0);

    this.pole = std({ map: tex.bark, normalMap: tex.barkNormal, roughness: 0.9, color: 0x9a8876 });
    this.wire = std({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.4 });

    this.woodDark = std({ map: tex.planksDark, normalMap: tex.planksNormal, roughnessMap: tex.planksRough, roughness: 1 });
    this.woodLight = std({ map: tex.planksLight, normalMap: tex.planksNormal, roughnessMap: tex.planksRough, roughness: 1 });
    this.woodRaw = std({ map: tex.planksLight, normalMap: tex.planksNormal, roughness: 0.85, color: 0xd8c0a0 });
    this.corrugated = std({ map: tex.corrugated, normalMap: tex.corrugatedNormal, roughnessMap: tex.corrugatedORM, metalnessMap: tex.corrugatedORM, roughness: 1, metalness: 1 });
    this.corrugatedRust = std({ map: tex.corrugatedRust, normalMap: tex.corrugatedNormal, roughnessMap: tex.corrugatedRustORM, metalnessMap: tex.corrugatedRustORM, roughness: 1, metalness: 1 });
    this.concrete = std({ map: tex.concrete, normalMap: tex.concreteNormal, roughness: 0.93 });
    this.rust = std({ map: tex.rust, normalMap: tex.rustNormal, roughness: 0.9, metalness: 0.25 });
    this.chrome = std({ color: 0xe8e8e8, roughness: 0.12, metalness: 1 });
    this.rubber = std({ color: 0x151515, roughness: 0.85 });
    this.tire = std({ map: tex.tread, normalMap: tex.treadNormal, roughness: 0.88 });
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0xcfd8d4, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.4, side: THREE.DoubleSide });
    this.glassDirty = std({ color: 0xffffff, map: tex.glassDirt, transparent: true, roughness: 0.6, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 });
    this.plasticBlack = std({ color: 0x1b1b1c, roughness: 0.55, normalMap: tex.vinylNormal, normalScale: new THREE.Vector2(0.4, 0.4) });
    this.metalDark = std({ map: tex.metalDark, normalMap: tex.metalNormal, color: 0x55585c, roughness: 0.55, metalness: 0.7 });
    this.metalBare = std({ map: tex.metalDark, normalMap: tex.metalNormal, color: 0x9a9da2, roughness: 0.4, metalness: 0.85 });
    this.carpet = std({ map: tex.carpet, color: 0x3a3430, roughness: 1 });
    this.deadWood = std({ map: tex.bark, normalMap: tex.barkNormal, color: 0xb8ad9e, roughness: 0.95 });
    this.ceramic = std({ color: 0x7a9a86, roughness: 0.25, metalness: 0 });
    this.black = std({ color: 0x050505, roughness: 0.9 });
    this.cardboard = std({ map: tex.cardboard, roughness: 0.95 });
  }

  /** Painted metal (optionally rusty) with a shared wear texture. */
  painted(color: number | string, rust = 0.3, rough = 0.5): THREE.MeshStandardMaterial {
    const key = `painted:${color}:${rust.toFixed(2)}:${rough}`;
    let m = this.cache.get(key) as THREE.MeshStandardMaterial;
    if (m) return m;
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color as any), roughness: rough, metalness: 0.15 });
    this.addRust(m, rust);
    this.cache.set(key, m);
    return m;
  }

  flat(color: number | string, rough = 0.8, metal = 0): THREE.MeshStandardMaterial {
    const key = `flat:${color}:${rough}:${metal}`;
    let m = this.cache.get(key) as THREE.MeshStandardMaterial;
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color as any), roughness: rough, metalness: metal });
      this.cache.set(key, m);
    }
    return m;
  }

  fabric(color: number | string): THREE.MeshStandardMaterial {
    const key = `fabric:${color}`;
    let m = this.cache.get(key) as THREE.MeshStandardMaterial;
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color as any), map: this.tex.fabric, normalMap: this.tex.fabricNormal, roughness: 0.95 });
      this.cache.set(key, m);
    }
    return m;
  }

  vinyl(color: number | string, rough = 0.55): THREE.MeshStandardMaterial {
    const key = `vinyl:${color}:${rough}`;
    let m = this.cache.get(key) as THREE.MeshStandardMaterial;
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color as any), normalMap: this.tex.vinylNormal, roughness: rough });
      m.normalScale.set(0.5, 0.5);
      this.cache.set(key, m);
    }
    return m;
  }

  emissive(color: number | string, intensity = 2): THREE.MeshStandardMaterial {
    const key = `emi:${color}:${intensity}`;
    let m = this.cache.get(key) as THREE.MeshStandardMaterial;
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color as any), emissiveIntensity: intensity, roughness: 0.4 });
      this.cache.set(key, m);
    }
    return m;
  }

  textured(map: THREE.Texture, rough = 0.7, key?: string, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
    const k = key ? 'tex:' + key : null;
    if (k && this.cache.has(k)) return this.cache.get(k) as THREE.MeshStandardMaterial;
    const m = new THREE.MeshStandardMaterial({ map, roughness: rough, ...extra });
    if (k) this.cache.set(k, m);
    return m;
  }

  /** Blend a rust layer over a painted surface using the shared wear mask (object-space triplanar). */
  addRust(m: THREE.MeshStandardMaterial, amount: number, dust = 0.35) {
    const tex = this.tex;
    m.userData.rust = { value: amount };
    m.userData.dust = { value: dust };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWear = { value: tex.wear };
      shader.uniforms.uRustTex = { value: tex.rust };
      shader.uniforms.uRustAmt = m.userData.rust;
      shader.uniforms.uDustAmt = m.userData.dust;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vOPos;\nvarying vec3 vONrm;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vOPos = position;\n vONrm = normal;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vOPos; varying vec3 vONrm;
          uniform sampler2D uWear; uniform sampler2D uRustTex; uniform float uRustAmt; uniform float uDustAmt;
          float rustK = 0.0;
          vec4 triS(sampler2D t, vec3 p, vec3 n, float s){
            vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-4);
            return texture2D(t, p.zy * s) * w.x + texture2D(t, p.xz * s) * w.y + texture2D(t, p.xy * s) * w.z;
          }`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            vec4 wr = triS(uWear, vOPos, vONrm, 0.7);
            vec4 wr2 = triS(uWear, vOPos + 3.1, vONrm, 2.3);
            float low = 1.0 - smoothstep(0.1, 0.7, vOPos.y + 0.8);
            float m = wr.r * 0.75 + wr2.r * 0.25 + low * 0.18;
            rustK = smoothstep(1.0 - uRustAmt * 0.85, 1.08 - uRustAmt * 0.8, m);
            rustK = max(rustK, wr2.g * uRustAmt * 0.9);
            vec3 rc = triS(uRustTex, vOPos, vONrm, 1.6).rgb;
            diffuseColor.rgb = mix(diffuseColor.rgb, rc, rustK);
            float dustK = uDustAmt * (0.35 + 0.65 * wr.b) * (0.5 + 0.5 * low);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.50, 0.37), clamp(dustK * 0.55, 0.0, 0.8));
          }`,
        )
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.92, max(rustK, uDustAmt * 0.3));')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor *= 1.0 - rustK;');
    };
    m.customProgramCacheKey = () => 'rust';
  }

  private addWind(m: THREE.MeshStandardMaterial, strength: number) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = WIND.uWind;
      shader.uniforms.uTime = WIND.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uWind;\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            vec3 ip = vec3(0.0);
            #ifdef USE_INSTANCING
              ip = instanceMatrix[3].xyz;
            #endif
            float hgt = max(position.y, 0.0);
            float ph = uTime * (1.3 + length(uWind) * 0.12) + ip.x * 0.37 + ip.z * 0.23;
            float sway = (sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.25 + 0.4) * ${strength.toFixed(3)} * (0.25 + length(uWind) * 0.12);
            vec2 wd = normalize(uWind.xz + 1e-4);
            transformed.xz += wd * sway * hgt * hgt;
          }`,
        );
    };
    m.customProgramCacheKey = () => 'wind' + strength;
  }

  addTriplanar(m: THREE.MeshStandardMaterial, albedo: { tex: THREE.Texture; scale: number }, normal: THREE.Texture, nStrength: number) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTA = { value: albedo.tex };
      shader.uniforms.uTN = { value: normal };
      shader.uniforms.uOriginMod = WORLD_UNIFORMS.uOriginMod;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + WPOS_VERT_PARS)
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + WPOS_VERT);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWPos; uniform sampler2D uTA; uniform sampler2D uTN;
          vec3 triW;`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec3 nWg = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz);
          triW = pow(abs(nWg), vec3(4.0)); triW /= (triW.x + triW.y + triW.z);
          float sc = 1.0 / ${albedo.scale.toFixed(2)};
          vec3 ta = texture2D(uTA, vWPos.zy * sc).rgb * triW.x + texture2D(uTA, vWPos.xz * sc).rgb * triW.y + texture2D(uTA, vWPos.xy * sc).rgb * triW.z;
          vec3 ta2 = texture2D(uTA, vWPos.zy * sc * 0.23).rgb * triW.x + texture2D(uTA, vWPos.xz * sc * 0.23).rgb * triW.y + texture2D(uTA, vWPos.xy * sc * 0.23).rgb * triW.z;
          diffuseColor.rgb *= ta * 0.65 + ta2 * 0.45;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `{
            float sc2 = 1.0 / ${albedo.scale.toFixed(2)};
            vec3 nx = texture2D(uTN, vWPos.zy * sc2).xyz * 2.0 - 1.0;
            vec3 ny = texture2D(uTN, vWPos.xz * sc2).xyz * 2.0 - 1.0;
            vec3 nz = texture2D(uTN, vWPos.xy * sc2).xyz * 2.0 - 1.0;
            // whiteout blend in world space
            vec3 tX = vec3(0.0, nx.y, nx.x) * ${nStrength.toFixed(2)};
            vec3 tY = vec3(ny.x, 0.0, ny.y) * ${nStrength.toFixed(2)};
            vec3 tZ = vec3(nz.x, nz.y, 0.0) * ${nStrength.toFixed(2)};
            vec3 nW2 = normalize(nWg + tX * triW.x + tY * triW.y + tZ * triW.z);
            normal = normalize((viewMatrix * vec4(nW2, 0.0)).xyz);
          }`,
        );
    };
    m.customProgramCacheKey = () => 'tri' + albedo.scale;
  }
}
