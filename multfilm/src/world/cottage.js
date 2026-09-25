// Clawd's cottage (exterior) shared by the heist, friendship and ambush scenes.
import { mix, hash, clamp } from '../engine/core.js';
import { text } from '../engine/font.js';
import { clawd } from '../chars/clawd.js';
import { bell, claudeSpark } from '../props.js';

// (x, y) = bottom-left of the house front. o: t, lamp (0..1 inside light), sleeping, door (0..1 open), bellSwing, hatch (0..1)
export function cottage(fb, x, y, o = {}) {
  const t = o.t || 0, w = 170, h = 96;
  // walls
  fb.rect(x, y - h, w, h, 0xe6d6b8);
  for (let yy = y - h + 6; yy < y; yy += 8) fb.rect(x, yy, w, 1, 0xd4c2a0);
  fb.rect(x, y - 4, w, 4, 0x8a7a66);
  // roof
  fb.poly([x - 14, y - h, x + w / 2, y - h - 58, x + w + 14, y - h], 0xc8643c);
  for (let k = 0; k < 6; k++) fb.line(x - 14 + k * 8, y - h - k * 0.2, x + w / 2, y - h - 58, 0xb0542f);
  fb.rect(x - 14, y - h, w + 28, 4, 0x9a4a2a);
  fb.rect(x + w - 40, y - h - 50, 12, 26, 0x8a6a5a);
  claudeSpark(fb, x + w / 2, y - h - 26, 8, 0xffe0cc);
  // round window with sleepy Clawd inside
  const wx = x + 44, wy = y - 58, R = 20, lamp = o.lamp || 0;
  fb.circle(wx, wy, R + 3, 0x6a4a32);
  const inside = mix(0x1c2033, 0xffc27a, lamp * 0.8 + 0.2);
  fb.circle(wx, wy, R, inside);
  if (o.sleeping !== false) {
    fb.rect(wx - 16, wy + 6, 32, 8, 0x5a6aa8); fb.rect(wx - 16, wy + 4, 10, 4, 0xf0f0f0);
    clawd(fb, wx - 2, wy + 8, { u: 1, eyes: 'closed', hat: 'nightcap', armR: o.writing ? 0.3 + Math.sin(t * 14) * 0.3 : 0, tint: 0x3a3050, tintK: 0.4 * (1 - lamp) });
    for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; text(fb, 'Z', wx + 6 + k * 10, wy - 6 - k * 14, mix(0xffffff, inside, k), { font: 'small' }); }
  }
  fb.rect(wx - R, wy - 1, 2 * R, 2, 0x6a4a32); fb.rect(wx - 1, wy - R, 2, 2 * R, 0x6a4a32);
  // door
  const dx = x + 84, dw = 26, dh = 46, open = clamp(o.door || 0);
  fb.rect(dx - 2, y - dh - 4, dw + 4, dh + 4, 0x6a4a32);
  fb.rect(dx, y - dh, dw, dh, mix(0x2a1a12, 0xffc27a, lamp * 0.9));
  if (open < 1) {
    const ow = Math.round(dw * (1 - open));
    fb.rect(dx, y - dh, ow, dh, 0x9a5a36);
    for (let k = 0; k < 3; k++) fb.rect(dx + 2, y - dh + 4 + k * 14, Math.max(0, ow - 4), 10, 0xa8683e);
    if (ow > 6) fb.circle(dx + ow - 4, y - dh / 2, 1, 0xe0b040);
  }
  // the "ASK" service hatch
  const hx = x + 130, hy = y - 52;
  fb.rect(hx - 2, hy - 2, 30, 24, 0x6a4a32);
  fb.rect(hx, hy, 26, 20, mix(0x2a2030, 0xffd08a, 0.35 + 0.65 * (o.hatch || 0)));
  fb.rect(hx - 4, hy + 20, 34, 3, 0x8a5a3a);
  fb.rect(hx + 2, hy - 12, 22, 9, 0x2a2a36); text(fb, 'ASK', hx + 13, hy - 10, 0xffc27a, { font: 'small', align: 'center' });
  // bell by the door
  bell(fb, dx - 12, y - dh - 6, o.bellSwing || 0);
  // porch lamp
  fb.rect(dx + dw + 4, y - dh - 2, 4, 6, 0x3a3a44); fb.rect(dx + dw + 5, y - dh + 4, 2, 3, lamp > 0.5 ? 0xfff0b0 : 0x6a6a74);
  return { door: [dx + dw / 2, y], hatch: [hx + 13, hy + 10], bell: [dx - 12, y - dh - 6], win: [wx, wy], lamp: [dx + dw + 6, y - dh + 5] };
}

export function fence(fb, x0, x1, y, c = 0x7a6450) {
  fb.rect(x0, y - 14, x1 - x0, 2, c); fb.rect(x0, y - 7, x1 - x0, 2, c);
  for (let x = x0; x < x1; x += 9) { fb.rect(x, y - 18, 4, 18, c); fb.set(x + 1, y - 19, c); fb.set(x + 2, y - 19, c); }
}
