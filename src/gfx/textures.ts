import * as THREE from 'three';
import { TexGen } from './texgen';

/** All GPU-generated procedural textures used across the game. */
export interface TexSet {
  sandAlbedo: THREE.Texture;
  sandNormal: THREE.Texture;
  sandMacro: THREE.Texture;
  asphaltAlbedo: THREE.Texture;
  asphaltNormal: THREE.Texture;
  asphaltORM: THREE.Texture;
  planksDark: THREE.Texture;
  planksLight: THREE.Texture;
  planksNormal: THREE.Texture;
  planksRough: THREE.Texture;
  corrugated: THREE.Texture;
  corrugatedRust: THREE.Texture;
  corrugatedNormal: THREE.Texture;
  corrugatedORM: THREE.Texture;
  corrugatedRustORM: THREE.Texture;
  concrete: THREE.Texture;
  concreteNormal: THREE.Texture;
  rust: THREE.Texture;
  rustNormal: THREE.Texture;
  wear: THREE.Texture;
  rockDetail: THREE.Texture;
  rockNormal: THREE.Texture;
  fabric: THREE.Texture;
  fabricNormal: THREE.Texture;
  vinylNormal: THREE.Texture;
  carpet: THREE.Texture;
  tread: THREE.Texture;
  treadNormal: THREE.Texture;
  cactus: THREE.Texture;
  cactusNormal: THREE.Texture;
  puff: THREE.Texture;
  glassDirt: THREE.Texture;
  fur: THREE.Texture;
  furNormal: THREE.Texture;
  bark: THREE.Texture;
  barkNormal: THREE.Texture;
  metalDark: THREE.Texture;
  metalNormal: THREE.Texture;
  grass: THREE.Texture;
  cardboard: THREE.Texture;
  noise: THREE.Texture;
}

const SAND_H = /* glsl */ `
float rip(vec2 uv){
  vec2 w = vec2(fbm(uv, vec2(3.), 4), fbm(uv + vec2(0.31, 0.77), vec2(3.), 4));
  float ph = uv.x * 13. + w.x * 1.15 + fbm(uv, vec2(9.), 3) * 0.2;
  float f = fract(ph);
  float r = f < 0.68 ? f / 0.68 : (1. - f) / 0.32;
  r = smoothstep(0., 1., r);
  float amp = 0.45 + 0.55 * smoothstep(-0.45, 0.45, fbm(uv + vec2(0.5), vec2(2.), 3));
  return r * amp;
}
vec4 texMain(vec2 uv){
  float h = rip(uv) * 0.8;
  h += fbm(uv, vec2(48.), 3) * 0.06;
  h += (hash12(floor(uv * uRes) + uSeed) - 0.5) * 0.012;
  return vec4(h, 0., 0., 1.);
}`;

const SAND_A = /* glsl */ `
uniform sampler2D uH;
vec4 texMain(vec2 uv){
  float h = texture2D(uH, uv).r;
  vec3 base = toLin(vec3(0.88, 0.69, 0.47));
  float m = fbm(uv, vec2(5.), 5);
  vec3 c = base * (0.93 + 0.12 * m);
  c *= mix(0.9, 1.04, smoothstep(0.05, 0.6, h));
  vec2 cell = floor(uv * uRes);
  float g = hash12(cell + uSeed * 3.);
  if (g > 0.986) c *= 0.5 + 0.3 * hash12(cell + 1.3);
  else if (g < 0.01) c = mix(c, vec3(1.0), 0.3);
  float g2 = hash12(floor(uv * uRes * 0.5) + 5.1);
  if (g2 > 0.972) c *= vec3(1.04, 0.84, 0.74);
  return vec4(c, 1.);
}`;

const SAND_MACRO = /* glsl */ `
vec4 texMain(vec2 uv){
  float a = fbm(uv, vec2(4.), 6) * 0.5 + 0.5;
  float b = fbm(uv + 0.3, vec2(9.), 5) * 0.5 + 0.5;
  float c = fbm(uv + 0.7, vec2(25.), 4) * 0.5 + 0.5;
  float d = fbm(uv + 0.11, vec2(61.), 3) * 0.5 + 0.5;
  return vec4(a, b, c, d);
}`;

const ROAD_COMMON = /* glsl */ `
struct RoadF { float paint; float crack; float patchm; float agg; float track; float edge; float n; };
RoadF roadF(vec2 uv){
  RoadF r;
  float x = (uv.x - 0.5) * 9.2; float y = uv.y * 16.;
  float ax = abs(x);
  vec3 v = voronoi(uv, vec2(368., 640.));
  r.agg = smoothstep(0.38, 0.08, v.x) * (0.35 + 0.65 * v.z);
  // sparse, irregular cracks: warped voronoi edges gated by a patchy mask
  vec2 wq = uv + vec2(fbm(uv, vec2(5., 9.), 4), fbm(uv + 0.5, vec2(5., 9.), 4)) * vec2(0.035, 0.02);
  vec3 cv = voronoi(wq, vec2(5., 9.));
  float ed = cv.y - cv.x;
  float cm = smoothstep(0.62, 0.8, fbm(uv + 0.4, vec2(2., 4.), 4) * 0.5 + 0.5);
  float cw = 0.012 + 0.01 * (fbm(uv, vec2(20., 40.), 2) * 0.5 + 0.5);
  r.crack = (1. - smoothstep(0.0, cw, ed)) * cm;
  // fine alligator cracking only in worn patches
  vec3 cv2 = voronoi(wq * 1.0 + 0.3, vec2(18., 32.));
  float am = smoothstep(0.7, 0.85, fbm(uv + 0.77, vec2(2., 3.), 3) * 0.5 + 0.5);
  r.crack = max(r.crack, (1. - smoothstep(0.0, 0.03, cv2.y - cv2.x)) * am * 0.8);
  float lcx = x - 0.95 - fbm(uv, vec2(2., 16.), 4) * 0.4;
  r.crack = max(r.crack, (1. - smoothstep(0.0, 0.018, abs(lcx))) * smoothstep(0.3, 0.55, fbm(uv + 0.9, vec2(1., 8.), 3) * 0.5 + 0.5));
  float pm = 0.;
  vec2 pc = vec2(uv.x * 3., uv.y * 4.);
  vec2 cell = floor(pc);
  if (hash12(cell + 9.1) > 0.86) {
    vec2 f = fract(pc); vec2 hs = hash22(cell + 2.3) * vec2(0.25, 0.3) + vec2(0.12, 0.1);
    vec2 d = abs(f - 0.5 + (hash22(cell + 7.7) - 0.5) * 0.2) - hs;
    pm = 1. - smoothstep(0., 0.025, max(d.x, d.y) + fbm(uv, vec2(30., 60.), 2) * 0.02);
  }
  r.patchm = pm;
  float ta = (ax - 1.0) / 0.38, tb = (ax - 2.95) / 0.38;
  r.track = exp(-ta * ta) + exp(-tb * tb);
  float edgeL = 1. - smoothstep(0.055, 0.068, abs(ax - 3.95));
  float cen = 1. - smoothstep(0.045, 0.057, abs(ax - 0.13));
  float fy = fract(y / 4.);
  float dash = smoothstep(0.0, 0.004, fy) * (1. - smoothstep(0.645, 0.65, fy));
  float paint = max(edgeL, cen * dash);
  float wn = fbm(uv, vec2(40., 70.), 4) * 0.5 + 0.5;
  paint *= smoothstep(0.26, 0.42, wn + 0.1 - r.track * 0.1);
  paint *= 1. - r.crack;
  paint *= 1. - r.patchm * 0.92;
  r.paint = paint;
  float e = ax + fbm(uv, vec2(4., 48.), 4) * 0.22 + (hash12(floor(uv * uRes)) - 0.5) * 0.04;
  r.edge = 1. - smoothstep(4.24, 4.3, e);
  r.n = fbm(uv, vec2(12., 20.), 5);
  return r;
}`;

const ROAD_A = ROAD_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  RoadF r = roadF(uv);
  vec3 c = toLin(vec3(0.255, 0.245, 0.235));
  c *= 0.84 + 0.26 * r.n;
  c = mix(c, toLin(vec3(0.44, 0.42, 0.40)), r.agg * 0.5);
  c *= 1. + r.track * 0.1;
  c = mix(c, c * 0.72, r.patchm);
  c = mix(c, toLin(vec3(0.07, 0.07, 0.07)), r.crack * 0.9);
  c = mix(c, toLin(vec3(0.88, 0.67, 0.17)) * (0.85 + 0.2 * r.n), r.paint);
  float ax = abs((uv.x - 0.5) * 9.2);
  float dust = smoothstep(3.3, 4.3, ax) * (0.35 + 0.65 * (fbm(uv, vec2(6., 24.), 4) * 0.5 + 0.5));
  c = mix(c, toLin(vec3(0.74, 0.60, 0.44)), dust * 0.5);
  return vec4(c, r.edge);
}`;
const ROAD_H = ROAD_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  RoadF r = roadF(uv);
  float h = 0.5 + r.agg * 0.3 - r.crack * 0.7 + r.paint * 0.12 - r.patchm * 0.06 + r.n * 0.05;
  return vec4(h, 0., 0., 1.);
}`;
const ROAD_ORM = ROAD_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  RoadF r = roadF(uv);
  float rough = 0.93 - r.track * 0.07;
  rough = mix(rough, 0.72, r.paint);
  rough = mix(rough, 0.8, r.patchm);
  return vec4(1. - r.crack * 0.5, rough, 0., 1.);
}`;

const PLANKS_COMMON = /* glsl */ `
struct PF { float gap; float grain; float knot; float nail; float seam; float r; float fx; };
PF planks(vec2 uv){
  PF p;
  float N = 10.;
  float px = uv.x * N; float id = floor(px); float fx = fract(px);
  float s1 = hash12(vec2(id, 3.) + uSeed * 1.7) * 0.5; float s2 = s1 + 0.3 + hash12(vec2(id, 5.) + uSeed) * 0.2;
  float seg = (uv.y > s1 && uv.y < s2) ? 1. : 0.;
  float r = hash12(vec2(id, seg * 9. + 1.) + uSeed);
  p.r = r; p.fx = fx;
  float warp = fbm(uv + vec2(0., r), vec2(N, 3.), 4) * 1.6;
  float lines = sin((fx * 5. + warp * 2. + r * 20.) * 6.2831853) * 0.5 + 0.5;
  lines = pow(max(lines, 0.), 2.5);
  float fine = gnoise(vec2(uv.x * N * 24., uv.y * 5.), vec2(N * 24., 5.)) * 0.5 + 0.5;
  p.grain = lines * 0.55 + fine * 0.45;
  p.gap = smoothstep(0.0, 0.03, fx) * (1. - smoothstep(0.97, 1.0, fx));
  p.seam = max(1. - smoothstep(0.0, 0.003, abs(uv.y - s1)), 1. - smoothstep(0.0, 0.003, abs(uv.y - s2)));
  // knot
  vec2 kp = vec2(0.25 + 0.5 * hash12(vec2(id, seg + 11.)), mix(s1, s2, hash12(vec2(id, seg + 13.))));
  if (seg < 0.5) kp.y = fract(s2 + (1. - (s2 - s1)) * hash12(vec2(id, 17.)));
  vec2 kd = vec2((fx - kp.x) * 0.2 / N * N, uv.y - kp.y);
  kd.x = (fx - kp.x) / N;
  float kr = length(kd * vec2(1.0, 0.45));
  p.knot = (1. - smoothstep(0.004, 0.012, kr)) * step(0.55, hash12(vec2(id, seg + 19.)));
  // nails near seams
  float ny = min(abs(uv.y - s1 - 0.012), abs(uv.y - s2 - 0.012));
  p.nail = 1. - smoothstep(0.0025, 0.004, length(vec2((fx - 0.5) / N, ny)));
  return p;
}`;
const PLANKS_A = PLANKS_COMMON + /* glsl */ `
uniform vec3 uDark; uniform vec3 uMid; uniform vec3 uGrey; uniform float uWeather;
vec4 texMain(vec2 uv){
  PF p = planks(uv);
  vec3 c = mix(toLin(uDark), toLin(uMid), p.grain * 0.65 + p.r * 0.35);
  float wz = fbm(uv, vec2(3., 4.), 4) * 0.5 + 0.5;
  c = mix(c, toLin(uGrey) * (0.8 + 0.3 * p.grain), uWeather * smoothstep(0.2, 0.8, wz + p.r * 0.3));
  c = mix(c, toLin(uDark) * 0.5, p.knot * 0.8);
  c *= mix(0.18, 1., p.gap);
  c *= 1. - p.seam * 0.7;
  c = mix(c, toLin(vec3(0.12, 0.08, 0.06)), p.nail);
  return vec4(c, 1.);
}`;
const PLANKS_H = PLANKS_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  PF p = planks(uv);
  float cup = 1. - pow(abs(p.fx - 0.5) * 2., 4.) * 0.15;
  float h = p.gap * cup - p.grain * 0.06 - p.seam * 0.5 + p.knot * 0.03 + p.nail * 0.05;
  return vec4(h, 0., 0., 1.);
}`;
const PLANKS_R = PLANKS_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  PF p = planks(uv);
  float r = 0.82 + p.grain * 0.12 - p.nail * 0.4;
  return vec4(1., r, p.nail * 0.8, 1.);
}`;

const CORR_H = /* glsl */ `
vec4 texMain(vec2 uv){
  float s = sin(uv.x * 12. * 6.2831853);
  float h = 0.5 + 0.5 * s + fbm(uv, vec2(8.), 3) * 0.03;
  return vec4(h, 0., 0., 1.);
}`;
const CORR_COMMON = /* glsl */ `
uniform float uRust;
float rustMask(vec2 uv){
  float streak = fbm(vec2(uv.x, uv.y), vec2(36., 3.), 4) * 0.5 + 0.5;
  float blot = fbm(uv, vec2(4.), 6) * 0.5 + 0.5;
  float bottom = smoothstep(0.35, 0.0, uv.y) * 0.25;
  return smoothstep(0.62 - uRust * 0.55, 0.78 - uRust * 0.5, blot * 0.75 + streak * 0.35 + bottom);
}`;
const CORR_A = CORR_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  float m = rustMask(uv);
  float n = fbm(uv, vec2(6.), 5);
  vec3 metal = toLin(vec3(0.58, 0.59, 0.58)) * (0.82 + 0.25 * n);
  metal *= 1. - (fbm(vec2(uv.x, uv.y), vec2(50., 2.), 3) * 0.5 + 0.5) * 0.15;
  vec3 rust = mix(toLin(vec3(0.32, 0.14, 0.06)), toLin(vec3(0.60, 0.30, 0.12)), fbm(uv + 0.5, vec2(20.), 4) * 0.5 + 0.5);
  vec3 c = mix(metal, rust, m);
  // bake rib shading into the albedo so the profile still reads under flat lighting
  float rib = sin(uv.x * 12. * 6.2831853);
  c *= 0.8 + 0.2 * (rib * 0.5 + 0.5);
  c *= 1. - 0.25 * pow(max(-rib, 0.), 6.);
  // dark run-off streaks under each fold
  c *= 1. - smoothstep(0.55, 0.95, fbm(uv, vec2(96., 1.), 4) * 0.5 + 0.5) * 0.3 * m;
  return vec4(c, 1.);
}`;
const CORR_ORM = CORR_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  float m = rustMask(uv);
  return vec4(1., mix(0.45, 0.92, m), mix(0.75, 0.05, m), 1.);
}`;

const CONC_COMMON = /* glsl */ `
float concH(vec2 uv){
  float h = fbm(uv, vec2(6.), 6) * 0.3 + 0.5;
  vec3 v = voronoi(uv, vec2(90.));
  h -= (1. - smoothstep(0.0, 0.12, v.x)) * 0.25 * step(0.6, v.z);
  vec3 cv = voronoi(uv + fbm(uv, vec2(4.), 3) * 0.02, vec2(3.));
  h -= (1. - smoothstep(0.0, 0.015, cv.y - cv.x)) * 0.6 * step(0.5, fbm(uv + 0.2, vec2(2.), 3) * 0.5 + 0.5);
  return h;
}`;
const CONC_A = CONC_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  float h = concH(uv);
  vec3 c = toLin(vec3(0.62, 0.60, 0.56));
  float st = fbm(uv + 0.4, vec2(3.), 6) * 0.5 + 0.5;
  c *= 0.78 + 0.3 * st;
  c = mix(c, toLin(vec3(0.55, 0.48, 0.40)), smoothstep(0.6, 0.9, fbm(uv + 0.8, vec2(2.), 4) * 0.5 + 0.5) * 0.5);
  c *= 0.75 + 0.5 * clamp(h, 0., 1.) * 0.5 + 0.25;
  return vec4(c, 1.);
}`;
const CONC_H = CONC_COMMON + /* glsl */ `vec4 texMain(vec2 uv){ return vec4(concH(uv), 0., 0., 1.); }`;

const RUST_A = /* glsl */ `
vec4 texMain(vec2 uv){
  float a = fbm(uv, vec2(5.), 7) * 0.5 + 0.5;
  float b = fbm(uv + 0.3, vec2(24.), 4) * 0.5 + 0.5;
  vec3 v = voronoi(uv, vec2(40.));
  vec3 c = mix(toLin(vec3(0.22, 0.10, 0.05)), toLin(vec3(0.58, 0.29, 0.12)), smoothstep(0.2, 0.8, a));
  c = mix(c, toLin(vec3(0.70, 0.42, 0.20)), smoothstep(0.65, 0.9, b) * 0.6);
  c *= 1. - (1. - smoothstep(0.0, 0.2, v.x)) * 0.5 * step(0.7, v.z);
  return vec4(c, 1.);
}`;
const RUST_H = /* glsl */ `
vec4 texMain(vec2 uv){
  float h = fbm(uv, vec2(5.), 7) * 0.4 + fbm(uv, vec2(40.), 3) * 0.2;
  vec3 v = voronoi(uv, vec2(40.));
  h -= (1. - smoothstep(0.0, 0.2, v.x)) * 0.3 * step(0.7, v.z);
  return vec4(h, 0., 0., 1.);
}`;

const WEAR = /* glsl */ `
vec4 texMain(vec2 uv){
  float blot = fbm(uv, vec2(3.), 7) * 0.5 + 0.5;
  blot = blot * 0.8 + (fbm(uv + 0.5, vec2(16.), 4) * 0.5 + 0.5) * 0.2;
  float sc = 0.;
  for (int k = 0; k < 3; k++){
    float fk = float(k);
    vec2 q = k == 0 ? vec2(uv.x, uv.y) : (k == 1 ? vec2(uv.y, uv.x) : vec2(uv.x + uv.y, uv.x - uv.y));
    float n = gnoise(q * vec2(3., 60.) + fk * 13., vec2(3., 60.));
    float mask = smoothstep(0.55, 0.8, fbm(uv + fk * 0.37, vec2(4.), 3) * 0.5 + 0.5);
    sc = max(sc, (1. - smoothstep(0.0, 0.035, abs(n))) * mask);
  }
  float dirt = fbm(uv + 0.77, vec2(6.), 5) * 0.5 + 0.5;
  float speck = hash12(floor(uv * uRes) + 3.3);
  return vec4(blot, sc, dirt, speck);
}`;

const ROCK_H = /* glsl */ `
float rockH(vec2 uv){
  float h = fbm(uv, vec2(4.), 7) * 0.5;
  float lay = sin((uv.y * 22. + fbm(uv, vec2(3., 2.), 4) * 2.) * 6.2831853);
  h += lay * 0.08 + (fbm(vec2(uv.x, uv.y), vec2(3., 40.), 4)) * 0.12;
  vec3 cv = voronoi(uv + fbm(uv, vec2(5.), 3) * 0.03, vec2(6.));
  h -= (1. - smoothstep(0.0, 0.03, cv.y - cv.x)) * 0.35;
  return h;
}
vec4 texMain(vec2 uv){ return vec4(rockH(uv), 0., 0., 1.); }`;
const ROCK_A = /* glsl */ `
uniform sampler2D uH;
vec4 texMain(vec2 uv){
  float h = texture2D(uH, uv).r;
  float n = fbm(uv + 0.5, vec2(9.), 5) * 0.5 + 0.5;
  float v = 0.78 + 0.34 * n + h * 0.25;
  vec3 c = vec3(v) * mix(vec3(1.0), vec3(1.06, 0.97, 0.9), fbm(uv + 0.2, vec2(3.), 4) * 0.5 + 0.5);
  float sp = hash12(floor(uv * uRes * 0.5) + 2.2);
  if (sp > 0.97) c *= 0.75;
  return vec4(c, 1.);
}`;

const FABRIC = /* glsl */ `
uniform float uMode;
vec4 texMain(vec2 uv){
  float N = 64.;
  float wx = sin(uv.x * N * 6.2831853), wy = sin(uv.y * N * 6.2831853);
  float check = step(0., sin(uv.x * N * 3.14159265) * sin(uv.y * N * 3.14159265));
  float thread = mix(abs(wx), abs(wy), check);
  float n = fbm(uv, vec2(16.), 4) * 0.5 + 0.5;
  float v = 0.75 + 0.2 * thread + 0.1 * n;
  float hs = hash12(floor(uv * uRes));
  v *= 0.94 + 0.06 * hs;
  return vec4(vec3(v), thread * 0.6 + n * 0.3);
}`;
const VINYL_H = /* glsl */ `
vec4 texMain(vec2 uv){
  vec3 v = voronoi(uv, vec2(150.));
  float h = smoothstep(0.0, 0.45, v.x) * 0.35 + fbm(uv, vec2(8.), 3) * 0.12;
  return vec4(h, 0., 0., 1.);
}`;
const CARPET = /* glsl */ `
vec4 texMain(vec2 uv){
  float n = fbm(uv, vec2(64.), 3) * 0.5 + 0.5;
  float h = hash12(floor(uv * uRes) + 1.);
  float v = 0.7 + 0.25 * n + 0.12 * h;
  return vec4(vec3(v), 1.);
}`;

const TREAD_COMMON = /* glsl */ `
float treadH(vec2 uv){
  // u: around circumference (8 blocks per tile), v: across the tread
  float v = uv.y;
  float groove = 0.;
  for (int i = 1; i <= 3; i++){ float gc = float(i) * 0.25; groove = max(groove, 1. - smoothstep(0.018, 0.03, abs(v - gc))); }
  float lat = fract(uv.x * 8. + (v > 0.5 ? 0.5 : 0.) + abs(v - 0.5) * 0.8);
  float sipe = 1. - smoothstep(0.03, 0.06, abs(lat - 0.5));
  sipe *= step(0.08, v) * step(v, 0.92);
  float shoulder = smoothstep(0.0, 0.1, v) * smoothstep(1.0, 0.9, v);
  float h = (1. - max(groove, sipe * 0.9)) * (0.6 + 0.4 * shoulder);
  h += fbm(uv, vec2(8., 2.), 3) * 0.03;
  return h;
}`;
const TREAD_A = TREAD_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  float h = treadH(uv);
  vec3 rubber = toLin(vec3(0.085, 0.082, 0.08)) * (0.9 + 0.2 * (fbm(uv, vec2(16., 4.), 3) * 0.5 + 0.5));
  vec3 worn = toLin(vec3(0.13, 0.125, 0.12));
  vec3 dust = toLin(vec3(0.55, 0.45, 0.33));
  vec3 c = mix(rubber, worn, smoothstep(0.7, 1.0, h) * 0.6);
  c = mix(dust, c, smoothstep(0.1, 0.45, h) * 0.7 + 0.3 * (fbm(uv + 0.3, vec2(8., 2.), 3) * 0.5 + 0.5));
  return vec4(c, 1.);
}`;
const TREAD_H = TREAD_COMMON + /* glsl */ `vec4 texMain(vec2 uv){ return vec4(treadH(uv), 0., 0., 1.); }`;

const CACTUS_COMMON = /* glsl */ `
float cactH(vec2 uv){
  float r = 1. - abs(fract(uv.x * 14.) - 0.5) * 2.;
  float h = pow(r, 0.8);
  float ar = fract(uv.y * 40.);
  vec2 d = vec2((fract(uv.x * 14.) - 0.5) * 0.9, ar - 0.5);
  float spot = 1. - smoothstep(0.05, 0.14, length(d));
  return h + spot * 0.15;
}`;
const CACTUS_A = CACTUS_COMMON + /* glsl */ `
vec4 texMain(vec2 uv){
  float r = 1. - abs(fract(uv.x * 14.) - 0.5) * 2.;
  vec3 c = mix(toLin(vec3(0.20, 0.30, 0.14)), toLin(vec3(0.36, 0.48, 0.24)), smoothstep(0.1, 0.9, r));
  c *= 0.88 + 0.2 * (fbm(uv, vec2(3., 6.), 4) * 0.5 + 0.5);
  float ar = fract(uv.y * 40.);
  vec2 d = vec2((fract(uv.x * 14.) - 0.5) * 0.9, ar - 0.5);
  float spot = 1. - smoothstep(0.04, 0.09, length(d));
  c = mix(c, toLin(vec3(0.78, 0.72, 0.58)), spot * 0.9);
  float scar = smoothstep(0.7, 0.85, fbm(uv + 0.4, vec2(4., 8.), 4) * 0.5 + 0.5);
  c = mix(c, toLin(vec3(0.45, 0.40, 0.28)), scar * 0.5);
  return vec4(c, 1.);
}`;
const CACTUS_H = CACTUS_COMMON + /* glsl */ `vec4 texMain(vec2 uv){ return vec4(cactH(uv), 0., 0., 1.); }`;

const PUFF = /* glsl */ `
vec4 texMain(vec2 uv){
  vec2 p = uv * 2. - 1.;
  float r = length(p);
  float n = fbm(uv, vec2(4.), 5) * 0.5 + 0.5;
  float a = smoothstep(1.0, 0.2, r + (n - 0.5) * 0.5);
  a *= 0.6 + 0.4 * n;
  return vec4(vec3(0.85 + 0.15 * n), a);
}`;

const GLASS_DIRT = /* glsl */ `
vec4 texMain(vec2 uv){
  float d = fbm(uv, vec2(4.), 6) * 0.5 + 0.5;
  vec3 v = voronoi(uv, vec2(60.));
  float spots = (1. - smoothstep(0.05, 0.25, v.x)) * step(0.75, v.z);
  float streak = fbm(vec2(uv.x, uv.y), vec2(40., 3.), 4) * 0.5 + 0.5;
  float a = smoothstep(0.35, 0.85, d) * 0.55 + spots * 0.35 + smoothstep(0.6, 0.9, streak) * 0.2;
  return vec4(toLin(vec3(0.78, 0.66, 0.5)), clamp(a, 0., 1.));
}`;

const FUR_H = /* glsl */ `
vec4 texMain(vec2 uv){
  float s = gnoise(vec2(uv.x * 160., uv.y * 12.), vec2(160., 12.)) * 0.5 + 0.5;
  float s2 = gnoise(vec2(uv.x * 320. + 3., uv.y * 20.), vec2(320., 20.)) * 0.5 + 0.5;
  return vec4(s * 0.6 + s2 * 0.4, 0., 0., 1.);
}`;
const FUR_A = /* glsl */ `
uniform sampler2D uH;
vec4 texMain(vec2 uv){
  float h = texture2D(uH, uv).r;
  float patchv = fbm(uv, vec2(3.), 4) * 0.5 + 0.5;
  vec3 c = mix(toLin(vec3(0.30, 0.25, 0.20)), toLin(vec3(0.58, 0.50, 0.42)), h * 0.7 + patchv * 0.3);
  return vec4(c, 1.);
}`;

const BARK_H = /* glsl */ `
vec4 texMain(vec2 uv){
  float s = fbm(vec2(uv.x, uv.y), vec2(12., 1.), 6);
  float cr = 1. - smoothstep(0.0, 0.06, abs(gnoise(vec2(uv.x * 10., uv.y * 1.5), vec2(10., 1.5)) ));
  return vec4(0.5 + s * 0.4 - cr * 0.4, 0., 0., 1.);
}`;
const BARK_A = /* glsl */ `
uniform sampler2D uH;
vec4 texMain(vec2 uv){
  float h = texture2D(uH, uv).r;
  vec3 c = mix(toLin(vec3(0.16, 0.12, 0.09)), toLin(vec3(0.42, 0.36, 0.30)), clamp(h, 0., 1.));
  c = mix(c, toLin(vec3(0.5, 0.48, 0.44)), smoothstep(0.55, 0.8, fbm(uv + 0.3, vec2(2., 3.), 4) * 0.5 + 0.5) * 0.4);
  return vec4(c, 1.);
}`;

const METAL_H = /* glsl */ `
vec4 texMain(vec2 uv){
  float n = fbm(uv, vec2(8.), 5) * 0.3 + fbm(uv, vec2(64.), 3) * 0.15;
  vec3 v = voronoi(uv, vec2(30.));
  n -= (1. - smoothstep(0.0, 0.15, v.x)) * 0.15 * step(0.8, v.z);
  return vec4(0.5 + n, 0., 0., 1.);
}`;
const METAL_A = /* glsl */ `
uniform sampler2D uH;
vec4 texMain(vec2 uv){
  float h = texture2D(uH, uv).r;
  float g = fbm(uv + 0.1, vec2(5.), 5) * 0.5 + 0.5;
  vec3 c = vec3(0.7 + 0.3 * g) * (0.85 + 0.3 * (h - 0.5));
  return vec4(c, 1.);
}`;

const GRASS = /* glsl */ `
vec4 texMain(vec2 uv){
  // vertical grass blades on a transparent card
  float a = 0.;
  vec3 col = vec3(0.);
  for (int i = 0; i < 44; i++){
    float fi = float(i);
    float x0 = 0.12 + 0.76 * hash12(vec2(fi, 1.) + uSeed);
    float hgt = 0.4 + 0.6 * hash12(vec2(fi, 2.) + uSeed);
    float bend = (hash12(vec2(fi, 3.) + uSeed) - 0.5) * 0.7 + (x0 - 0.5) * 0.5;
    float t = uv.y / hgt;
    if (t > 1.) continue;
    float x = x0 + bend * t * t;
    float w = 0.022 * (1. - t * 0.85) + 0.003;
    float d = abs(uv.x - x);
    float m = 1. - smoothstep(w * 0.6, w, d);
    if (m > a) {
      a = m;
      vec3 base = mix(toLin(vec3(0.55, 0.42, 0.22)), toLin(vec3(0.86, 0.72, 0.42)), hash12(vec2(fi, 4.) + uSeed));
      col = base * (0.5 + 0.65 * t);
    }
  }
  return vec4(col, a);
}`;

const CARDBOARD = /* glsl */ `
vec4 texMain(vec2 uv){
  float n = fbm(uv, vec2(6.), 5) * 0.5 + 0.5;
  float fl = sin(uv.y * 180.) * 0.5 + 0.5;
  vec3 c = toLin(vec3(0.62, 0.47, 0.30)) * (0.85 + 0.2 * n) * (0.97 + 0.03 * fl);
  float stain = smoothstep(0.62, 0.8, fbm(uv + 0.6, vec2(3.), 4) * 0.5 + 0.5);
  c *= 1. - stain * 0.25;
  return vec4(c, 1.);
}`;

const NOISE = /* glsl */ `
vec4 texMain(vec2 uv){
  return vec4(fbm(uv, vec2(4.), 6) * 0.5 + 0.5, fbm(uv + 0.3, vec2(16.), 5) * 0.5 + 0.5, vnoise(uv * 64., vec2(64.)), hash12(floor(uv * uRes)));
}`;

export function generateTextures(renderer: THREE.WebGLRenderer, quality: number): TexSet {
  const g = new TexGen(renderer);
  const S = quality >= 2 ? 1024 : 512;
  const S2 = quality >= 2 ? 512 : 256;
  // The texture shaders linearise with toLin(), so uniforms must stay sRGB-encoded;
  // THREE.Color(hex) would already convert to linear and darken the result twice.
  const col = (h: string) => new THREE.Color(h).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  const v3 = (c: { r: number; g: number; b: number }) => new THREE.Vector3(c.r, c.g, c.b);

  const sandH = g.run(SAND_H, { width: S, float: true, seed: 3 });
  const sandNormal = g.normalFrom(sandH, 9, S);
  const sandAlbedo = g.run(SAND_A, { width: S, srgb: true, uniforms: { uH: { value: sandH } }, seed: 4 });
  const sandMacro = g.run(SAND_MACRO, { width: 512, seed: 5 });

  const asphaltAlbedo = g.run(ROAD_A, { width: S2, height: S, srgb: true, seed: 6 });
  const asphaltH = g.run(ROAD_H, { width: S2, height: S, float: true, seed: 6 });
  const asphaltNormal = g.normalFrom(asphaltH, 3.5, S2, S, 6);
  const asphaltORM = g.run(ROAD_ORM, { width: S2, height: S, seed: 6 });

  const plankU = (dark: string, mid: string, grey: string, weather: number) => ({
    uDark: { value: v3(col(dark)) }, uMid: { value: v3(col(mid)) }, uGrey: { value: v3(col(grey)) }, uWeather: { value: weather },
  });
  const planksDark = g.run(PLANKS_A, { width: S, srgb: true, seed: 8, uniforms: plankU('#44301f', '#7e5d3c', '#8a7c6a', 0.45) });
  const planksLight = g.run(PLANKS_A, { width: S, srgb: true, seed: 8, uniforms: plankU('#7a5a38', '#b58a58', '#a89478', 0.15) });
  const planksH = g.run(PLANKS_H, { width: S, float: true, seed: 8 });
  const planksNormal = g.normalFrom(planksH, 6, S);
  const planksRough = g.run(PLANKS_R, { width: S2, seed: 8 });

  const corrH = g.run(CORR_H, { width: S2, float: true, seed: 9 });
  const corrugatedNormal = g.normalFrom(corrH, 3, S2);
  const corrugated = g.run(CORR_A, { width: S2, srgb: true, seed: 9, uniforms: { uRust: { value: 0.25 } } });
  const corrugatedRust = g.run(CORR_A, { width: S2, srgb: true, seed: 10, uniforms: { uRust: { value: 0.85 } } });
  const corrugatedORM = g.run(CORR_ORM, { width: S2, seed: 9, uniforms: { uRust: { value: 0.25 } } });
  const corrugatedRustORM = g.run(CORR_ORM, { width: S2, seed: 10, uniforms: { uRust: { value: 0.85 } } });

  const concrete = g.run(CONC_A, { width: S, srgb: true, seed: 11 });
  const concH = g.run(CONC_H, { width: S, float: true, seed: 11 });
  const concreteNormal = g.normalFrom(concH, 4, S);

  const rust = g.run(RUST_A, { width: S2, srgb: true, seed: 12 });
  const rustH = g.run(RUST_H, { width: S2, float: true, seed: 12 });
  const rustNormal = g.normalFrom(rustH, 5, S2);

  const wear = g.run(WEAR, { width: S, seed: 13 });

  const rockH = g.run(ROCK_H, { width: S, float: true, seed: 14 });
  const rockNormal = g.normalFrom(rockH, 5, S);
  const rockDetail = g.run(ROCK_A, { width: S, uniforms: { uH: { value: rockH } }, seed: 14 });

  const fabric = g.run(FABRIC, { width: 256, seed: 15, uniforms: { uMode: { value: 0 } } });
  const fabricH = g.run(`uniform sampler2D uF; vec4 texMain(vec2 uv){ return vec4(texture2D(uF, uv).a, 0., 0., 1.); }`, { width: 256, float: true, uniforms: { uF: { value: fabric } } });
  const fabricNormal = g.normalFrom(fabricH, 2.5, 256);
  const vinylH = g.run(VINYL_H, { width: 512, float: true, seed: 16 });
  const vinylNormal = g.normalFrom(vinylH, 2.0, 512);
  const carpet = g.run(CARPET, { width: 256, seed: 17 });

  const tread = g.run(TREAD_A, { width: 512, height: 256, srgb: true, seed: 18 });
  const treadH = g.run(TREAD_H, { width: 512, height: 256, float: true, seed: 18 });
  const treadNormal = g.normalFrom(treadH, 6, 512, 256);

  const cactus = g.run(CACTUS_A, { width: 256, height: 512, srgb: true, seed: 19 });
  const cactH = g.run(CACTUS_H, { width: 256, height: 512, float: true, seed: 19 });
  const cactusNormal = g.normalFrom(cactH, 5, 256, 512);

  const puff = g.run(PUFF, { width: 128, seed: 20, wrap: false });
  const glassDirt = g.run(GLASS_DIRT, { width: 512, seed: 21 });
  const furH = g.run(FUR_H, { width: 256, float: true, seed: 22 });
  const furNormal = g.normalFrom(furH, 3, 256);
  const fur = g.run(FUR_A, { width: 256, srgb: true, uniforms: { uH: { value: furH } }, seed: 22 });
  const barkH = g.run(BARK_H, { width: 256, height: 512, float: true, seed: 23 });
  const barkNormal = g.normalFrom(barkH, 4, 256, 512);
  const bark = g.run(BARK_A, { width: 256, height: 512, srgb: true, uniforms: { uH: { value: barkH } }, seed: 23 });
  const metalH = g.run(METAL_H, { width: 256, float: true, seed: 24 });
  const metalNormal = g.normalFrom(metalH, 2, 256);
  const metalDark = g.run(METAL_A, { width: 256, uniforms: { uH: { value: metalH } }, seed: 24 });
  const grass = g.run(GRASS, { width: 256, srgb: true, seed: 25, wrap: false });
  const cardboard = g.run(CARDBOARD, { width: 256, srgb: true, seed: 26 });
  const noise = g.run(NOISE, { width: 256, seed: 27 });

  return {
    sandAlbedo, sandNormal, sandMacro, asphaltAlbedo, asphaltNormal, asphaltORM, planksDark, planksLight, planksNormal, planksRough,
    corrugated, corrugatedRust, corrugatedNormal, corrugatedORM, corrugatedRustORM, concrete, concreteNormal, rust, rustNormal, wear,
    rockDetail, rockNormal, fabric, fabricNormal, vinylNormal, carpet, tread, treadNormal, cactus, cactusNormal, puff, glassDirt,
    fur, furNormal, bark, barkNormal, metalDark, metalNormal, grass, cardboard, noise,
  };
}
