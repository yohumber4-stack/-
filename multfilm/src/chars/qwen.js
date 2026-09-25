// Qwen — the chill capybara mascot in a white T-shirt with the purple logo.
// Front-facing and upright. Optional spy disguise (fedora, sunglasses, trench coat).
import { scratch, outlined } from '../engine/fb.js';

export const QW = {
  fur: 0xa8784e, furHi: 0xc3915f, furSh: 0x86603f, furDk: 0x654530, muzzle: 0xcfa87f, muzzleSh: 0xb58e67,
  nose: 0x3a2a1f, eye: 0x2a1d15, shirt: 0xf3f3f7, shirtSh: 0xcfd1dc, logo: 0x615ced, line: 0x3b2618,
  coat: 0xc9a76a, coatSh: 0xa58648, belt: 0x76603a, hat: 0x3f3530, hatBand: 0x8c2f39, glass: 0x111118,
};

// (x, y) = feet centre. Options: u, eyes ('line'|'shifty'|'wide'|'scared'|'smug'|'closed'), look (-1..1),
// spy, mustache, arms ('down'|'up'|'sneak'|'hold'|'wave'|'flail' or [left, right]), walk (phase), tiptoe,
// bob, flip, fur (spikes 0..1), mouth ('none'|'open'|'smirk'|'o'), sweat, shirt, alpha, lean (-1..1)
export function qwen(fb, x, y, o = {}) {
  const u = o.u || 1;
  const P = QW;
  const s = scratch(32 * u, 38 * u, 'qwen');
  const ox = 4 * u, oy = 8 * u;
  const R = (xx, yy, w, h, c) => s.rect(ox + xx * u, oy + yy * u, w * u, h * u, c);
  const S = (xx, yy, c) => s.rect(ox + xx * u, oy + yy * u, u, u, c);

  let legA = 0, legB = 0, bob = Math.round(o.bob || 0);
  if (o.walk !== undefined) {
    const k = Math.sin((o.walk % 1) * Math.PI * 2);
    legA = k > 0.2 ? -1 : 0;
    legB = k < -0.2 ? -1 : 0;
    if (Math.abs(k) > 0.7) bob -= 1;
  }
  const tip = o.tiptoe ? -1 : 0;
  const lean = Math.round((o.lean || 0) * 2);

  // legs
  R(7, 25 + legA + tip, 4, 3 - tip, P.furSh);
  R(7, 27 + legA, 4, 1, P.furDk);
  R(13, 25 + legB + tip, 4, 3 - tip, P.furSh);
  R(13, 27 + legB, 4, 1, P.furDk);

  const by = bob + tip;
  const B = (xx, yy, w, h, c) => R(xx, yy + by, w, h, c);
  const Bp = (xx, yy, c) => S(xx, yy + by, c);

  // body + shirt
  B(4, 14, 16, 12, P.fur);
  B(5, 13, 14, 1, P.fur);
  if (o.shirt !== false) {
    B(4, 14, 16, 8, P.shirt);
    B(5, 13, 14, 1, P.shirt);
    B(17, 15, 3, 7, P.shirtSh);
    B(4, 21, 16, 1, P.shirtSh);
    const lx = 10, ly = 16; // purple hexagon logo
    B(lx + 1, ly, 3, 1, P.logo);
    B(lx, ly + 1, 1, 3, P.logo);
    B(lx + 4, ly + 1, 1, 3, P.logo);
    B(lx + 1, ly + 4, 3, 1, P.logo);
    Bp(lx + 2, ly + 2, P.logo);
  }
  B(4, 22, 16, 4, P.fur);
  B(17, 22, 3, 4, P.furSh);
  if (o.spy) {
    B(3, 13, 18, 13, P.coat);
    B(18, 14, 3, 12, P.coatSh);
    B(9, 13, 6, 5, P.shirt);
    Bp(10, 17, P.coatSh); Bp(13, 17, P.coatSh); Bp(11, 18, P.coatSh); Bp(12, 18, P.coatSh);
    B(3, 20, 18, 1, P.belt);
    Bp(11, 20, 0xd9c08a);
    Bp(8, 16, P.coatSh); Bp(15, 16, P.coatSh); Bp(8, 22, 0x8a6d3d); Bp(15, 22, 0x8a6d3d);
    B(3, 25, 18, 1, P.coatSh);
  }

  // arms
  const arms = o.arms || 'down';
  const armCol = o.spy ? P.coat : P.fur;
  const armSh = o.spy ? P.coatSh : P.furSh;
  const arm = (L, pose) => {
    const bx = L ? 1 : 20;
    if (pose === 'up') { B(bx, 8, 3, 7, armCol); B(bx, 7, 3, 2, P.furDk); }
    else if (pose === 'sneak') { B(L ? 3 : 18, 14, 3, 3, armCol); B(L ? 5 : 16, 12, 3, 3, P.furDk); }
    else if (pose === 'hold') { B(L ? 3 : 18, 16, 3, 3, armCol); B(L ? 5 : 16, 17, 3, 3, P.furDk); }
    else if (pose === 'wave') { B(bx, 9, 3, 6, armCol); B(L ? 0 : 21, 8, 3, 2, P.furDk); }
    else if (pose === 'flail') {
      const up = (Math.floor((o.t || 0) * 10) + (L ? 0 : 1)) % 2;
      B(L ? 0 : 21, up ? 8 : 12, 3, 6, armCol);
      B(L ? 0 : 21, up ? 7 : 11, 3, 2, P.furDk);
    } else {
      B(bx, 15, 3, 7, armCol);
      B(bx, 21, 3, 2, P.furDk);
      if (!L) B(bx + 2, 15, 1, 7, armSh);
    }
  };
  arm(true, typeof arms === 'string' ? arms : arms[0]);
  arm(false, typeof arms === 'string' ? arms : arms[1]);

  // head
  const H = (xx, yy, w, h, c) => R(xx + lean, yy + by, w, h, c);
  const Hp = (xx, yy, c) => S(xx + lean, yy + by, c);
  H(5, 1, 3, 2, P.furDk);
  H(16, 1, 3, 2, P.furDk);
  H(4, 3, 16, 11, P.fur);
  H(3, 4, 18, 9, P.fur);
  H(4, 3, 16, 1, P.furHi);
  H(3, 4, 1, 7, P.furHi);
  H(20, 5, 1, 8, P.furSh);
  H(4, 13, 16, 1, P.furSh);
  // muzzle
  H(6, 8, 12, 5, P.muzzle);
  H(7, 7, 10, 1, P.muzzle);
  H(6, 12, 12, 1, P.muzzleSh);
  Hp(10, 8, P.nose); Hp(13, 8, P.nose);
  H(10, 7, 4, 1, P.muzzleSh);
  const mouth = o.mouth || 'none';
  if (mouth === 'open') { H(10, 10, 4, 2, P.nose); H(11, 11, 2, 1, 0xd8646a); }
  else if (mouth === 'o') H(11, 10, 2, 2, P.nose);
  else if (mouth === 'smirk') { H(11, 10, 3, 1, P.nose); Hp(14, 9, P.nose); }
  else { Hp(11, 10, P.muzzleSh); Hp(12, 10, P.muzzleSh); }
  if (o.mustache) {
    H(8, 9, 3, 1, 0x4a2e1c); H(13, 9, 3, 1, 0x4a2e1c); Hp(7, 8, 0x4a2e1c); Hp(16, 8, 0x4a2e1c); H(11, 9, 2, 1, 0x4a2e1c);
  }

  // eyes
  const eyes = o.eyes || 'line';
  const look = Math.round(o.look || 0);
  if (o.spy && o.glasses !== false) {
    H(5, 5, 6, 3, P.glass); H(13, 5, 6, 3, P.glass); H(11, 5, 2, 1, P.glass);
    Hp(6, 5, 0x6f7bb0); Hp(14, 5, 0x6f7bb0);
  } else if (eyes === 'wide' || eyes === 'scared') {
    const big = eyes === 'scared';
    for (const ex of [6, 14]) {
      H(ex, big ? 4 : 5, 4, big ? 4 : 3, 0xffffff);
      H(ex + 1 + look, big ? 5 : 6, big ? 1 : 2, 1, P.eye);
    }
  } else if (eyes === 'closed') {
    H(6, 6, 3, 1, P.eye); Hp(5, 5, P.eye); H(15, 6, 3, 1, P.eye); Hp(18, 5, P.eye);
  } else if (eyes === 'smug') {
    H(6, 6, 4, 1, P.eye); Hp(9, 5, P.eye); H(14, 6, 4, 1, P.eye); Hp(14, 5, P.eye);
  } else {
    H(6, 6, 4, 1, P.eye); H(14, 6, 4, 1, P.eye);
    if (eyes === 'shifty') { Hp(look < 0 ? 6 : 9, 5, P.eye); Hp(look < 0 ? 14 : 17, 5, P.eye); }
  }
  if (o.spy && o.hat !== false) {
    H(1, 1, 22, 2, P.hat); H(6, -3, 12, 4, P.hat); H(6, 0, 12, 1, P.hatBand); H(7, -3, 10, 1, 0x57493f);
  }
  if (o.fur) {
    const n = Math.round(o.fur * 3);
    for (let i = 0; i < 5; i++) H(5 + i * 3, 2 - n, 1, n + 1, P.fur);
  }
  if (o.sweat) {
    const d = Math.floor((o.t || 0) * 6) % 3;
    Hp(21, 3 + d, 0x9fd8ff); Hp(21, 4 + d, 0x9fd8ff); Hp(2, 5 + ((d + 1) % 3), 0x9fd8ff);
  }

  const spr = o.outline === false ? s : outlined(s, P.line);
  const pad = o.outline === false ? 0 : 1;
  fb.blit(spr, x - (ox + 12 * u + pad), y - (oy + 28 * u + pad + 1), { flip: o.flip, alpha: o.alpha, tint: o.tint, tintK: o.tintK, dither: o.dither, solid: o.solid });
}
