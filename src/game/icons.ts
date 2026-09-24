import * as THREE from 'three';
import type { ItemEntity } from './items';

/**
 * Structural copy sharing geometry/materials. Object3D.clone() deep-copies userData through JSON,
 * which throws on the item back-references stored there (and froze the frame loop).
 */
function cloneVisual(src: THREE.Object3D): THREE.Object3D {
  const mesh = src as THREE.Mesh;
  const dst: THREE.Object3D = mesh.isMesh ? new THREE.Mesh(mesh.geometry, mesh.material) : new THREE.Group();
  dst.position.copy(src.position);
  dst.quaternion.copy(src.quaternion);
  dst.scale.copy(src.scale);
  dst.visible = src.visible;
  for (const c of src.children) if (!(c as THREE.Light).isLight) dst.add(cloneVisual(c));
  return dst;
}

/** Renders small 3D thumbnails of items for the hotbar (cached as data URLs). */
export class IconRenderer {
  private cache = new Map<string, string>();
  private rt: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(26, 1, 0.01, 60);
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private buf: Uint8Array;
  private img: ImageData;

  constructor(private renderer: THREE.WebGLRenderer, private size = 112) {
    this.rt = new THREE.WebGLRenderTarget(size, size, { samples: 4, type: THREE.UnsignedByteType });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
    this.buf = new Uint8Array(size * size * 4);
    this.img = this.ctx.createImageData(size, size);
    const hemi = new THREE.HemisphereLight(0xfff4e0, 0x5a4a3a, 1.1);
    const key = new THREE.DirectionalLight(0xfff0dc, 1.9);
    key.position.set(2, 3, 2.5);
    const rim = new THREE.DirectionalLight(0xc8d8ff, 0.9);
    rim.position.set(-2.5, 1, -2);
    this.scene.add(hemi, key, rim);
  }

  key(e: ItemEntity) {
    const s = e.state;
    return [e.def.id, e.part?.kind ?? '', s.liquid ?? '', s.color ?? '', s.label ?? ''].join('|');
  }

  get(e: ItemEntity, env: THREE.Texture | null): string {
    const k = this.key(e);
    let url = this.cache.get(k);
    if (url) return url;
    url = this.render(e.obj, env);
    this.cache.set(k, url);
    return url;
  }

  private render(src: THREE.Object3D, env: THREE.Texture | null): string {
    const obj = cloneVisual(src);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    obj.scale.set(1, 1, 1);
    obj.visible = true;
    const holder = new THREE.Group();
    holder.add(obj);
    // pleasant three-quarter view
    holder.rotation.set(0.35, -0.75, 0.08);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    holder.position.sub(c);
    const r = Math.max(sz.x, sz.y, sz.z * 0.8) * 0.5 + 1e-3;
    const dist = r / Math.tan(THREE.MathUtils.degToRad(this.cam.fov * 0.5)) * 1.12;
    this.cam.position.set(0, 0, dist);
    this.cam.near = dist * 0.05;
    this.cam.far = dist * 4;
    this.cam.lookAt(0, 0, 0);
    this.cam.updateProjectionMatrix();
    this.scene.add(holder);
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.6;
    const r0 = this.renderer;
    const prevTarget = r0.getRenderTarget();
    const prevClear = r0.getClearColor(new THREE.Color());
    const prevAlpha = r0.getClearAlpha();
    const prevShadow = r0.shadowMap.autoUpdate;
    r0.shadowMap.autoUpdate = false;
    r0.setRenderTarget(this.rt);
    r0.setClearColor(0x000000, 0);
    r0.clear(true, true, true);
    r0.render(this.scene, this.cam);
    r0.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.buf);
    r0.setRenderTarget(prevTarget);
    r0.setClearColor(prevClear, prevAlpha);
    r0.shadowMap.autoUpdate = prevShadow;
    this.scene.remove(holder);
    const n = this.size;
    const d = this.img.data;
    for (let y = 0; y < n; y++) {
      const srcRow = (n - 1 - y) * n * 4;
      d.set(this.buf.subarray(srcRow, srcRow + n * 4), y * n * 4);
    }
    this.ctx.clearRect(0, 0, n, n);
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
}
