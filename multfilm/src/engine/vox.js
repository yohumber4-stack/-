// Tiny software voxel renderer: voxel models -> quads with baked AO, z-buffered
// rasterisation at native pixel resolution, point lights, fog, outlines, bloom,
// and depth-tested 2D billboards (HD-2D style characters in 3D worlds).
import { W, H, clamp, bayer } from './core.js';
import { FB } from './fb.js';

export const EMIT = 1 << 24;
const SOLID = 0x80000000;

export class VoxModel {
  constructor(sx, sy, sz) {
    this.sx = sx; this.sy = sy; this.sz = sz;
    this.d = new Uint32Array(sx * sy * sz);
  }
  inb(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz; }
  set(x, y, z, c) { if (this.inb(x, y, z)) this.d[(y * this.sz + z) * this.sx + x] = ((c & 0x1ffffff) | SOLID) >>> 0; }
  del(x, y, z) { if (this.inb(x, y, z)) this.d[(y * this.sz + z) * this.sx + x] = 0; }
  get(x, y, z) { return this.inb(x, y, z) ? this.d[(y * this.sz + z) * this.sx + x] : 0; }
  solid(x, y, z) { return this.inb(x, y, z) && this.d[(y * this.sz + z) * this.sx + x] !== 0; }
  box(x0, y0, z0, x1, y1, z1, c) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
      this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
  }
  ellipsoid(cx, cy, cz, rx, ry, rz, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, dz = (z + 0.5 - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
        }
  }
}

// face definitions: normal + tangents
const DIRS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
const FACE_DEF = DIRS.map((n) => {
  const axis = n[0] ? 0 : n[1] ? 1 : 2;
  const t1 = (axis + 1) % 3, t2 = (axis + 2) % 3;
  const plane = n[axis] > 0 ? 1 : 0;
  let corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => {
    const c = [0, 0, 0];
    c[axis] = plane; c[t1] = a; c[t2] = b;
    return c;
  });
  // ensure counter-clockwise winding seen from outside
  const e1 = corners[1].map((v, i) => v - corners[0][i]), e2 = corners[2].map((v, i) => v - corners[0][i]);
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) corners = corners.reverse();
  return { n, axis, t1, t2, corners };
});
const AO_LEVEL = [0.42, 0.62, 0.8, 1.0];

// Build quads with per-vertex AO from a voxel model.
export function meshify(m, ox = 0, oy = 0, oz = 0) {
  const pos = [], col = [], nrm = [], ao = [];
  for (let y = 0; y < m.sy; y++)
    for (let z = 0; z < m.sz; z++)
      for (let x = 0; x < m.sx; x++) {
        const v = m.get(x, y, z);
        if (!v) continue;
        for (let f = 0; f < 6; f++) {
          const F = FACE_DEF[f], n = F.n;
          if (m.solid(x + n[0], y + n[1], z + n[2])) continue;
          for (const c of F.corners) {
            pos.push(x + c[0] + ox, y + c[1] + oy, z + c[2] + oz);
            const s1 = c[F.t1] ? 1 : -1, s2 = c[F.t2] ? 1 : -1;
            const d1 = [0, 0, 0], d2 = [0, 0, 0];
            d1[F.t1] = s1; d2[F.t2] = s2;
            const bx = x + n[0], by = y + n[1], bz = z + n[2];
            const A = m.solid(bx + d1[0], by + d1[1], bz + d1[2]) ? 1 : 0;
            const B = m.solid(bx + d2[0], by + d2[1], bz + d2[2]) ? 1 : 0;
            const C = m.solid(bx + d1[0] + d2[0], by + d1[1] + d2[1], bz + d1[2] + d2[2]) ? 1 : 0;
            ao.push(AO_LEVEL[A && B ? 0 : 3 - (A + B + C)]);
          }
          col.push(v & 0x1ffffff);
          nrm.push(f);
        }
      }
  return { n: nrm.length, pos: Float32Array.from(pos), col: Uint32Array.from(col), nrm: Uint8Array.from(nrm), ao: Float32Array.from(ao) };
}

const NEAR = 0.15;

export class R3D {
  constructor(w = W, h = H) {
    this.w = w; this.h = h;
    this.z = new Float32Array(w * h);
    this.gr = new Float32Array(w * h); this.gg = new Float32Array(w * h); this.gb = new Float32Array(w * h);
    this.ambient = [0.3, 0.32, 0.45];
    this.sun = { dir: norm([-0.4, 0.8, -0.3]), color: [0.5, 0.5, 0.6] };
    this.points = [];
    this.tmp = new FB(w, h);
    this.poly = new Float32Array(8 * 6);
    this.poly2 = new Float32Array(8 * 6);
  }
  camera(eye, target, fov = 50, roll = 0) {
    this.eye = eye;
    const f = norm(sub(target, eye));
    let r = norm(cross(f, [0, 1, 0]));
    let u = cross(r, f);
    if (roll) {
      const c = Math.cos(roll), s = Math.sin(roll);
      const r2 = [r[0] * c + u[0] * s, r[1] * c + u[1] * s, r[2] * c + u[2] * s];
      u = [u[0] * c - r[0] * s, u[1] * c - r[1] * s, u[2] * c - r[2] * s];
      r = r2;
    }
    this.f = f; this.r = r; this.u = u;
    this.focal = this.h / 2 / Math.tan((fov * Math.PI) / 360);
  }
  clear() { this.z.fill(Infinity); this.gr.fill(0); this.gg.fill(0); this.gb.fill(0); }
  toCam(x, y, z) {
    const dx = x - this.eye[0], dy = y - this.eye[1], dz = z - this.eye[2];
    return [dx * this.r[0] + dy * this.r[1] + dz * this.r[2], dx * this.u[0] + dy * this.u[1] + dz * this.u[2], dx * this.f[0] + dy * this.f[1] + dz * this.f[2]];
  }
  project(x, y, z) {
    const c = this.toCam(x, y, z);
    if (c[2] < NEAR) return null;
    return [this.w / 2 + (c[0] / c[2]) * this.focal, this.h / 2 - (c[1] / c[2]) * this.focal, c[2]];
  }
  // light at a world point for a given normal (null = omni). Returns [r,g,b] multipliers
  lightAt(x, y, z, n) {
    let r = this.ambient[0], g = this.ambient[1], b = this.ambient[2];
    const s = this.sun;
    const sd = n ? Math.max(0, n[0] * s.dir[0] + n[1] * s.dir[1] + n[2] * s.dir[2]) : 0.6;
    r += s.color[0] * sd; g += s.color[1] * sd; b += s.color[2] * sd;
    for (const L of this.points) {
      const dx = L.p[0] - x, dy = L.p[1] - y, dz = L.p[2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > L.r * L.r) continue;
      const d = Math.sqrt(d2) + 1e-6;
      let k = 1 - d / L.r;
      k *= k * (L.k || 1);
      if (n) k *= Math.max(0, (n[0] * dx + n[1] * dy + n[2] * dz) / d) * 0.7 + 0.3;
      r += L.c[0] * k; g += L.c[1] * k; b += L.c[2] * k;
    }
    return [r, g, b];
  }

  // xf: {x, y, z, rot (around Y), s (scale), cx, cz (pivot)}; o: {emit: multiplier, tint:[r,g,b], lightK}
  drawMesh(fb, mesh, xf = {}, o = {}) {
    const s = xf.s || 1, rot = xf.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
    const tx = xf.x || 0, ty = xf.y || 0, tz = xf.z || 0, pcx = xf.cx || 0, pcy = xf.cy || 0, pcz = xf.cz || 0;
    const P = mesh.pos, A = mesh.ao;
    const poly = this.poly;
    const emitK = o.emit === undefined ? 1 : o.emit;
    const tint = o.tint;
    for (let q = 0; q < mesh.n; q++) {
      const f = mesh.nrm[q], n0 = DIRS[f];
      const n = rot ? [n0[0] * cs + n0[2] * sn, n0[1], -n0[0] * sn + n0[2] * cs] : n0;
      const cval = mesh.col[q];
      const emissive = (cval & EMIT) !== 0;
      const cr0 = (cval >> 16) & 255, cg0 = (cval >> 8) & 255, cb0 = cval & 255;
      // quick backface test with face centre
      let cxw = 0, cyw = 0, czw = 0;
      for (let k = 0; k < 4; k++) {
        const i = (q * 4 + k) * 3;
        let px = (P[i] - pcx) * s, py = (P[i + 1] - pcy) * s, pz = (P[i + 2] - pcz) * s;
        if (rot) { const rx = px * cs + pz * sn; pz = -px * sn + pz * cs; px = rx; }
        px += tx; py += ty; pz += tz;
        cxw += px; cyw += py; czw += pz;
        const c = this.toCam(px, py, pz);
        let lr, lg, lb;
        if (emissive) { lr = lg = lb = emitK; }
        else {
          const L = this.lightAt(px, py, pz, n);
          const a = A[q * 4 + k];
          lr = L[0] * a; lg = L[1] * a; lb = L[2] * a;
        }
        let r = cr0 * lr, g = cg0 * lg, b = cb0 * lb;
        if (tint) { r *= tint[0]; g *= tint[1]; b *= tint[2]; }
        const j = k * 6;
        poly[j] = c[0]; poly[j + 1] = c[1]; poly[j + 2] = c[2]; poly[j + 3] = r; poly[j + 4] = g; poly[j + 5] = b;
      }
      const vx = cxw / 4 - this.eye[0], vy = cyw / 4 - this.eye[1], vz = czw / 4 - this.eye[2];
      if (vx * n[0] + vy * n[1] + vz * n[2] >= 0) continue;
      this.polyRaster(fb, poly, 4, emissive ? (o.glow === undefined ? 1 : o.glow) : 0);
    }
  }

  // poly: camera-space verts [x,y,z,r,g,b]*n. Clips to near plane, projects, fans triangles.
  polyRaster(fb, poly, n, glow) {
    let src = poly, cnt = n;
    let needClip = false;
    for (let k = 0; k < n; k++) if (poly[k * 6 + 2] < NEAR) { needClip = true; break; }
    if (needClip) {
      const out = this.poly2;
      let m = 0;
      for (let k = 0; k < n; k++) {
        const a = k * 6, b = ((k + 1) % n) * 6;
        const za = poly[a + 2], zb = poly[b + 2];
        if (za >= NEAR) { for (let i = 0; i < 6; i++) out[m * 6 + i] = poly[a + i]; m++; }
        if ((za >= NEAR) !== (zb >= NEAR)) {
          const t = (NEAR - za) / (zb - za);
          for (let i = 0; i < 6; i++) out[m * 6 + i] = poly[a + i] + (poly[b + i] - poly[a + i]) * t;
          m++;
        }
      }
      if (m < 3) return;
      src = out; cnt = m;
    }
    const hw = this.w / 2, hh = this.h / 2, F = this.focal;
    for (let k = 0; k < cnt; k++) {
      const j = k * 6, z = src[j + 2];
      src[j] = hw + (src[j] / z) * F;
      src[j + 1] = hh - (src[j + 1] / z) * F;
    }
    for (let k = 1; k + 1 < cnt; k++) this.tri(fb, src, 0, k * 6, (k + 1) * 6, glow);
  }

  tri(fb, v, a, b, c, glow) {
    let x0 = v[a], y0 = v[a + 1], x1 = v[b], y1 = v[b + 1], x2 = v[c], y2 = v[c + 1];
    let area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-6) return;
    let A = a, B = b;
    if (area < 0) { A = b; B = a; [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; area = -area; }
    const iz0 = 1 / v[A + 2], iz1 = 1 / v[B + 2], iz2 = 1 / v[c + 2];
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) return;
    const inv = 1 / area, u = fb.u8, zb = this.z, W2 = this.w;
    const r0 = v[A + 3], g0 = v[A + 4], b0 = v[A + 5], r1 = v[B + 3], g1 = v[B + 4], b1 = v[B + 5], r2 = v[c + 3], g2 = v[c + 4], b2 = v[c + 5];
    for (let py = minY; py <= maxY; py++) {
      const sy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5;
        const w0 = ((x1 - sx) * (y2 - sy) - (x2 - sx) * (y1 - sy)) * inv;
        if (w0 < -1e-4) continue;
        const w1 = ((x2 - sx) * (y0 - sy) - (x0 - sx) * (y2 - sy)) * inv;
        if (w1 < -1e-4) continue;
        const w2 = 1 - w0 - w1;
        if (w2 < -1e-4) continue;
        const iz = w0 * iz0 + w1 * iz1 + w2 * iz2;
        const d = 1 / iz;
        const pi = py * W2 + px;
        if (d >= zb[pi]) continue;
        zb[pi] = d;
        const j = pi << 2;
        const r = w0 * r0 + w1 * r1 + w2 * r2, g = w0 * g0 + w1 * g1 + w2 * g2, b = w0 * b0 + w1 * b1 + w2 * b2;
        u[j] = r; u[j + 1] = g; u[j + 2] = b; u[j + 3] = 255;
        if (glow) { this.gr[pi] += r * glow; this.gg[pi] += g * glow; this.gb[pi] += b * glow; }
        else if (this.gr[pi]) { this.gr[pi] = 0; this.gg[pi] = 0; this.gb[pi] = 0; }
      }
    }
  }

  // Composite a full-screen sprite layer drawn by fn(layer) at a single depth; mul tints by light.
  layer(fb, depth, fn, mul, glow = 0) {
    const L = this.tmp;
    L.clear();
    fn(L);
    const lu = L.u8, u = fb.u8, zb = this.z;
    const mr = mul ? mul[0] : 1, mg = mul ? mul[1] : 1, mb = mul ? mul[2] : 1;
    for (let i = 0, n = this.w * this.h; i < n; i++) {
      const j = i << 2;
      if (lu[j + 3] === 0) continue;
      if (depth >= zb[i]) continue;
      if (lu[j + 3] === 254) { u[j] += lu[j]; u[j + 1] += lu[j + 1]; u[j + 2] += lu[j + 2]; continue; }
      const a = lu[j + 3] / 255;
      const r = lu[j] * mr, g = lu[j + 1] * mg, b = lu[j + 2] * mb;
      u[j] += (r - u[j]) * a; u[j + 1] += (g - u[j + 1]) * a; u[j + 2] += (b - u[j + 2]) * a;
      if (a > 0.5) zb[i] = depth;
      if (glow) { this.gr[i] += r * glow; this.gg[i] += g * glow; this.gb[i] += b * glow; }
    }
  }

  // project a world point and draw a glowing particle with depth test
  spark(fb, x, y, z, c, k = 1, rad = 4) {
    const p = this.project(x, y, z);
    if (!p) return null;
    const sx = Math.round(p[0]), sy = Math.round(p[1]);
    if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return p;
    if (p[2] > this.z[sy * this.w + sx]) return p;
    const R = rad * Math.min(2, 40 / p[2]);
    fb.glow(sx, sy, Math.max(2, R), c, 0.5 * k, 4);
    fb.blend(sx, sy, 0xffffff, Math.min(1, k));
    return p;
  }

  fog(fb, color, near, far, maxK = 1) {
    const u = fb.u8, zb = this.z, R = (color >> 16) & 255, G = (color >> 8) & 255, B = color & 255;
    for (let i = 0, n = this.w * this.h; i < n; i++) {
      const d = zb[i];
      if (d === Infinity) continue;
      const k = clamp((d - near) / (far - near)) * maxK;
      if (k <= 0) continue;
      const j = i << 2;
      u[j] += (R - u[j]) * k; u[j + 1] += (G - u[j + 1]) * k; u[j + 2] += (B - u[j + 2]) * k;
    }
  }

  // darken the nearer pixel across depth discontinuities (pixel-art silhouettes)
  outline(fb, k = 0.55, rel = 0.06, abs = 0.6) {
    const zb = this.z, u = fb.u8, w = this.w, h = this.h;
    const mark = new Uint8Array(w * h);
    for (let y = 0; y < h - 1; y++)
      for (let x = 0; x < w - 1; x++) {
        const i = y * w + x, d = zb[i];
        for (const j of [i + 1, i + w]) {
          const e = zb[j];
          if (d === Infinity && e === Infinity) continue;
          if (e > d * (1 + rel) + abs) mark[i] = 1;
          else if (d > e * (1 + rel) + abs) mark[j] = 1;
        }
      }
    for (let i = 0; i < w * h; i++) if (mark[i]) { const j = i << 2; u[j] *= k; u[j + 1] *= k; u[j + 2] *= k; }
  }

  bloom(fb, k = 0.8, rad = 3) {
    const w = this.w, h = this.h, hw = w >> 1, hh = h >> 1;
    const r = new Float32Array(hw * hh), g = new Float32Array(hw * hh), b = new Float32Array(hw * hh);
    for (let y = 0; y < hh; y++)
      for (let x = 0; x < hw; x++) {
        const i0 = y * 2 * w + x * 2, o = y * hw + x;
        r[o] = (this.gr[i0] + this.gr[i0 + 1] + this.gr[i0 + w] + this.gr[i0 + w + 1]) / 4;
        g[o] = (this.gg[i0] + this.gg[i0 + 1] + this.gg[i0 + w] + this.gg[i0 + w + 1]) / 4;
        b[o] = (this.gb[i0] + this.gb[i0 + 1] + this.gb[i0 + w] + this.gb[i0 + w + 1]) / 4;
      }
    for (let pass = 0; pass < 2; pass++) { boxBlur(r, hw, hh, rad); boxBlur(g, hw, hh, rad); boxBlur(b, hw, hh, rad); }
    const u = fb.u8;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y >> 1) * hw + (x >> 1), j = (y * w + x) << 2;
        const th = bayer(x, y) * 6;
        u[j] += Math.floor(r[o] * k / 6 + th / 6) * 6; u[j + 1] += Math.floor(g[o] * k / 6 + th / 6) * 6; u[j + 2] += Math.floor(b[o] * k / 6 + th / 6) * 6;
      }
  }
}

function boxBlur(a, w, h, r) {
  const t = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += a[y * w + clampI(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      t[y * w + x] = s / (2 * r + 1);
      s += a[y * w + clampI(x + r + 1, 0, w - 1)] - a[y * w + clampI(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += t[clampI(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      a[y * w + x] = s / (2 * r + 1);
      s += t[clampI(y + r + 1, 0, h - 1) * w + x] - t[clampI(y - r, 0, h - 1) * w + x];
    }
  }
}
const clampI = (v, a, b) => (v < a ? a : v > b ? b : v);

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
