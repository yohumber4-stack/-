// Heist props in the sprite style: cardboard copies, the distillery, answer orbs.
import { createGrid, set, fillRect, shade, outline, toFB } from './grid.js';
import { BUILD, drawSprite } from './chars.js';
import { text } from '../engine/font.js';
import { mix, hash, clamp } from '../engine/core.js';

// Cardboard Qwen copy on a stick. v picks a disguise. fall 0..1 tips it over backwards.
export function decoy(fb, x, y, v = 0, fall = 0) {
  const opts = [{ spy: true }, { spy: true, hat: false }, { spy: true, glasses: false }, {}, { spy: true }, { spy: true, hat: false }][v % 6];
  const spr = BUILD.qwen({ ...opts, eyes: v % 2 ? 'shifty' : 'open', mouth: 'flat', blush: false });
  const k = Math.cos(clamp(fall) * Math.PI / 2);
  if (k < 0.99) {
    drawSprite(fb, spr, x + fall * 8, y - 8 * k, { scale: 1, tint: 0x8a6a40, tintK: 0.55 + fall * 0.25 });
    return;
  }
  fb.rect(x - 1, y - 12, 3, 12, 0x6d4a32);
  drawSprite(fb, spr, x, y - 10, { scale: 1, tint: 0xc4a06a, tintK: 0.5 });
  // cardboard edge highlight
  fb.rect(x - 2, y - 2, 5, 2, 0x5a4020);
}

// Distillery: big flask with glowing liquid, coil and QWEN bottles. level 0..1 per bottle.
export function distillery(fb, x, y, t, o = {}) {
  const broken = o.broken || 0, liquid = o.liquid || 0xffa060;
  fb.rect(x - 36, y - 3, 90, 3, 0x3a2a20); fb.rect(x - 34, y - 26, 3, 23, 0x5a4636);
  if (broken < 1) {
    fb.circle(x - 20, y - 16, 13, 0x1a1a2a); fb.circle(x - 20, y - 16, 12, 0xbfe3f0); fb.circle(x - 20, y - 15, 10, liquid);
    fb.rect(x - 23, y - 40, 6, 16, 0x1a1a2a); fb.rect(x - 22, y - 40, 4, 16, 0xbfe3f0);
    for (let i = 0; i < 6; i++) { const b = (t * 1.6 + hash(i)) % 1; fb.set(x - 26 + hash(i * 3) * 12, y - 14 - b * 12, 0xfff0d0); }
    fb.glow(x - 20, y - 15, 20, liquid, 0.55);
    fb.poly([x - 30, y - 50, x - 10, y - 50, x - 18, y - 40, x - 22, y - 40], 0x9aa0b0);
    fb.line(x - 20, y - 40, x + 4, y - 44, 0xbfe3f0); fb.line(x - 20, y - 41, x + 4, y - 45, 0xbfe3f0);
    for (let i = 0; i < 4; i++) fb.ring(x + 8, y - 38 + i * 6, 5, 0x9fc9d8);
    fb.line(x + 13, y - 16, x + 18, y - 12, 0xbfe3f0);
  } else {
    for (let i = 0; i < 10; i++) fb.rect(x - 34 + hash(i) * 40, y - 2 - hash(i + 9) * 4, 2, 1, 0xbfe3f0);
    fb.ellipse(x - 14, y - 1, 22, 3, liquid, 0.8);
  }
  const levels = o.levels || [0, 0, 0];
  levels.forEach((lv, i) => {
    const bx = x + 20 + i * 11;
    fb.rect(bx - 1, y - 20, 10, 18, 0x1a1a2a); fb.rect(bx, y - 19, 8, 16, 0x2a2a3a);
    const h = Math.round(14 * clamp(lv));
    if (h > 0) { fb.rect(bx + 1, y - 4 - h, 6, h, 0x9d7bff); fb.glow(bx + 4, y - 10, 10, 0x9d7bff, 0.35 * lv); }
    fb.rect(bx + 2, y - 25, 4, 5, 0x1a1a2a); fb.rect(bx, y - 14, 8, 4, 0xf3f3f7); text(fb, 'Q', bx + 4, y - 14, 0x615ced, { font: 'small', align: 'center' });
  });
}

// Glowing answer orb with Claude's spark
export function answerOrb(fb, x, y, k = 1) {
  fb.glow(x, y, 12, 0xffa36b, 0.8 * k, 4);
  fb.rect(x - 4, y - 3, 9, 7, 0x6b2e1c); fb.rect(x - 3, y - 2, 7, 5, 0xffd2b0);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; fb.set(x + Math.round(Math.cos(a) * 2), y + Math.round(Math.sin(a) * 2), 0xd97757); fb.set(x - Math.round(Math.cos(a) * 2), y - Math.round(Math.sin(a) * 2), 0xd97757); }
}
export function questionNote(fb, x, y) {
  fb.rect(x - 4, y - 3, 9, 8, 0x1a1a2a); fb.rect(x - 3, y - 2, 7, 6, 0xf4f4f4);
  text(fb, '?', x + 1, y - 1, 0x3a3a50, { font: 'small', align: 'center' });
}

// Swinging bell (2D) mounted at (x, y)
export function bellSwing(fb, x, y, swing = 0) {
  fb.rect(x - 7, y - 2, 14, 3, 0x3b2a20);
  const a = swing * 0.7, cs = Math.cos(a), sn = Math.sin(a);
  const P = (u, v) => [x + u * cs - v * sn, y + u * sn + v * cs];
  fb.poly([P(-3, 1), P(3, 1), P(6, 9), P(7, 12), P(-7, 12), P(-6, 9)].flat(), 0x1a1a2a);
  fb.poly([P(-2, 2), P(2, 2), P(5, 9), P(6, 11), P(-6, 11), P(-5, 9)].flat(), 0xe0b040);
  const hl = P(-2, 5); fb.rect(hl[0], hl[1], 2, 3, 0xfff0a0);
  const cl = P(0, 13); fb.circle(cl[0], cl[1], 1.5, 0x8a6a2a);
}
