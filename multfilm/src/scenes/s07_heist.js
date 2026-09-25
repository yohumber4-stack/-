// The night heist at Clawd's cottage. Qwen lines up cardboard copies at the ASK
// hatch; sleepy Clawd answers them all and every glowing answer flies into Qwen's
// distillery. Gemini, hiding behind a barrel, remembers the laughter... and rings
// the bell. Light floods the yard, the copies topple, Qwen flees.
import { yardWorld, YD } from '../world/yard.js';
import { r3d, actor, billboard, worldLights, rgbf } from '../world/stage.js';
import { skyDome } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, mix, step } from '../engine/core.js';
import { vignette, smoke, speedLines, burst } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { emote, bubble, thoughtBubble, label } from '../sprites/props.js';
import { char } from '../sprites/chars.js';
import { decoy, distillery, answerOrb, questionNote, bellSwing } from '../sprites/heist.js';
import { woodSign } from '../props.js';
import { hop, float, blink, bounce } from '../kit.js';

const NIGHT = [0x3a4280, 0x242c62, 0x141a44, 0x0a0e2a];
const QUEUE = [56.5, 59.5, 62.5, 65.5, 68.5, 71.5];
const DIST = [66, 1, 23];

export default {
  dur: 16,
  in: { type: 'black', dur: 0.6 },
  render(fb, t) {
    const Wd = yardWorld();
    const shot = t < 3.0 ? 'A' : t < 4.8 ? 'B' : t < 6.2 ? 'Q' : t < 9.3 ? 'C' : t < 11.2 ? 'D' : 'E';
    if (shot === 'A' || shot === 'E') r3d.camera([63, 6.0, 12.5], [58.5, 2.8, 29], 56);
    else if (shot === 'B') r3d.camera([55.5, 4.0, 22.5], [54, 3.5, 30], 55);
    else if (shot === 'Q') r3d.camera([63.5, 3.0, 17.0], [63.8, 2.4, 24], 54);
    else if (shot === 'C') r3d.camera([6, 3.6, 7.5], [14, 3.0, 22], 55);
    else r3d.camera([47.5, 4.8, 17.5], [47.5, 3.8, 30], 55);
    r3d.clear();
    const flare = seg(t, 10.0, 10.25) * (1 - 0.55 * seg(t, 12.5, 15)) * (shot === 'D' ? 0.3 : 1);
    skyDome(fb, r3d, t, { stops: NIGHT, stars: 220, moon: [2.6, 0.7, 7], span: 0.6 });
    r3d.ambient = [0.34 + flare * 0.9, 0.36 + flare * 0.9, 0.54 + flare * 0.7];
    r3d.sun = { dir: [-0.3, 0.8, -0.5], color: [0.25, 0.3, 0.5] };
    r3d.points = worldLights(Wd.lights, 1.3);
    const hatchOn = t < 10.0;
    r3d.points.push({ p: [52.5, 4, 28.5], c: rgbf(0xffc27a, hatchOn ? 0.9 : 0.6), r: 10 });
    r3d.points.push({ p: [DIST[0] - 1.5, 2, DIST[2]], c: rgbf(0xffa060, t < 12.4 ? 1.4 : 0.4), r: 9 });
    if (flare > 0) r3d.points.push({ p: [44, 5, 26], c: rgbf(0xf4f8ff, 2.8 * flare), r: 40 });
    r3d.drawMesh(fb, Wd.mesh);
    r3d.drawMesh(fb, Wd.litMesh);
    r3d.drawMesh(fb, t > 11 ? Wd.lampOn : Wd.lampOff);
    r3d.fog(fb, 0x141a3a, 40, 120, 0.5);

    // sign with the count of fake accounts
    billboard(fb, [74, 1, 25], (L, x, y) => woodSign(L, x, y - 22, '...×25 000', { font: 'small', post: 14, color: 0x8a6a4a, ink: 0xfff0d0 }), { bias: 0.2 });
    // distillery
    const levels = [0, 1, 2].map((i) => clamp((t - 1.8 - i * 1.3) / 1.6));
    const broken = seg(t, 12.3, 12.5);
    billboard(fb, DIST, (L, x, y) => distillery(L, x, y, t, { levels: t > 12.3 ? [0, 0, 0] : levels, broken }), { bias: 0.3 });
    if (broken > 0) { const p = r3d.project(DIST[0] - 1, 1.5, DIST[2]); if (p) smoke(fb, t, 12.35, p[0], p[1], { n: 7, color: 0x9d7bff, size: 7 }); }
    // the queue of cardboard copies (topple like dominoes when the light hits)
    const slide = E.outCubic(seg(t, 0.0, 1.6));
    QUEUE.forEach((qx, i) => {
      const fall = seg(t, 10.3 + i * 0.12, 10.65 + i * 0.12);
      billboard(fb, [qx + (1 - slide) * 18, 1, 26.5], (L, x, y) => decoy(L, x, y, i, fall), { bias: 0.4 });
    });
    // Clawd behind the hatch, sleepy (nightcap), writing answers
    if (hatchOn || t > 10) {
      const awake = t > 10.1;
      actor(fb, [52.6, 2.6, 30.7], 'clawd', { acc: 'nightcap', eyes: awake ? 'wide' : t % 2.6 < 0.2 ? 'blink' : 'closed', mouth: awake ? 'o' : 'smile', armL: !awake && Math.sin(t * 14) > 0 ? -4 : 0, armR: !awake && Math.sin(t * 14 + 1) > 0 ? -4 : 0, blush: !awake }, { scale: 1, shadow: false, bias: 0.05, lit: false });
    }
    // notes in, answers out along an arc to the funnel
    if (t > 1.4 && t < 10.0) {
      const period = Math.max(0.3, 0.8 - (t - 1.4) * 0.08);
      const n = Math.floor((t - 1.4) / period);
      for (let k = n - 3; k <= n; k++) {
        if (k < 0) continue;
        const lt = (t - 1.4 - k * period) / period;
        if (lt < 0 || lt > 2.5) continue;
        if (lt < 0.5) { const q = lt / 0.5; const p = r3d.project(lerp(QUEUE[0], 53, q), lerp(3, 4, q) + Math.sin(q * Math.PI), lerp(26.5, 29.5, q)); if (p) questionNote(fb, p[0], p[1]); }
        else {
          const q = Math.min(1, (lt - 0.5) / 1.8);
          const p = r3d.project(lerp(53, DIST[0] - 2, q), lerp(4, 5, q) + Math.sin(q * Math.PI) * 4, lerp(29.5, DIST[2], q));
          if (p && q < 1) answerOrb(fb, p[0], p[1]);
        }
      }
    }
    // Qwen
    let qp = [DIST[0] - 4, 1, DIST[2] - 1.0], qo = { spy: true, eyes: 'shifty', mouth: 'smirk', rub: 1, t }, qd = { scale: 1 };
    if (shot === 'Q') qd = { scale: 2, shadow: false, dy: 30 };
    if (t > 10.1 && t < 11.6) { qo = { spy: true, eyes: 'shock', mouth: 'scream', handL: -14, handR: -14 }; qp = [DIST[0] - 4, 1 + hop(t, 10.2, 0.4, 1.5), DIST[2] - 1.0]; }
    if (t >= 11.6) {
      const k = E.inQuad(seg(t, 11.6, 13.4));
      qp = [lerp(DIST[0] - 4, 49, k), 1 + Math.abs(Math.sin(t * 14)) * 0.4, lerp(DIST[2] - 1.0, 15.5, k)];
      qo = { spy: true, hat: false, eyes: 'shock', mouth: 'scream', handL: Math.sin(t * 20) > 0 ? -14 : 0, handR: Math.sin(t * 20) > 0 ? 0 : -14 };
    }
    if (t < 13.4) {
      const qs = actor(fb, qp, 'qwen', qo, qd);
      if (qs && shot === 'Q' && t > 5.0) emote(fb, 'note', qs.x - 70, qs.y - 150 - ((t * 20) % 8), { scale: 2 });
      if (qs && t >= 11.6) speedLines(fb, t, qs.y - 50, qs.y, 0xffffff, 0.3, 10, 1);
    }
    if (t > 11.7) { // the fedora flies off and lands
      const k = seg(t, 11.7, 12.3);
      billboard(fb, [DIST[0] - 4 - k * 2, 1 + (1 - E.outBounce(k)) * 3 + Math.sin(k * Math.PI) * 2, DIST[2] - 1.0], (L, x, y) => { L.rect(x - 9, y - 3, 18, 3, 0x2e2622); L.rect(x - 6, y - 9, 12, 6, 0x2e2622); L.rect(x - 6, y - 5, 12, 2, 0x8c2f39); });
    }
    // Gemini
    if (shot === 'C') {
      const lt = t - 6.2;
      billboard(fb, [10.5, 1, 14.2], (L, x, y) => barrel2d(L, x, y), { bias: 0.2, lit: true, lift: 0.45 });
      const peek = lt < 0.5 ? E.outCubic(lt / 0.5) : lt < 1.2 ? 1 : lt < 1.5 ? 0.5 : lt < 2.6 ? 0.5 : 1.2;
      const brave = lt > 2.6;
      const gs = actor(fb, [10.9 - peek * 1.7, 1.2 + float(t, 0.1, 2), 15.6], 'gemini', {
        eyes: lt < 1.2 ? 'wide' : lt < 2.6 ? (lt > 2.2 ? 'closed' : 'sad') : 'determined', mouth: lt < 1.2 ? 'o' : lt < 2.6 ? 'wobble' : 'flat', grey: brave ? 0.25 - 0.25 * seg(lt, 2.6, 3.0) : 0.5, bright: brave ? 0.25 : 0, lookX: -1,
      }, { scale: 1, groundY: 1, lift: 0.55, glow: brave ? 0.2 : 0 });
      if (gs && lt > 1.3 && lt < 2.5) {
        const tb = thoughtBubble(fb, gs.x + 30, gs.y - 130, 120, 70, gs.x + 16, gs.y - 56);
        char(fb, 'deepseek', tb.cx - 20, tb.cy + 18, { eyes: 'happy', mouth: 'laugh' }, { scale: 0.5 });
        char(fb, 'kimi', tb.cx + 22, tb.cy + 18, { eyes: 'happy', mouth: 'laugh' }, { scale: 0.5 });
        text(fb, 'ХА-ХА', tb.cx, tb.cy - 22, 0x2a2a3a, { align: 'center' });
      }
      if (gs && brave) { for (let i = 0; i < 6; i++) { const a = t * 3 + i * 1.05; fb.add(gs.x + Math.cos(a) * 36, gs.y - 28 + Math.sin(a) * 30, 0xffffff, 1); } emote(fb, 'spark', gs.x + 30, gs.y - 64, { scale: 2 }); }
    }
    if (shot === 'D' || shot === 'E') {
      const k = E.outCubic(seg(t, 9.3, 9.8));
      const gx = lerp(40, 44.2, k), gy = lerp(2.5, 4.3, k) + float(t, 0.1, 3);
      const ringing = t > 9.8 && t < 11.0;
      const gs = actor(fb, [gx, gy, 27.8], 'gemini', { eyes: ringing ? 'closed' : t > 11 ? 'determined' : 'determined', mouth: ringing ? 'open' : 'flat', handR: ringing ? (Math.sin(t * 30) > 0 ? -14 : -6) : 0, bright: flare * 0.3, grey: 0 }, { scale: 1, groundY: 1, lift: 0.6, glow: 0.2 * flare });
      if (k < 1 && gs) speedLines(fb, t, gs.y - 50, gs.y, 0xffffff, 0.4, 8, 1);
      const bp = r3d.project(44.4, 6.4, 28.6);
      if (bp) bellSwing(fb, bp[0], bp[1], ringing ? Math.sin((t - 9.8) * 22) * (1 - seg(t, 10.4, 11.0)) : 0);
      if (ringing && bp) {
        const a = Math.floor(t * 6) % 2;
        text(fb, 'ДИНЬ-ДОН!', bp[0], bp[1] - 40 - a * 2, a ? 0xffe08a : 0xffffff, { scale: 2, align: 'center', outline: 0x1a1a2a });
        if (t > 10.0) burst(fb, t, 10.0, bp[0], bp[1] + 20, { colors: [0xea4335, 0x4285f4, 0xfbbc04, 0x34a853], n: 40, speed: 140, gravity: 0, life: 0.9, flash: 60 });
      }
    }
    r3d.outline(fb, 0.6);
    r3d.bloom(fb, 0.55, 3);
    if (t > 10.0 && t < 10.35) fb.overlay(0xffffff, (1 - seg(t, 10.0, 10.35)) * 0.5);
    vignette(fb, 0.45);
  },
};

function barrel2d(fb, x, y) {
  const w = 48, h = 60, X = x - w / 2, Y = y - h;
  fb.rect(X - 1, Y - 1, w + 2, h + 2, 0x1a1210);
  for (let yy = 0; yy < h; yy++) {
    const bulge = Math.round(Math.sin((yy / h) * Math.PI) * 3);
    fb.rect(X - bulge, Y + yy, w + bulge * 2, 1, yy % 11 < 2 ? 0x3a3a44 : 0x8a5a36);
  }
  for (let k = 1; k < 6; k++) fb.rect(X + k * 8, Y + 2, 1, h - 4, 0x6a4028);
  fb.rect(X + 3, Y + 3, 3, h - 6, 0xa8744a);
  fb.ellipse(x, Y + 1, w / 2, 3, 0x5a3a26);
}
