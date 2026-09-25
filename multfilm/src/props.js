// Props shared across scenes: sky lanterns, flash rockets, the big "3.5 PRO"
// lantern, calendars, signs, bubbles, captions and more.
import { FB, scratch, outlined } from './engine/fb.js';
import { text, textWidth } from './engine/font.js';
import { clamp, mix, hash, lerp, TAU, E, seg, scale as cscale } from './engine/core.js';
import { starShape, gemColorAt, GEM } from './chars/gemini.js';

// ---------- small icons ----------
export function claudeSpark(fb, x, y, r, c) {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.2, L = r * (i % 2 ? 0.7 : 1);
    fb.line(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, c);
  }
  fb.set(x, y, c);
}
export function blossom(fb, x, y, r, c) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU, b = ((i + 1) / 6) * TAU;
    fb.line(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b) * r, y + Math.sin(b) * r, c);
    fb.line(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, x + Math.cos(a + 1.2) * r, y + Math.sin(a + 1.2) * r, c);
  }
}
export function bolt(fb, x, y, s, c) {
  // lightning bolt about s px tall centred at x,y
  const k = s / 8;
  fb.poly([x + 1 * k, y - 4 * k, x - 2 * k, y + 0.5 * k, x, y + 0.5 * k, x - 1 * k, y + 4 * k, x + 2.5 * k, y - 1 * k, x + 0.3 * k, y - 1 * k], c);
}
export function qwenLogo(fb, x, y, c) {
  fb.rect(x - 1, y - 2, 3, 1, c); fb.rect(x - 2, y - 1, 1, 3, c); fb.rect(x + 2, y - 1, 1, 3, c); fb.rect(x - 1, y + 2, 3, 1, c); fb.set(x, y, c);
}

const KIND = {
  claude: { paper: 0xe88a64, dark: 0xa3492c, glow: 0xffa36b },
  openai: { paper: 0xf2f2f6, dark: 0x9a9fb8, glow: 0xdfe6ff },
  qwen: { paper: 0x8b7cf0, dark: 0x4b3fb0, glow: 0xb3a8ff },
  plain: { paper: 0xffd28a, dark: 0xb07a3a, glow: 0xffc870 },
  gem: { paper: 0x8fb4ff, dark: 0x3c5aa8, glow: 0xcfe0ff },
  whale: { paper: 0x5d7bff, dark: 0x2b3fae, glow: 0x8ea4ff },
  kimi: { paper: 0xf3e3a0, dark: 0xb09b58, glow: 0xfff0b0 },
  astra: { paper: 0xfff7d6, dark: 0xc9b26a, glow: 0xfff3c0 },
  sol: { paper: 0xffc94d, dark: 0xd4861c, glow: 0xffd978 },
  luna: { paper: 0xdbe6ff, dark: 0x8a9ac9, glow: 0xe3ecff },
};
export const LANTERN_GLOW = Object.fromEntries(Object.entries(KIND).map(([k, v]) => [k, v.glow]));

// Sky lantern centred at (x, y). o: kind, size (px), label, lit (0..1), t, labelBelow (default true)
export function lantern(fb, x, y, o = {}) {
  const kind = o.kind || 'plain', K = KIND[kind] || KIND.plain;
  const S = Math.round(o.size || 16), t = o.t || 0;
  const lit = o.lit === undefined ? 1 : o.lit;
  const flick = 0.9 + 0.1 * Math.sin(t * 13 + x * 0.3) * Math.sin(t * 7.3 + y);
  x = Math.round(x); y = Math.round(y);
  if (lit > 0 && o.glow !== false) fb.glow(x, y, S * 1.5, K.glow, 0.45 * lit * flick, 6);
  const paper = mix(cscale(K.paper, 0.55), K.paper, 0.35 + 0.65 * lit);
  const core = mix(paper, 0xffffff, 0.45 * lit * flick);
  if (kind === 'gem') {
    starShape(fb, x, y, S * 1.25, (a, r, px, py) => {
      const c = gemColorAt(a, r, px, py);
      return mix(cscale(c, 0.5), mix(c, 0xffffff, 0.3 * (1 - r)), 0.35 + 0.65 * lit);
    });
  } else if (kind === 'astra') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU, r = (i % 2 ? 0.42 : 1) * S * 0.62;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    fb.poly(pts, paper);
    fb.circle(x, y, S * 0.22, core);
  } else if (kind === 'sol') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * 0.3;
      fb.line(x + Math.cos(a) * S * 0.38, y + Math.sin(a) * S * 0.38, x + Math.cos(a) * S * 0.62, y + Math.sin(a) * S * 0.62, K.dark);
    }
    fb.circle(x, y, S * 0.4, paper);
    fb.circle(x - 1, y - 1, S * 0.24, core);
  } else if (kind === 'luna' || kind === 'kimi') {
    const R = S * 0.5;
    for (let py = -R; py <= R; py++)
      for (let px = -R; px <= R; px++) {
        if (px * px + py * py > R * R) continue;
        const qx = px - R * 0.45, qy = py + R * 0.2;
        if (qx * qx + qy * qy < R * R * 0.62) continue;
        fb.set(x + px, y + py, px * px + py * py > R * R * 0.6 ? paper : core);
      }
  } else if (kind === 'whale') {
    fb.ellipse(x, y, S * 0.55, S * 0.36, paper);
    fb.poly([x + S * 0.45, y - S * 0.05, x + S * 0.8, y - S * 0.4, x + S * 0.75, y + S * 0.05], paper);
    fb.ellipse(x - S * 0.1, y + S * 0.1, S * 0.35, S * 0.16, core);
    fb.set(x - S * 0.32, y - S * 0.08, K.dark);
  } else {
    // classic paper sky lantern: wide top, narrow mouth
    const wt = S * 0.46, wb = S * 0.32, h = S * 0.5;
    fb.poly([x - wt, y - h + 2, x - wt + 2, y - h, x + wt - 2, y - h, x + wt, y - h + 2, x + wb, y + h, x - wb, y + h], paper);
    fb.ellipse(x, y + 1, wt * 0.6, h * 0.62, core);
    for (let i = -1; i <= 1; i += 2) fb.line(x + i * wt * 0.5, y - h + 1, x + i * wb * 0.55, y + h - 1, mix(paper, K.dark, 0.35));
    fb.rect(x - wb, y + h - 1, wb * 2, 1, K.dark);
    if (lit > 0) { fb.set(x, y + h, 0xfff2a8); fb.glow(x, y + h, 3, 0xffcf6b, 0.8 * lit); }
    if (S >= 14) {
      if (kind === 'claude') claudeSpark(fb, x, y, Math.max(2, S * 0.18), 0xfff3ea);
      else if (kind === 'openai') blossom(fb, x, y, Math.max(2, S * 0.17), 0x4a4f6a);
      else if (kind === 'qwen') qwenLogo(fb, x, y, 0xffffff);
    }
  }
  if (o.label) {
    const ly = o.labelAbove ? y - S * 0.7 - 8 : y + S * 0.62 + 3;
    const w = textWidth(o.label, 'small');
    fb.rect(x - Math.ceil(w / 2) - 2, ly - 1, w + 4, 7, 0x10131f, 0.55 * (o.labelAlpha === undefined ? 1 : o.labelAlpha));
    text(fb, o.label, x, ly, o.labelColor || 0xffffff, { font: 'small', align: 'center' });
  }
}

// ---------- flash rockets ----------
export function rocket(fb, x, y, o = {}) {
  // (x, y) = centre of the body, vertical
  const s = o.size || 12;
  const w = Math.max(3, Math.round(s * 0.35));
  fb.rect(x - w / 2, y - s / 2, w, s, 0xffd23f);
  fb.rect(x - w / 2, y - s / 2, 1, s, 0xfff2a0);
  fb.rect(x + w / 2 - 1, y - s / 2, 1, s, 0xd99a1e);
  fb.poly([x - w / 2, y - s / 2, x + w / 2, y - s / 2, x, y - s / 2 - w], 0xea4335);
  fb.poly([x - w / 2, y + s / 2 - 3, x - w / 2 - 2, y + s / 2 + 1, x - w / 2, y + s / 2], 0x4285f4);
  fb.poly([x + w / 2, y + s / 2 - 3, x + w / 2 + 2, y + s / 2 + 1, x + w / 2, y + s / 2], 0x4285f4);
  bolt(fb, x, y, Math.min(s * 0.6, 8), 0x3a3fb0);
  if (o.stick) fb.line(x, y + s / 2, x, y + s / 2 + s, 0x8a6a4a);
  if (o.label) text(fb, o.label, x, y + s / 2 + 4, 0xffffff, { font: 'small', align: 'center', outline: 0x1a1a2a });
}
export function rocketTrail(fb, t, x, y, len = 14) {
  for (let i = 0; i < len; i++) {
    const k = i / len;
    const px = x + Math.sin(t * 40 + i * 1.7) * k * 2, py = y + i * 1.2;
    fb.add(px, py, i < 3 ? 0xffffff : 0xffb347, (1 - k) * 0.9);
  }
  fb.glow(x, y + 2, 5, 0xffc16b, 0.8);
}
// Flash pop: dazzling burst with zig-zag bolts radiating from (x, y), starting at t0
export function flashPop(fb, t, t0, x, y, o = {}) {
  const dt = t - t0, life = o.life || 1.1;
  if (dt < 0 || dt > life) return;
  const k = 1 - dt / life;
  const R = (o.size || 40) * E.outCubic(Math.min(1, dt / 0.35));
  if (dt < 0.2) {
    fb.glow(x, y, R * 2.2, 0xffffff, 1.2 * (1 - dt / 0.2), 6);
  }
  fb.glow(x, y, R * 1.2, 0xffe38a, 0.6 * k, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + (o.seed || 0);
    let px = x, py = y;
    for (let j = 1; j <= 4; j++) {
      const r = (R * j) / 4, jit = (hash(i * 13 + j + (o.seed || 0) * 7) - 0.5) * 0.5;
      const nx = x + Math.cos(a + jit) * r, ny = y + Math.sin(a + jit) * r;
      fb.line(px, py, nx, ny, j < 3 ? 0xffffff : 0xffd23f, k);
      px = nx; py = ny;
    }
  }
  for (let i = 0; i < 20; i++) {
    const a = hash(i * 3 + 1) * TAU, sp = R * (0.8 + hash(i * 5) * 0.8);
    fb.add(x + Math.cos(a) * sp * E.outCubic(dt / life), y + Math.sin(a) * sp * E.outCubic(dt / life) + dt * dt * 20, [0xea4335, 0x4285f4, 0xfbbc04, 0x34a853][i % 4], k);
  }
  if (o.label && dt < life * 0.8) text(fb, o.label, x, y - R - 10, 0xffffff, { font: 'big', align: 'center', outline: 0x202040 });
}

// ---------- Gemini's big "3.5 PRO" lantern ----------
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

// ---------- calendar ----------
export const MONTHS = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ', 'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];
// Tear-off calendar with its top-left at (x, y). day optional.
export function calendar(fb, x, y, month, o = {}) {
  const w = o.w || 46, h = o.h || 40;
  fb.rect(x + 2, y + 2, w, h, 0x000000, 0.35);
  fb.rect(x, y, w, h, 0xfbf7ee);
  fb.rect(x, y, w, 10, 0xd64541);
  fb.rect(x, y + h - 2, w, 2, 0xd9d2c3);
  for (let i = 0; i < 4; i++) fb.rect(x + 6 + i * ((w - 12) / 3), y - 2, 2, 5, 0x555a66);
  text(fb, month, x + w / 2, y + 2, 0xffffff, { font: textWidth(month) > w - 4 ? 'small' : 'big', align: 'center' });
  if (o.day !== undefined) text(fb, String(o.day), x + w / 2, y + 16, 0x2a2a35, { align: 'center', scale: 2 });
  if (o.strike) { fb.line(x + 6, y + 14, x + w - 6, y + h - 6, 0xd64541); fb.line(x + 7, y + 14, x + w - 5, y + h - 6, 0xd64541); }
}
// page flying off: progress k 0..1 from the calendar at (x,y)
export function calendarPage(fb, x, y, k, o = {}) {
  if (k <= 0 || k >= 1) return;
  const w = o.w || 46, h = o.h || 40, dir = o.dir || 1;
  const px = x + dir * k * 120, py = y - k * 40 + k * k * 160;
  const a = dir * k * 3.5;
  const cs = Math.cos(a), sn = Math.sin(a);
  const pts = [[0, 0], [w, 0], [w, h], [0, h]].map(([u, v]) => [px + (u - w / 2) * cs - (v - h / 2) * sn * 0.6 + w / 2, py + (u - w / 2) * sn * 0.6 + (v - h / 2) * cs + h / 2]);
  fb.poly(pts.flat(), 0xfbf7ee);
  fb.poly([pts[0], pts[1], [lerp(pts[1][0], pts[2][0], 0.25), lerp(pts[1][1], pts[2][1], 0.25)], [lerp(pts[0][0], pts[3][0], 0.25), lerp(pts[0][1], pts[3][1], 0.25)]].flat(), 0xd64541);
}

// ---------- signs, tags, bubbles, captions ----------
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
export function paperTag(fb, x, y, lines, o = {}) {
  // (x, y) top centre; lines: array of strings; strike: indices of struck lines
  const font = o.font || 'small', lh = font === 'small' ? 7 : 9;
  const w = Math.max(...lines.map((l) => textWidth(l, font))) + 8, h = lines.length * lh + 5;
  const rot = o.swing || 0;
  const X = Math.round(x + rot * 3);
  if (o.string) fb.line(x, y - o.string, X, y, 0xd8d0c0);
  fb.rect(X - w / 2 + 1, y + 1, w, h, 0x000000, 0.3);
  fb.rect(X - w / 2, y, w, h, o.paper || 0xfff8e1);
  fb.set(X, y + 2, 0x6a5a40);
  lines.forEach((l, i) => {
    const ly = y + 4 + i * lh;
    text(fb, l, X, ly, o.ink || 0x2b2b3a, { font, align: 'center' });
    if (o.strike && o.strike.includes(i)) { const lw = textWidth(l, font); fb.line(X - lw / 2 - 1, ly + 2, X + lw / 2 + 1, ly + 2, 0xd64541); }
  });
  return { w, h };
}
export function bubble(fb, x, y, w, h, tx, ty, o = {}) {
  // (x, y) top-left; tail tip at (tx, ty)
  const fill = o.fill || 0xffffff, line = o.line || 0x1f2233;
  const bx = Math.round(x), by = Math.round(y);
  const cxm = bx + w / 2, tail = [cxm - 4, by + h - 1, cxm + 4, by + h - 1, tx, ty];
  fb.poly([tail[0] - 1, tail[1], tail[2] + 1, tail[3], tx, ty + 1], line);
  fb.rect(bx + 1, by - 1, w - 2, h + 2, line); fb.rect(bx - 1, by + 1, w + 2, h - 2, line); fb.rect(bx, by, w, h, line);
  fb.rect(bx + 1, by, w - 2, h, fill); fb.rect(bx, by + 1, w, h - 2, fill);
  fb.poly(tail, fill);
}
// Thought bubble with trailing dots
export function thought(fb, x, y, w, h, tx, ty, o = {}) {
  const fill = o.fill || 0xffffff, line = o.line || 0x1f2233;
  fb.ellipse(x + w / 2, y + h / 2, w / 2 + 1, h / 2 + 1, line);
  fb.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, fill);
  for (let i = 1; i <= 2; i++) {
    const k = i / 3;
    const px = lerp(x + w / 2, tx, 0.4 + k * 0.6), py = lerp(y + h, ty, 0.4 + k * 0.6);
    fb.circle(px, py, 3 - i + 1, line); fb.circle(px, py, 2 - i + 1, fill);
  }
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

// ---------- misc props ----------
export function umbrella(fb, x, y, o = {}) {
  // (x, y) = handle bottom; canopy above
  const r = o.r || 18, c = o.color || 0xe8795a, h = o.h || 22;
  const tilt = o.tilt || 0;
  const tx = x + tilt * 6, ty = y - h;
  fb.line(x, y, tx, ty, 0x3b2a20);
  fb.rect(x - 2, y - 1, 3, 1, 0x3b2a20); fb.set(x - 2, y - 2, 0x3b2a20);
  const open = o.open === undefined ? 1 : o.open;
  const R = r * Math.max(0.15, open);
  for (let py = -R * 0.55; py <= 0; py++)
    for (let px = -R; px <= R; px++) {
      const v = (px * px) / (R * R) + (py * py) / (R * R * 0.3);
      if (v > 1) continue;
      const seg8 = Math.floor(((px + R) / (2 * R)) * 6);
      fb.set(tx + px, ty + py, seg8 % 2 ? c : mix(c, 0xffffff, 0.25));
    }
  for (let i = -3; i <= 3; i++) { const px = (i / 3) * R; fb.circle(tx + px, ty + 1, 1, mix(c, 0x000000, 0.35)); }
  fb.set(tx, ty - R * 0.55 - 1, 0x3b2a20);
}

export function chipsBag(fb, x, y, o = {}) {
  // (x, y) bottom centre, 14x18 at scale 1
  if (o.k && o.k !== 1) {
    const s = scratch(24, 26, 'chips');
    chipsBag(s, 12, 24, { ...o, k: 1 });
    fb.blit(s, Math.round(x - 12 * o.k), Math.round(y - 24 * o.k), { sx: o.k, sy: o.k });
    return;
  }
  const cols = [GEM.blue, GEM.red, GEM.yellow, GEM.green];
  fb.poly([x - 7, y, x + 7, y, x + 8, y - 17, x - 8, y - 17], 0xf6f3ea);
  for (let i = 0; i < 4; i++) fb.rect(x - 7 + i * 3.5, y - 16, 4, 3, cols[i]);
  fb.rect(x - 8, y - 18, 16, 2, 0xd9d4c6);
  text(fb, 'TPU', x, y - 11, 0x2a2a3a, { font: 'small', align: 'center' });
  fb.rect(x - 6, y - 4, 12, 2, 0xe0b048);
  fb.rect(x - 7, y - 1, 14, 1, 0xcfc9b8);
  if (o.open) { fb.circle(x - 2, y - 19, 2, 0xe8c05a); fb.circle(x + 2, y - 20, 2, 0xf0cc68); }
}
export function chip(fb, x, y) { fb.ellipse(x, y, 2, 1.5, 0xf0cc68); fb.set(x - 1, y - 1, 0xfff0a0); }

// Cardboard capybara decoy ("fake account"). variant 0..n picks a disguise.
export function decoy(fb, x, y, o = {}) {
  const v = o.variant || 0, fall = clamp(o.fall || 0);
  const s = scratch(24, 30, 'decoy');
  const card = 0xc4a06a, cardD = 0x9c7b4b, ink = 0x4a3420;
  s.rect(4, 3, 16, 12, card); s.rect(3, 4, 18, 9, card); s.rect(5, 1, 3, 2, cardD); s.rect(16, 1, 3, 2, cardD);
  s.rect(4, 14, 16, 12, card); s.rect(6, 8, 12, 5, 0xd6b886);
  s.rect(6, 6, 4, 1, ink); s.rect(14, 6, 4, 1, ink); s.set(10, 8, ink); s.set(13, 8, ink);
  s.rect(8, 17, 8, 5, 0xe8e2d6); qwenLogo(s, 12, 19, 0x7a70d8);
  s.line(4, 26, 20, 26, cardD); s.rect(11, 26, 2, 4, 0x6d4a32);
  const hats = v % 4;
  if (hats === 0) { s.rect(3, 1, 18, 2, 0x333333); s.rect(7, -2, 10, 3, 0x333333); }
  if (hats === 1) { s.rect(5, 5, 6, 3, 0x111111); s.rect(13, 5, 6, 3, 0x111111); s.rect(11, 5, 2, 1, 0x111111); }
  if (hats === 2) { s.rect(8, 9, 3, 1, ink); s.rect(13, 9, 3, 1, ink); s.set(7, 8, ink); s.set(16, 8, ink); }
  if (hats === 3) { s.rect(5, 0, 14, 3, 0xd64541); s.rect(3, 2, 18, 1, 0xd64541); }
  if (v % 3 === 1) { s.ring(8, 6, 2, 0x222222); s.ring(16, 6, 2, 0x222222); }
  const spr = outlined(s, 0x5a4020);
  if (fall <= 0) { fb.blit(spr, x - spr.w / 2, y - spr.h + 1); return; }
  // falling backwards: squash vertically as it tips over
  const k = Math.cos(fall * Math.PI / 2);
  fb.blit(spr, x - spr.w / 2 + fall * 3, y - spr.h * Math.max(0.12, k) + 1, { sy: Math.max(0.12, k), tint: 0x000000, tintK: fall * 0.35 });
}

// Distillation apparatus: flasks, coil and a bottle. (x, y) = bottom-left on the ground. t for bubbles.
export function distiller(fb, x, y, t, o = {}) {
  const glass = 0xbfe3f0, liq = o.liquid || 0xffa060, out = o.out || 0x9d7bff, broken = o.broken || 0;
  // stand
  fb.rect(x, y - 2, 60, 2, 0x5a4636);
  fb.rect(x + 4, y - 22, 2, 20, 0x5a4636);
  // big flask
  if (broken < 1) {
    fb.circle(x + 10, y - 12, 8, glass);
    fb.circle(x + 10, y - 12, 6, liq);
    fb.rect(x + 8, y - 28, 4, 10, glass);
    for (let i = 0; i < 4; i++) { const b = (t * 2 + i * 0.27) % 1; fb.set(x + 7 + i * 2, y - 12 - b * 10, 0xffffff); }
    fb.glow(x + 10, y - 12, 12, liq, 0.4);
    // pipe and coil
    fb.line(x + 10, y - 28, x + 30, y - 32, glass); fb.line(x + 10, y - 29, x + 30, y - 33, glass);
    for (let i = 0; i < 4; i++) fb.ring(x + 34, y - 28 + i * 5, 4, 0x9fc9d8);
    fb.line(x + 38, y - 12, x + 46, y - 10, glass);
  } else {
    for (let i = 0; i < 8; i++) fb.set(x + 4 + hash(i) * 30, y - 1 - hash(i + 9) * 3, glass);
    fb.ellipse(x + 20, y - 1, 16, 2, liq, 0.7);
  }
  // collecting bottles
  const n = o.bottles === undefined ? 2 : o.bottles;
  for (let i = 0; i < n; i++) {
    const bx = x + 46 + i * 8;
    fb.rect(bx, y - 12, 6, 10, 0x2a2a3a); fb.rect(bx + 1, y - 11, 4, 8, out); fb.rect(bx + 2, y - 15, 2, 3, 0x2a2a3a);
    fb.glow(bx + 3, y - 7, 6, out, 0.5);
  }
  if (broken < 1 && o.drip !== false) { const d = (t * 3) % 1; fb.set(x + 46, y - 10 + d * 6, liq); }
}

export function bell(fb, x, y, swing = 0) {
  // (x, y) = mount point
  fb.rect(x - 6, y - 2, 12, 2, 0x5a4636);
  const a = swing * 0.6, cs = Math.cos(a), sn = Math.sin(a);
  const P = (u, v) => [x + u * cs - v * sn, y + u * sn + v * cs];
  const pts = [P(-2, 1), P(2, 1), P(4, 7), P(5, 9), P(-5, 9), P(-4, 7)].flat();
  fb.poly(pts, 0xe0b040);
  const hl = P(-2, 4); fb.set(hl[0], hl[1], 0xfff0a0);
  const cl = P(0, 10); fb.circle(cl[0], cl[1], 1, 0x8a6a2a);
  const rope = P(0, 11); fb.line(rope[0], rope[1], rope[0] + swing * 2, rope[1] + 12, 0xc8b28a);
}

export function streetlamp(fb, x, y, o = {}) {
  // (x, y) = base; lamp head at y - h
  const h = o.h || 60;
  fb.rect(x - 1, y - h, 3, h, 0x2c3140);
  fb.rect(x - 3, y - 3, 7, 3, 0x2c3140);
  fb.rect(x - 1, y - h, 10, 2, 0x2c3140);
  fb.rect(x + 6, y - h + 2, 7, 3, 0x2c3140);
  fb.rect(x + 7, y - h + 5, 5, 2, o.on === false ? 0x555a66 : 0xfff1c0);
}

export function barrel(fb, x, y) {
  fb.rect(x - 7, y - 16, 14, 16, 0x7a5236);
  fb.rect(x - 8, y - 13, 16, 10, 0x8a6040);
  fb.rect(x - 8, y - 12, 16, 1, 0x3a3a44); fb.rect(x - 8, y - 5, 16, 1, 0x3a3a44);
  fb.rect(x - 7, y - 16, 14, 1, 0x5a3a26);
  fb.rect(x - 4, y - 15, 1, 14, 0x6a4630); fb.rect(x + 3, y - 15, 1, 14, 0x6a4630);
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
