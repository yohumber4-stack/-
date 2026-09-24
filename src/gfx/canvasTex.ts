import * as THREE from 'three';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function toTex(c: HTMLCanvasElement, srgb = true, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Speckle/grime overlay drawn onto a canvas to make printed graphics look aged. */
export function weather(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 0.5, seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.save();
  for (let i = 0; i < 260 * amount; i++) {
    const x = rnd() * w, y = rnd() * h, r = rnd() * (w / 40) + 1;
    ctx.fillStyle = `rgba(${90 + rnd() * 60},${60 + rnd() * 40},${30 + rnd() * 20},${0.08 + rnd() * 0.25 * amount})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + rnd()), rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(255,240,210,${0.08 * amount})`);
  g.addColorStop(1, `rgba(90,60,30,${0.22 * amount})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40 * amount; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.1})`;
    ctx.lineWidth = rnd() * 1.5;
    ctx.beginPath();
    const x = rnd() * w, y = rnd() * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * w * 0.3, y + (rnd() - 0.5) * h * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

export const FONT = `"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif`;
export const FONT_COND = `"Arial Narrow", "Roboto Condensed", "Segoe UI", Arial, sans-serif`;

const texCache = new Map<string, THREE.Texture>();
export function cachedTex(key: string, make: () => THREE.Texture) {
  let t = texCache.get(key);
  if (!t) {
    t = make();
    texCache.set(key, t);
  }
  return t;
}

/** Green road sign plate with white text (km posts, destinations). */
export function roadSignTex(lines: string[], opts: { bg?: string; fg?: string; w?: number; h?: number; border?: boolean; font?: string; seed?: number } = {}) {
  const W = opts.w ?? 512, H = opts.h ?? 256;
  const [c, x] = canvas(W, H);
  x.fillStyle = opts.bg ?? '#1f5a3a';
  x.fillRect(0, 0, W, H);
  if (opts.border !== false) {
    x.strokeStyle = opts.fg ?? '#f2f2ec';
    x.lineWidth = H * 0.035;
    const m = H * 0.06;
    x.beginPath();
    x.roundRect(m, m, W - 2 * m, H - 2 * m, H * 0.07);
    x.stroke();
  }
  x.fillStyle = opts.fg ?? '#f2f2ec';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const n = lines.length;
  const fs = Math.min(H * (n === 1 ? 0.55 : 0.34), (W * 1.6) / Math.max(...lines.map((l) => l.length), 3));
  x.font = `700 ${fs}px ${opts.font ?? FONT_COND}`;
  lines.forEach((l, i) => x.fillText(l, W / 2, H / 2 + (i - (n - 1) / 2) * fs * 1.12));
  weather(x, W, H, 0.55, opts.seed ?? lines.join('').length);
  return toTex(c);
}
