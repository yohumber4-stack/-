// Sky time-lapse (2D): December -> May. New lanterns keep rising and the sky
// (the frontier) scrolls up; Gemini's "3" is left behind. Then the title card.
import { E, seg, clamp, lerp, key, hash, mix } from '../engine/core.js';
import { vignette, stars } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { lantern, calendar, calendarPage, MONTHS, title, rocket, rocketTrail, flashPop } from '../props.js';
import { SKY, cloud } from '../bg.js';
import { gemini } from '../chars/gemini.js';

// [spawn time, x, kind, label, rank (height)]
const RISE = [
  [0.8, 150, 'claude', 'OPUS 4.6', 1], [1.3, 330, 'openai', 'GPT-5.3', 1.6], [2.0, 250, 'gem', '3.1 PRO', -1.2],
  [2.4, 90, 'claude', 'SONNET 5', 2.6], [2.9, 390, 'openai', 'GPT-5.4', 3.2], [3.3, 200, 'whale', 'V4', 2.3],
  [3.7, 300, 'claude', 'OPUS 4.7', 4.1], [4.1, 120, 'kimi', 'K2.5', 3.4], [4.4, 420, 'openai', 'GPT-5.5', 4.7],
  [4.8, 250, 'qwen', 'QWEN 3.5', 4.3], [5.2, 170, 'claude', 'MYTHOS', 5.6], [5.6, 350, 'openai', 'GPT-5.5 PRO', 5.9],
];
const MONTH_AT = [[0, 11], [0.9, 0], [1.9, 1], [2.9, 2], [3.9, 3], [4.9, 4]];

export default {
  dur: 11,
  in: { type: 'cross', dur: 0.8 },
  out: { type: 'black', dur: 0.8 },
  render(fb, t) {
    const cam = key(t, [[0, 0], [0.6, 0], [6.6, -560]], E.inOutSine); // world y of screen top
    fb.gradV(0, 0, fb.w, fb.h, SKY.night);
    stars(fb, t, 21, 170, 0, 0, fb.w, fb.h, { py: -cam * 0.35 });
    stars(fb, t, 22, 70, 0, 0, fb.w, fb.h, { py: -cam * 0.7 });
    // drifting clouds pass by as the camera climbs
    for (let i = 0; i < 5; i++) {
      const wy = 300 - i * 180, sy = wy - cam * 0.9;
      if (sy > -30 && sy < 300) cloud(fb, (hash(i * 5) * 520 + t * 6) % 560 - 40, sy, 70 + hash(i) * 50, 0x2a3470, 0x1f2860, i, 0.8);
    }
    const Y = (wy) => wy - cam;

    // lanterns from the prologue
    const dim = 1 - 0.55 * seg(t, 2.5, 5.5);
    lantern(fb, 222 + Math.sin(t * 0.6) * 2, Y(128 + Math.sin(t) * 2), { kind: 'gem', size: 20, label: '3', lit: dim, t });
    lantern(fb, 290, Y(96), { kind: 'claude', size: 20, label: 'OPUS 4.5', lit: 1, t });
    lantern(fb, 170, Y(72), { kind: 'openai', size: 20, label: 'GPT-5.2', lit: 1, t });

    // new lanterns rising into ever higher ranks
    for (const [t0, x, kind, label, rank] of RISE) {
      if (t < t0) continue;
      const k = E.outCubic(seg(t, t0, t0 + 1.6));
      const finalY = 60 - rank * 100;
      const startY = cam + 300;
      const wy = lerp(startY, finalY, k) + Math.sin(t * 0.9 + x) * 2;
      const lit = kind === 'gem' ? 0.7 : 1;
      lantern(fb, x + Math.sin(t * 0.5 + x) * 3, Y(wy), { kind, size: 20, label, lit, t });
      if (kind === 'qwen') {
        // a suspicious orange glow inside the purple lantern
        const sy = Y(wy);
        fb.glow(x + Math.sin(t * 0.5 + x) * 3, sy, 7, 0xff9a5a, 0.6 + 0.2 * Math.sin(t * 9), 4);
      }
    }
    // Gemini's quick flashes: bright, then gone
    const flashAt = [[1.1, 380, '3 FLASH'], [5.4, 110, '3.5 FLASH']];
    for (const [t0, x, label] of flashAt) {
      const k = seg(t, t0, t0 + 0.55);
      if (k > 0 && k < 1) {
        const sy = 270 - E.outQuad(k) * 170;
        rocket(fb, x, sy, { size: 10 });
        rocketTrail(fb, t, x, sy + 6);
      }
      flashPop(fb, t, t0 + 0.55, x, 100, { size: 34, label, seed: t0 });
    }

    // tear-off calendar (montage device)
    let mi = 11;
    for (const [ts, m] of MONTH_AT) if (t >= ts) mi = m;
    const cx = 18, cy = 206;
    if (t < 7.2) {
      calendar(fb, cx, cy, MONTHS[mi], { w: 60, h: 44 });
      for (const [ts, m] of MONTH_AT.slice(1)) {
        const k = seg(t, ts - 0.05, ts + 0.8);
        const prev = MONTH_AT[MONTH_AT.findIndex((q) => q[0] === ts) - 1][1];
        if (k > 0 && k < 1) calendarPage(fb, cx, cy, k, { w: 60, h: 44, dir: 1 });
        void prev;
      }
    }

    vignette(fb, 0.4);

    // title card
    const tk = seg(t, 6.7, 7.6);
    if (tk > 0) {
      fb.overlay(0x05060f, 0.45 * tk);
      const bob = Math.sin(t * 1.6) * 1.5;
      const drop = (1 - E.outBack(tk)) * -30;
      title(fb, 'COMING SOON', 240, 116 + drop + bob, { scale: 5, spacing: 1, top: 0xfff6d0, bottom: 0xff9a5c, outline: 0x2a1840, alpha: clamp(tk * 1.5), dither: true });
      // a small sparkle hops onto the title like the dot over an i
      const gk = seg(t, 7.8, 8.4);
      if (gk > 0) gemini(fb, 414, 84 - E.outBounce(gk) * 0 - (1 - E.outBounce(gk)) * 40, { size: 22, eyes: 'happy', mouth: 'smile', sat: 1 - 0.6 * seg(t, 9.2, 10.2), droop: 0.4 * seg(t, 9.2, 10.2), alpha: 1 });
      const sk = seg(t, 8.2, 8.9);
      if (sk > 0) text(fb, 'ИСТОРИЯ ОДНОЙ ЗВЁЗДОЧКИ', 240, 156, mix(0x05060f, 0xc9d2f0, sk), { align: 'center' });
    }
  },
};
