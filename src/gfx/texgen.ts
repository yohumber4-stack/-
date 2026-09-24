import * as THREE from 'three';

/** Shared GLSL: seeded periodic value/gradient noise, fbm, voronoi. Tile space uv ∈ [0,1). */
export const GLSL_NOISE = /* glsl */ `
uniform float uSeed;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash32(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
float sh(vec2 i, vec2 per){ return hash12(mod(i, per) + uSeed * 17.13); }
float vnoise(vec2 p, vec2 per){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(sh(i,per), sh(i+vec2(1.,0.),per), u.x), mix(sh(i+vec2(0.,1.),per), sh(i+vec2(1.,1.),per), u.x), u.y);
}
vec2 gh(vec2 i, vec2 per){ float a = hash12(mod(i,per) + uSeed*13.7 + 0.5) * 6.2831853; return vec2(cos(a), sin(a)); }
float gnoise(vec2 p, vec2 per){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.-15.)+10.);
  float a = dot(gh(i,per), f), b = dot(gh(i+vec2(1.,0.),per), f-vec2(1.,0.));
  float c = dot(gh(i+vec2(0.,1.),per), f-vec2(0.,1.)), d = dot(gh(i+vec2(1.,1.),per), f-vec2(1.,1.));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y) * 1.5;
}
// periodic fbm over the unit tile; freq must be an integer
float fbm(vec2 uv, vec2 freq, int oct){
  float s = 0., a = 0.5, n = 0.; vec2 f = freq;
  for (int i = 0; i < 10; i++){ if (i >= oct) break; s += a * gnoise(uv * f + float(i) * vec2(17., 31.), f); n += a; a *= 0.5; f *= 2.; }
  return s / n;
}
float fbmv(vec2 uv, vec2 freq, int oct){
  float s = 0., a = 0.5, n = 0.; vec2 f = freq;
  for (int i = 0; i < 10; i++){ if (i >= oct) break; s += a * vnoise(uv * f + float(i) * vec2(17., 31.), f); n += a; a *= 0.5; f *= 2.; }
  return s / n;
}
// periodic voronoi: x=F1, y=F2, z=cell id
vec3 voronoi(vec2 uv, vec2 freq){
  vec2 p = uv * freq; vec2 i = floor(p), f = fract(p);
  float F1 = 8., F2 = 8., id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    vec2 cell = mod(i + g, freq);
    vec2 o = hash22(cell + uSeed * 7.1);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < F1){ F2 = F1; F1 = d; id = hash12(cell + uSeed * 3.3 + 0.7); } else if (d < F2) F2 = d;
  }
  return vec3(sqrt(F1), sqrt(F2), id);
}
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export interface GenOpts {
  width: number;
  height?: number;
  srgb?: boolean;
  float?: boolean;
  mips?: boolean;
  uniforms?: Record<string, THREE.IUniform>;
  seed?: number;
  wrap?: boolean;
}

/** Renders procedural texture programs on the GPU into render targets (instant, high quality). */
export class TexGen {
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  readonly targets: THREE.WebGLRenderTarget[] = [];
  maxAniso: number;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
  }

  /** body must define `vec4 texMain(vec2 uv)`; returned value written raw (linear). */
  run(body: string, o: GenOpts): THREE.Texture {
    const w = o.width, h = o.height ?? o.width;
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: o.float ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      generateMipmaps: o.mips !== false,
      minFilter: o.mips !== false ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: o.wrap === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping,
      wrapT: o.wrap === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping,
      colorSpace: o.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
      depthBuffer: false,
      anisotropy: Math.min(8, this.maxAniso),
    });
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: `precision highp float;\nvarying vec2 vUv;\nuniform vec2 uRes;\n${GLSL_NOISE}\n${body}\nvoid main(){ gl_FragColor = texMain(vUv); }`,
      uniforms: { uSeed: { value: o.seed ?? 1 }, uRes: { value: new THREE.Vector2(w, h) }, ...(o.uniforms || {}) },
      depthTest: false,
      depthWrite: false,
    });
    this.quad.material = mat;
    const prev = this.renderer.getRenderTarget();
    const prevXR = this.renderer.xr.enabled;
    this.renderer.xr.enabled = false;
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.scene, this.cam);
    this.renderer.setRenderTarget(prev);
    this.renderer.xr.enabled = prevXR;
    mat.dispose();
    this.targets.push(rt);
    rt.texture.anisotropy = Math.min(8, this.maxAniso);
    return rt.texture;
  }

  /** Height texture (R channel) -> tangent-space normal map. */
  normalFrom(height: THREE.Texture, strength: number, w: number, h = w, seed = 1): THREE.Texture {
    return this.run(
      /* glsl */ `uniform sampler2D uH; uniform float uStr;
      vec4 texMain(vec2 uv){
        vec2 e = 1.0 / uRes;
        float l = texture2D(uH, uv - vec2(e.x, 0.)).r, r = texture2D(uH, uv + vec2(e.x, 0.)).r;
        float d = texture2D(uH, uv - vec2(0., e.y)).r, u = texture2D(uH, uv + vec2(0., e.y)).r;
        vec3 n = normalize(vec3((l - r) * uStr, (d - u) * uStr, 1.0));
        return vec4(n * 0.5 + 0.5, 1.0);
      }`,
      { width: w, height: h, uniforms: { uH: { value: height }, uStr: { value: strength } }, seed },
    );
  }

  disposeAll() {
    for (const t of this.targets) t.dispose();
    this.targets.length = 0;
  }
}
