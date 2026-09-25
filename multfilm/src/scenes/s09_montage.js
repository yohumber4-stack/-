// Montage: friends rebuild the lantern. Codex debugs the frame, Clawd stitches,
// Gemini learns to glow; evenings of cards while "PRETRAINING GEMINI 4" fills up.
// Finally Gemini itself takes off the "COMING SOON" tag and burns it.
import { FB } from '../engine/fb.js';
import { E, seg, clamp, lerp, hash, mix, step } from '../engine/core.js';
import { vignette, LightMap, smoke, stars } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { paperTag, calendarPage, claudeSpark } from '../props.js';
import { gemini, starShape, gemColorAt } from '../chars/gemini.js';
import { clawd } from '../chars/clawd.js';
import { codex } from '../chars/codex.js';
import { float, bounce, hop, eyesB } from '../kit.js';

const panel = new FB(156, 270);
const half = new FB(238, 270);

function wall(f, tone = 0) {
  f.gradV(0, 0, f.w, f.h, [mix(0x5a3a26, 0x3a2a40, tone), mix(0x6e4a30, 0x4a3450, tone)]);
  for (let x = 0; x < f.w; x += 24) f.rect(x, 0, 1, f.h, mix(0x4a2e1e, 0x2e2238, tone));
}

// the rebuilt, star-shaped lantern (unlit unless lit > 0)
export function starLantern(fb, x, y, size, lit = 0, t = 0, o = {}) {
  starShape(fb, x, y, size, (a, r, px, py) => {
    const c = gemColorAt(a, r, px, py);
    let col = mix(mix(c, 0x3a3a50, 0.55), mix(c, 0xffffff, 0.35 * (1 - r)), lit);
    if (o.wire && r > 0.3 && (Math.abs(px - x) < 1 || Math.abs(py - y) < 1)) col = 0x3a2a20;
    return col;
  });
  if (!o.noFrame) { fb.line(x - size * 0.45, y, x + size * 0.45, y, mix(0x5a4636, 0xffffff, lit * 0.4)); fb.line(x, y - size * 0.45, x, y + size * 0.45, mix(0x5a4636, 0xffffff, lit * 0.4)); }
  if (lit > 0) fb.glow(x, y, size * 1.2, 0xdfe8ff, 0.5 * lit, 6);
}

export default {
  dur: 10,
  in: { type: 'black', dur: 0.4 },
  render(fb, t) {
    fb.clear(0x0c0a10);
    if (t < 3.4) {
      // ---- triptych ----
      const slide = (i) => (1 - E.outCubic(seg(t, 0.05 + i * 0.12, 0.5 + i * 0.12))) * (i % 2 ? -280 : 280);
      // 1: Codex debugs the frame
      wall(panel, 0.6);
      const fix = seg(t, 1.6, 2.2);
      panel.rect(20, 40, 116, 90, 0x10162a); panel.rect(20, 40, 116, 2, 0x2a3a6a);
      starShape(panel, 78, 86, 70, (a, r, px, py) => (r > 0.88 || (px + py) % 6 === 0 ? 0x6ad0ff : null));
      const bugC = mix(0xff4a4a, 0x4aff8a, fix);
      panel.circle(98, 70, 4, bugC); panel.glow(98, 70, 10, bugC, 0.6);
      text(panel, fix >= 1 ? 'FIXED' : 'BUG', 78, 120, bugC, { font: 'small', align: 'center' });
      codex(panel, 78, 236 + float(t, 1, 3), { u: 2, t, face: fix >= 1 ? '^_^' : 'code', hands: { l: [4 + Math.sin(t * 24) * 2, 17], r: [22 - Math.sin(t * 24) * 2, 17] } });
      panel.rect(40, 236, 76, 5, 0x3a3a48); panel.rect(44, 222, 68, 14, 0x22222c);
      fb.blit(panel, 4, slide(0));
      // 2: Clawd stitches new fabric
      wall(panel, 0);
      for (let i = 0; i < 4; i++) panel.rect(18 + i * 30, 60, 30, 110, [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853][i]);
      panel.rect(18, 60, 120, 110, 0x000000, 0.15);
      const stitchN = Math.floor(t * 6);
      for (let k = 0; k < Math.min(12, stitchN); k++) panel.rect(30 + k * 8, 118, 5, 1, 0xffffff);
      const nx = 30 + Math.min(12, stitchN) * 8, ny = 118 + Math.sin(t * 12) * 6;
      panel.line(nx, ny - 8, nx, ny + 4, 0xdfe0e8); panel.line(nx, ny - 8, 150, 150, 0xffffff);
      clawd(panel, 78, 250, { u: 4, eyes: 'determined', lookY: -1, armR: 0.6 + Math.sin(t * 12) * 0.2, armL: 0.2 });
      fb.blit(panel, 162, slide(1));
      // 3: Gemini learns to glow again
      wall(panel, 0.3);
      const glow = t < 1.8 ? (Math.sin(t * 22) > 0.2 ? 0.5 : 0.1) : 0.4 + 0.6 * seg(t, 1.8, 2.6);
      panel.glow(78, 140, 70, 0xdfe8ff, 0.5 * glow, 6);
      gemini(panel, 78, 140 + float(t, 1.5, 2), { size: 70, eyes: t < 2.6 ? 'closed' : 'happy', mouth: t < 2.6 ? 'flat' : 'grin', sat: 0.5 + 0.4 * glow, bright: 0.2 * glow });
      if (t > 2.6) for (let i = 0; i < 8; i++) { const a = i * 0.785 + t * 2; panel.set(78 + Math.cos(a) * 46, 140 + Math.sin(a) * 46, 0xffffff); }
      fb.blit(panel, 320, slide(2));
    } else if (t < 6.6) {
      // ---- evenings of cards | pretraining progress ----
      const lt = t - 3.4;
      wall(half, 0.1);
      half.rect(20, 190, 200, 8, 0x8a5a3a); half.rect(28, 198, 6, 60, 0x6a4028); half.rect(206, 198, 6, 60, 0x6a4028);
      for (let i = 0; i < 5; i++) { const cx = 70 + i * 22 + Math.sin(i) * 4; half.rect(cx, 184, 12, 7, 0xf8f4ea); half.rect(cx + 2, 186, 3, 3, i % 2 ? 0xea4335 : 0x2a2a3a); }
      const laugh = Math.sin(lt * 5) > 0.3;
      clawd(half, 50, 190, { u: 3, eyes: laugh ? 'happy' : 'normal', mouth: laugh ? 'open' : undefined, armR: 0.4 });
      gemini(half, 120, 158 + (laugh ? bounce(lt, 0.3, 3) : 0), { size: 46, eyes: laugh ? 'happy' : 'normal', mouth: 'grin', sat: 0.85, blush: true });
      codex(half, 190, 190 + float(lt, 1, 3), { u: 1.5, t, face: laugh ? '^_^' : '>_', flip: true });
      const pg = lt / 3.2;
      for (let k = 0; k < 3; k++) calendarPage(half, 180, 20, (lt * 1.2 + k / 3) % 1, { w: 30, h: 26, dir: -1 });
      const L = new LightMap(half.w, half.h).reset(0.7, 0.6, 0.55);
      L.light(120, 120, 180, 0xffd9a0, 0.6);
      L.apply(half, 10);
      fb.blit(half, 0, 0);
      half.clear(0x0c1020);
      half.rect(14, 60, 210, 150, 0x151a2e); half.rect(14, 60, 210, 12, 0x252c48);
      for (let i = 0; i < 3; i++) half.circle(24 + i * 8, 66, 2, [0xff5f56, 0xffbd2e, 0x27c93f][i]);
      text(half, '> PRETRAINING', 26, 88, 0x9cffd0, { font: 'small' });
      text(half, 'GEMINI 4', 119, 104, 0xffffff, { scale: 2, align: 'center' });
      const p = clamp(0.08 + pg * 0.9);
      half.rect(30, 140, 178, 14, 0x2a3350);
      for (let x = 0; x < Math.round(176 * p); x++) half.rect(31 + x, 141, 1, 12, [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853][Math.floor(x / 44) % 4]);
      text(half, Math.round(p * 100) + '%', 119, 164, 0xffffff, { align: 'center' });
      for (let i = 0; i < 3; i++) text(half, '> STEP ' + (Math.floor(p * 90000) - i * 1117), 26, 184 + i * 8, 0x5a7a8a, { font: 'small' });
      fb.blit(half, 242, 0);
    } else {
      // ---- the tag goes into the fire ----
      const lt = t - 6.6;
      wall(fb, 0);
      fb.rect(0, 222, 480, 48, 0x4e3322);
      // stove
      fb.rect(60, 150, 70, 72, 0x2a2a30); fb.rect(56, 146, 78, 6, 0x3a3a44); fb.rect(88, 60, 14, 86, 0x2a2a30);
      const flare = seg(lt, 1.9, 2.1) * (1 - seg(lt, 2.8, 3.4));
      fb.rect(74, 176, 42, 30, 0x120a08);
      for (let i = 0; i < 10; i++) {
        const h = 10 + Math.sin(t * 10 + i) * 4 + flare * 30;
        const col = flare > 0.05 ? [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853][i % 4] : i % 2 ? 0xff8a3a : 0xffc44a;
        fb.rect(76 + i * 4, 206 - h, 4, h, col);
      }
      if (flare > 0) fb.glow(95, 190, 80 * flare + 20, 0xffffff, 0.5 * flare, 6);
      // the rebuilt lantern with the old tag
      starLantern(fb, 300, 120, 120, 0, t, { wire: false });
      fb.rect(294, 176, 12, 46, 0x5a4636); fb.rect(280, 218, 40, 4, 0x3a3a44);
      const tagOff = seg(lt, 0.4, 0.8);
      const crumple = seg(lt, 1.0, 1.4);
      const toss = seg(lt, 1.5, 1.95);
      const gx = lerp(360, 250, E.inOutSine(seg(lt, 0.0, 0.5))) + toss * -40, gy = 150 + float(t, 1.5, 2.4);
      gemini(fb, gx, gy, { size: 56, t, sat: 0.9, eyes: lt < 1.4 ? 'normal' : lt < 2.2 ? 'determined' : 'happy', mouth: lt < 2.2 ? 'flat' : 'grin', armL: toss > 0 && toss < 1 ? 1 : 0.2, look: lt > 1.4 && lt < 2.3 ? -1 : 0, blush: lt > 2.3 });
      if (tagOff < 1) paperTag(fb, lerp(318, gx - 24, tagOff), lerp(96, gy - 20, tagOff), ['3.5 PRO', 'COMING SOON'], { string: tagOff > 0 ? 0 : 8 });
      else if (toss < 1) {
        const bx = lerp(gx - 26, 95, toss), by = lerp(gy - 16, 186, toss) - Math.sin(toss * Math.PI) * 40;
        const r = lerp(8, 5, crumple);
        fb.circle(bx, by, r, 0xfff8e1); fb.set(bx - 1, by, 0xc8c0a8); fb.set(bx + 2, by - 1, 0xc8c0a8);
      }
      if (lt > 2.1) smoke(fb, t, 8.7, 95, 146, { n: 5, color: 0x9098a8 });
      clawd(fb, 404, 222, { u: 3, eyes: lt > 2.3 ? 'happy' : 'normal', armL: lt > 2.3 ? 1 : 0, armR: lt > 2.3 ? 1 : 0, look: -1, mouth: lt > 2.3 ? 'open' : undefined });
      codex(fb, 446, 214 + float(t, 1, 2.3), { u: 1.5, t, face: lt > 2.3 ? '^_^' : '>_', flip: true, hands: lt > 2.3 ? { l: [-3, 6], r: [29, 6] } : undefined });
      const L = new LightMap().reset(0.58, 0.48, 0.44);
      L.light(95, 190, 200, flare > 0.05 ? 0xdfe8ff : 0xffa04a, 0.8 + flare * 0.9);
      L.light(240, 20, 240, 0xffd9a0, 0.6);
      L.apply(fb, 10);
    }
    vignette(fb, 0.4);
  },
};
