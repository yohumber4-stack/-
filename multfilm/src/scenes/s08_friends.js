// Friendship. Clawd finds the mess, then Gemini — soaked, grey, pointing at the
// thief. An umbrella. A warm fireplace and a bag of "TPU" chips in Google's
// colours (Claude really does run on Google TPUs): Gemini laughs, and one of its
// points gets its colour back. Codex arrives with the fedora; three friends.
import { E, seg, clamp, lerp, hash, mix, step, key } from '../engine/core.js';
import { vignette, LightMap, rain, stars } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { cloud } from '../bg.js';
import { distiller, decoy, umbrella, chipsBag, chip } from '../props.js';
import { cottage, fence } from '../world/cottage.js';
import { gemini } from '../chars/gemini.js';
import { clawd } from '../chars/clawd.js';
import { codex } from '../chars/codex.js';
import { float, hop, bounce, eyesB } from '../kit.js';

const GY = 232, HX = 290;

function yard(fb, t) {
  fb.gradV(0, 0, 480, 150, [0x070a1a, 0x121838, 0x1e2650]);
  stars(fb, t, 71, 60, 0, 0, 480, 80, { alpha: 0.5 });
  for (let i = 0; i < 5; i++) cloud(fb, ((i * 130 + t * 6) % 640) - 80, 26 + (i % 2) * 20, 130, 0x1a2140, 0x131830, i + 21, 0.9);
  fb.rect(0, 150, 480, 82, 0x151a2c);
  for (let x = 0; x < 480; x += 40) fb.poly([x, 160, x + 20, 144 + (x % 80 ? 4 : 0), x + 40, 160], 0x10142a);
  fence(fb, 0, HX - 10, 216, 0x4a4050);
  fb.rect(0, GY, 480, 38, 0x2a2a34);
  for (let x = 0; x < 480; x += 14) fb.rect(x + ((x / 14) % 2) * 7, GY + 6, 10, 1, 0x34343f);
}

function room(fb, t) {
  fb.gradV(0, 0, 480, 216, [0x4a2c20, 0x6a4230]);
  for (let x = 0; x < 480; x += 30) fb.rect(x, 0, 1, 216, 0x3e2418);
  fb.rect(0, 216, 480, 54, 0x5a3624);
  for (let y = 222; y < 270; y += 9) fb.rect(0, y, 480, 1, 0x4a2c1c);
  fb.ellipse(240, 244, 150, 16, 0x9a3a3a); fb.ellipse(240, 244, 130, 12, 0xb84a44);
  // fireplace
  fb.rect(20, 110, 116, 106, 0x7a6a64); fb.rect(14, 104, 128, 10, 0x8a7a72);
  for (let y = 116; y < 214; y += 10) for (let x = 22 + ((y / 10) % 2) * 8; x < 134; x += 16) fb.rect(x, y, 14, 8, 0x8a7872);
  fb.rect(42, 150, 72, 66, 0x1a1010);
  for (let i = 0; i < 16; i++) {
    const fx = 50 + i * 4, h = 16 + Math.sin(t * 9 + i * 1.7) * 6 + Math.sin(t * 13 + i) * 4;
    fb.rect(fx, 214 - h, 4, h, i % 3 ? 0xff8a3a : 0xffc44a);
    fb.rect(fx + 1, 214 - h * 0.5, 2, h * 0.5, 0xfff0a0);
  }
  fb.rect(46, 208, 64, 6, 0x5a3a26);
  // window with rain and the far workshop
  const wx = 300, wy = 40;
  fb.rect(wx - 5, wy - 5, 110, 80, 0x3a2416);
  fb.gradV(wx, wy, 100, 70, [0x0a0e22, 0x1a2244]);
  fb.poly([wx + 20, wy + 60, wx + 40, wy + 44, wx + 60, wy + 60], 0x2a2230); fb.rect(wx + 24, wy + 60, 32, 10, 0x2a2230);
  fb.ellipse(wx + 70, wy + 58, 9, 7, 0x3a3a5a);
  for (let i = 0; i < 14; i++) { const px = wx + hash(i) * 100, py = wy + ((hash(i * 3) * 70 + t * 60) % 70); fb.line(px, py, px - 1, py + 3, 0x6a7aa8); }
  fb.rect(wx + 48, wy, 4, 70, 0x3a2416); fb.rect(wx, wy + 33, 100, 4, 0x3a2416);
  // table and door
  fb.rect(380, 176, 70, 6, 0x8a5a3a); fb.rect(386, 182, 5, 34, 0x6a4028); fb.rect(438, 182, 5, 34, 0x6a4028);
  fb.rect(404, 158, 8, 18, 0xd9b36a); fb.poly([398, 158, 418, 158, 412, 146, 404, 146], 0xf0e0b0);
  fb.rect(452, 118, 28, 98, 0x3a2416);
}

export default {
  dur: 14,
  render(fb, t) {
    if (t < 3.6) {
      // ---- wide: Clawd steps out ----
      yard(fb, t);
      const door = E.outCubic(seg(t, 0.2, 0.7));
      const C = cottage(fb, HX, GY, { t, lamp: 1, sleeping: false, door });
      distiller(fb, 60, GY, t, { broken: 1, bottles: 0 });
      [404, 382, 360, 338, 316, 294].forEach((qx, i) => decoy(fb, qx, GY + 2, { variant: i, fall: 1 }));
      fb.rect(168, GY - 2, 16, 2, 0x3f3530); fb.rect(171, GY - 7, 10, 5, 0x3f3530); fb.rect(171, GY - 4, 10, 1, 0x8c2f39);
      const cx = lerp(C.door[0], 340, E.inOutSine(seg(t, 0.7, 1.5)));
      clawd(fb, cx, GY + 1, { u: 3, hat: 'nightcap', walk: t > 0.7 && t < 1.5 ? t * 2 : undefined, eyes: t < 1.4 ? 'closed' : t < 2.3 ? 'wide' : 'normal', look: t > 1.5 && t < 2.3 ? -1 : t > 2.4 ? 1 : 0, flip: false, mouth: t > 1.6 && t < 2.3 ? 'o' : undefined });
      gemini(fb, 446, GY - 26 + float(t, 1, 3) + Math.sin(t * 40) * 0.5, { size: 40, sat: 0.4, eyes: t > 2.6 ? 'sad' : 'normal', mouth: 'flat', armL: 0.7, look: -1, droop: 0.3 });
      const L = new LightMap().reset(0.5, 0.52, 0.7);
      L.light(C.door[0], GY - 30, 110, 0xffc27a, 1.0);
      L.light(C.lamp[0], C.lamp[1], 90, 0xfff0b0, 0.8);
      L.apply(fb, 9);
      rain(fb, t, { n: 80, speed: 280, angle: 0.15, len: 5, ground: GY + 30, alpha: 0.35 });
      vignette(fb, 0.45);
      return;
    }
    if (t < 7.0) {
      // ---- close two-shot: the umbrella ----
      const lt = t - 3.6;
      fb.gradV(0, 0, 480, 270, [0x0a0e22, 0x151c38, 0x222a48]);
      for (let i = 0; i < 4; i++) cloud(fb, ((i * 150 + t * 6) % 640) - 80, 30 + (i % 2) * 20, 150, 0x1a2140, 0x131830, i + 31, 0.8);
      fb.rect(0, 226, 480, 44, 0x2a2a34);
      rain(fb, t, { n: 150, speed: 300, angle: 0.15, len: 7, ground: 270, alpha: 0.35 });
      const open = E.outBack(seg(lt, 0.5, 0.9));
      const ux = 262;
      clawd(fb, 176, 228, { u: 5, hat: 'nightcap', look: 1, lookY: 0, eyes: lt > 1.7 ? 'happy' : 'normal', blush: lt > 1.7, armR: 0.6 + 0.2 * open });
      umbrella(fb, 222, 200, { r: 78 * Math.max(0.2, open), h: 92, color: 0xe8795a, open: Math.max(0.2, open), tilt: 6 });
      const gSat = 0.4 + 0.05 * seg(lt, 2.4, 3.2);
      gemini(fb, 306, 172 + float(t, 1, 2) + Math.sin(t * 30) * 0.8 * (1 - open), { size: 72, sat: gSat, eyes: lt < 1.0 ? 'sad' : 'normal', mouth: lt > 2.6 ? 'smile' : 'flat', lookY: lt > 1.0 ? -1 : 0, look: lt > 1.0 ? -1 : 0, droop: 0.35 * (1 - seg(lt, 1.0, 2.6)), tear: lt > 1.3 && lt < 2.6 ? lt : 0, blush: lt > 2.8 });
      // rain in front, except under the umbrella
      rain(fb, t + 7, { n: 60, speed: 320, angle: 0.15, len: 8, ground: 270, alpha: 0.4, x0: 0, w: open > 0.5 ? 180 : 480 });
      if (open > 0.5) rain(fb, t + 3, { n: 40, speed: 320, angle: 0.15, len: 8, ground: 270, alpha: 0.4, x0: 372, w: 108 });
      const L = new LightMap().reset(0.52, 0.55, 0.72);
      L.light(240, 120, 260, 0xffc27a, 0.45);
      L.apply(fb, 9);
      vignette(fb, 0.45);
      return;
    }
    // ---- interior: fireplace, chips, Codex arrives ----
    const lt = t - 7;
    room(fb, t);
    const offer = E.inOutSine(seg(lt, 0.4, 1.0));
    const laugh = lt > 1.8;
    const pts = [0.35, laugh ? E.outCubic(seg(lt, 1.9, 2.4)) * 0.65 + 0.35 : 0.35, 0.35, 0.35];
    const gx = 200, gy = 176 + float(t, 0.8, 2) + (laugh && lt < 3.2 ? bounce(lt, 0.3, 3, 1.8) : 0);
    // stool and blanket
    fb.rect(180, 200, 40, 6, 0x8a5a3a); fb.rect(184, 206, 4, 12, 0x6a4028); fb.rect(212, 206, 4, 12, 0x6a4028);
    gemini(fb, gx, gy, { size: 60, sat: laugh ? 0.75 : 0.4, pts: laugh ? pts : undefined, eyes: lt < 1.2 ? 'normal' : lt < 1.8 ? 'wide' : laugh && lt < 3.4 ? 'happy' : eyesB(t, 'normal', 2), mouth: laugh && lt < 3.4 ? 'grin' : 'smile', blush: laugh, look: lt > 3.6 ? 1 : lt > 0.8 ? 1 : 0, lookY: lt > 6.2 ? -1 : 0 });
    fb.poly([gx - 26, gy + 4, gx + 26, gy + 4, gx + 22, gy + 26, gx - 22, gy + 26], 0xb84a44);
    for (let k = -2; k <= 2; k++) fb.line(gx + k * 9, gy + 5, gx + k * 8, gy + 25, 0xe8c070);
    fb.line(gx - 24, gy + 14, gx + 24, gy + 14, 0xe8c070);
    if (laugh && lt < 3.0) { const k = seg(lt, 1.9, 3.0); fb.glow(gx + 22, gy, 26 * (1 - k) + 6, 0x4285f4, 0.8 * (1 - k)); for (let i = 0; i < 10; i++) { const a = i * 0.63 + lt * 3; const r = 8 + k * 26; fb.set(gx + 22 + Math.cos(a) * r, gy + Math.sin(a) * r * 0.8, i % 2 ? 0xffffff : 0x9fc4ff); } }
    // Clawd with the chips
    const cx = 292;
    clawd(fb, cx, 216, { u: 4, eyes: laugh && lt < 3.6 ? 'happy' : eyesB(t, 'normal', 6), mouth: laugh && lt < 3.6 ? 'open' : lt > 0.4 ? 'smile' : undefined, look: -1, armL: 0.35 * offer, blush: laugh });
    const bagX = lerp(cx - 40, gx + 50, offer), bagY = 214 - offer * 10;
    chipsBag(fb, bagX, bagY, { open: true, k: 2 });
    if (lt > 2.2 && lt < 3.6) { chip(fb, gx + 14, gy + 2); if (lt > 2.6) for (let i = 0; i < 4; i++) fb.set(gx + 10 + hash(i) * 10, gy + 6 + ((lt * 20 + i * 5) % 12), 0xf0cc68); }
    // knock, door, Codex with the fedora
    if (lt > 3.4 && lt < 4.4) text(fb, 'ТУК-ТУК', 410, 100 + Math.sin(lt * 30) * 1, 0xffffff, { outline: 0x1a1a2a });
    const doorOpen = seg(lt, 3.9, 4.3);
    fb.rect(452, 118, 28 * doorOpen, 98, 0x1a1222);
    if (lt > 4.1) {
      const xk = E.outCubic(seg(lt, 4.1, 5.0));
      const xx = lerp(500, 400, xk), xy = 150 + float(t, 1.5, 2.2);
      const bump = seg(lt, 5.6, 6.0);
      codex(fb, xx, xy, { u: 2, t, face: step(lt, [[0, 'o_o'], [4.9, '^_^'], [6.3, '>_']]), flip: true, hands: lt < 5.3 ? { l: [-2, 6], r: [28, 14] } : { l: [-4 - bump * 14, 12], r: [28, 16] } });
      if (lt < 5.4) { const hx = xx - 34, hy = xy - 18; fb.rect(hx - 9, hy + 3, 18, 3, 0x3f3530); fb.rect(hx - 6, hy - 3, 12, 6, 0x3f3530); fb.rect(hx - 6, hy + 1, 12, 1, 0x8c2f39); }
      else { fb.rect(398, 170, 18, 3, 0x3f3530); fb.rect(401, 164, 12, 6, 0x3f3530); fb.rect(401, 168, 12, 1, 0x8c2f39); }
      if (bump > 0.9 && lt < 6.4) for (let i = 0; i < 6; i++) { const a = i * 1.05 + lt * 4; fb.set(gx + 50 + Math.cos(a) * 8, gy - 6 + Math.sin(a) * 8, 0xffffff); }
      if (lt > 5.0 && lt < 6.0) text(fb, '♥', gx, gy - 46 - (lt - 5) * 6, 0xff6b8a, { font: 'small', scale: 3 });
    }
    const L = new LightMap().reset(0.62, 0.52, 0.48);
    L.light(78, 190, 240, 0xffa04a, 1.1 + 0.1 * Math.sin(t * 11));
    L.light(408, 150, 90, 0xffe0a0, 0.6);
    L.apply(fb, 10);
    fb.glow(78, 196, 40, 0xff9040, 0.35);
    vignette(fb, 0.4);
  },
};
