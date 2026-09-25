// Gemini's workshop, June -> September. June: the giant "3.5 PRO" lantern won't
// inflate. July: a Flash rocket out of the window — bright for a second. August:
// the tag "COMING SOON". September: through the window everyone's flagships rise
// next to an empty star-shaped slot. Gemini grabs the last rocket and heads out.
import { FB } from '../engine/fb.js';
import { workshopWorld, WS } from '../world/workshop.js';
import { r3d, actor, billboard, lanternW, worldLights, rgbf } from '../world/stage.js';
import { skyDome } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, mix, key, step } from '../engine/core.js';
import { vignette, stars, smoke, speedLines } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { rocket, exhaust, emote, lanternP, calPage, label } from '../sprites/props.js';
import { bigLantern, flashPop, woodSign } from '../props.js';
import { char } from '../sprites/chars.js';
import { starShape } from '../sprites/star.js';
import { monthCard, pump, tag } from './common.js';
import { hop, float, blink } from '../kit.js';

const NIGHT = [0x2c3470, 0x1b2458, 0x0d1236, 0x070a22];

export default {
  dur: 18,
  in: { type: 'black', dur: 0.6 },
  render(fb, t) {
    if (t >= 12.8 && t < 15.6) return pov(fb, t);
    const Wd = workshopWorld();
    const push = E.inOutSine(seg(t, 0, 18));
    r3d.camera([14 + Math.sin(t * 0.2) * 0.6, 8.2 - push * 0.8, -11 + push * 1.5], [14, 4.6, 10], 52);
    r3d.clear();
    skyDome(fb, r3d, t, { stops: NIGHT, stars: 200, span: 0.5 });
    const sept = t > 15.6;
    // lanterns rising outside the window (seen through it)
    const outside = [[1.0, 6, 'claude', 'FABLE 5'], [5.2, 22, 'openai', 'GPT-5.6'], [9.2, 10, 'kimi', 'K3']];
    for (const [t0, x, kind, lab] of outside) {
      const k = E.outCubic(seg(t, t0, t0 + 3));
      if (k > 0) lanternW(fb, [x, lerp(-4, 16, k), 44], { kind, w: 14, label: lab, smallLabel: true, t });
    }
    if (sept) for (const [x, y, kind] of [[16, 15, 'astra'], [8, 13, 'claude'], [22, 12, 'sol']]) lanternW(fb, [x, y, 44], { kind, w: 16, t });
    // lighting: bulb + stove + moon through the window + flashes
    const flashA = clamp(1 - Math.abs(t - 7.25) / 0.35), flashB = clamp(1 - Math.abs(t - 11.05) / 0.3) * 0.7;
    const fl = Math.max(flashA, flashB);
    r3d.ambient = [0.36 + fl * 0.8, 0.33 + fl * 0.8, 0.36 + fl * 0.7];
    r3d.sun = { dir: [0.1, 0.5, -0.85], color: [0.22, 0.26, 0.45] };
    r3d.points = [];
    for (const L of Wd.lights) {
      const f = L.fire ? 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.1) : 1;
      r3d.points.push({ p: L.p, c: rgbf(L.c, (L.bulb ? 1.5 : 1.3) * f), r: L.r });
    }
    if (fl > 0) r3d.points.push({ p: [14, 10, 24], c: rgbf(0xfff4d0, 2.2 * fl), r: 40 });
    r3d.drawMesh(fb, Wd.mesh);
    r3d.drawMesh(fb, Wd.fireMesh, {}, { emit: 0.85 + 0.15 * Math.sin(t * 12) });

    // wall calendar (left wall) with crossed months
    const month = step(t, [[0, 'ИЮНЬ'], [4.0, 'ИЮЛЬ'], [8.0, 'АВГУСТ'], [12.0, 'СЕНТЯБРЬ']]);
    billboard(fb, [24, 9.2, 17.2], (L, x, y) => calPage(L, x - 18, y - 14, 36, 30, month), { bias: 0.2 });
    // Flash rockets on the shelves (fewer each month)
    const left = t < 5.6 ? 3 : t < 10.2 ? 2 : t < 16.9 ? 1 : 0;
    for (let i = 0; i < left; i++) billboard(fb, [26.4, 4.4, 10 + i * 2.2], (L, x, y) => rocket(L, x, y - 10), { bias: 0.1 });

    // ---- the giant lantern on its stand ----
    const inflate = key(t, [[0, 0.4], [0.9, 0.4], [2.9, 0.88, E.outQuad], [3.1, 0.88], [3.6, 0.36, E.outBounce], [9, 0.35], [12, 0.32], [18, 0.22]]);
    const burst = t > 3.0 && t < 3.6;
    const top = billboard(fb, [14, 2, 10], (L, x, y) => {
      const r = bigLantern(L, x, y, { inflate, w: 76, h: 104, t, label: '3.5 PRO', patches: t > 3.6 });
      if (t > 9.6) tag(L, x - 34, Math.max(r.top + 20, y - 76), ['COMING', 'SOON'], { string: 10, swing: Math.sin(t * 2) * 0.6 });
    }, { bias: 0.3 });
    if (burst && top) {
      text(fb, 'ПФФФ!', top.x + 44, top.y - 96 - (t - 3) * 20, 0xffffff, { scale: 2, outline: 0x1a1a2a });
      smoke(fb, t, 3.0, top.x + 30, top.y - 70, { n: 7, color: 0xc0c0cc, size: 6, rise: 22 });
      const k = seg(t, 3.0, 3.6); fb.rect(top.x + 30 + k * 60, top.y - 80 - k * 40 + k * k * 90, 8, 6, 0xe8dcc0);
    }

    // ---- pump (June) ----
    const pumping = t > 0.9 && t < 2.9;
    const stroke = pumping ? (Math.sin((t - 0.9) * Math.PI * 2 * 2.5) + 1) / 2 : 0;
    billboard(fb, [8.5, 1, 7], (L, x, y) => pump(L, x, y, stroke), { bias: 0.2 });

    // ---- Gemini ----
    let gp = [8.5, 1.9, 6.5], go = { eyes: 'determined', mouth: 'flat' }, flip = false, holdRocket = false, gd = {};
    if (t < 0.9) { gp = [lerp(4, 8.5, E.inOutSine(seg(t, 0, 0.9))), 1.3 + float(t, 0.2, 3), 6.5]; }
    else if (t < 2.9) { gp = [8.5, 1.3 + 0.9 - stroke * 0.9, 6.5]; go.handL = go.handR = stroke > 0.5 ? 4 : -10; go.sy = 1 - stroke * 0.08; go.sx = 1 + stroke * 0.05; }
    else if (t < 4.0) { gp = [8.5, 1.3 + hop(t, 3.0, 0.4, 1.2), 6.5]; go.eyes = t < 3.4 ? 'wide' : 'dizzy'; go.mouth = t < 3.4 ? 'o' : 'wobble'; }
    else if (t < 5.0) { gp = [8.5, 1.3 + float(t, 0.15, 3), 6.5]; go.eyes = 'sad'; go.mouth = 'frown'; go.grey = 0.15; }
    else if (t < 7.6) {
      // grab a rocket from the shelf, fly to the window, launch
      const k1 = E.inOutSine(seg(t, 5.0, 5.6)), k2 = E.inOutSine(seg(t, 5.8, 6.6));
      gp = [lerp(lerp(8.5, 24, k1), 16, k2), lerp(lerp(1.3, 5.2, k1), 3.4, k2), lerp(lerp(6.5, 11, k1), 15.5, k2)];
      holdRocket = t > 5.6 && t < 6.9;
      go.eyes = t > 7.0 ? 'happy' : 'determined'; go.mouth = t > 7.0 ? 'open' : 'flat';
      go.handR = holdRocket ? -12 : 0; go.lookY = t > 6.6 ? -1 : 0;
    } else if (t < 9.6) {
      gp = [lerp(16, 12, E.inOutSine(seg(t, 7.8, 8.6))), lerp(3.4, 1.6, E.inOutSine(seg(t, 7.8, 8.6))) + float(t, 0.15, 3), lerp(15.5, 7, E.inOutSine(seg(t, 7.8, 8.6)))];
      go.eyes = t < 8.0 ? 'wide' : 'sad'; go.mouth = t < 8.0 ? 'o' : 'frown'; go.grey = 0.2;
    } else if (t < 12.0) {
      // hangs the tag, crosses months on the calendar, fires another quick flash
      const k = E.inOutSine(seg(t, 9.6, 10.1)), k2 = E.inOutSine(seg(t, 10.2, 10.7));
      gp = [lerp(12, 16, k2), lerp(1.6, 3.4, k2) + float(t, 0.15, 3), lerp(7, 15.5, k2)];
      go.eyes = t < 10.7 ? 'determined' : 'open'; go.mouth = 'flat'; go.grey = 0.2; go.handL = t < 10.1 ? -12 : 0;
      holdRocket = t > 10.2 && t < 10.75;
    } else {
      // September: small and grey at the window, then determination
      gp = [lerp(16, 22, E.inOutSine(seg(t, 15.6, 16.4))), lerp(3.4, 2.2, E.inOutSine(seg(t, 15.6, 16.4))) + float(t, 0.12, 2.5), lerp(15.5, 8, E.inOutSine(seg(t, 15.6, 16.4)))];
      const dec = t > 16.6;
      go.eyes = dec ? 'determined' : 'sad'; go.mouth = dec ? 'flat' : 'frown'; go.grey = dec ? 0.2 : 0.5; go.lookY = dec ? 0 : -1;
      holdRocket = t > 16.9;
      go.handR = holdRocket ? -8 : 0;
      if (t > 17.2) gp[0] = lerp(22, 32, E.inQuad(seg(t, 17.2, 18)));
    }
    const gs = actor(fb, gp, 'gemini', { ...go, eyes: go.eyes === 'open' && blink(t, 4) ? 'blink' : go.eyes }, { scale: 1, groundY: gp[1] > 3 ? undefined : 1, lift: 0.5, shadow: 30 });
    if (gs && holdRocket) rocket(fb, gs.x - 22, gs.y - 44);
    if (gs && t > 3.3 && t < 4.4) emote(fb, 'sweat', gs.x + 22, gs.y - 50, { scale: 1 });
    if (gs && t > 17.2) speedLines(fb, t, gs.y - 50, gs.y, 0xffffff, 0.3, 8, 1);

    // rockets leaving through the window and popping in the sky
    const launch = (t0, pop, lab, seed, size) => {
      const k = seg(t, t0, t0 + 0.6);
      const a = r3d.project(16, 6, 17), b = r3d.project(15, 13, 40);
      if (!a || !b) return;
      if (k > 0 && k < 1) { const x = lerp(a[0], b[0], E.inQuad(k)), y = lerp(a[1], b[1], E.inQuad(k)); rocket(fb, x, y); exhaust(fb, t, x, y + 10, 14); }
      flashPop(fb, t, t0 + 0.6, b[0], b[1], { size, label: lab, seed });
      // fireflies rush to the flash, then drift away
      for (let i = 0; i < 14; i++) {
        const h1 = hash(i * 5 + seed), h2 = hash(i * 7 + seed);
        const go2 = seg(t, t0 + 0.6, t0 + 1.1) * (1 - seg(t, t0 + 1.4 + h1 * 0.5, t0 + 2.6));
        if (go2 <= 0) continue;
        const fx = lerp(b[0] + (h1 - 0.5) * 300, b[0] + Math.cos(i) * 20, go2), fy = lerp(b[1] + 60 + h2 * 40, b[1] + Math.sin(i * 2) * 12, go2);
        fb.glow(fx, fy, 4, 0xd9ff7a, 0.5 * go2, 3); fb.add(fx, fy, 0xffffe0, go2);
      }
    };
    launch(6.65, true, '3.6 FLASH', 1, 44);
    launch(10.45, true, '3.7 FLASH', 2, 36);
    r3d.outline(fb, 0.6);
    r3d.bloom(fb, 0.75, 3);
    // hanging bulb glare
    const bb = r3d.project(14.5, 11.8, 8.5); if (bb) fb.glow(bb[0], bb[1], 22, 0xffe0a0, 0.35);
    if (fl > 0.5) fb.overlay(0xffffff, (fl - 0.5) * 0.5);
    vignette(fb, 0.4);
    monthCard(fb, t, 0.0, 'ИЮНЬ', { dur: 0.9 });
    monthCard(fb, t, 4.05, 'ИЮЛЬ', { dur: 0.9 });
    monthCard(fb, t, 8.1, 'АВГУСТ', { dur: 0.9 });
    monthCard(fb, t, 11.95, 'СЕНТЯБРЬ', { dur: 0.9 });
  },
};

// September, through the window: the flagships rise; Gemini's slot stays empty
function pov(fb, t) {
  fb.gradV(0, 0, 480, 270, [0x0a0f30, 0x18215a, 0x2c3674]);
  stars(fb, t, 45, 180, 0, 0, 480, 210);
  starShape(fb, 118, 56, 70, (ang, r, px, py) => (r > 0.84 || (px * 3 + py) % 7 === 0 ? 0x9aa6d8 : null));
  fb.line(118, 84, 104, 96, 0x8a7a60); fb.line(118, 84, 132, 96, 0x8a7a60);
  woodSign(fb, 118, 104, 'COMING SOON', { font: 'big' });
  text(fb, '3.5 PRO', 118, 52, 0x7a86b8, { align: 'center' });
  const rise = (t0, x, top, kind, lab, w) => {
    if (t < t0) return;
    const k = E.outCubic(seg(t, t0, t0 + 1.6));
    lanternP(fb, x + Math.sin(t * 0.8 + x) * 2, lerp(320, top, k), { kind, w, label: lab, t });
  };
  rise(12.9, 322, 70, 'astra', 'GPT-6 ASTRA', 44);
  rise(13.3, 420, 122, 'claude', 'OPUS 5.5', 38);
  rise(13.8, 240, 46, 'sol', 'GPT-6 SOL', 30);
  rise(14.2, 58, 186, 'luna', 'GPT-6 LUNA', 26);
  // rooftops, Clawd's orange roof and a suspicious bush with binoculars
  fb.rect(0, 222, 480, 48, 0x121633);
  fb.poly([300, 230, 380, 196, 460, 230], 0xc0643c); fb.rect(312, 230, 136, 40, 0xd8c8a8); fb.rect(370, 238, 18, 16, 0xffd27a);
  fb.circle(90, 236, 20, 0x2a5a36); fb.circle(64, 240, 15, 0x24502f); fb.circle(116, 242, 14, 0x24502f);
  const pk = E.outBack(seg(t, 13.6, 14.0));
  if (pk > 0) {
    char(fb, 'qwen', 92, 262 - pk * 20, { spy: true }, { scale: 0.5 });
    fb.rect(98, 232 - pk * 20 + 20, 14, 6, 0x111118);
    if (Math.sin(t * 6) > 0.5) fb.set(111, 233 - pk * 20 + 20, 0xffffff);
    fb.circle(86, 248, 14, 0x2a5a36);
  }
  // window frame and Gemini's silhouette
  fb.rect(0, 0, 480, 12, 0x2a1a10); fb.rect(0, 258, 480, 12, 0x2a1a10); fb.rect(0, 0, 12, 270, 0x2a1a10); fb.rect(468, 0, 12, 270, 0x2a1a10);
  fb.rect(236, 0, 8, 270, 0x2a1a10); fb.rect(0, 131, 480, 8, 0x2a1a10);
  char(fb, 'gemini', 410, 300, { handL: 'hide', handR: 'hide', eyes: 'sad' }, { scale: 2, tint: 0x0a0a18, tintK: 0.9 });
  vignette(fb, 0.45);
}
