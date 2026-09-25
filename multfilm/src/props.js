// Shared 2D props: the flash burst, the big "3.5 PRO" lantern, wooden signs,
// captions, the title logo and fireworks.
import { FB, scratch, outlined } from './engine/fb.js';
import { text, textWidth } from './engine/font.js';
import { clamp, mix, hash, lerp, TAU, E, seg } from './engine/core.js';
import { GEM } from './sprites/star.js';

// Flash pop: a bright, short-lived burst (Google colours) with a label, starting at t0
export function flashPop(fb, t, t0, x, y, o = {}) {
  const dt = t - t0, life = o.life || 1.2;
  if (dt < 0 || dt > life) return;
  const k = 1 - dt / life, R = (o.size || 40) * E.outCubic(Math.min(1, dt / 0.3));
  if (dt < 0.18) fb.glow(x, y, R * 2.4 + 20, 0xffffff, 1.4 * (1 - dt / 0.18), 6);
  fb.glow(x, y, R * 1.3, 0xfff0c0, 0.7 * k, 6);
  const cols = [0xea4335, 0x4285f4, 0xfbbc04, 0x34a853];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + (o.seed || 0), r = R * (0.7 + 0.5 * hash(i + 3)) * (0.4 + 0.6 * E.outCubic(Math.min(1, dt / 0.6)));
    const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r + dt * dt * 18), c = cols[i % 4];
    const s = dt < 0.5 ? 2 : 1;
    fb.add(px, py, 0xffffff, k); for (let d = 1; d <= s; d++) { fb.add(px - d, py, c, k); fb.add(px + d, py, c, k); fb.add(px, py - d, c, k); fb.add(px, py + d, c, k); }
  }
  if (dt < 0.5) fb.ring(x, y, R * (0.6 + dt * 1.4), 0xffffff, 1);
  if (o.label && dt < life * 0.85) {
    const a = dt < 0.15 ? dt / 0.15 : 1 - Math.max(0, (dt - life * 0.6) / (life * 0.25));
    text(fb, o.label, x, y - R - 12, mix(0x101020, 0xffffff, clamp(a)), { font: 'big', align: 'center', outline: 0x1a1f4d });
  }
}

// (x, y) = bottom centre. o: inflate (0 saggy..1 full), w, h, lit, label, t, patches, lean
export function bigLantern(fb, x, y, o = {}) {
  const inf = clamp(o.inflate === undefined ? 1 : o.inflate), W2 = (o.w || 56) / 2, Hf = o.h || 70;
  const t = o.t || 0, lit = o.lit || 0;
  const h = lerp(Hf * 0.28, Hf, E.outQuad(inf));
  const wob = (1 - inf) * Math.sin(t * 3) * 1.5;
  const lean = (o.lean || 0) + (1 - inf) * 10;
  const cols = [GEM.blue, GEM.red, GEM.yellow, GEM.green];
  const s = scratch(W2 * 2 + 40, Hf + 20, 'bigl');
  const cx = s.w / 2, by = s.h - 4;
  for (let py = 0; py < h; py++) {
    const v = py / h; // 0 top .. 1 bottom
    // profile: round top, narrower mouth; saggy -> wider, flatter
    let half = W2 * Math.sqrt(Math.max(0, 1 - Math.pow(1 - v * 1.05, 2))) * (v > 0.8 ? lerp(1, 0.72, (v - 0.8) / 0.2) : 1);
    half *= lerp(1.25, 1, inf);
    const shift = lean * (1 - v) * (1 - v) + wob * Math.sin(v * 6);
    const yy = by - h + py;
    for (let px = -Math.round(half); px <= Math.round(half); px++) {
      const u = (px + half) / (2 * half + 0.001);
      const band = Math.floor(u * 8) % 4;
      let c = cols[band];
      const edge = Math.abs(u - 0.5) * 2;
      c = mix(c, 0x000000, edge * edge * 0.45 + (1 - inf) * 0.25);
      if (lit > 0) c = mix(c, 0xffffff, lit * (1 - edge) * 0.45);
      if ((1 - inf) > 0.2 && Math.sin(v * 18 + u * 9 + t) > 0.8) c = mix(c, 0x000000, 0.25); // wrinkles
      s.set(cx + px + shift, yy, c);
    }
  }
  // mouth ring and burner
  s.rect(cx - W2 * 0.55, by, W2 * 1.1, 2, 0x5a4636);
  if (o.patches) {
    s.rect(cx - 8, by - h * 0.6, 6, 5, 0xe8dcc0); s.line(cx - 8, by - h * 0.6, cx - 3, by - h * 0.6 + 4, 0x9a8a70);
    s.rect(cx + 6, by - h * 0.35, 5, 4, 0xe8dcc0);
  }
  const spr = outlined(s, 0x1c2046);
  fb.blit(spr, x - spr.w / 2, y - spr.h + 3);
  if (o.label && inf > 0.35) {
    const ly = y - h * 0.62;
    text(fb, o.label, x + lean * 0.3, ly, 0xffffff, { font: 'big', align: 'center', outline: 0x1c2046 });
  }
  return { top: y - h, h };
}

export function woodSign(fb, x, y, str, o = {}) {
  // (x, y) centre of the board
  const font = o.font || 'small', tw = textWidth(str, font), th = font === 'small' ? 5 : 7;
  const w = tw + 8, h = th + 6;
  if (o.hang) { fb.line(x - w / 2 + 3, y - h / 2, x - 3, y - h / 2 - o.hang, 0x3b2a20); fb.line(x + w / 2 - 3, y - h / 2, x + 3, y - h / 2 - o.hang, 0x3b2a20); }
  if (o.post) fb.rect(x - 1, y + h / 2, 3, o.post, 0x6d4a32);
  fb.rect(Math.round(x - w / 2) - 1, Math.round(y - h / 2) - 1, w + 2, h + 2, 0x3b2a20);
  fb.rect(Math.round(x - w / 2), Math.round(y - h / 2), w, h, o.color || 0xb98a5a);
  fb.rect(Math.round(x - w / 2), Math.round(y - h / 2), w, 1, 0xd8ac7a);
  text(fb, str, Math.round(x), Math.round(y - th / 2), o.ink || 0x2a1a10, { font, align: 'center' });
  return { w, h };
}

// Film caption card: slides in at t0, out at t1 (top-left)
export function caption(fb, t, t0, t1, str, o = {}) {
  if (t < t0 || t > t1 + 0.4) return;
  const kin = E.outCubic(seg(t, t0, t0 + 0.45)), kout = E.inCubic(seg(t, t1, t1 + 0.4));
  const sc = o.scale || 1, w = textWidth(str) * sc + 16, h = 7 * sc + 10;
  const x = Math.round(lerp(-w - 4, o.x || 10, kin) - kout * (w + 20)), y = o.y || 12;
  fb.rect(x, y, w, h, 0x0c0f1c, 0.72);
  fb.rect(x, y + h, w, 1, 0x000000, 0.4);
  const cols = [GEM.blue, GEM.red, GEM.yellow, GEM.green];
  for (let i = 0; i < 4; i++) fb.rect(x + (w / 4) * i, y + h - 2, Math.ceil(w / 4), 2, o.bar || cols[i]);
  const n = Math.floor(seg(t, t0 + 0.2, t0 + 0.2 + str.length * 0.035) * str.length);
  text(fb, str, x + 8, y + 5, 0xffffff, { scale: sc, chars: n });
}

// Big title text with vertical gradient, outline and drop shadow
export function title(fb, str, x, y, o = {}) {
  const sc = o.scale || 4, spacing = o.spacing === undefined ? 1 : o.spacing;
  const w = textWidth(str, 'big', spacing) * sc, h = 7 * sc;
  const s = new FB(w + 4, h + 4).clear();
  const top = o.top || 0xfff3c4, bot = o.bottom || 0xff9d5c;
  text(s, str, 2, 2, (i) => 0, { scale: sc, spacing });
  for (let yy = 0; yy < s.h; yy++) {
    const c = mix(top, bot, clamp((yy - 2) / h));
    for (let xx = 0; xx < s.w; xx++) if (s.opaque(xx, yy)) s.set(xx, yy, (yy - 2) % sc === 0 && yy - 2 < sc ? mix(c, 0xffffff, 0.5) : c);
  }
  let spr = outlined(s, o.outline || 0x2a1840, true);
  spr = outlined(spr, o.outline2 || o.outline || 0x2a1840, false);
  const X = Math.round(x - spr.w / 2), Y = Math.round(y - spr.h / 2);
  fb.blit(spr, X + 2, Y + 3, { solid: o.shadow || 0x000000, alpha: 0.45 });
  fb.blit(spr, X, Y, { alpha: o.alpha === undefined ? 1 : o.alpha, dither: o.dither });
  return { w: spr.w, h: spr.h };
}

// Firework: a rising spark trail, then a big two-tone burst with falling glitter
export function firework(fb, t, t0, x, y, cols, seed = 0) {
  const dt = t - t0;
  if (dt < 0 || dt > 2.2) return;
  const riseT = 0.45;
  if (dt < riseT) {
    const k = dt / riseT;
    const py = y + (1 - E.outQuad(k)) * 90;
    for (let i = 0; i < 6; i++) fb.add(x + Math.sin(i + t * 30) * 0.5, py + i * 2, 0xffe0a0, (1 - i / 6) * 0.9);
    return;
  }
  const b = dt - riseT, life = 1.7, k = 1 - b / life;
  if (b < 0.12) fb.glow(x, y, 26 * (1 - b / 0.12), 0xffffff, 1.0, 5);
  fb.glow(x, y, 30, cols[0], 0.25 * k, 5);
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(i + seed * 40) * 0.2;
    const sp = 55 * (0.75 + hash(i * 3 + seed) * 0.4);
    const r = sp * E.outCubic(Math.min(1, b / 0.9));
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r + b * b * 16;
    const c = i % 2 ? cols[0] : cols[1];
    const tw = hash(i * 7 + Math.floor(t * 20)) > 0.3 ? 1 : 0.4;
    fb.add(px, py, c, k * tw);
    fb.add(px + 1, py, c, k * tw * 0.7);
    fb.add(px, py + 1, c, k * tw * 0.7);
    fb.add(px - Math.cos(a) * 3, py - Math.sin(a) * 3 - 1, c, k * 0.35);
  }
}
