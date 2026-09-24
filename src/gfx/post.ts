import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.0 },
    uContrast: { value: 1.04 },
    uWarm: { value: 0.25 },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.018 },
    uTime: { value: 0 },
    uDamage: { value: 0 },
    uFade: { value: 0 },
    uLift: { value: new THREE.Vector3(0.004, 0.0035, 0.003) },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uRes: { value: new THREE.Vector2(1920, 1080) },
    uBlur: { value: 0 },
    uGrey: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSat, uContrast, uWarm, uVignette, uGrain, uTime, uDamage, uFade, uBlur, uGrey;
    uniform vec3 uLift, uGain;
    uniform vec2 uRes;
    varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (uBlur > 0.001) {
        vec2 px = uBlur * 3.0 / uRes;
        c = c * 0.4 + (texture2D(tDiffuse, vUv + vec2(px.x, 0.)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.)).rgb + texture2D(tDiffuse, vUv + vec2(0., px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0., px.y)).rgb) * 0.15;
      }
      c *= mix(vec3(1.0), vec3(1.06, 1.0, 0.9), uWarm);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat * (1.0 - uGrey));
      c = pow(max(c, 0.0) / 0.2, vec3(uContrast)) * 0.2;
      c = c * uGain + uLift;
      vec2 d = vUv - 0.5;
      d.x *= uRes.x / uRes.y * 0.75;
      float r2 = dot(d, d);
      c *= 1.0 - r2 * uVignette;
      float dm = uDamage * smoothstep(0.05, 0.55, sqrt(r2) * 1.3);
      c = mix(c, c * vec3(1.1, 0.25, 0.2) + vec3(0.05, 0.0, 0.0), dm);
      float n = fract(sin(dot(floor(vUv * uRes) + fract(uTime * 7.13) * 97.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uGrain * (0.15 + sqrt(max(l, 0.0)));
      c *= 1.0 - uFade;
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export class Post {
  composer: EffectComposer;
  renderPass: RenderPass;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  gtao: GTAOPass | null = null;
  output: OutputPass;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, samples: number) {
    this.scene = scene;
    this.camera = camera;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.32, 0.55, 2.6);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
  }

  setAO(enabled: boolean) {
    if (enabled && !this.gtao) {
      const size = new THREE.Vector2();
      this.renderer.getDrawingBufferSize(size);
      this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.blendIntensity = 0.85;
      this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      this.composer.insertPass(this.gtao, 1);
    } else if (!enabled && this.gtao) {
      this.composer.removePass(this.gtao);
      this.gtao.dispose();
      this.gtao = null;
    }
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    (this.grade.uniforms.uRes.value as THREE.Vector2).set(w, h);
  }

  render(dt: number) {
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}
