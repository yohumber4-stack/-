// May 19: the big stage. Gemini unveils the giant "3.5 PRO" lantern and promises
// it for June. Cutaway: Clawd and Codex exchange a look; Qwen quietly takes notes.
import { E, seg, clamp, lerp, hash, mix, step, TAU } from '../engine/core.js';
import { vignette, fireflies, confetti, LightMap } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { SKY, sky, hills, skyline, cloud } from '../bg.js';
import { bigLantern, bubble, caption, calendar, paperTag } from '../props.js';
import { gemini } from '../chars/gemini.js';
import { clawd } from '../chars/clawd.js';
import { codex } from '../chars/codex.js';
import { qwen } from '../chars/qwen.js';
import { whale, moon } from '../chars/extras.js';
import { hop, bounce, float, eyesB } from '../kit.js';

const GCOL = [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853];

function bunting(fb, x0, y0, x1, y1, sag, t, n = 14) {
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const x = lerp(x0, x1, k), y = lerp(y0, y1, k) + Math.sin(k * Math.PI) * sag;
    fb.line(px, py, x, y, 0x3a2a3a);
    if (i < n) {
      const fx = (px + x) / 2, fy = (py + y) / 2 + 1, sw = Math.sin(t * 3 + i) * 1;
      fb.poly([fx - 3, fy, fx + 3, fy, fx + sw, fy + 7], GCOL[i % 4]);
    }
    px = x; py = y;
  }
}

function bulbs(fb, str, cx, y, t, sc = 3) {
  // marquee letters made of light bulbs
  const G = { I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'], O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'] };
  const widths = [...str].map((c) => G[c][0].length);
  const total = widths.reduce((a, b) => a + b, 0) + str.length - 1;
  let x = cx - (total * sc * 2) / 2;
  let k = 0;
  [...str].forEach((c, ci) => {
    const g = G[c];
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < g[0].length; gx++)
        if (g[gy][gx] === '#') {
          const px = x + gx * sc * 2, py = y + gy * sc * 2;
          const on = Math.sin(t * 6 - k * 0.7) > -0.3;
          const col = GCOL[(ci + gy) % 4];
          fb.circle(px, py, sc * 0.7, on ? mix(col, 0xffffff, 0.35) : mix(col, 0x000000, 0.4));
          if (on) fb.glow(px, py, sc * 2.2, col, 0.35, 4);
          k++;
        }
    x += (g[0].length + 1) * sc * 2;
  });
}

function stage(fb, t) {
  // wooden stage with skirt and steps
  fb.rect(130, 186, 300, 8, 0x8a5a3a);
  fb.rect(130, 186, 300, 1, 0xb07a50);
  fb.rect(130, 194, 300, 30, 0x5a3a2a);
  for (let x = 134; x < 430; x += 12) fb.rect(x, 194, 1, 30, 0x4a2e22);
  for (let i = 0; i < 25; i++) { const x = 136 + i * 12; fb.poly([x, 194, x + 12, 194, x + 6, 200 + Math.sin(t * 2 + i) * 0.5], i % 2 ? 0xc0392b : 0xe0b040); }
  // side speakers
  for (const sx of [118, 432]) { fb.rect(sx - 10, 150, 20, 36, 0x22222c); fb.circle(sx, 162, 6, 0x3a3a48); fb.circle(sx, 162, 3, 0x15151c); fb.circle(sx, 177, 4, 0x3a3a48); }
  // backdrop panel
  fb.rect(150, 96, 260, 90, 0x2c2456);
  fb.rect(150, 96, 260, 2, 0x4a3f86);
  for (let x = 156; x < 408; x += 16) fb.rect(x, 100, 1, 84, 0x352c66);
}

export default {
  dur: 9,
  in: { type: 'black', dur: 0.6 },
  render(fb, t) {
    if (t < 6.2) {
      // ---- shot 1: wide on the stage ----
      sky(fb, SKY.sunset);
      fb.glow(380, 120, 70, 0xffd38a, 0.5, 8);
      fb.circle(380, 128, 16, 0xffe6a8);
      cloud(fb, 90 + t * 3, 50, 70, 0xf3a0a8, 0xc9748f, 3);
      cloud(fb, 330 - t * 2, 34, 50, 0xf7b8b0, 0xd08a98, 7);
      hills(fb, 150, 10, 0.012, 0x6a4f86, 4, 0);
      skyline(fb, 176, 0x4a3868, 11, t * 2, { windows: 0xffd98a, t });
      fb.rect(0, 176, 480, 94, 0x3a2c4a);
      for (let y = 176; y < 270; y += 6) for (let x = (y % 12 ? 0 : 6); x < 480; x += 12) fb.rect(x, y, 11, 5, 0x44344f);
      stage(fb, t);
      bunting(fb, 0, 40, 160, 70, 18, t);
      bunting(fb, 400, 70, 480, 44, 12, t);
      bunting(fb, 150, 92, 410, 92, 16, t, 18);
      bulbs(fb, 'I/O', 280, 104, t, 3);

      // tarp / giant lantern on stage right
      const reveal = E.outCubic(seg(t, 1.9, 2.6));
      const lx = 352, ly = 186;
      if (reveal > 0) {
        bigLantern(fb, lx, ly, { inflate: 0.78, w: 62, h: 74, t, label: '3.5 PRO', lit: 0.15 + 0.15 * Math.sin(t * 3) });
        for (let i = 0; i < 6; i++) {
          const a = t * 1.5 + (i * TAU) / 6, r = 44 + Math.sin(t * 2 + i) * 4;
          const px = lx + Math.cos(a) * r, py = ly - 44 + Math.sin(a) * r * 0.6;
          if (Math.sin(t * 9 + i * 2) > 0) { fb.set(px, py, 0xffffff); fb.set(px - 1, py, 0xfff0a0); fb.set(px + 1, py, 0xfff0a0); fb.set(px, py - 1, 0xfff0a0); fb.set(px, py + 1, 0xfff0a0); }
        }
      }
      if (reveal < 1) {
        // tarp flies up and off to the right
        const fly = E.inQuad(seg(t, 1.9, 2.7));
        const tx = lx + fly * 120, ty = ly - 40 - fly * 110, rot = fly * 1.2;
        const pts = [[-34, -42], [34, -40], [38, 40], [-36, 40]].map(([u, v]) => [tx + u * Math.cos(rot) - v * Math.sin(rot) * 0.5, ty + u * Math.sin(rot) * 0.5 + v * Math.cos(rot) * (1 - fly * 0.4)]);
        fb.poly(pts.flat(), 0x5a6a8a);
        for (let i = 0; i < 4; i++) fb.line(pts[0][0] + i * 16, pts[0][1] + 4, pts[3][0] + i * 16, pts[3][1] - 4, 0x4a5878);
        if (fly === 0) paperTag(fb, lx + 20, ly - 70, ['3.5 PRO'], { string: 6 });
      }

      // Gemini hops in and presents
      const gx = lerp(470, 262, E.outCubic(seg(t, 0.2, 1.2)));
      const gy = 150 + float(t, 1.5, 3) + hop(t, 0.2, 0.5, 18) + hop(t, 0.7, 0.5, 12) + bounce(t, 0.45, 5, 3.3) * (t < 5.6 ? 1 : 0);
      const pointing = t > 3.2;
      gemini(fb, gx, gy, {
        size: 44, t, eyes: t > 3.2 ? 'happy' : 'normal', mouth: t > 2.4 ? 'grin' : 'smile', blush: t > 3.2,
        armR: t > 1.6 && t < 2.4 ? 1 : pointing ? 1.2 : Math.sin(t * 10) * 0.5 * seg(t, 1.0, 1.2) * (t < 1.6 ? 1 : 0),
        armL: pointing ? 0.4 : 0, rot: Math.sin(t * 5) * 0.06,
      });
      if (t > 3.3) {
        const k = E.outBack(seg(t, 3.3, 3.6));
        const bw = 62 * k, bh = 40 * k;
        if (k > 0.1) {
          bubble(fb, gx - 90, gy - 92, bw, bh, gx - 22, gy - 26);
          if (k > 0.9) {
            calendar(fb, gx - 84, gy - 86, 'ИЮНЬ', { w: 34, h: 28 });
            text(fb, '!', gx - 42, gy - 82, 0xea4335, { scale: 3 });
          }
        }
      }

      // audience silhouettes in the foreground
      const cheer = t > 2.4 ? 1 : 0;
      const sil = 0x1b1330;
      const jump = (s) => (cheer ? bounce(t + s, 0.5, 4, 2.4) : float(t, 1, 2, s));
      whale(fb, 44, 272 + jump(0.1), { u: 2, tint: sil, tintK: 1 });
      clawd(fb, 150, 270 + jump(0.3), { u: 4, tint: sil, tintK: 1, armL: cheer, armR: cheer });
      qwen(fb, 250, 280 + jump(0.5) * 0.3, { u: 2, spy: true, solid: sil });
      codex(fb, 350, 266 + jump(0.7), { u: 2, tint: sil, tintK: 1, face: '', hands: cheer ? { l: [-3, 4], r: [29, 4] } : undefined });
      moon(fb, 448, 270 + jump(0.9), { u: 2, tint: sil, tintK: 1 });
      fireflies(fb, t, 5, 16, 240, 120, 220, 60, { k: 0.6 });
      if (t > 3.4) confetti(fb, t, 3.4, { n: 70 });
      vignette(fb, 0.35);
      caption(fb, t, 0.4, 2.8, '19 МАЯ');
    } else {
      // ---- shot 2: the audience, seen from the stage ----
      const lt = t - 6.2;
      sky(fb, [0xe08a70, 0xc0607a, 0x7a4a86], 0, 110);
      skyline(fb, 110, 0x5a3f70, 3, 40, { windows: 0xffd98a, t });
      fb.gradV(0, 110, 480, 160, [0x4a3658, 0x2e2240]);
      bunting(fb, 0, 18, 480, 18, 20, t, 22);
      // stage light from above (the stage is behind the camera)
      const L = new LightMap().reset(0.7, 0.62, 0.72);
      L.light(240, 120, 260, 0xffe0b0, 0.6, 0.6);
      // background crowd silhouettes
      for (let i = 0; i < 9; i++) {
        const x = 20 + i * 56 + Math.sin(i) * 10, y = 150 + bounce(lt + i * 0.2, 0.7, 2);
        if (i % 3 === 0) clawd(fb, x, y, { u: 2, tint: 0x3a2a50, tintK: 0.85 });
        else if (i % 3 === 1) codex(fb, x, y, { u: 1, tint: 0x3a2a50, tintK: 0.85, face: '' });
        else moon(fb, x, y + 2, { u: 1, tint: 0x3a2a50, tintK: 0.85 });
      }
      whale(fb, 432, 214, { u: 2, eyes: 'smug', mouth: 'smile', t });
      clawd(fb, 214, 246, { u: 5, look: lt > 0.9 ? 1 : 0, lookY: lt > 0.9 ? 0 : -1, eyes: eyesB(lt, 'normal', 4) });
      codex(fb, 330, 244, { u: 2.5, t, face: step(lt, [[0, '>_'], [1.0, 'o_o'], [1.8, '-_-']]), flip: true, hands: { l: [0, 18], r: [26, 18] } });
      // Qwen in the foreground, taking notes
      qwen(fb, 58, 318, { u: 5, spy: true, arms: 'hold', eyes: 'line', mouth: lt > 1.2 ? 'smirk' : 'none' });
      fb.rect(70, 214, 44, 30, 0xf6f1e4); fb.rect(70, 214, 44, 4, 0xc84a3a); fb.rect(70, 244, 44, 2, 0xcfc6b0);
      for (let i = 0; i < 5; i++) fb.rect(74, 222 + i * 4, Math.min(34, Math.floor((lt * 16 + i * 9) % 35)), 1, 0x6a6a7a);
      fb.rect(104 + Math.sin(lt * 20) * 3, 222, 3, 18, 0xe0b040); fb.rect(104 + Math.sin(lt * 20) * 3, 240, 3, 3, 0x333333);
      L.apply(fb, 8);
      fireflies(fb, lt, 9, 10, 240, 100, 240, 50, { k: 0.5 });
      // "?" over Clawd / Codex as they glance at each other
      if (lt > 1.5) text(fb, '?', 300, 150 + Math.sin(lt * 6) * 1, 0xffffff, { scale: 3, outline: 0x1a1a2a });
      vignette(fb, 0.4);
    }
  },
};
