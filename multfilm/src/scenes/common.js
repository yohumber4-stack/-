// Shared scene helpers: month cards, room pump, tags, simple timeline utilities.
import { E, seg, clamp, lerp, mix } from '../engine/core.js';
import { text } from '../engine/font.js';
const textW = (s) => s.length * 2;
import { calPage } from '../sprites/props.js';

// Big calendar page that drops in, holds, and flies off (time passing).
export function monthCard(fb, t, t0, month, o = {}) {
  const dur = o.dur || 0.95;
  const k = (t - t0) / dur;
  if (k < 0 || k > 1) return;
  const inK = E.outBack(clamp(k / 0.3)), outK = E.inCubic(clamp((k - 0.72) / 0.28));
  fb.overlay(0x05060c, 0.35 * (1 - outK) * clamp(k / 0.15));
  const w = 132, h = 96, x = Math.round(240 - w / 2 + outK * 60), y = Math.round(135 - h / 2 - (1 - inK) * 160 - outK * 200);
  calPage(fb, x, y, w, h, o.year || '2026');
  text(fb, month, x + w / 2, y + 50, 0x2a2a35, { align: 'center', scale: textW(month) > 16 ? 2 : 3 });
  if (o.sub) text(fb, o.sub, 240, Math.round(y + h + 8), 0xffffff, { align: 'center', outline: 0x1a1a2a });
}

// Foot pump (2D), stroke 0..1
export function pump(fb, x, y, stroke) {
  fb.rect(x - 5, y - 26, 10, 26, 0x1a1a2a); fb.rect(x - 4, y - 25, 8, 24, 0x4a7a6a); fb.rect(x - 4, y - 25, 2, 24, 0x6a9a8a);
  fb.rect(x - 8, y - 3, 16, 3, 0x2a2a30);
  const hy = y - 40 + stroke * 12;
  fb.rect(x - 1, hy, 2, y - 26 - hy, 0x9a9aa8);
  fb.rect(x - 11, hy - 2, 22, 4, 0x1a1a2a); fb.rect(x - 10, hy - 1, 20, 2, 0x8a5a3a);
}

// Paper tag with lines; strike indices get a red line
export function tag(fb, x, y, lines, o = {}) {
  const lh = 9, w = Math.max(...lines.map((l) => l.length)) * 6 + 8, h = lines.length * lh + 6;
  const X = Math.round(x - w / 2 + (o.swing || 0) * 3), Y = Math.round(y);
  if (o.string) fb.line(x, Y - o.string, X + w / 2, Y, 0xd8d0c0);
  fb.rect(X - 1, Y - 1, w + 2, h + 2, 0x1a1a2a);
  fb.rect(X, Y, w, h, 0xfff8e1);
  lines.forEach((l, i) => {
    const ly = Y + 4 + i * lh;
    text(fb, l, X + w / 2, ly, o.colors?.[i] || 0x2b2b3a, { align: 'center' });
    if (o.strike?.includes(i)) fb.rect(X + 3, ly + 3, w - 6, 1, 0xd64541);
  });
}
