// Finale: three friends on the hill under a sky where their lights shine side by
// side. "Light can't be copied. It can only be shared." The end — and Qwen,
// soaked in goo, now holding the COMING SOON sign himself.
import { E, seg, clamp, lerp, hash, mix } from '../engine/core.js';
import { vignette, stars, drawFlies, LightMap, rain } from '../engine/fx.js';
import { text, textWidth } from '../engine/font.js';
import { SKY, hills, sea } from '../bg.js';
import { lantern, chipsBag, chip, woodSign, title } from '../props.js';
import { gemini } from '../chars/gemini.js';
import { clawd } from '../chars/clawd.js';
import { codex, codexPet } from '../chars/codex.js';
import { qwen } from '../chars/qwen.js';
import { float, bounce, eyesB } from '../kit.js';

export default {
  dur: 9,
  in: { type: 'black', dur: 0.8 },
  render(fb, t) {
    if (t < 5.4) {
      fb.gradV(0, 0, 480, 270, SKY.night);
      stars(fb, t, 101, 220, 0, 0, 480, 200);
      // shooting star
      const sk = seg(t, 2.0, 2.7);
      if (sk > 0 && sk < 1) for (let i = 0; i < 14; i++) fb.add(lerp(60, 200, sk) - i * 3, lerp(20, 70, sk) - i, 0xffffff, (1 - i / 14) * (1 - sk));
      // their lights, side by side
      lantern(fb, 240, 70 + Math.sin(t) * 2, { kind: 'gem', size: 40, label: 'GEMINI 4', t, lit: 1 });
      lantern(fb, 150, 84 + Math.sin(t * 0.9 + 1) * 2, { kind: 'claude', size: 30, label: 'OPUS 5.5', t, lit: 1 });
      lantern(fb, 330, 80 + Math.sin(t * 0.8 + 2) * 2, { kind: 'astra', size: 32, label: 'GPT-6 ASTRA', t, lit: 1 });
      for (let i = 0; i < 12; i++) lantern(fb, 30 + hash(i * 3) * 420, 20 + hash(i * 7) * 50, { kind: ['claude', 'openai', 'plain', 'gem'][i % 4], size: 7 + hash(i) * 4, t, lit: 0.7 });
      sea(fb, 176, 200, t, { moonX: 240 });
      hills(fb, 212, 6, 0.02, 0x1d2a3a, 7, 0, { hi: 0x2e4a4a });
      fb.rect(0, 222, 480, 48, 0x1a2a2a);
      // the three on the hill, looking up
      const gx = 240, gy = 196 + float(t, 1, 2);
      clawd(fb, 176, 224, { u: 3, lookY: -1, look: 1, eyes: t > 1.2 && t < 2.2 ? 'happy' : eyesB(t, 'normal', 3), armR: t > 0.6 && t < 1.6 ? 0.4 : 0, blush: true });
      if (t > 0.6 && t < 2.4) chipsBag(fb, lerp(196, 214, seg(t, 0.6, 1.0)), 218, { open: true });
      gemini(fb, gx, gy, { size: 42, t, lookY: -1, eyes: t > 1.2 && t < 2.6 ? 'happy' : 'normal', mouth: t > 1.2 && t < 2.6 ? 'grin' : 'smile', blush: true, armL: 0.25 });
      if (t > 1.2 && t < 2.4) chip(fb, gx - 16, gy + 2);
      codex(fb, 306, 222 + float(t, 1, 2.2), { u: 1.5, t, face: '^_^', flip: true });
      codexPet(fb, 306, 170 + Math.sin(t * 2) * 1, t, 1);
      text(fb, 'z', 316, 160 - ((t * 8) % 8), 0xffffff, { font: 'small' });
      drawFlies(fb, Array.from({ length: 14 }, (_, i) => [240 + Math.cos(t * 0.6 + i) * (60 + i * 8), 190 + Math.sin(t * 0.8 + i * 2) * 26, 0.6 + 0.4 * Math.sin(t * 3 + i)]), 0xd9ff7a, 0.9);
      // the moral
      const a1 = seg(t, 1.0, 2.0), a2 = seg(t, 2.6, 3.6);
      if (a1 > 0) text(fb, 'СВЕТ НЕЛЬЗЯ СКОПИРОВАТЬ.', 240, 118, mix(0x151d4a, 0xffffff, a1), { align: 'center', outline: mix(0x151d4a, 0x0a0e2a, a1) });
      if (a2 > 0) text(fb, 'ИМ МОЖНО ТОЛЬКО ПОДЕЛИТЬСЯ.', 240, 134, mix(0x151d4a, 0xffe6a8, a2), { align: 'center', outline: mix(0x151d4a, 0x0a0e2a, a2) });
      vignette(fb, 0.4);
      if (t > 4.9) fb.overlay(0x000000, seg(t, 4.9, 5.4));
      return;
    }
    if (t < 7.5) {
      // THE END
      fb.clear(0x05060c);
      stars(fb, t, 102, 80, 0, 0, 480, 270, { alpha: 0.6 });
      const k = seg(t, 5.4, 6.0);
      title(fb, 'КОНЕЦ', 240, 112, { scale: 5, top: 0xffffff, bottom: 0xbfd0ff, outline: 0x141a3a, alpha: k, dither: true });
      gemini(fb, 332, 96 + float(t, 1.5, 2), { size: 26, eyes: 'happy', mouth: 'grin', alpha: k, dither: true });
      const k2 = seg(t, 6.1, 6.6);
      if (k2 > 0) text(fb, 'CONTEXT WINDOW PICTURES - 2026', 240, 156, mix(0x05060c, 0x8a93b8, k2), { font: 'small', align: 'center' });
      if (t > 7.1) fb.overlay(0x000000, seg(t, 7.1, 7.5));
      return;
    }
    // post-credits: the copycat is "coming soon" now
    const lt = t - 7.5;
    fb.gradV(0, 0, 480, 270, [0x06070f, 0x0c1020, 0x141828]);
    fb.rect(0, 220, 480, 50, 0x1a1c26);
    fb.rect(60, 60, 90, 160, 0x10121c); fb.rect(330, 40, 110, 180, 0x10121c);
    fb.rect(80, 90, 10, 14, 0x3a3020); fb.rect(360, 80, 10, 14, 0x3a3020);
    qwen(fb, 240, 224, { u: 3, eyes: 'closed', mouth: lt > 0.8 ? 'o' : 'none', arms: 'hold', shirt: true, t });
    for (let i = 0; i < 8; i++) fb.circle(200 + hash(i) * 80, 150 + hash(i * 5) * 60, 3, 0x9d5bff);
    woodSign(fb, 240, 186, 'COMING SOON', { font: 'big' });
    if (lt > 0.8) { const k = seg(lt, 0.8, 1.4); fb.circle(270 + k * 10, 130 - k * 10, 3 + k * 3, 0x8a8a9a, 0.6 * (1 - k)); }
    const L = new LightMap().reset(0.55, 0.55, 0.7);
    L.light(240, 120, 140, 0xffe0b0, 0.6);
    L.apply(fb, 8);
    rain(fb, t, { n: 60, speed: 250, angle: 0.1, len: 5, ground: 270, alpha: 0.3 });
    vignette(fb, 0.5);
    if (lt > 1.1) fb.overlay(0x000000, seg(lt, 1.1, 1.5));
  },
};
