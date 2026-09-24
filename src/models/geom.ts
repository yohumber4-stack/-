import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { mergeGeometries, mergeVertices };

/** Merge geometries after normalising attribute sets (drops attributes not present in all). */
export function merge(geos: THREE.BufferGeometry[], groups = false): THREE.BufferGeometry {
  const list = geos.filter(Boolean).map((g) => (g.index ? g : g));
  if (!list.length) return new THREE.BufferGeometry();
  const names = new Set(Object.keys(list[0].attributes));
  for (const g of list) for (const n of [...names]) if (!g.attributes[n]) names.delete(n);
  const prepared = list.map((g) => {
    let c = g;
    for (const n of Object.keys(c.attributes)) if (!names.has(n)) c.deleteAttribute(n);
    if (!c.index) c = c; // mergeGeometries handles mixed? ensure all indexed
    return c;
  });
  const anyIndexed = prepared.some((g) => g.index);
  const allIndexed = prepared.every((g) => g.index);
  const final = anyIndexed && !allIndexed ? prepared.map((g) => (g.index ? g.toNonIndexed() : g)) : prepared;
  const m = mergeGeometries(final, groups);
  if (!m) throw new Error('merge failed');
  return m;
}

/** Box whose UVs are scaled in metres (1 UV unit = `tile` metres), vertical faces map v to height. */
export function boxUV(w: number, h: number, d: number, tile = 1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u: number, v: number;
    if (ny > 0.5) { u = x; v = z; }
    else if (nx > 0.5) { u = z; v = y; }
    else { u = x; v = y; }
    uv.setXY(i, u / tile, v / tile);
  }
  return g;
}

export function placed(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(sx, sy, sz),
  );
  g.applyMatrix4(m);
  return g;
}

export function setColor(g: THREE.BufferGeometry, c: THREE.Color | number | string): THREE.BufferGeometry {
  const col = c instanceof THREE.Color ? c : new THREE.Color(c as any);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/**
 * Tube along a polyline with per-ring radius function r(t, angle). Optional round caps.
 * Produces uv.x around (0..1), uv.y along in metres / vTile.
 */
export function tube(
  pts: THREE.Vector3[],
  radius: (t: number, a: number) => number,
  radial = 12,
  opts: { capStart?: boolean; capEnd?: boolean; capRings?: number; vTile?: number } = {},
): THREE.BufferGeometry {
  const n = pts.length;
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    tangents.push(b.clone().sub(a).normalize());
  }
  // parallel transport frames
  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  let ref = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let nrm = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i]);
      const s = axis.length();
      if (s > 1e-6) {
        axis.divideScalar(s);
        const ang = Math.acos(THREE.MathUtils.clamp(tangents[i - 1].dot(tangents[i]), -1, 1));
        nrm = nrm.clone().applyAxisAngle(axis, ang);
      }
    }
    normals.push(nrm.clone());
    binormals.push(new THREE.Vector3().crossVectors(tangents[i], nrm).normalize());
  }
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  let len = 0;
  const vTile = opts.vTile ?? 1;
  const ring = (i: number, t: number, scale: number, offset: THREE.Vector3 | null, vv: number) => {
    const c = offset ? pts[i].clone().add(offset) : pts[i];
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const r = radius(t, a) * scale;
      const dir = normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(binormals[i], Math.sin(a));
      pos.push(c.x + dir.x * r, c.y + dir.y * r, c.z + dir.z * r);
      uvs.push(k / radial, vv / vTile);
    }
  };
  let rings = 0;
  const capR = opts.capRings ?? 4;
  if (opts.capStart) {
    for (let c = capR; c >= 1; c--) {
      const ang = (c / capR) * Math.PI * 0.5;
      const r0 = radius(0, 0);
      ring(0, 0, Math.cos(ang) + 1e-3, tangents[0].clone().multiplyScalar(-Math.sin(ang) * r0), -Math.sin(ang) * r0);
      rings++;
    }
  }
  for (let i = 0; i < n; i++) {
    if (i > 0) len += pts[i].distanceTo(pts[i - 1]);
    ring(i, i / (n - 1), 1, null, len);
    rings++;
  }
  if (opts.capEnd) {
    const rEnd = radius(1, 0);
    for (let c = 1; c <= capR; c++) {
      const ang = (c / capR) * Math.PI * 0.5;
      ring(n - 1, 1, Math.cos(ang) + 1e-3, tangents[n - 1].clone().multiplyScalar(Math.sin(ang) * rEnd), len + Math.sin(ang) * rEnd);
      rings++;
    }
  }
  const V = radial + 1;
  for (let r = 0; r < rings - 1; r++)
    for (let k = 0; k < radial; k++) {
      const a = r * V + k, b = a + 1, c = a + V, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Catmull-Rom sampled points of a smooth curve through control points. */
export function curvePts(ctrl: THREE.Vector3[], samples: number): THREE.Vector3[] {
  const c = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  return c.getPoints(samples);
}

/** Lathe with UVs scaled by arc length. profile: [radius, y]. */
export function lathe(profile: [number, number][], segs = 24, phiStart = 0, phiLen = Math.PI * 2): THREE.BufferGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y));
  const g = new THREE.LatheGeometry(pts, segs, phiStart, phiLen);
  return g;
}

/** Extruded shape from a 2D outline (in XY), depth along Z, centred. */
export function extrude(shape: THREE.Shape, depth: number, bevel = 0, bevelSegs = 2, curveSegs = 12): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: bevelSegs,
    curveSegments: curveSegs,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function roundRectShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape();
  const x0 = cx - w / 2, y0 = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h);
  s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** Displace vertices along normals by a function (used for rocks/organic shapes). */
export function displace(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    const d = f(p, n);
    pos.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Bake a simple hemispheric ambient-occlusion term into vertex colours (darker low & inward). */
export function bakeAO(g: THREE.BufferGeometry, minY: number, maxY: number, strength = 0.5) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = (g.attributes.color as THREE.BufferAttribute) || setColor(g, 0xffffff).attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - minY) / (maxY - minY), 0, 1);
    const k = 1 - strength * (1 - Math.sqrt(t));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  col.needsUpdate = true;
  return g;
}
