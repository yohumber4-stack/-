import * as THREE from 'three';

/**
 * Global atmospheric fog shared by every built-in material: exponential height fog with
 * sun in-scattering. Values are Float32Arrays so that the per-material uniform clones made by
 * three.js keep referencing the same storage (cloneUniforms copies typed arrays by reference).
 */
export const FOG = {
  sunColor: new Float32Array([1, 0.9, 0.75]),
  sunDir: new Float32Array([0, 1, 0]),
  // x: height falloff, y: base height, z: sun scatter power, w: max fog amount
  params: new Float32Array([0.012, 0, 8, 1]),
};

export const FOG_PARS_FRAG = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogViewPos;
  uniform float fogDensity;
  uniform vec3 fogSunColor;
  uniform vec3 fogSunDir;
  uniform vec4 fogParams;
  vec3 applyFog(vec3 col, vec3 viewPos) {
    vec3 dirW = (vec4(viewPos, 0.0) * viewMatrix).xyz;
    float dist = length(dirW);
    vec3 fdir = dirW / max(dist, 1e-4);
    float k = fogParams.x;
    float y0 = max(cameraPosition.y - fogParams.y, -50.0);
    float dy = fdir.y * dist;
    float ht = abs(dy) > 0.05 ? (exp(-k * y0) - exp(-k * (y0 + dy))) / (k * dy) : exp(-k * y0);
    float amt = 1.0 - exp(-fogDensity * dist * max(ht, 0.0));
    float sunAmt = pow(max(dot(fdir, fogSunDir), 0.0), fogParams.z);
    vec3 fc = mix(fogColor, fogSunColor, sunAmt);
    return mix(col, fc, clamp(amt, 0.0, fogParams.w));
  }
#endif
`;

let installed = false;
export function installShaderPatches() {
  if (installed) return;
  installed = true;
  const libs = ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'matcap', 'points', 'dashed', 'sprite', 'shadow'] as const;
  for (const k of libs) {
    const lib = (THREE.ShaderLib as any)[k];
    if (!lib) continue;
    lib.uniforms.fogSunColor = { value: FOG.sunColor };
    lib.uniforms.fogSunDir = { value: FOG.sunDir };
    lib.uniforms.fogParams = { value: FOG.params };
  }
  const C = THREE.ShaderChunk as any;
  C.fog_pars_vertex = `#ifdef USE_FOG\n varying vec3 vFogViewPos;\n#endif\n`;
  C.fog_vertex = `#ifdef USE_FOG\n vFogViewPos = mvPosition.xyz;\n#endif\n`;
  C.fog_pars_fragment = FOG_PARS_FRAG;
  C.fog_fragment = `#ifdef USE_FOG\n gl_FragColor.rgb = applyFog(gl_FragColor.rgb, vFogViewPos);\n#endif\n`;
}

/** Uniform set to merge into custom ShaderMaterials that want the same fog. */
export function fogUniforms() {
  return {
    fogColor: { value: new THREE.Color() },
    fogDensity: { value: 0.00025 },
    fogSunColor: { value: FOG.sunColor },
    fogSunDir: { value: FOG.sunDir },
    fogParams: { value: FOG.params },
  };
}
