// The ambush. Qwen sneaks back to the garden with a bigger distiller for the
// "sleeping" Clawd in the hammock — but it is an inflatable decoy. Eyes light up
// in the bushes: Codex hits Enter and a cage of curly braces drops, Gemini's
// spotlight blazes, the distiller backfires. Qwen, covered in orange goo, flees.
import { yardWorld } from '../world/yard.js';
import { r3d, actor, billboard, worldLights, rgbf } from '../world/stage.js';
import { skyDome } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, mix, step } from '../engine/core.js';
import { vignette, smoke, speedLines, LightMap } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { emote, bubble } from '../sprites/props.js';
import { char } from '../sprites/chars.js';
import { distillery } from '../sprites/heist.js';
import { hop, float, blink, bounce } from '../kit.js';

const NIGHT = [0x3a4280, 0x242c62, 0x141a44, 0x0a0e2a];
const HAM = [18, 1, 27];

export default {
  dur: 13,
  in: { type: 'black', dur: 0.6 },
  out: { type: 'black', dur: 0.5 },
  render(fb, t) {
    const Wd = yardWorld();
    r3d.camera([20.5 - E.inOutSine(seg(t, 0, 13)) * 1.0, 5.4, 12.2], [19.5, 2.6, 27], 56);
    r3d.clear();
    const spot = seg(t, 7.3, 7.6) * (1 - 0.45 * seg(t, 10.5, 13));
    skyDome(fb, r3d, t, { stops: NIGHT, stars: 220, moon: [0.4, 0.75, 8], span: 0.6 });
    r3d.ambient = [0.34 + spot * 0.7, 0.36 + spot * 0.7, 0.54 + spot * 0.6];
    r3d.sun = { dir: [-0.3, 0.8, -0.5], color: [0.25, 0.3, 0.5] };
    r3d.points = worldLights(Wd.lights, 1.2);
    if (spot > 0) r3d.points.push({ p: [26, 7, 22], c: rgbf(0xffffff, 2.2 * spot), r: 26 });
    r3d.drawMesh(fb, Wd.mesh);
    r3d.drawMesh(fb, Wd.darkMesh);
    r3d.drawMesh(fb, Wd.lampOff);
    r3d.fog(fb, 0x141a3a, 40, 120, 0.5);
    // hammock between the posts
    const a = r3d.project(12.5, 5, 27), b = r3d.project(24.5, 5, 27);
    if (a && b) for (let i = 0; i <= 40; i++) { const k = i / 40, x = lerp(a[0], b[0], k), y = lerp(a[1], b[1], k) + Math.sin(k * Math.PI) * 18; fb.rect(x, y, 2, 3, 0xd9c7a0); fb.rect(x, y + 3, 2, 1, 0x9a8a6a); }
    // inflatable "Clawd" asleep in the hammock (deflates under suction)
    const deflate = seg(t, 4.2, 5.2);
    if (deflate < 1) actor(fb, [HAM[0], 3.2, HAM[2] - 0.3], 'clawd', { acc: 'nightcap', eyes: 'closed', sq: Math.round(deflate * 6), blush: true }, { scale: 1, shadow: false, lift: 0.5 });
    else billboard(fb, [HAM[0], 3.4, HAM[2] - 0.3], (L, x, y) => { L.rect(x - 26, y - 5, 52, 5, 0xc8704c); L.rect(x - 10, y - 8, 20, 3, 0x4b6cc9); }, { bias: 0.1 });
    const hp = r3d.project(HAM[0], 5.6, HAM[2]);
    if (hp && t < 4.2) for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; text(fb, 'Z', hp[0] + 20 + k * 12, hp[1] - 20 - k * 16, 0xffffff, { font: 'small' }); }
    if (hp && t > 4.3 && t < 5.4) text(fb, 'ПФФФ!', hp[0], hp[1] - 44, 0xffffff, { scale: 2, align: 'center', outline: 0x1a1a2a });
    // Qwen with a bigger distiller on a cart
    const arrive = E.inOutSine(seg(t, 0.2, 3.0));
    const cartX = lerp(-4, 9.5, arrive);
    const broken = seg(t, 8.6, 8.8);
    billboard(fb, [cartX, 1, 25], (L, x, y) => distillery(L, x, y, t, { levels: [clamp((t - 4) / 1.2), 0, 0], broken, liquid: 0xffa060 }), { bias: 0.2 });
    let qp = [lerp(-8, 13, E.inOutSine(seg(t, 0.4, 3.2))), 1, 24.2], qo = { spy: true, eyes: 'shifty', glance: t % 1.2 < 0.6 ? -1 : 1, mouth: 'smirk', handL: -4, handR: -4 }, qd = { scale: 1 };
    if (t > 3.2 && t < 5.4) qo = { spy: true, eyes: 'shifty', mouth: 'smirk', rub: 1, t };
    if (t >= 5.4 && t < 7.3) qo = { spy: true, eyes: 'wide', mouth: 'o', handL: 0, handR: 0 };
    if (t >= 7.3 && t < 10.8) { qo = { spy: true, glasses: t < 9.2, eyes: 'shock', mouth: 'scream', handL: -14, handR: -14, goo: broken > 0 ? seg(t, 8.6, 9.2) : 0 }; qp = [13 + Math.sin(t * 50) * 0.08, 1 + hop(t, 9.4, 0.5, 1.6), 24.2]; }
    if (t >= 10.8) { const k = seg(t, 10.8, 12.8); qp = [lerp(13, -8, E.inQuad(k)), 1 + Math.abs(Math.sin(t * 14)) * 0.4, 24.2]; qo = { spy: true, hat: false, glasses: false, eyes: 'shock', mouth: 'scream', goo: 1, handL: Math.sin(t * 20) > 0 ? -14 : 0, handR: Math.sin(t * 20) > 0 ? 0 : -14 }; }
    const qs = actor(fb, qp, 'qwen', qo, qd);
    if (qs && t > 5.6 && t < 7.2) emote(fb, 'q', qs.x + 8, qs.y - 66, { scale: 2 });
    if (qs && t > 9.4 && t < 10.6) text(fb, 'А-А-А!', qs.x, qs.y - 80, 0xffe08a, { scale: 2, align: 'center', outline: 0x1a1a2a });
    if (qs && t >= 10.8) speedLines(fb, t, qs.y - 50, qs.y, 0xffffff, 0.3, 10, 1);
    // hose to a suction funnel on the hammock
    if (t > 2.6 && broken < 1 && hp) {
      const cp = r3d.project(cartX + 1, 2.5, 25), fk = seg(t, 3.0, 3.8);
      if (cp) { const fx = lerp(cp[0], hp[0], fk), fy = lerp(cp[1], hp[1] + 10, fk); for (let k = 0; k <= 20; k++) { const q = k / 20; fb.rect(lerp(cp[0], fx, q), lerp(cp[1], fy, q) - Math.sin(q * Math.PI) * 18, 2, 2, 0x5a5a6a); } fb.poly([fx - 8, fy + 6, fx + 8, fy + 6, fx + 3, fy - 2, fx - 3, fy - 2], 0x9aa0b0); }
    }
    // backfire: orange goo bursts over Qwen
    if (broken > 0 && qs) { const g = seg(t, 8.6, 9.2); for (let i = 0; i < 26; i++) { const an = hash(i) * Math.PI, r = g * (20 + hash(i * 3) * 44); fb.circle(qs.x - 30 + Math.cos(an) * r * 1.6, qs.y - 20 - Math.sin(an) * r + g * g * 20, 2, i % 3 ? 0xff9a4a : 0xd96a1e); } text(fb, 'БУМ!', qs.x - 40, qs.y - 60, 0xff9a4a, { scale: 2, outline: 0x1a1a2a }); }
    // the cage of curly braces
    const cage = E.outBounce(seg(t, 7.1, 7.6)) * (1 - E.inQuad(seg(t, 10.5, 10.9)));
    if (cage > 0 && qs) {
      const cy = lerp(-90, qs.y - 86, cage);
      text(fb, '{', qs.x - 40, cy, 0x9cffd0, { scale: 5, outline: 0x0d3a2a });
      text(fb, '}', qs.x + 16, cy, 0x9cffd0, { scale: 5, outline: 0x0d3a2a });
      for (let i = 0; i < 4; i++) fb.rect(qs.x - 16 + i * 10, cy + 4, 2, 64, 0x9cffd0, 0.7);
      fb.rect(qs.x - 40, cy + 2, 80, 2, 0x9cffd0, 0.7); fb.rect(qs.x - 40, cy + 66, 80, 2, 0x9cffd0, 0.7);
      fb.glow(qs.x, cy + 36, 60, 0x9cffd0, 0.25);
    }
    // the friends in the bushes: glowing eyes, then they burst out
    const out = seg(t, 7.1, 7.5);
    const bp = r3d.project(27.5, 2.2, 21);
    if (bp && out < 1 && t > 5.6) {
      const k = seg(t, 5.6, 6.2);
      fb.rect(bp[0] - 50, bp[1] - 6, 3, 5, mix(0x1e4a2e, 0xffa36b, k)); fb.rect(bp[0] - 42, bp[1] - 6, 3, 5, mix(0x1e4a2e, 0xffa36b, k));
      fb.rect(bp[0] - 10, bp[1] - 10, 22, 12, mix(0x1e4a2e, 0x121838, k)); text(fb, '>:)', bp[0] + 1, bp[1] - 7, mix(0x1e4a2e, 0x9fd8ff, k), { font: 'small', align: 'center' });
      fb.glow(bp[0] + 36, bp[1] - 4, 10, 0xdfe8ff, 0.6 * k);
      for (let i = 0; i < 4; i++) fb.set(bp[0] + 36 + [0, 3, 0, -3][i], bp[1] - 4 + [-3, 0, 3, 0][i], [0xea4335, 0x4285f4, 0x34a853, 0xfbbc04][i]);
    }
    if (out > 0) {
      const laugh = t > 11.0;
      const cs = actor(fb, [lerp(25, 22.6, E.outCubic(out)), 1 + hop(t, 7.1, 0.4, 1.4) + (laugh ? bounce(t, 0.35, 0.3) : 0), 19.6], 'clawd', { eyes: laugh ? 'happy' : 'determined', mouth: laugh ? 'laugh' : 'flat', armL: laugh ? -10 : -6, armR: t > 12.0 ? -14 : laugh ? -10 : -6, lookX: 1 }, { scale: 1 });
      const xs = actor(fb, [lerp(26, 24.8, E.outCubic(out)), 1 + (laugh ? bounce(t + 0.1, 0.35, 0.3) : 0), 19.0], 'codex', { face: t < 7.3 ? 'enter' : laugh ? 'laugh' : 'braces', armL: 'type', armR: 'type' }, { scale: 1 });
      const gs = actor(fb, [lerp(26.5, 19.8, E.outCubic(out)), 3.0 + float(t, 0.15, 2.4) + (laugh ? bounce(t + 0.2, 0.35, 0.3) : 0), 20.2], 'gemini', { eyes: laugh ? 'happy' : 'determined', mouth: laugh ? 'laugh' : 'flat', bright: spot * 0.4, handL: t > 12.0 ? -14 : -6, handR: -6, blush: laugh ? 'big' : true }, { scale: 1, groundY: 1, glow: spot * 0.2 });
      if (gs && spot > 0) { for (let i = 0; i < 12; i++) { const an = Math.PI * 0.6 + (i / 11) * 0.8; fb.line(gs.x, gs.y - 28, gs.x + Math.cos(an) * -300, gs.y - 28 + Math.sin(an) * 300, 0xfff8e0, 0.08 * spot); } }
      if (gs && cs && t > 12.1 && t < 12.8) text(fb, 'ХЛОП!', (gs.x + cs.x) / 2, gs.y - 74, 0xffe08a, { scale: 2, align: 'center', outline: 0x1a1a2a });
    }
    r3d.outline(fb, 0.6);
    r3d.bloom(fb, 0.7, 3);
    if (spot > 0 && t < 7.9) fb.overlay(0xffffff, (1 - seg(t, 7.3, 7.9)) * 0.45);
    vignette(fb, 0.45);
  },
};
