// Rain. Gemini alone under a streetlamp. In a puddle, the old bright Gemini of
// lantern "3" — until a drop shatters the reflection into the grey present.
// The last firefly leaves. On the rooftops, a figure in a fedora sneaks by.
import { FB } from '../engine/fb.js';
import { E, seg, clamp, lerp, hash, mix, key } from '../engine/core.js';
import { vignette, LightMap, rain, letterbox, stars, drawFlies } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { cloud, sea, skyline } from '../bg.js';
import { streetlamp, woodSign, lantern } from '../props.js';
import { gemini, starShape } from '../chars/gemini.js';
import { qwen } from '../chars/qwen.js';
import { float, eyesB } from '../kit.js';

const refl = new FB(300, 90);

function bench(fb, x, y, w = 56) {
  fb.rect(x, y, w, 4, 0x6a4a32); fb.rect(x, y, w, 1, 0x8a6446);
  fb.rect(x + 2, y - 12, w - 4, 3, 0x6a4a32); fb.rect(x + 2, y - 7, w - 4, 3, 0x6a4a32);
  fb.rect(x + 4, y + 4, 3, 10, 0x2c3140); fb.rect(x + w - 7, y + 4, 3, 10, 0x2c3140);
}

function fogGlass(fb, x, y, w, h, t, scribble) {
  fb.rect(x - 2, y - 2, w + 4, h + 4, 0x2c3140);
  fb.rect(x, y, w, h, 0x9fb0c8, 0.28);
  for (let i = 0; i < 40; i++) { const px = x + hash(i * 3) * w, py = y + ((hash(i * 5) * h + t * (6 + hash(i) * 10)) % h); fb.blend(px, py, 0xdfe8ff, 0.6); }
  if (scribble) {
    // barely legible, written with a fingertip on the fogged glass
    for (let i = 0; i < 6; i++) {
      const a = 0.5 - i * 0.07;
      text(fb, 'I AM A DISGRACE', x + 5 + (i % 2) * 3, y + 6 + i * 8, mix(0x9fb0c8, 0xe8eeff, a), { font: 'small' });
    }
    // a rivulet washes part of it away
    const rx = x + 30 + Math.sin(t) * 4;
    fb.rect(rx, y, 3, h, 0x5a6a88, 0.5);
  }
}

export default {
  dur: 14,
  in: { type: 'black', dur: 0.8 },
  render(fb, t) {
    const bars = 22;
    if (t < 4.0) {
      // ---- wide ----
      const lightning = clamp(1 - Math.abs(t - 2.5) / 0.08) + 0.6 * clamp(1 - Math.abs(t - 2.72) / 0.06);
      fb.gradV(0, 0, 480, 170, [0x05070f, 0x0b1022, 0x151c36]);
      // the empty slot peeks between clouds
      starShape(fb, 110, 62, 40, (a, r, px, py) => (r > 0.8 || (px + py) % 3 === 0 ? 0x3a4468 : null));
      woodSign(fb, 110, 90, 'COMING SOON', { font: 'small', color: 0x5a4a38, ink: 0x201810 });
      for (let i = 0; i < 7; i++) cloud(fb, ((i * 90 + t * 8) % 620) - 70, 30 + (i % 3) * 16, 120, 0x1a2036, 0x121628, i, 0.95);
      sea(fb, 150, 200, t, { top: 0x1a2240, bottom: 0x0a0f22, glint: 0x3a4a78 });
      skyline(fb, 152, 0x0f1428, 5, 0, { windows: 0x8a6a3a, t });
      fb.rect(0, 200, 480, 70, 0x1e2230);
      for (let x = 0; x < 480; x += 16) fb.rect(x, 200, 15, 3, 0x2a3040);
      // railing
      fb.rect(0, 186, 480, 2, 0x3a4050);
      for (let x = 6; x < 480; x += 22) fb.rect(x, 186, 2, 14, 0x3a4050);
      streetlamp(fb, 250, 200, { h: 96 });
      bench(fb, 214, 214, 60);
      fogGlass(fb, 290, 170, 44, 44, t, false);
      gemini(fb, 244, 200 + float(t, 0.6, 1.5), { size: 36, sat: 0.3, droop: 0.7, eyes: 'sad', mouth: 'frown', lookY: 1 });
      // puddles
      fb.ellipse(262, 240, 40, 5, 0x3a4a6a, 0.8); fb.ellipse(120, 252, 30, 4, 0x2a3450, 0.8);
      fb.ellipse(262, 240, 12, 2, 0xfff1c0, 0.35);
      const L = new LightMap().reset(0.5 + lightning * 0.9, 0.54 + lightning * 0.9, 0.72 + lightning);
      L.cone(259, 104, 120, 0.5, 0xffd9a0, 1.8);
      L.light(259, 106, 60, 0xffe0b0, 1.2);
      L.light(250, 210, 70, 0xffd9a0, 0.6);
      L.apply(fb, 8);
      fb.glow(259, 106, 16, 0xfff1c0, 0.7);
      rain(fb, t, { n: 260, speed: 300, angle: 0.18, len: 6, ground: 262, alpha: 0.5 });
      if (lightning > 0) fb.overlay(0xdfe8ff, lightning * 0.25);
      letterbox(fb, bars);
      vignette(fb, 0.5);
      return;
    }
    if (t < 9.0) {
      // ---- close-up: the puddle memory ----
      const lt = t - 4;
      fb.gradV(0, 0, 480, 270, [0x0b1022, 0x121a30, 0x1a2236]);
      fogGlass(fb, 40, 30, 150, 110, t, true);
      streetlamp(fb, 430, 200, { h: 190 });
      bench(fb, 150, 166, 200);
      const drop = 2.5; // drop hits the puddle
      // reflection: memory of the bright Gemini with lantern "3", then the grey present
      refl.clear(0x1a2440);
      const memory = lt < drop + 0.15;
      if (memory) {
        refl.gradV(0, 0, 300, 90, [0x3a4a90, 0x1c2a60]);
        for (let i = 0; i < 12; i++) refl.set(hash(i * 3) * 300, hash(i * 7) * 50, 0xffffff);
        lantern(refl, 190, 20, { kind: 'gem', size: 18, lit: 1, t, label: '3' });
        gemini(refl, 150, 60, { size: 46, eyes: 'happy', mouth: 'grin', blush: true, armL: 0.5, armR: 0.5 });
      } else gemini(refl, 150, 56, { size: 46, sat: 0.3, droop: 0.7, eyes: 'sad', mouth: 'frown' });
      const px = 90, py = 204, pw = 300, ph = 58;
      for (let y = 0; y < ph; y++)
        for (let x = 0; x < pw; x++) {
          const dx = (x - pw / 2) / (pw / 2), dy = (y - ph / 2) / (ph / 2);
          if (dx * dx + dy * dy > 1) continue;
          const rip = lt > drop ? Math.sin(Math.hypot(dx * 4, dy * 2) * 12 - (lt - drop) * 16) * 3 * Math.exp(-(lt - drop) * 1.2) : 0;
          const sx = Math.round(x + rip + Math.sin(y * 0.8 + t * 3) * 0.6), sy = 89 - Math.round(y * 1.5);
          let c = refl.get(Math.max(0, Math.min(299, sx)), Math.max(0, Math.min(89, sy)));
          if (c < 0) c = 0x1a2440;
          fb.set(px + x, py + y, mix(c, 0x0a1224, 0.15));
        }
      // ripple rings
      if (lt > drop) for (let r = 0; r < 3; r++) { const rr = (lt - drop) * 50 - r * 14; if (rr > 0 && rr < 140) fb.ellipse(px + pw / 2, py + ph / 2, rr, rr * 0.2, 0xbfd0f0, 0.45 * (1 - rr / 140)); }
      // Gemini on the bench, looking down
      const tear = lt > 3.0 ? (lt - 3.0) : 0;
      gemini(fb, 250, 128 + float(t, 0.8, 1.4), { size: 84, sat: 0.3, droop: 0.65, eyes: 'sad', mouth: 'frown', lookY: 1, tear: tear > 0 ? tear : 0 });
      if (tear > 0) { const ty = 150 + ((tear * 50) % 70); fb.rect(236, ty, 2, 3, 0x9fd8ff); }
      const L = new LightMap().reset(0.55, 0.58, 0.78);
      L.light(430, 20, 340, 0xffd9a0, 0.9);
      L.light(240, 230, 200, 0x9fb4ff, 0.35);
      L.apply(fb, 8);
      rain(fb, t, { n: 200, speed: 320, angle: 0.18, len: 7, ground: 270, alpha: 0.45 });
      letterbox(fb, bars);
      vignette(fb, 0.55);
      return;
    }
    // ---- medium: the last firefly leaves; a shadow on the rooftops ----
    const lt = t - 9;
    fb.gradV(0, 0, 480, 170, [0x070a18, 0x151c36, 0x2a3458]);
    for (let i = 0; i < 5; i++) cloud(fb, ((i * 120 + t * 8) % 620) - 70, 24 + (i % 2) * 18, 140, 0x1e2440, 0x151a30, i + 9, 0.95);
    // far lanterns glow through the clouds (where the firefly goes)
    fb.glow(390, 40, 50, 0xfff0c8, 0.3); fb.glow(350, 30, 40, 0xffa36b, 0.25);
    // rooftops and Clawd's house on the hill
    fb.poly([300, 140, 360, 112, 420, 140], 0x7a3a24); fb.rect(308, 140, 104, 30, 0x2a2430); fb.rect(350, 148, 12, 10, 0x8a6a3a);
    for (let x = -30; x < 480; x += 60) { fb.poly([x, 160, x + 30, 140, x + 60, 160], 0x0d1120); fb.line(x, 160, x + 30, 140, 0x2a3048); fb.line(x + 30, 140, x + 60, 160, 0x2a3048); }
    fb.rect(0, 160, 480, 110, 0x1e2230);
    // Qwen sneaking along the rooftops with a sack of cardboard decoys
    const qk = seg(t, 11.2, 14.0);
    if (qk > 0 && qk < 1) {
      const qx = lerp(-20, 300, qk), rel = ((qx + 30) % 60 + 60) % 60, qy = 160 - (rel < 30 ? rel : 60 - rel) * (20 / 30) + 1;
      qwen(fb, qx, qy, { u: 1, spy: true, solid: 0x05060c, tiptoe: true, walk: t * 2.4 });
      fb.rect(qx - 16, qy - 26, 8, 20, 0x05060c); fb.rect(qx - 18, qy - 28, 12, 3, 0x05060c);
    }
    streetlamp(fb, 330, 232, { h: 110 });
    bench(fb, 170, 232, 90);
    const followQ = seg(t, 11.6, 12.2);
    gemini(fb, 214, 212 + float(t, 0.6, 1.3) + Math.sin(t * 40) * 0.6 * (lt < 2.5 ? 1 : 0), {
      size: 46, sat: 0.3, droop: 0.8, eyes: followQ > 0 ? (t > 12.4 ? 'wide' : 'normal') : 'sad', mouth: followQ > 0 ? 'open' : 'frown',
      look: followQ > 0 ? lerp(-1, 1, seg(t, 11.8, 13.6)) : 0, lookY: followQ > 0 ? -1 : lt < 1.5 ? 0 : -1, armL: -0.5, armR: -0.5,
    });
    // the last firefly
    const fk = E.inOutSine(seg(t, 10.2, 12.2));
    const hes = lt < 1.2 ? Math.sin(lt * 5) * 6 : 0;
    const fx = lerp(240 + hes, 390, fk), fy = lerp(190 + Math.sin(t * 3) * 3, 40, fk);
    drawFlies(fb, [[fx, fy, 0.8]], 0xd9ff7a, 1 - 0.7 * fk);
    const L = new LightMap().reset(0.5, 0.54, 0.74);
    L.cone(339, 124, 120, 0.45, 0xffd9a0, 1.6);
    L.light(339, 126, 30, 0xfff0c8, 1.0);
    L.light(fx, fy, 16, 0xd9ff7a, 0.6 * (1 - fk));
    L.apply(fb, 8);
    fb.glow(339, 126, 14, 0xfff1c0, 0.7);
    rain(fb, t, { n: 220, speed: 300, angle: 0.18, len: 6, ground: 262, alpha: 0.45 });
    letterbox(fb, bars);
    vignette(fb, 0.5);
  },
};
