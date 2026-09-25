// The hill at dusk: Clawd and Codex release their flagships. Gemini's Flash
// rocket overtakes them for one bright second and pops. DeepSeek and Kimi's
// lanterns rise higher; they laugh, drench Gemini's last rocket and pin a
// "COMING SOON" note on its back. Gemini walks away as the clouds roll in.
import { E, seg, clamp, lerp, hash, mix, ramp, step } from '../engine/core.js';
import { vignette, stars, smoke, rain, drawFlies } from '../engine/fx.js';
import { text } from '../engine/font.js';
import { SKY, hills, cloud, sea, grassTufts } from '../bg.js';
import { lantern, rocket, rocketTrail, flashPop, paperTag } from '../props.js';
import { gemini } from '../chars/gemini.js';
import { clawd } from '../chars/clawd.js';
import { codex } from '../chars/codex.js';
import { whale, moon, spout } from '../chars/extras.js';
import { hop, bounce, float, eyesB } from '../kit.js';

const GROUND = 206;

// close-up: the Flash rocket streaks up, Gemini lights up with hope... and it's gone
function closeHope(fb, t) {
  const night = seg(t, 5, 13);
  fb.gradV(0, 0, 480, 270, [mix(0x2b2a5c, 0x0c1030, night), 0x6a3f7a, 0xc9607a, 0xf0a070]);
  stars(fb, t, 52, 60, 0, 0, 480, 150, { alpha: 0.5 });
  const rk = seg(t, 4.6, 5.15);
  if (rk > 0 && rk < 1) { const ry = lerp(300, -10, E.inQuad(rk)); rocket(fb, 300, ry, { size: 16 }); rocketTrail(fb, t, 300, ry + 9, 30); }
  const f = clamp(1 - Math.abs(t - 5.3) / 0.25);
  const lit = t < 5.45;
  gemini(fb, 240, 200 + float(t, 2, 3), {
    size: 110, t, lookY: -1, look: 0.5, eyes: lit ? 'happy' : 'wide', mouth: lit ? 'grin' : t < 5.7 ? 'open' : 'frown',
    blush: lit, armL: lit ? 0.45 : 0.1, armR: lit ? 0.45 : 0.1, bright: f * 0.5, sat: t > 5.6 ? 0.85 : 1,
  });
  if (f > 0) { fb.glow(300, 0, 200, 0xfff4d0, 0.9 * f, 6); fb.overlay(0xffffff, f * 0.35); }
  vignette(fb, 0.45);
}

// close-up: drenched, and the note slapped on
function closeWet(fb, t) {
  fb.gradV(0, 0, 480, 270, [0x0c1030, 0x1c2250, 0x2a2c5a]);
  stars(fb, t, 53, 50, 0, 0, 480, 120, { alpha: 0.6 });
  const shakeX = t > 11.35 && t < 11.5 ? Math.round(Math.sin(t * 90) * 3) : 0;
  const gx = 240 + shakeX, gy = 176 + float(t, 1, 2);
  gemini(fb, gx, gy, { size: 110, t, eyes: 'closed', mouth: 'wobble', droop: 0.5, sat: 0.7, armL: -0.3, armR: -0.3 });
  for (let i = 0; i < 26; i++) {
    const d = (t * (1.5 + hash(i) * 1.2) + hash(i * 3)) % 1;
    const x = gx - 60 + hash(i * 7) * 120, y = gy - 70 + d * 150;
    fb.rect(x, y, 1, 3, 0xbfe6ff);
  }
  smoke(fb, t, 10.9, 300, 250, { n: 8, color: 0x9098a8, size: 7, rise: 20 });
  if (t > 11.35) {
    const k = E.outBack(seg(t, 11.35, 11.5));
    paperTag(fb, gx + 34, gy - 6 - (1 - k) * 30, ['COMING', 'SOON'], { font: 'big', swing: Math.sin(t * 5) * 0.6 });
    const a = seg(t, 11.5, 11.7);
    text(fb, 'ХА-ХА-ХА', 110 + Math.sin(t * 20) * 2, 40, mix(0x0c1030, 0xffffff, a), { scale: 2, outline: 0x1a1a2a });
    text(fb, 'ХА-ХА', 330 + Math.sin(t * 22) * 2, 70, mix(0x0c1030, 0xffe08a, a), { scale: 2, outline: 0x1a1a2a });
  }
  vignette(fb, 0.45);
}
const slopeY = (x) => (x < 360 ? GROUND : GROUND + (x - 360) * 0.45);

export default {
  dur: 16,
  in: { type: 'black', dur: 0.5 },
  render(fb, t) {
    if (t > 4.6 && t < 6.0) return closeHope(fb, t);
    if (t > 10.9 && t < 12.2) return closeWet(fb, t);
    const cam = Math.round(E.inOutSine(seg(t, 12.0, 16)) * 70);
    const night = seg(t, 5, 13);
    // sky: dusk fading to a cloudy night
    const top = mix(0x2b2a5c, 0x0c1030, night), mid = mix(0xc9607a, 0x2a2c5a, night), low = mix(0xffd08a, 0x4a4a7a, night);
    fb.gradV(0, 0, 480, 170, [top, mix(top, mid, 0.5), mid, low]);
    stars(fb, t, 51, 120, 0, 0, 480, 120, { alpha: night });
    sea(fb, 150, 172, t, { top: mix(0x6a5a8a, 0x2a3a6a, night), bottom: mix(0x3a3060, 0x121a3a, night), glint: mix(0xffc8a0, 0x6f86c8, night) });
    fb.ox = -cam * 0.3;
    hills(fb, 164, 8, 0.02, mix(0x5a4270, 0x1e2244, night), 12, 0);
    fb.ox = -cam;
    // the hill
    for (let x = -10; x < 560; x++) {
      const y = Math.round(slopeY(x) + Math.sin(x * 0.05) * 1.5);
      fb.rect(x, y, 1, 270 - y + 10, mix(0x4f7a45, 0x243a2c, night));
      fb.set(x, y, mix(0x7aa05a, 0x3a5a3a, night));
    }
    grassTufts(fb, GROUND + 2, t, mix(0x6a9a50, 0x2e4a34, night), 3, 0.25, cam);
    for (const px of [120, 220, 320]) { fb.rect(px - 1, GROUND - 10, 3, 12, 0x6d4a32); fb.rect(px - 5, GROUND - 12, 11, 2, 0x8a5a3a); }

    // ---- lanterns in the sky ----
    const riseTo = (t0, dur, x0, y0, x1, y1) => { const k = E.outCubic(seg(t, t0, t0 + dur)); return [lerp(x0, x1, k) + Math.sin(t * 0.9 + x0) * 2 * k, lerp(y0, y1, k)]; };
    const opus = riseTo(0.8, 6.5, 120, GROUND - 38, 150, 36);
    const astra = riseTo(1.6, 6.5, 220, GROUND - 42, 250, 28);
    lantern(fb, opus[0], opus[1], { kind: 'claude', size: 26, label: 'OPUS 5.5', t, lit: 1 });
    lantern(fb, astra[0], astra[1], { kind: 'astra', size: 30, label: 'GPT-6 ASTRA', t, lit: 1 });
    // DeepSeek and Kimi release theirs from the right
    const wX = lerp(560, 396, E.outCubic(seg(t, 6.0, 7.2))), mX = lerp(600, 446, E.outCubic(seg(t, 6.3, 7.5)));
    const v4 = riseTo(7.4, 4.5, wX - 10, GROUND - 60, 350, 74);
    const k3 = riseTo(7.8, 4.5, mX - 10, GROUND - 60, 420, 62);
    if (t > 7.4) lantern(fb, v4[0], v4[1], { kind: 'whale', size: 24, label: 'V4', t, lit: 1 });
    if (t > 7.8) lantern(fb, k3[0], k3[1], { kind: 'kimi', size: 22, label: 'K3', t, lit: 1 });

    // ---- Gemini's flash rocket ----
    const rk = seg(t, 4.2, 5.2);
    let flashY = 100;
    if (t > 3.4 && t < 4.2) rocket(fb, 334, GROUND - 14, { size: 12 });
    if (rk > 0 && rk < 1) {
      const ry = lerp(GROUND - 14, 22, E.inQuad(rk));
      rocket(fb, 334, ry, { size: 12 }); rocketTrail(fb, t, 334, ry + 7, 22);
      flashY = ry;
    }
    flashPop(fb, t, 5.2, 334, 22, { size: 54, label: 'FLASH', seed: 3 });
    // second, drenched rocket
    if (t > 9.6 && t < 12.2) rocket(fb, 336, GROUND - 14 + (t > 10.9 ? 3 : 0), { size: 12 });
    if (t > 10.9) smoke(fb, t, 10.9, 336, GROUND - 22, { n: 7, color: 0x9098a8 });

    // fireflies: drift to the big lanterns, rush to the flash, then leave it
    const flies = [];
    for (let i = 0; i < 22; i++) {
      const h1 = hash(i * 5 + 1), h2 = hash(i * 5 + 2);
      const home = i % 2 ? opus : astra;
      const orbit = [home[0] + Math.cos(t * (1 + h1) + i) * 18 * (0.5 + h2), home[1] + Math.sin(t * (1.3 + h2) + i) * 12];
      const toFlash = seg(t, 4.5 + h1 * 0.3, 5.1) * (1 - seg(t, 5.4 + h2 * 0.4, 6.4 + h2 * 0.6));
      const fx = [334 + Math.cos(i) * 20, 28 + Math.sin(i * 2) * 14];
      flies.push([lerp(orbit[0], fx[0], E.inOutSine(toFlash)), lerp(orbit[1], fx[1], E.inOutSine(toFlash)), 0.6 + 0.4 * Math.sin(t * 3 + i)]);
    }
    drawFlies(fb, flies, 0xd9ff7a, 0.8);

    // ---- characters ----
    clawd(fb, 120, GROUND, { u: 3, lookY: t > 1 ? -1 : 0, eyes: t > 1.2 ? 'happy' : eyesB(t, 'normal', 1), armL: t > 0.4 && t < 1.2 ? 1.1 : t > 1.2 && t < 2.4 ? 0.8 : 0, armR: t > 0.4 && t < 1.2 ? 1.1 : t > 1.2 && t < 2.4 ? 0.8 : 0, blush: t > 1.2 });
    if (t < 0.8) lantern(fb, 120, GROUND - 48, { kind: 'claude', size: 26, t, lit: seg(t, 0.1, 0.5) });
    codex(fb, 220, GROUND - 1 + float(t, 1, 2), { u: 1.5, t, face: t > 1.8 ? '^_^' : '>_', flip: true, hands: t < 1.7 ? { l: [4, 2], r: [22, 2] } : undefined });
    if (t < 1.6) lantern(fb, 220, GROUND - 58, { kind: 'astra', size: 30, t, lit: seg(t, 0.8, 1.3) });

    // Gemini
    let gx = 320, gy = GROUND - 26 + float(t, 1.2, 3), go = { size: 42, t, eyes: 'determined', mouth: 'flat' };
    if (t < 3.4) { go.eyes = eyesB(t, 'normal', 5); go.mouth = 'smile'; go.lookY = -1; go.look = -1; }
    else if (t < 4.2) { go.eyes = 'determined'; go.armR = 0.2 + Math.sin(t * 30) * 0.3; }
    else if (t < 5.25) { go.eyes = 'happy'; go.mouth = 'grin'; go.lookY = -1; go.armL = 0.8; go.armR = 0.8; gy += hop(t, 4.4, 0.6, 12); }
    else if (t < 9.6) { go.eyes = t < 6.2 ? 'wide' : 'sad'; go.mouth = t < 6.2 ? 'open' : 'frown'; go.lookY = t < 7 ? -1 : 0; go.look = t > 8 ? 1 : 0; go.droop = 0.25 * seg(t, 5.4, 6.5); }
    else if (t < 12.2) {
      go.eyes = t < 10.9 ? 'determined' : 'closed'; go.mouth = t < 10.9 ? 'flat' : 'wobble'; go.droop = t < 10.9 ? 0.2 : 0.5;
      go.sat = 1 - 0.3 * seg(t, 10.9, 12);
      if (t > 10.9) go.armL = go.armR = -0.4;
    } else {
      const k = E.inOutSine(seg(t, 12.2, 16));
      gx = lerp(320, 520, k); gy = slopeY(gx) - 24 + float(t, 1.2, 2.2);
      go.eyes = 'sad'; go.mouth = 'frown'; go.droop = 0.7; go.sat = lerp(0.7, 0.35, k); go.lookY = 1;
    }
    gemini(fb, gx, gy, go);
    if (t > 10.9 && t < 12.6) for (let i = 0; i < 6; i++) { const d = (t * 3 + hash(i)) % 1; fb.set(gx - 16 + hash(i * 3) * 32, gy - 10 + d * 30, 0xbfe6ff); }
    if (t > 11.4) paperTag(fb, gx + 10, gy - 4, ['COMING', 'SOON'], { swing: Math.sin(t * 4) * 0.8 });

    // bullies
    if (t > 6.0) {
      const laugh = t > 8.6;
      const wy = GROUND - 8 + float(t, 2, 2.4) + (laugh ? bounce(t, 0.35, 3) : 0);
      whale(fb, wX, wy, { u: 2, t, eyes: laugh ? 'laugh' : 'smug', mouth: laugh ? 'laugh' : 'smile' });
      if (t > 10.1 && t < 11.2) spout(fb, t, wX - 22, wy - 38, { dir: -0.9, h: 26, n: 40, rate: 2.4, spread: 0.4 });
      const mxx = t > 11.0 && t < 11.8 ? lerp(mX, gx + 20, E.inOutSine(seg(t, 11.0, 11.4)) * (1 - seg(t, 11.4, 11.8))) : mX;
      moon(fb, mxx, GROUND - 2 + float(t, 2, 2.1, 1) + (laugh ? bounce(t + 0.15, 0.35, 3) : 0), { u: 2, t, eyes: laugh ? 'laugh' : 'smug', mouth: laugh ? 'laugh' : 'smirk', arms: laugh ? 'laugh' : undefined });
      if (laugh && t < 15.4) {
        const a = 1 - seg(t, 14.2, 15.4);
        text(fb, 'ХА', wX - 30, 120 + bounce(t, 0.35, 5), mix(0x1a1a2a, 0xffffff, a), { scale: 2, outline: 0x1a1a2a });
        text(fb, 'ХА', mX - 10, 108 + bounce(t + 0.17, 0.35, 5), mix(0x1a1a2a, 0xffffff, a), { scale: 2, outline: 0x1a1a2a });
        if (t > 11.6) text(fb, 'ХА-ХА', wX - 20, 96 + bounce(t + 0.1, 0.3, 4), mix(0x1a1a2a, 0xffe08a, a), { outline: 0x1a1a2a });
      }
    }

    // storm clouds roll in; first drops
    fb.ox = 0;
    const cl = seg(t, 11.5, 16);
    if (cl > 0) for (let i = 0; i < 6; i++) cloud(fb, lerp(-120, 60 + i * 80, E.outSine(cl)) + i * 10, 20 + (i % 3) * 14, 110, 0x2a2f48, 0x1c2036, i + 3, 0.9);
    if (t > 14.6) rain(fb, t, { n: Math.round(60 * seg(t, 14.6, 16)), alpha: 0.4 });
    vignette(fb, 0.4);
  },
};
