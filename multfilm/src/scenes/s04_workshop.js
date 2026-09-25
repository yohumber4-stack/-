// Gemini's workshop, June -> September. The "3.5 PRO" lantern will not inflate;
// Gemini fires quick Flash rockets instead, while outside the window everyone
// else's flagships rise. In the sky hangs an empty star-shaped slot: COMING SOON.
import { FB } from '../engine/fb.js';
import { E, seg, clamp, lerp, hash, mix, step, key } from '../engine/core.js';
import { vignette, LightMap, smoke, stars } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { bigLantern, calendar, calendarPage, MONTHS, paperTag, rocket, rocketTrail, flashPop, lantern, woodSign } from '../props.js';
import { gemini, starShape } from '../chars/gemini.js';
import { qwen } from '../chars/qwen.js';
import { hop, float, eyesB, bounce } from '../kit.js';

const view = new FB(150, 118);
const MONTH_T = [[0, 5], [4.0, 6], [8.0, 7], [12.4, 8]];

// outside world seen through the window (window-local coords)
function outside(t) {
  const v = view;
  v.gradV(0, 0, v.w, v.h, [0x0d1236, 0x1b2458, 0x2c3470]);
  stars(v, t, 44, 50, 0, 0, v.w, 80);
  if (t > 8.0) {
    const a = seg(t, 8.0, 8.8);
    starShape(v, 40, 26, 26, (ang, r, px, py) => (r > 0.78 || (px + py) % 3 === 0 ? mix(0x1b2458, 0x9aa6d8, 0.6 * a) : null));
    v.line(40, 36, 34, 44, 0x8a7a60); v.line(40, 36, 46, 44, 0x8a7a60);
    woodSign(v, 40, 49, 'COMING SOON', { font: 'small' });
  }
  const rise = (t0, x, kind, label, size, top) => {
    if (t < t0) return;
    const k = E.outCubic(seg(t, t0, t0 + 2.4));
    lantern(v, x + Math.sin(t + x) * 1.5, lerp(132, top, k), { kind, size, label, t, lit: 1 });
  };
  if (t < 12.4) {
    rise(1.0, 112, 'claude', 'FABLE 5', 16, 30);
    rise(4.6, 104, 'openai', 'GPT-5.6', 16, 62);
    rise(9.0, 120, 'kimi', 'K3', 14, 86);
  } else {
    lantern(v, 96, 22, { kind: 'astra', size: 22, t, lit: 1 });
    lantern(v, 128, 40, { kind: 'claude', size: 20, t, lit: 1 });
    lantern(v, 70, 14, { kind: 'sol', size: 16, t, lit: 1 });
    lantern(v, 112, 70, { kind: 'luna', size: 14, t, lit: 1 });
  }
  v.rect(0, 98, v.w, 20, 0x1a1f3a);
  v.poly([80, 102, 112, 84, 144, 102], 0xc0643c);
  v.rect(86, 102, 52, 16, 0xd8c8a8);
  v.rect(106, 106, 9, 8, 0xffd27a);
  v.circle(36, 110, 10, 0x2a5a36); v.circle(24, 112, 8, 0x24502f); v.circle(48, 113, 7, 0x24502f);
}

// full-screen view through the window: everyone's flagships rise; Gemini's slot stays empty
function pov(fb, t) {
  fb.gradV(0, 0, 480, 270, [0x0a0f30, 0x18215a, 0x2c3674]);
  stars(fb, t, 45, 180, 0, 0, 480, 210);
  const a = 1;
  starShape(fb, 132, 70, 70, (ang, r, px, py) => (r > 0.84 || (px * 3 + py) % 7 === 0 ? mix(0x18215a, 0xaab6e8, 0.55 * a) : null));
  fb.line(132, 98, 118, 116, 0x8a7a60); fb.line(132, 98, 146, 116, 0x8a7a60);
  woodSign(fb, 132, 124, 'COMING SOON', { font: 'big', color: 0xb98a5a });
  text(fb, '3.5 PRO', 132, 66, 0x6a76a8, { align: 'center' });
  const rise = (t0, x, top, kind, label, size) => {
    if (t < t0) return;
    const k = E.outCubic(seg(t, t0, t0 + 1.6));
    const y = lerp(300, top, k);
    lantern(fb, x + Math.sin(t * 0.8 + x) * 2, y, { kind, size, label, t, lit: 1 });
    fb.glow(x, y, size * 2.4, kind === 'claude' ? 0xffa36b : 0xfff0c8, 0.25, 6);
  };
  rise(12.5, 320, 66, 'astra', 'GPT-6 ASTRA', 46);
  rise(12.9, 420, 118, 'claude', 'OPUS 5.5', 40);
  rise(13.4, 238, 40, 'sol', 'GPT-6 SOL', 30);
  rise(13.8, 60, 176, 'luna', 'GPT-6 LUNA', 26);
  // rooftops across the street and the suspicious bush
  fb.rect(0, 222, 480, 48, 0x121633);
  fb.poly([300, 230, 380, 196, 460, 230], 0xc0643c); fb.rect(312, 230, 136, 40, 0xd8c8a8); fb.rect(370, 238, 18, 16, 0xffd27a);
  fb.circle(90, 236, 20, 0x2a5a36); fb.circle(64, 240, 15, 0x24502f); fb.circle(116, 242, 14, 0x24502f);
  const pk = E.outBack(seg(t, 13.3, 13.7));
  if (pk > 0) {
    qwen(fb, 92, 262 - pk * 16, { u: 2, spy: true });
    fb.rect(98, 224 - pk * 16 + 16, 14, 6, 0x111118); fb.rect(110, 225 - pk * 16 + 16, 4, 4, 0x111118);
    if (Math.sin(t * 6) > 0.5) fb.set(113, 225 - pk * 16 + 16, 0xffffff);
    fb.circle(88, 246, 16, 0x2a5a36);
  }
  // window frame and Gemini's silhouette looking out
  fb.rect(0, 0, 480, 12, 0x2a1a10); fb.rect(0, 258, 480, 12, 0x2a1a10); fb.rect(0, 0, 12, 270, 0x2a1a10); fb.rect(468, 0, 12, 270, 0x2a1a10);
  fb.rect(236, 0, 8, 270, 0x2a1a10); fb.rect(0, 131, 480, 8, 0x2a1a10);
  gemini(fb, 420, 250, { size: 96, tint: 0x0a0a18, tintK: 0.92, droop: 0.15 + 0.3 * seg(t, 14.2, 15.2), line: 0x2a3050 });
}

export default {
  dur: 18,
  in: { type: 'black', dur: 0.6 },
  render(fb, t) {
    if (t >= 12.5 && t < 15.2) { pov(fb, t); vignette(fb, 0.45); return; }
    // ---- room ----
    fb.gradV(0, 0, 480, 222, [0x5a3a26, 0x6e4a30]);
    for (let x = 0; x < 480; x += 24) { fb.rect(x, 0, 1, 222, 0x4a2e1e); for (let y = 10 + (x % 48); y < 222; y += 70) fb.rect(x + 4, y, 16, 1, 0x5e3e28); }
    fb.rect(0, 222, 480, 48, 0x4e3322);
    for (let y = 226; y < 270; y += 8) fb.rect(0, y, 480, 1, 0x3c2618);
    fb.rect(0, 222, 480, 2, 0x2e1d12);

    // window with the outside world
    const wx = 314, wy = 28;
    outside(t);
    fb.rect(wx - 6, wy - 6, view.w + 12, view.h + 12, 0x3a2416);
    fb.blit(view, wx, wy);
    fb.rect(wx + view.w / 2 - 1, wy, 2, view.h, 0x5a3a26);
    fb.rect(wx, wy + view.h / 2 - 1, view.w, 2, 0x5a3a26);
    fb.rect(wx - 8, wy + view.h + 4, view.w + 16, 5, 0x7a5236);

    // calendar
    let mi = 5;
    for (const [ts, m] of MONTH_T) if (t >= ts) mi = m;
    calendar(fb, 40, 50, MONTHS[mi], { w: 58, h: 46 });
    for (const [ts] of MONTH_T.slice(1)) { const k = seg(t, ts - 0.1, ts + 0.7); if (k > 0 && k < 1) calendarPage(fb, 40, 50, k, { w: 58, h: 46, dir: 1 }); }

    // shelf with flash rockets, workbench
    fb.rect(24, 124, 100, 4, 0x8a5a3a); fb.rect(30, 128, 3, 8, 0x5a3a26); fb.rect(114, 128, 3, 8, 0x5a3a26);
    const rocketsLeft = t < 5.4 ? 3 : t < 10.0 ? 2 : 1;
    for (let i = 0; i < rocketsLeft; i++) rocket(fb, 44 + i * 22, 114, { size: 12 });
    fb.rect(16, 180, 120, 6, 0x8a5a3a); fb.rect(22, 186, 5, 36, 0x5a3a26); fb.rect(124, 186, 5, 36, 0x5a3a26);
    fb.rect(30, 170, 14, 10, 0x4a6aa0); fb.rect(30, 168, 14, 2, 0x3a3a44); fb.rect(52, 172, 22, 3, 0x9a9aa8); fb.rect(70, 168, 4, 10, 0x6a4a32);
    fb.rect(86, 164, 10, 16, 0xd64541); fb.rect(100, 170, 12, 10, 0xfbbc04); fb.rect(100, 168, 12, 2, 0x3a3a44);

    // ---- the big lantern ----
    const inflate = key(t, [[0, 0.42], [1.2, 0.42], [2.8, 0.86, E.outQuad], [3.1, 0.86], [3.6, 0.38, E.outBounce], [8, 0.36], [12.4, 0.34], [14.5, 0.14, E.inOutQuad], [18, 0.12]]);
    const LX = 214, LY = 222;
    fb.rect(LX - 20, LY - 4, 40, 4, 0x3a3a44); fb.rect(LX - 14, LY - 7, 28, 3, 0x55555f);
    const bl = bigLantern(fb, LX, LY - 6, { inflate, w: 70, h: 96, t, label: '3.5 PRO', patches: t > 3.6 });
    if (t > 2.95 && t < 3.3) text(fb, 'ПФФ', LX + 36, LY - 80, 0xffffff, { outline: 0x1a1a2a });
    smoke(fb, t, 3.0, LX + 30, LY - 70, { n: 6, color: 0xb0b0b8 });
    // tag with struck-out months
    if (t > 8.4) {
      const lines = ['COMING SOON', 'ИЮНЬ', 'ИЮЛЬ', 'АВГУСТ', t > 12.8 ? 'СЕНТЯБРЬ' : ''].filter(Boolean);
      const strikes = t > 12.8 ? [1, 2, 3] : t > 9.6 ? [1, 2] : [1];
      paperTag(fb, LX - 44, Math.max(bl.top + 10, LY - 70), lines, { string: 10, swing: Math.sin(t * 2) * 0.6, strike: strikes });
    }

    // ---- pump ----
    const pumping = t > 1.2 && t < 2.8;
    const stroke = pumping ? (Math.sin((t - 1.2) * Math.PI * 2 * 2.5) + 1) / 2 : 0;
    const PX = 168;
    fb.rect(PX - 5, 196, 10, 26, 0x4a7a6a); fb.rect(PX - 5, 196, 2, 26, 0x6a9a8a); fb.rect(PX - 7, 218, 14, 4, 0x3a3a44);
    fb.rect(PX - 1, 180 + stroke * 12, 2, 18, 0x9a9aa8); fb.rect(PX - 10, 178 + stroke * 12, 20, 3, 0x6a4a32);
    fb.line(PX + 5, 216, LX - 20, 219, 0x2a2a30);

    // ---- Gemini's choreography ----
    let gx = 150, gy = 156, go = { size: 40, t, eyes: 'determined', mouth: 'flat' };
    if (t < 1.2) { gx = lerp(120, 168, E.inOutSine(seg(t, 0.2, 1.1))); gy = 160 + float(t, 1, 3); }
    else if (t < 2.8) { gx = PX; gy = 158 + stroke * 12; go.armL = -0.5; go.armR = -0.5; go.squash = stroke * 0.25; }
    else if (t < 4.0) { gx = PX; gy = 156 + float(t, 1, 3) + hop(t, 2.95, 0.4, 10); go.eyes = t < 3.4 ? 'wide' : 'sad'; go.mouth = t < 3.4 ? 'open' : 'frown'; go.droop = seg(t, 3.4, 3.9) * 0.4; }
    else if (t < 5.4) {
      gx = lerp(PX, LX - 26, E.inOutSine(seg(t, 4.0, 4.5))); gy = 186 + float(t, 1, 3);
      go.eyes = 'determined'; go.armR = 0.3 + Math.sin(t * 30) * 0.3 * (t > 4.5 ? 1 : 0);
      if (t > 5.0) { go.eyes = 'closed'; go.mouth = 'wobble'; }
    } else if (t < 7.8) {
      // grab a rocket, go to the window, launch it
      const k1 = seg(t, 5.4, 6.0), k2 = seg(t, 6.0, 6.6);
      gx = t < 6.0 ? lerp(LX - 26, 66, E.inOutSine(k1)) : lerp(66, 360, E.inOutSine(k2));
      gy = t < 6.0 ? lerp(186, 110, E.inOutSine(k1)) : lerp(110, 150, E.inOutSine(k2));
      go.eyes = t > 7.0 && t < 7.6 ? 'happy' : 'determined'; go.mouth = t > 7.0 && t < 7.6 ? 'grin' : 'flat';
      go.lookY = t > 6.7 ? -1 : 0; go.look = t > 6.7 ? 1 : 0; go.armR = t > 6.6 ? 1 : 0.4;
      if (t > 5.9 && t < 6.75) rocket(fb, gx + 12, gy - 6, { size: 12 });
    } else if (t < 10.8) {
      gx = lerp(360, LX - 60, E.inOutSine(seg(t, 7.8, 8.4))); gy = 150 + float(t, 1, 3);
      go.eyes = eyesB(t, 'normal', 2); go.mouth = 'flat'; go.armR = t > 8.4 && t < 9.8 ? 0.4 + Math.sin(t * 18) * 0.2 : 0;
      if (t > 9.8) { gx = lerp(LX - 60, 360, E.inOutSine(seg(t, 9.8, 10.4))); go.eyes = 'determined'; }
      if (t > 9.9 && t < 10.5) rocket(fb, gx + 12, gy - 6, { size: 12 });
    } else if (t < 15.6) {
      gx = 360; gy = 150 + float(t, 1, 3);
      go.eyes = t > 12.6 ? 'wide' : t > 11.1 && t < 11.7 ? 'happy' : 'normal'; go.mouth = t > 12.6 ? 'wobble' : 'smile';
      go.lookY = -1; go.look = 1; go.sat = 1 - 0.45 * seg(t, 13.5, 15.5); go.droop = 0.3 * seg(t, 14, 15.5);
    } else {
      gx = lerp(360, LX - 50, E.inOutSine(seg(t, 15.2, 16.2))); gy = lerp(150, 200, E.inOutSine(seg(t, 15.2, 16.2))) + float(t, 0.6, 2);
      go.eyes = 'sad'; go.mouth = 'frown'; go.sat = 0.55; go.droop = 0.6; go.lookY = 1;
      rocket(fb, gx + 10, gy + 4, { size: 10 });
    }
    if (t > 5.2 && t < 5.9) smoke(fb, t, 5.0, LX - 16, LY - 12, { n: 5, color: 0x30303a, rise: 20 });
    if (t > 4.5 && t < 5.1 && Math.floor(t * 20) % 3 === 0) { for (let i = 0; i < 5; i++) fb.set(LX - 18 + hash(i + Math.floor(t * 20)) * 10, LY - 10 - hash(i * 3 + Math.floor(t * 20)) * 8, 0xffd060); }

    // window light floods the room in September
    const flood = seg(t, 12.8, 14.0) * (1 - 0.3 * seg(t, 16, 18));
    if (flood > 0) {
      const len = 120 * flood;
      fb.ellipse(gx - 20 - len / 2, 224, len / 2 + 10, 4, 0x000000, 0.35);
    }
    gemini(fb, gx, gy, go);

    // rocket launches seen through the window
    const launch = (t0, label, seed) => {
      const k = seg(t, t0, t0 + 0.6);
      if (k > 0 && k < 1) { const ry = wy + view.h - E.inQuad(k) * 90; rocket(fb, wx + 60, ry, { size: 10 }); rocketTrail(fb, t, wx + 60, ry + 6); }
      flashPop(fb, t, t0 + 0.6, wx + 66, wy + 24, { size: 46, label, seed });
    };
    launch(6.7, '3.6 FLASH', 1);
    launch(10.5, '3.7 FLASH', 2);

    // lighting: warm bulb + window light (flashes and the flagship glow)
    const L = new LightMap().reset(0.42, 0.36, 0.34);
    const bulbOn = 1 - 0.25 * flood;
    L.light(240, 18, 230, 0xffd9a0, 0.85 * bulbOn);
    L.light(wx + 56, wy + 50, 150, 0x9fb0ff, 0.35);
    const pop = (t0) => clamp(1 - Math.abs(t - t0 - 0.62) / 0.35);
    const fl = Math.max(pop(6.7), pop(10.5));
    if (fl > 0) L.light(wx + 56, wy + 40, 360, 0xfff4d0, 1.2 * fl);
    if (flood > 0) { L.light(wx + 50, wy + 30, 380, 0xfff0c8, 0.9 * flood); L.light(wx + 20, wy + 20, 300, 0xffa36b, 0.5 * flood * seg(t, 13.6, 14.6)); }
    L.apply(fb, 10);
    // hanging bulb
    fb.line(240, 0, 240, 12, 0x2a2a2a); fb.rect(236, 12, 8, 4, 0x3a3a44); fb.circle(240, 19, 3, 0xfff4c8); fb.glow(240, 19, 20, 0xffd98a, 0.4 * bulbOn);
    if (fl > 0.6) fb.overlay(0xffffff, (fl - 0.6) * 0.6);
    vignette(fb, 0.4);
  },
};
