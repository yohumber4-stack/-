// May 19 at sunset: Gemini's keynote. The tarp flies off a giant saggy lantern
// "3.5 PRO"; Gemini promises it for June (calendar in the speech bubble).
// Reverse shot: the audience — Clawd and Codex exchange a look, Qwen takes notes.
import { hillWorld, SEA_Y } from '../world/hill.js';
import { stageWorld } from '../world/stageio.js';
import { r3d, actor, billboard, worldLights, rgbf } from '../world/stage.js';
import { skyDome, seaPass } from '../engine/sky.js';
import { E, seg, clamp, lerp, hash, step, key, mix } from '../engine/core.js';
import { vignette, confetti } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { bubble, calPage, emote, label } from '../sprites/props.js';
import { bigLantern, caption } from '../props.js';
import { hop, bounce, float, blink } from '../kit.js';

const DUSK = [0xffc890, 0xf09a7a, 0xb86a8a, 0x5a4a8a, 0x2b2a5c];

export default {
  dur: 10,
  in: { type: 'black', dur: 0.6 },
  render(fb, t) {
    const Wd = hillWorld(), S = stageWorld();
    const P = Wd.plaza;
    const A = t < 6.2;
    if (A) {
      const push = E.inOutSine(seg(t, 0, 6.2));
      r3d.camera([P[0] + 0.5, P[1] + 3.4, P[2] - 9.5 + push * 1.5], [P[0] + 0.5, P[1] + 3.6, P[2] + 6], 52);
    } else {
      r3d.camera([P[0], P[1] + 2.6, P[2] + 1], [P[0], P[1] + 1.8, P[2] - 12], 55);
    }
    r3d.clear();
    const dome = skyDome(fb, r3d, t, { stops: DUSK, stars: 30, starAlpha: 0.4, span: 0.6 });
    seaPass(fb, r3d, t, SEA_Y + 0.5, { moonX: -999, far: 0xd08a8a, deep: 0x3a3060, glint: 0xffd0a0 });
    r3d.ambient = [0.5, 0.42, 0.48];
    r3d.sun = { dir: [0.5, 0.35, -0.6], color: [0.75, 0.48, 0.32] };
    const lit = seg(t, 1.9, 2.1);
    r3d.points = worldLights(Wd.lights.map((L) => ({ ...L, r: 10 })), 1.2);
    for (const sp of S.spots) r3d.points.push({ p: sp, c: rgbf(0xfff0d0, 1.4), r: 18 });
    if (lit > 0) r3d.points.push({ p: [P[0], P[1] + 6, P[2] + 7], c: rgbf(0xbcd0ff, 1.2 * lit), r: 16 });
    r3d.drawMesh(fb, Wd.mesh);
    r3d.drawMesh(fb, S.mesh);
    r3d.drawMesh(fb, S.bulbs);
    r3d.fog(fb, 0xe0a090, 60, 220, 0.6);

    // marquee "I/O" made of bulbs, pinned to the backdrop
    billboard(fb, S.panel, (L, x, y) => marquee(L, x, y, t), { bias: 0.1 });
    if (A) {
      // giant lantern under a tarp, revealed at 1.9s
      const reveal = E.outCubic(seg(t, 1.9, 2.6));
      billboard(fb, S.lanternAt, (L, x, y) => {
        if (reveal > 0) bigLantern(L, x, y, { inflate: 0.72, w: 60, h: 78, t, label: '3.5 PRO', lit: 0.15 + 0.1 * Math.sin(t * 3) });
        if (reveal < 1) {
          const fly = E.inQuad(seg(t, 1.9, 2.7));
          const tx = x + fly * 140, ty = y - 44 - fly * 120, rot = fly * 1.4;
          const q = [[-34, -44], [34, -42], [38, 42], [-36, 42]].map(([u, v]) => [tx + u * Math.cos(rot) - v * Math.sin(rot) * 0.5, ty + u * Math.sin(rot) * 0.5 + v * Math.cos(rot) * (1 - fly * 0.4)]);
          L.poly(q.flat(), 0x5a6a8a);
          for (let i = 0; i < 4; i++) L.line(q[0][0] + i * 16, q[0][1] + 4, q[3][0] + i * 16, q[3][1] - 4, 0x4a5878);
          if (fly === 0) label(L, x, y - 100, '?', 0xe0b040);
        }
      }, { bias: 0.2 });
      // Gemini hops in from the side and presents
      const inK = E.outCubic(seg(t, 0.2, 1.2));
      const gx = lerp(P[0] - 9, P[0] + 2.5, inK);
      const gy = S.front[1] + 0.6 + float(t, 0.15, 3) + hop(t, 0.2, 0.5, 1.2) + hop(t, 0.7, 0.5, 0.8) + (t > 3.3 && t < 5.8 ? bounce(t, 0.45, 0.35) : 0);
      const presenting = t > 1.6;
      const gs = actor(fb, [gx, gy, S.front[2]], 'gemini', {
        eyes: t > 2.6 ? 'happy' : blink(t, 2) ? 'blink' : 'open', mouth: t > 2.4 ? 'open' : 'smile', blush: t > 2.6 ? 'big' : true,
        handL: presenting ? -14 : 0, handR: t > 3.2 ? -12 : 0, lookX: t > 1.6 && t < 2.6 ? 1 : 0,
      }, { scale: 1, groundY: S.front[1], lift: 0.5 });
      // speech bubble with the promise
      if (gs && t > 3.3) {
        const k = E.outBack(seg(t, 3.3, 3.65));
        const b = bubble(fb, gs.x - 60, gs.y - 132, 96, 58, gs.x - 8, gs.y - 66, { k });
        if (b && k > 0.95) {
          calPage(fb, b.x + 10, b.y + 12, 48, 38, 'ИЮНЬ', { day: 1, dayScale: 2 });
          text(fb, '!!', b.x + 66, b.y + 18, 0xea4335, { scale: 3 });
        }
      }
      // audience silhouettes (seen from behind) in the foreground
      const cheer = t > 2.4;
      const sil = 0x160f26;
      const row = [['deepseek', -5.5, {}], ['clawd', -2.2, { armL: cheer && Math.sin(t * 12) > 0 ? -12 : 0, armR: cheer && Math.sin(t * 12 + 1) > 0 ? -12 : 0 }], ['qwen', 0.9, { spy: true }], ['codex', 3.8, { armL: cheer ? 'up' : undefined, armR: cheer ? 'up' : undefined, face: '' }], ['kimi', 6.8, {}]];
      for (const [n, dx, so] of row) {
        const j = cheer && n !== 'qwen' ? bounce(t + dx, 0.5, 0.3, 2.4) : 0;
        actor(fb, [P[0] + dx * 0.8, P[1] + j, P[2] - 0.5], n, so, { scale: 1, tint: sil, tintK: 1, lit: false, shadow: false, dy: 14 });
      }
      if (t > 3.4) confetti(fb, t, 3.4, { n: 80 });
      for (let i = 0; i < 24; i++) {
        const h1 = hash(i * 3 + 1), h2 = hash(i * 3 + 2);
        r3d.spark(fb, P[0] + (h1 - 0.5) * 22 + Math.sin(t + i) * 0.8, P[1] + 3 + h2 * 6 + Math.sin(t * 1.3 + i) * 0.5, P[2] - 4 + h2 * 6, 0xd9ff7a, 0.6, 3);
      }
      r3d.outline(fb, 0.6);
      r3d.bloom(fb, 0.75, 3);
      vignette(fb, 0.35);
      caption(fb, t, 0.4, 2.8, '19 МАЯ · I/O');
    } else {
      const lt = t - 6.2;
      // the audience, from the stage
      const tilt = (n) => ({ clawd: lt > 1.0 ? 1 : 0 }[n] || 0);
      const glance = lt > 0.9 && lt < 2.6;
      actor(fb, [P[0] - 5.6, P[1], P[2] - 7], 'kimi', { eyes: blink(t, 5) ? 'blink' : 'shifty', mouth: 'smirk' }, { scale: 1, lift: 0.55 });
      actor(fb, [P[0] + 5.0, P[1], P[2] - 7], 'deepseek', { eyes: 'shifty', mouth: 'smirk' }, { scale: 1, lift: 0.55, dy: Math.round(float(t, 1, 2)) });
      const cs = actor(fb, [P[0] + 0.9, P[1], P[2] - 5], 'clawd', { eyes: glance ? 'open' : blink(t, 1) ? 'blink' : 'open', lookX: glance ? -1 : 0, lookY: glance ? 0 : -1, mouth: glance ? 'flat' : 'smile' }, { scale: 1, lift: 0.55 });
      const xs = actor(fb, [P[0] - 2.3, P[1], P[2] - 5], 'codex', { face: step(lt, [[0, 'prompt'], [0.9, 'wow'], [1.8, 'bored']]), cursor: Math.floor(t * 3) % 2 === 0 }, { scale: 1, lift: 0.55, dy: -Math.round(float(t, 1, 2)) });
      if (cs && lt > 1.2) emote(fb, 'q', cs.x, cs.y - 52 - (lt > 1.2 && lt < 1.4 ? 3 : 0), { scale: 2 });
      if (xs && lt > 1.5) emote(fb, 'q', xs.x, xs.y - 66, { scale: 2 });
      // Qwen in the foreground corner, scribbling notes
      // Qwen in the foreground (2x), scribbling notes with a sly smile
      const qs = actor(fb, [P[0] + 2.1, P[1], P[2] - 2.4], 'qwen', { spy: true, eyes: 'shifty', glance: -1, mouth: lt > 1.2 ? 'smirk' : 'smile' }, { scale: 2, lift: 0.5, shadow: false, dy: -10 });
      if (qs) {
        const nx = qs.x - 86, ny = qs.y - 82;
        fb.rect(nx - 2, ny - 2, 52, 38, 0x1a1a2a); fb.rect(nx, ny, 48, 34, 0xf6f1e4); fb.rect(nx, ny, 48, 6, 0xc84a3a);
        for (let i = 0; i < 5; i++) fb.rect(nx + 5, ny + 11 + i * 4, Math.min(36, Math.floor((lt * 22 + i * 9) % 37)), 2, 0x6a6a7a);
        const px2 = nx + 40 + Math.round(Math.sin(lt * 20) * 3);
        fb.rect(px2, ny + 6, 4, 22, 0xe0b040); fb.rect(px2, ny + 28, 4, 4, 0x333333); fb.rect(px2, ny + 4, 4, 3, 0xff8fa0);
        text(fb, 'ИЮНЬ?', nx + 24, ny - 1, 0xffffff, { font: 'small', align: 'center', outline: 0x1a1a2a });
      }
      r3d.outline(fb, 0.6);
      r3d.bloom(fb, 0.7, 3);
      vignette(fb, 0.4);
    }
  },
};

// bulb marquee "I/O" in Google colours (2D, readable)
function marquee(fb, cx, cy, t) {
  const G = { I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'], O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'] };
  const cols = [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853];
  const sc = 6, glyphs = ['I', '/', 'O'];
  const total = glyphs.reduce((a, g) => a + G[g][0].length + 1, -1);
  let x = Math.round(cx - (total * sc) / 2), k = 0;
  glyphs.forEach((ch, ci) => {
    const g = G[ch];
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < g[0].length; gx++) if (g[gy][gx] === '#') {
      const px = x + gx * sc, py = Math.round(cy - 20 + gy * sc), on = Math.sin(t * 6 - k * 0.6) > -0.4, col = cols[(ci + gy) % 4];
      fb.circle(px, py, 2.2, on ? mix(col, 0xffffff, 0.45) : mix(col, 0x000000, 0.35));
      if (on) fb.glow(px, py, 6, col, 0.3, 3);
      k++;
    }
    x += (g[0].length + 1) * sc;
  });
}
