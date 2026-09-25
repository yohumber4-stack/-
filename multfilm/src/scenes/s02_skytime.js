// Time-lapse (2D sky): December -> May. Gemini watches from the hill as everyone's
// lanterns climb past "3". The sky keeps rising; Gemini drops out of frame, its
// quick Flash rockets pop and fade. Then the title: COMING SOON.
import { E, seg, clamp, lerp, key, hash, mix, fract } from '../engine/core.js';
import { vignette, stars } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { lanternP, rocket, exhaust, calPage, emote } from '../sprites/props.js';
import { title } from '../props.js';
import { flashPop } from '../props.js';
import { cloud, hills, SKY } from '../bg.js';
import { char } from '../sprites/chars.js';
import { blink, float } from '../kit.js';

const RISE = [
  [0.7, 150, 'claude', 'OPUS 4.6', 1], [1.2, 330, 'openai', 'GPT-5.3', 1.6], [1.9, 400, 'gem', '3.1 PRO', 0.2],
  [2.3, 90, 'claude', 'SONNET 5', 2.6], [2.8, 380, 'openai', 'GPT-5.4', 3.2], [3.2, 210, 'whale', 'V4', 2.3],
  [3.6, 300, 'claude', 'OPUS 4.7', 4.1], [4.0, 120, 'kimi', 'K2.5', 3.4], [4.3, 420, 'openai', 'GPT-5.5', 4.7],
  [4.7, 250, 'qwen', 'QWEN 3.5', 4.3], [5.1, 170, 'claude', 'MYTHOS', 5.6], [5.5, 350, 'openai', 'GPT-5.5 PRO', 5.9],
];
const MONTHS = [[0, 'ДЕКАБРЬ'], [0.9, 'ЯНВАРЬ'], [1.9, 'ФЕВРАЛЬ'], [2.9, 'МАРТ'], [3.9, 'АПРЕЛЬ'], [4.9, 'МАЙ']];

export default {
  dur: 10,
  in: { type: 'cross', dur: 0.8 },
  out: { type: 'black', dur: 0.6 },
  render(fb, t) {
    const cam = key(t, [[0, 0], [0.8, 0], [6.4, -600]], E.inOutSine); // world y at the screen top
    const Y = (wy) => Math.round(wy - cam);
    // sky: deepens as we climb
    const up = clamp(-cam / 600);
    fb.gradV(0, 0, 480, 270, [mix(0x16204f, 0x07081a, up), mix(0x27306a, 0x0e1238, up), mix(0x3d4585, 0x1a1f4d, up), mix(0x5a5a9a, 0x2a2c66, up)]);
    // nebula band
    for (let y = 0; y < 270; y += 2) for (let x = 0; x < 480; x += 2) {
      const wy = y + cam * 0.5, n = Math.sin(x * 0.012 + wy * 0.02) + Math.sin(x * 0.03 - wy * 0.013 + 2) * 0.6;
      if (n > 1.2 && hash(x * 31 + y * 7) > 0.5) fb.add(x, y, 0x6a4aa0, 0.12);
    }
    stars(fb, t, 21, 170, 0, 0, 480, 270, { py: -cam * 0.35 });
    stars(fb, t, 22, 60, 0, 0, 480, 270, { py: -cam * 0.7 });
    for (let i = 0; i < 6; i++) {
      const wy = 320 - i * 170, sy = wy - cam * 0.9;
      if (sy > -40 && sy < 310) cloud(fb, (hash(i * 5) * 560 + t * 8) % 600 - 60, sy, 80 + hash(i) * 60, 0x323a7a, 0x262e66, i, 0.85);
    }
    // the hill with Gemini watching (scrolls away)
    const hy = Y(236);
    if (hy < 300) {
      for (let x = 0; x < 480; x++) { const h = hy + Math.round(Math.pow((x - 240) / 240, 2) * 40); fb.rect(x, h, 1, 300 - h, 0x141a34); fb.set(x, h, 0x2a3458); }
      const look = t > 1.2 ? -1 : 0;
      char(fb, 'gemini', 240, hy + 2 + float(t, 1, 2), { eyes: t > 4.2 ? (blink(t, 2) ? 'blink' : 'sad') : blink(t, 2) ? 'blink' : 'open', lookY: look, mouth: t > 3.5 ? 'flat' : 'smile', grey: 0.25 * seg(t, 2, 5) });
    }
    // older lanterns
    const dim = 1 - 0.5 * seg(t, 2.5, 5.5);
    lanternP(fb, 240 + Math.sin(t * 0.6) * 2, Y(150 + Math.sin(t) * 2), { kind: 'gem', w: 20, label: '3', lit: dim, t });
    lanternP(fb, 304, Y(116), { kind: 'claude', w: 20, label: 'OPUS 4.5', t });
    lanternP(fb, 170, Y(92), { kind: 'openai', w: 20, label: 'GPT-5.2', t });
    for (const [t0, x, kind, lab, rank] of RISE) {
      if (t < t0) continue;
      const k = E.outCubic(seg(t, t0, t0 + 1.6));
      const wy = lerp(cam + 320, 60 - rank * 100, k) + Math.sin(t * 0.9 + x) * 2;
      const sx = x + Math.sin(t * 0.5 + x) * 3;
      lanternP(fb, sx, Y(wy), { kind, w: 20, label: lab, lit: kind === 'gem' ? 0.7 : 1, t });
      if (kind === 'qwen') fb.glow(sx, Y(wy), 9, 0xff9a5a, 0.7 + 0.2 * Math.sin(t * 9), 4); // Claude-orange light inside
    }
    // Gemini's quick flashes: bright, then gone
    for (const [t0, x, lab] of [[1.1, 380, '3 FLASH'], [5.3, 110, '3.5 FLASH']]) {
      const k = seg(t, t0, t0 + 0.55);
      if (k > 0 && k < 1) { const sy = 280 - E.outQuad(k) * 180; rocket(fb, x, sy); exhaust(fb, t, x, sy + 10, 16); }
      flashPop(fb, t, t0 + 0.55, x, 100, { size: 36, label: lab, seed: t0 });
    }
    // calendar
    let m = MONTHS[0][1];
    for (const [ts, mm] of MONTHS) if (t >= ts) m = mm;
    if (t < 6.8) {
      calPage(fb, 16, 208, 64, 48, m);
      MONTHS.slice(1).forEach(([ts], i) => {
        const k = seg(t, ts - 0.05, ts + 0.7);
        if (k > 0 && k < 1) calPage(fb, Math.round(16 + k * 110), Math.round(208 - k * 40 + k * k * 150), 64, 48, MONTHS[i][1]);
      });
    }
    vignette(fb, 0.4);
    // title card
    const tk = seg(t, 6.6, 7.4);
    if (tk > 0) {
      fb.overlay(0x05060f, 0.5 * tk);
      const bob = Math.sin(t * 1.6) * 1.5, drop = (1 - E.outBack(tk)) * -30;
      title(fb, 'COMING SOON', 240, 110 + drop + bob, { scale: 5, top: 0xfff6d0, bottom: 0xff9a5c, outline: 0x2a1840, alpha: clamp(tk * 1.5), dither: true });
      const gk = seg(t, 7.6, 8.2);
      if (gk > 0) {
        const sad = seg(t, 8.8, 9.4);
        const gy = 86 - (1 - E.outBounce(gk)) * 80;
        char(fb, 'gemini', 424, gy + 8, { eyes: sad > 0 ? 'sad' : 'happy', mouth: sad > 0 ? 'frown' : 'open', grey: 0.5 * sad, handL: sad > 0 ? 6 : -10 });
        if (sad > 0.5) emote(fb, 'sweat', 448, gy - 50, { scale: 2 });
      }
      const sk = seg(t, 8.1, 8.8);
      if (sk > 0) text(fb, 'ИСТОРИЯ ОДНОЙ ЗВЁЗДОЧКИ', 240, 152, mix(0x05060f, 0xc9d2f0, sk), { align: 'center' });
    }
  },
};
