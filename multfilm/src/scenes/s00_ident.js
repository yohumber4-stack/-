// Studio ident: "CONTEXT WINDOW PICTURES". The shutters open onto a dawn sky;
// Clawd and Codex peek over the sill, Gemini pops up late (a first hint of "coming soon").
import { FB } from '../engine/fb.js';
import { text, textWidth } from '../engine/font.js';
import { E, seg, clamp, lerp, mix } from '../engine/core.js';
import { vignette, stars } from '../engine/fx.js';
import { clawd } from '../chars/clawd.js';
import { codex } from '../chars/codex.js';
import { gemini } from '../chars/gemini.js';
import { cloud, rays } from '../bg.js';
import { hop } from '../kit.js';

const win = new FB(116, 84);

export default {
  dur: 5,
  render(fb, t) {
    fb.clear(0x07080f);
    const cx = 240, cy = 92, fw = 124, fh = 92;
    const X0 = cx - fw / 2, Y0 = cy - fh / 2;
    const appear = E.outCubic(seg(t, 0.1, 0.7));
    const open = E.inOutCubic(seg(t, 0.7, 1.35));

    // light spilling out of the window
    if (open > 0) {
      rays(fb, cx, cy + 30, 7, 150, 0xffd9a0, 0.5 * open, t, 1.3);
      fb.glow(cx, cy, 120, 0xffb070, 0.25 * open, 8);
    }

    // interior: dawn sky with clouds and peeking characters
    win.clear();
    win.gradV(0, 0, 116, 84, [0x2a3570, 0x7a6aa8, 0xf0a07a, 0xffd49a]);
    stars(win, t, 9, 22, 0, 0, 116, 36, { alpha: 0.8 });
    win.glow(88, 64, 22, 0xfff0c0, 0.7);
    win.circle(88, 64, 7, 0xfff4d0);
    cloud(win, 28 + t * 2, 44, 38, 0xffe2c8, 0xe0a8a0, 2);
    cloud(win, 92 - t * 1.5, 26, 30, 0xf8d0c8, 0xc890a8, 5);
    const sill = 84;
    // Clawd pops up on the left
    const cUp = E.outBack(seg(t, 2.35, 2.7));
    if (cUp > 0) {
      const lookG = t > 3.55 ? 1 : t > 2.9 ? 1 : 0;
      clawd(win, 28, sill + 22 - cUp * 21, { u: 2, look: lookG, eyes: t > 3.55 && t < 3.75 ? 'wide' : 'normal', armL: t > 2.7 && t < 3.3 ? 0.9 + Math.sin(t * 20) * 0.3 : 0 });
    }
    const xUp = E.outBack(seg(t, 2.6, 2.95));
    if (xUp > 0) {
      const face = t > 3.55 ? (t < 3.9 ? 'o_o' : '^_^') : t > 3.0 ? '^_^' : '>_';
      codex(win, 88, sill + 20 - xUp * 19, { face, t, flip: true, hands: { l: [0, 16], r: [26, 16] } });
    }
    // Gemini: late, overshoots and bonks the frame
    const gUp = seg(t, 3.35, 3.6);
    if (gUp > 0) {
      const y = sill + 18 - E.outBack(gUp) * 36 + hop(t, 3.6, 0.35, -4);
      gemini(win, 58, y, { size: 30, eyes: t > 3.9 ? 'happy' : 'wide', mouth: t > 3.9 ? 'grin' : 'open', blush: t > 3.9, armR: t > 3.9 ? 0.6 : 0, rot: Math.sin(t * 9) * 0.08 * seg(t, 3.5, 4.2) });
    }
    fb.blit(win, X0 + 4, Y0 + 4, { alpha: appear });

    // frame and mullions
    const wood = mix(0x07080f, 0x7a5436, appear), woodHi = mix(0x07080f, 0xa2744c, appear), woodSh = mix(0x07080f, 0x4d3322, appear);
    fb.rect(X0, Y0, fw, 4, wood); fb.rect(X0, Y0 + fh - 4, fw, 4, wood);
    fb.rect(X0, Y0, 4, fh, wood); fb.rect(X0 + fw - 4, Y0, 4, fh, wood);
    fb.rect(X0, Y0, fw, 1, woodHi); fb.rect(X0, Y0 + fh - 1, fw, 1, woodSh);
    fb.rect(cx - 1, Y0 + 4, 2, fh - 8, wood); fb.rect(X0 + 4, cy - 1, fw - 8, 2, wood);
    fb.rect(X0 - 6, Y0 + fh, fw + 12, 4, woodSh); fb.rect(X0 - 6, Y0 + fh, fw + 12, 1, woodHi);
    // glass glints
    if (open > 0) { fb.line(X0 + 10, Y0 + 22, X0 + 22, Y0 + 10, 0xffffff, 0.35 * open); fb.line(cx + 8, cy + 30, cx + 16, cy + 22, 0xffffff, 0.3 * open); }

    // shutters swing outwards
    const shutter = (side) => {
      const hingeX = side < 0 ? X0 : X0 + fw;
      const col = mix(0x07080f, 0x2f6b66, appear), dark = mix(0x07080f, 0x1d4441, appear);
      if (open < 0.5) {
        const w = (fw / 2) * (1 - open * 2);
        const x = side < 0 ? hingeX : hingeX - w;
        fb.rect(x, Y0, w, fh, mix(col, dark, open * 2));
        for (let i = 1; i < 6; i++) fb.rect(x, Y0 + (i * fh) / 6, w, 1, dark);
      } else {
        const w = (fw / 2 - 18) * (open * 2 - 1);
        const x = side < 0 ? hingeX - w : hingeX;
        fb.rect(x, Y0 + 2, w, fh - 4, mix(dark, col, 0.6));
        for (let i = 1; i < 6; i++) fb.rect(x, Y0 + 2 + (i * (fh - 4)) / 6, w, 1, dark);
      }
    };
    shutter(-1); shutter(1);

    // studio name, typed in
    const title = 'CONTEXT WINDOW';
    const n = Math.floor(seg(t, 1.25, 2.2) * title.length + 0.001);
    text(fb, title, 240, 168, 0xfff0d8, { scale: 2, align: 'center', chars: n, spacing: 2 });
    const p = seg(t, 2.3, 2.8);
    if (p > 0) text(fb, 'P I C T U R E S', 240, 192, mix(0x07080f, 0xffb070, p), { align: 'center' });
    const pr = seg(t, 3.9, 4.3);
    if (pr > 0) text(fb, 'ПРЕДСТАВЛЯЕТ', 240, 214, mix(0x07080f, 0x8a93b8, pr), { font: 'big', align: 'center' });
    // blinking cursor after the typed title
    if (t > 1.2 && t < 2.6 && Math.floor(t * 6) % 2 === 0) {
      const full = textWidth(title, 'big', 2) * 2, part = textWidth(title.slice(0, n), 'big', 2) * 2;
      fb.rect(Math.round(240 - full / 2) + part + (n ? 4 : 0), 168, 8, 14, 0xffb070);
    }
    vignette(fb, 0.5);
    if (t > 4.4) fb.overlay(0x000000, clamp((t - 4.4) / 0.6));
  },
};
