// Sky backdrops and the raycast sea plane shared by 3D scenes.
import { W, H, clamp, bayer, hash, noise2, mix, fract } from './core.js';
import { stars } from './fx.js';

export function nightSky(fb, t, o = {}) {
  fb.gradV(0, 0, fb.w, fb.h, o.stops || [0x0b1030, 0x16204f, 0x2a3570, 0x4a4f8a], 0, 1);
  stars(fb, t, o.seed || 3, o.n || 160, 0, 0, fb.w, fb.h * 0.8, { px: o.px || 0, py: o.py || 0 });
}

// Sky dome for 3D cameras: gradient by ray elevation, stars fixed in world directions.
// stops go from horizon (index 0) to zenith. Returns the horizon colour.
export function skyDome(fb, r3d, t, o = {}) {
  const stops = o.stops || [0x4a4f8a, 0x2a3570, 0x16204f, 0x0b1030];
  const w = fb.w, h = fb.h, F = r3d.focal, f = r3d.f, r = r3d.r, u = r3d.u;
  const n = stops.length - 1;
  for (let py = 0; py < h; py++) {
    const vy = -(py + 0.5 - h / 2) / F;
    for (let px = 0; px < w; px++) {
      const vx = (px + 0.5 - w / 2) / F;
      const dx = f[0] + vx * r[0] + vy * u[0], dy = f[1] + vx * r[1] + vy * u[1], dz = f[2] + vx * r[2] + vy * u[2];
      const el = dy / Math.sqrt(dx * dx + dy * dy + dz * dz);
      let k = clamp((el + 0.02) / (o.span || 0.75)) * n;
      const i = Math.min(n - 1, Math.floor(k)), fr = k - i;
      const c = fr > bayer(px, py) ? stops[i + 1] : stops[i];
      const j = (py * w + px) << 2;
      fb.u8[j] = (c >> 16) & 255; fb.u8[j + 1] = (c >> 8) & 255; fb.u8[j + 2] = c & 255; fb.u8[j + 3] = 255;
    }
  }
  const ns = o.stars === undefined ? 260 : o.stars;
  for (let i = 0; i < ns; i++) {
    const az = hash(i * 3 + 11) * Math.PI * 2, el = 0.06 + Math.pow(hash(i * 3 + 12), 0.8) * 1.4;
    const dir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    const cz = dir[0] * f[0] + dir[1] * f[1] + dir[2] * f[2];
    if (cz <= 0.05) continue;
    const sx = w / 2 + ((dir[0] * r[0] + dir[1] * r[1] + dir[2] * r[2]) / cz) * F;
    const sy = h / 2 - ((dir[0] * u[0] + dir[1] * u[1] + dir[2] * u[2]) / cz) * F;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
    const hz = hash(i * 3 + 13);
    const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + hz * 3) + hz * 40);
    const a = (0.35 + 0.65 * tw) * (o.starAlpha === undefined ? 1 : o.starAlpha) * clamp(el * 3);
    const c = hz > 0.8 ? 0xfff1c9 : hz > 0.5 ? 0xcfe3ff : 0xffffff;
    fb.blend(sx, sy, c, a);
    if (hz > 0.94) { fb.blend(sx + 1, sy, c, a * 0.5); fb.blend(sx - 1, sy, c, a * 0.5); fb.blend(sx, sy + 1, c, a * 0.5); fb.blend(sx, sy - 1, c, a * 0.5); }
  }
  if (o.moon) {
    const [az, el, rad] = o.moon;
    const dir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    const cz = dir[0] * f[0] + dir[1] * f[1] + dir[2] * f[2];
    if (cz > 0.05) {
      const sx = w / 2 + ((dir[0] * r[0] + dir[1] * r[1] + dir[2] * r[2]) / cz) * F;
      const sy = h / 2 - ((dir[0] * u[0] + dir[1] * u[1] + dir[2] * u[2]) / cz) * F;
      moonDisc(fb, sx, sy, rad, t);
      return { horizon: stops[0], moonX: sx, moonY: sy };
    }
  }
  return { horizon: stops[0], moonX: -999 };
}

export function moonDisc(fb, x, y, r, t = 0) {
  fb.glow(x, y, r * 4, 0xbfd4ff, 0.35, 6);
  fb.circle(x, y, r, 0xfdf6d8);
  fb.circle(x + r * 0.35, y - r * 0.2, r * 0.25, 0xe8dfbd);
  fb.circle(x - r * 0.3, y + r * 0.35, r * 0.18, 0xe8dfbd);
}

// Raycast a flat sea at height seaY for pixels where the ray hits the plane.
export function seaPass(fb, r3d, t, seaY, o = {}) {
  const w = fb.w, h = fb.h, F = r3d.focal, e = r3d.eye, f = r3d.f, r = r3d.r, u = r3d.u;
  const deep = o.deep || 0x0d1a3a, far = o.far || 0x3a4f8a, glint = o.glint || 0xdfe8ff;
  const moonX = o.moonX === undefined ? w * 0.75 : o.moonX;
  const U = fb.u8, zb = r3d.z;
  for (let py = 0; py < h; py++) {
    const vy = -(py + 0.5 - h / 2) / F;
    for (let px = 0; px < w; px++) {
      const vx = (px + 0.5 - w / 2) / F;
      const dx = f[0] + vx * r[0] + vy * u[0], dy = f[1] + vx * r[1] + vy * u[1], dz = f[2] + vx * r[2] + vy * u[2];
      if (dy >= -1e-4) continue;
      const tt = (seaY - e[1]) / dy;
      if (tt <= 0 || tt > (o.maxDist || 900)) continue;
      const hx = e[0] + dx * tt, hz = e[2] + dz * tt;
      const k = clamp(tt / (o.fade || 260));
      let c = mix(deep, far, Math.pow(k, 0.7));
      const wave = noise2(hx * 0.35 + t * 0.6, hz * 0.9 - t * 0.3);
      if (wave > 0.72) c = mix(c, 0xffffff, 0.12);
      const col = Math.abs(px - moonX) / (6 + k * 50);
      if (col < 1 && noise2(hx * 0.8 + t * 1.3, hz * 1.6) > 0.55 + col * 0.35) c = mix(c, glint, 0.85 - col * 0.4);
      if (o.tint) c = mix(c, o.tint, o.tintK || 0.3);
      const i = py * w + px, j = i << 2;
      U[j] = (c >> 16) & 255; U[j + 1] = (c >> 8) & 255; U[j + 2] = c & 255; U[j + 3] = 255;
      zb[i] = tt * (dx * f[0] + dy * f[1] + dz * f[2]);
    }
  }
}
