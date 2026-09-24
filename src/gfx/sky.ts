import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir, uMoonDir;
uniform vec3 uZenith, uHorizon, uHorizonSun, uSunColor, uGround, uFogColor, uFogSun;
uniform float uSunVis, uMoonVis, uStars, uCloud, uCloudDark, uTime, uEnv, uHaze, uStorm, uMoonPhase, uFogAmt;
uniform vec2 uCloudOffset;
uniform vec3 uCloudLit, uCloudShade;

float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(h12(i), h12(i+vec2(1,0)), u.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0., a = 0.5; for (int i = 0; i < 6; i++){ s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float fbm3(vec2 p){ float s = 0., a = 0.5; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.07 + vec2(3.1, 1.3); a *= 0.5; } return s; }

vec3 atmosphere(vec3 d){
  float y = d.y;
  vec2 dh = normalize(d.xz + 1e-5);
  vec2 sh = normalize(uSunDir.xz + 1e-5);
  float towardSun = clamp(dot(dh, sh) * 0.5 + 0.5, 0.0, 1.0);
  vec3 hor = mix(uHorizon, uHorizonSun, pow(towardSun, 3.0));
  float t = pow(clamp(y, 0.0, 1.0), 0.42);
  vec3 col = mix(hor, uZenith, t);
  // horizon haze band
  col = mix(col, mix(uFogColor, uFogSun, pow(towardSun, 6.0)), exp(-max(y, 0.0) * (7.0 - uHaze * 4.0)) * (0.55 + 0.45 * uHaze));
  float cs = dot(d, uSunDir);
  // Mie-like glow around the sun
  col += uSunColor * (pow(max(cs, 0.0), 6.0) * 0.18 + pow(max(cs, 0.0), 48.0) * 0.45 + pow(max(cs, 0.0), 600.0) * 1.2) * uSunVis;
  if (y < 0.0) {
    vec3 g = mix(mix(uFogColor, uFogSun, pow(towardSun, 6.0)), uGround, smoothstep(0.0, -0.25, y));
    col = mix(col, g, smoothstep(0.0, -0.03, y));
  }
  return col;
}

vec4 clouds(vec3 d){
  if (d.y < 0.005 || uCloud < 0.01) return vec4(0.);
  vec2 p = d.xz / (d.y + 0.12) * 1.4 + uCloudOffset;
  float cover = uCloud;
  float n = fbm(p * 0.9);
  float dens = smoothstep(1.02 - cover * 0.75, 1.25 - cover * 0.6, n + 0.28);
  // cirrus streaks
  vec2 q = d.xz / (d.y + 0.2) * 0.5 + uCloudOffset * 0.3;
  float ci = fbm3(vec2(q.x * 0.6, q.y * 3.0)) ;
  float cir = smoothstep(0.55, 0.85, ci) * 0.35 * (0.4 + cover);
  vec2 sdir = normalize(uSunDir.xz + 1e-4);
  float n2 = fbm(p * 0.9 + sdir * 0.09);
  float shade = exp(-max(n2 - n + 0.05, 0.0) * 5.0) * 0.75 + 0.25 * (1.0 - dens);
  float cs = max(dot(d, uSunDir), 0.0);
  vec3 lit = uCloudLit * (0.75 + 0.5 * shade) + uSunColor * pow(cs, 12.0) * 0.6 * uSunVis;
  vec3 col = mix(uCloudShade, lit, shade);
  col = mix(col, uCloudShade, uCloudDark * 0.7);
  float a = clamp(dens + cir * (1.0 - dens), 0.0, 1.0);
  a *= smoothstep(0.0, 0.18, d.y);
  return vec4(col, a);
}

void main(){
  vec3 d = normalize(vDir);
  vec3 col = atmosphere(d);
  if (uEnv < 0.5) {
    // stars + milky way
    if (uStars > 0.001 && d.y > -0.05) {
      vec3 sd = d * 300.0;
      vec3 cell = floor(sd);
      float h = h13(cell);
      if (h > 0.9935) {
        vec3 pos = h33(cell + 7.0) * 0.6 + 0.2;
        float dd = length(fract(sd) - pos);
        float b = pow(fract(h * 157.3), 3.0) * 2.5 + 0.2;
        float tw = 0.75 + 0.25 * sin(uTime * (2.0 + h * 5.0) + h * 100.0);
        col += vec3(0.8 + 0.2 * fract(h * 31.), 0.85, 1.0) * smoothstep(0.32, 0.0, dd) * b * tw * uStars;
      }
      vec3 mwN = normalize(vec3(0.3, 0.55, 0.78));
      float bd = dot(d, mwN) / 0.2;
      float band = exp(-bd * bd);
      float mw = fbm(vec2(atan(d.z, d.x) * 6.0, d.y * 8.0)) * band;
      col += vec3(0.5, 0.55, 0.7) * mw * 0.06 * uStars;
    }
    // sun disc
    float cs = dot(d, uSunDir);
    float disc = smoothstep(0.99985, 0.99992, cs);
    col += uSunColor * disc * 40.0 * uSunVis * (1.0 - uStorm * 0.9);
    // moon
    float cm = dot(d, uMoonDir);
    if (cm > 0.9995 && uMoonVis > 0.001) {
      vec3 right = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
      vec3 up = cross(right, uMoonDir);
      vec2 md = vec2(dot(d - uMoonDir, right), dot(d - uMoonDir, up)) / 0.0316;
      float r = length(md);
      if (r < 1.0) {
        vec3 nrm = vec3(md, sqrt(1.0 - r * r));
        vec3 L = normalize(vec3(cos(uMoonPhase), 0.0, sin(uMoonPhase)));
        float lit = smoothstep(-0.05, 0.12, dot(nrm, L));
        float mare = fbm(md * 3.0 + 4.0);
        vec3 mc = vec3(0.95, 0.93, 0.86) * (0.65 + 0.35 * smoothstep(0.35, 0.65, mare));
        col = mix(col, mc * (0.04 + lit * 1.6), smoothstep(1.0, 0.94, r) * uMoonVis);
      }
    }
    col += vec3(0.6, 0.65, 0.8) * pow(max(cm, 0.0), 800.0) * 0.25 * uMoonVis;
  }
  vec4 cl = clouds(d);
  col = mix(col, cl.rgb, cl.a);
  // global fog / storm veil
  float veil = uFogAmt * (1.0 - smoothstep(0.0, 0.5 + uStorm * 0.8, d.y) * (1.0 - uStorm * 0.85));
  col = mix(col, mix(uFogColor, uFogSun, pow(max(dot(d, uSunDir), 0.0), 6.0)), clamp(veil, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  private envScene = new THREE.Scene();
  private envMesh: THREE.Mesh;
  private cubeRT: THREE.WebGLCubeRenderTarget;
  private cubeCam: THREE.CubeCamera;
  private pmrem: THREE.PMREMGenerator;
  envRT: THREE.WebGLRenderTarget | null = null;
  uniforms: Record<string, THREE.IUniform>;

  constructor(private renderer: THREE.WebGLRenderer) {
    const u = (v: any) => ({ value: v });
    this.uniforms = {
      uSunDir: u(new THREE.Vector3(0, 1, 0)), uMoonDir: u(new THREE.Vector3(0, -1, 0)),
      uZenith: u(new THREE.Color()), uHorizon: u(new THREE.Color()), uHorizonSun: u(new THREE.Color()),
      uSunColor: u(new THREE.Color()), uGround: u(new THREE.Color()), uFogColor: u(new THREE.Color()), uFogSun: u(new THREE.Color()),
      uSunVis: u(1), uMoonVis: u(0), uStars: u(0), uCloud: u(0.3), uCloudDark: u(0), uTime: u(0), uEnv: u(0), uHaze: u(0.5),
      uStorm: u(0), uMoonPhase: u(1.2), uFogAmt: u(0), uCloudOffset: u(new THREE.Vector2()),
      uCloudLit: u(new THREE.Color(1, 1, 1)), uCloudShade: u(new THREE.Color(0.6, 0.65, 0.75)),
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    const geo = new THREE.SphereGeometry(1000, 48, 24);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.envMesh = new THREE.Mesh(geo, this.material);
    this.envScene.add(this.envMesh);
    this.cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.cubeCam = new THREE.CubeCamera(1, 5000, this.cubeRT);
    this.envScene.add(this.cubeCam);
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  follow(cam: THREE.Camera) {
    this.mesh.position.copy(cam.position);
    this.mesh.updateMatrixWorld();
  }

  /** Re-render the sky into a prefiltered environment map for image based lighting. */
  updateEnv(): THREE.Texture {
    this.uniforms.uEnv.value = 1;
    this.cubeCam.update(this.renderer, this.envScene);
    this.uniforms.uEnv.value = 0;
    const next = this.pmrem.fromCubemap(this.cubeRT.texture, this.envRT ?? undefined);
    this.envRT = next;
    return next.texture;
  }
}
