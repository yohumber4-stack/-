// Studio ident: shutters open on a dawn sky; Clawd and Codex peek over the sill,
// Gemini pops up late and bonks into frame — the first tiny "coming soon" joke.
import { FB } from '../engine/fb.js';
import { text, textWidth } from '../engine/font.js';
import { E, seg, clamp, mix } from '../engine/core.js';
import { vignette, stars } from '../engine/fx.js';
import { char } from '../sprites/chars.js';
import { emote } from '../sprites/props.js';
import { cloud, rays } from '../bg.js';
import { hop, blink } from '../kit.js';

const WW = 196, WH = 108;
const win = new FB(WW, WH);

export default {
  dur: 5,
  render(fb, t) {
    fb.clear(0x07080f);
    const cx = 240, cy = 78, fw = WW + 8, fh = WH + 8;
    const X0 = cx - fw / 2, Y0 = cy - fh / 2;
    const appear = E.outCubic(seg(t, 0.1, 0.7));
    const open = E.inOutCubic(seg(t, 0.7, 1.35));
    if (open > 0) {
      rays(fb, cx, cy + 40, 7, 170, 0xffd9a0, 0.5 * open, t, 1.3);
      fb.glow(cx, cy, 150, 0xffb070, 0.22 * open, 8);
    }
    win.clear();
    win.gradV(0, 0, WW, WH, [0x2a3570, 0x7a6aa8, 0xf0a07a, 0xffd49a]);
    stars(win, t, 9, 30, 0, 0, WW, 44, { alpha: 0.8 });
    win.glow(160, 80, 26, 0xfff0c0, 0.7);
    win.circle(160, 80, 8, 0xfff4d0);
    cloud(win, 40 + t * 3, 56, 50, 0xffe2c8, 0xe0a8a0, 2);
    cloud(win, 150 - t * 2, 30, 40, 0xf8d0c8, 0xc890a8, 5);
    const sill = WH;
    // Clawd pops up on the left, waves
    const cUp = E.outBack(seg(t, 2.3, 2.65));
    if (cUp > 0) {
      const wave = t > 2.7 && t < 3.4;
      const surprised = t > 3.55 && t < 3.9;
      char(win, 'clawd', 40, sill + 26 - cUp * 24, {
        eyes: surprised ? 'wide' : blink(t, 1) ? 'blink' : 'open', lookX: t > 3.5 ? 1 : 0,
        armL: wave ? (Math.sin(t * 22) > 0 ? -12 : -6) : 0, mouth: t > 3.9 ? 'open' : 'smile',
      });
    }
    const xUp = E.outBack(seg(t, 2.55, 2.9));
    if (xUp > 0) {
      const face = t > 3.55 ? (t < 3.9 ? 'wow' : 'happy') : t > 3.0 ? 'happy' : 'prompt';
      char(win, 'codex', 158, sill + 34 - xUp * 30, { face, cursor: Math.floor(t * 3) % 2 === 0 });
    }
    // Gemini: late, overshoots, bonks the frame, then grins
    const gUp = seg(t, 3.3, 3.55);
    if (gUp > 0) {
      const y = sill + 34 - E.outBack(gUp) * 42 + hop(t, 3.55, 0.3, -5);
      const ok = t > 3.9;
      char(win, 'gemini', 99, y, { eyes: ok ? 'happy' : 'wide', mouth: ok ? 'open' : 'o', blush: ok ? 'big' : true, handR: ok ? -10 : 0 });
      if (t > 3.55 && t < 3.9) emote(win, 'spark', 99, y - 60, { scale: 2 });
    }
    fb.blit(win, X0 + 4, Y0 + 4, { alpha: appear });

    const wood = mix(0x07080f, 0x7a5436, appear), woodHi = mix(0x07080f, 0xa2744c, appear), woodSh = mix(0x07080f, 0x4d3322, appear);
    fb.rect(X0, Y0, fw, 4, wood); fb.rect(X0, Y0 + fh - 4, fw, 4, wood);
    fb.rect(X0, Y0, 4, fh, wood); fb.rect(X0 + fw - 4, Y0, 4, fh, wood);
    fb.rect(X0, Y0, fw, 1, woodHi); fb.rect(X0, Y0 + fh - 1, fw, 1, woodSh);
    fb.rect(X0 - 8, Y0 + fh, fw + 16, 5, woodSh); fb.rect(X0 - 8, Y0 + fh, fw + 16, 1, woodHi);
    if (open > 0) { fb.line(X0 + 12, Y0 + 28, X0 + 28, Y0 + 12, 0xffffff, 0.3 * open); fb.line(cx + 60, cy + 40, cx + 72, cy + 28, 0xffffff, 0.25 * open); }
    // shutters swing open
    const shutter = (side) => {
      const hingeX = side < 0 ? X0 : X0 + fw;
      const col = mix(0x07080f, 0x2f6b66, appear), dark = mix(0x07080f, 0x1d4441, appear);
      if (open < 0.5) {
        const w = (fw / 2) * (1 - open * 2), x = side < 0 ? hingeX : hingeX - w;
        fb.rect(x, Y0, w, fh, mix(col, dark, open * 2));
        for (let i = 1; i < 7; i++) fb.rect(x, Y0 + (i * fh) / 7, w, 1, dark);
      } else {
        const w = (fw / 2 - 30) * (open * 2 - 1), x = side < 0 ? hingeX - w : hingeX;
        fb.rect(x, Y0 + 2, w, fh - 4, mix(dark, col, 0.6));
        for (let i = 1; i < 7; i++) fb.rect(x, Y0 + 2 + (i * (fh - 4)) / 7, w, 1, dark);
      }
    };
    shutter(-1); shutter(1);
    const title = 'CONTEXT WINDOW';
    const n = Math.floor(seg(t, 1.25, 2.2) * title.length + 0.001);
    text(fb, title, 240, 162, 0xfff0d8, { scale: 2, align: 'center', chars: n, spacing: 2 });
    if (t > 1.2 && t < 2.6 && Math.floor(t * 6) % 2 === 0) {
      const full = textWidth(title, 'big', 2) * 2, part = textWidth(title.slice(0, n), 'big', 2) * 2;
      fb.rect(Math.round(240 - full / 2) + part + (n ? 4 : 0), 162, 8, 14, 0xffb070);
    }
    const p = seg(t, 2.3, 2.8);
    if (p > 0) text(fb, 'P I C T U R E S', 240, 186, mix(0x07080f, 0xffb070, p), { align: 'center' });
    const pr = seg(t, 3.9, 4.3);
    if (pr > 0) text(fb, 'ПРЕДСТАВЛЯЕТ', 240, 212, mix(0x07080f, 0x8a93b8, pr), { align: 'center' });
    vignette(fb, 0.5);
    if (t > 4.4) fb.overlay(0x000000, clamp((t - 4.4) / 0.6));
  },
};
