// Clawd — the Claude Code pixel crab. Silhouette follows the terminal mascot
// (16x10 grid: body 12x8, side arms, four legs, tall eyes), drawn at unit u.
import { scratch, outlined } from '../engine/fb.js';
import { clamp } from '../engine/core.js';

export const CLAWD = {
  hi: 0xf2a886, base: 0xd97757, sh: 0xb95f41, dk: 0x8f432c,
  eye: 0x1c120f, line: 0x4a2014, blush: 0xff8f8f, white: 0xffffff,
};

// (x, y) = bottom centre (feet). Options:
// u unit, eyes, look (-1..1), lookY, armL/armR (-1 down .. 0 out .. 1 up), walk (phase, 0..1 loop; undefined = still)
// bob (px), squash (-1..1), flip, mouth, blush, tear, hat, alpha, tint/tintK, outline(false), pal
export function clawd(fb, x, y, o = {}) {
  const u = o.u || 2;
  const P = o.pal || CLAWD;
  const s = scratch(22 * u, 18 * u, 'clawd');
  const ox = 3 * u, oy = 6 * u; // origin of the 16x10 grid inside the scratch
  const walk = o.walk;
  const lift = Math.max(1, Math.round(u / 2));
  let bodyDy = Math.round(o.bob || 0);
  let legA = 0, legB = 0, legSx = 0;
  if (walk !== undefined) {
    const ph = ((walk % 1) + 1) % 1;
    const k = Math.sin(ph * Math.PI * 2);
    legA = k > 0.2 ? -lift : 0;
    legB = k < -0.2 ? -lift : 0;
    legSx = k > 0 ? 1 : -1;
    bodyDy += Math.abs(k) > 0.7 ? -1 : 0;
  }
  const by = oy + bodyDy;

  // legs
  const legs = [3, 5, 10, 12];
  legs.forEach((lx, i) => {
    const up = i % 2 === 0 ? legA : legB;
    const sx = walk !== undefined ? (i % 2 === 0 ? legSx : -legSx) * (u >= 2 ? 1 : 0) : 0;
    s.rect(ox + lx * u + sx, oy + 8 * u + up, u, 2 * u, P.sh);
    if (u >= 2) s.rect(ox + lx * u + sx, oy + 8 * u + up, u, 1, P.dk);
  });

  // body
  s.rect(ox + 2 * u, by, 12 * u, 8 * u, P.base);
  if (u >= 2) {
    s.rect(ox + 2 * u + 1, by, 12 * u - 2, 1, P.hi);
    s.rect(ox + 2 * u, by + 1, 1, 8 * u - 3, P.hi);
    s.rect(ox + 2 * u + 1, by + 8 * u - 1, 12 * u - 1, 1, P.sh);
    s.rect(ox + 14 * u - 1, by + 1, 1, 8 * u - 1, P.sh);
    // soften corners
    s.u32[by * s.w + ox + 2 * u] = 0;
    s.u32[by * s.w + ox + 14 * u - 1] = 0;
    s.u32[(by + 8 * u - 1) * s.w + ox + 2 * u] = 0;
    s.u32[(by + 8 * u - 1) * s.w + ox + 14 * u - 1] = 0;
  }

  // arms: slide from down(-1) through out(0) to up(1)
  const arm = (a, left) => {
    a = clamp(a, -1, 1.3);
    const ay = by + Math.round(4 * u - a * 4.5 * u);
    const ax = left ? ox + Math.round(Math.max(0, a) * 0.5 * u) : ox + 14 * u - Math.round(Math.max(0, a) * 0.5 * u);
    s.rect(ax, ay, 2 * u, 2 * u, P.base);
    if (u >= 2) {
      s.rect(ax, ay, 2 * u, 1, P.hi);
      s.rect(ax, ay + 2 * u - 1, 2 * u, 1, P.sh);
    }
  };
  arm(o.armL || 0, true);
  arm(o.armR || 0, false);

  // hat (nightcap for the sleepy scene)
  if (o.hat === 'nightcap') {
    const hx = ox + 3 * u, hy = by - 3 * u;
    s.poly([hx, hy + 3 * u, hx + 10 * u, hy + 3 * u, hx + 12 * u, hy - 1 * u], 0x4b6cc9);
    for (let i = 0; i < 3; i++) s.rect(hx + (2 + i * 3) * u, hy + 3 * u - 1 - i * u * 0.4, u, 1, 0xdfe7ff);
    s.rect(hx, hy + 3 * u - 1, 11 * u, u, 0xeef2ff);
    s.circle(hx + 12 * u, hy - 1 * u, Math.max(1, u * 0.9), 0xffffff);
  }

  // face
  const look = Math.round((o.look || 0) * Math.max(1, u / 2));
  const lookY = Math.round((o.lookY || 0) * Math.max(1, u / 2));
  const ex = [ox + 4 * u + look, ox + 11 * u + look], ey = by + 2 * u + lookY;
  const E = P.eye, eyes = o.eyes || 'normal';
  for (let i = 0; i < 2; i++) {
    const x0 = ex[i];
    switch (eyes) {
      case 'closed':
      case 'sleep':
        s.rect(x0 - (u >= 2 ? 1 : 0), ey + 2 * u - Math.max(1, u >> 1), u + (u >= 2 ? 2 : 0), Math.max(1, u >> 1), E);
        break;
      case 'happy':
        if (u >= 2) {
          s.rect(x0 - 1, ey + u, 1, u, E); s.rect(x0 + u, ey + u, 1, u, E); s.rect(x0, ey + u - 1, u, 1, E);
        } else s.rect(x0, ey + 1, u, 1, E);
        break;
      case 'wide':
        s.rect(x0 - 1, ey - 1, u + 2, 2 * u + 2, E);
        if (u >= 2) s.rect(x0, ey, 1, 1, P.white);
        break;
      case 'sad':
        s.rect(x0, ey + Math.round(u * 0.5), u, Math.round(1.5 * u), E);
        if (u >= 2) s.set(i === 0 ? x0 - 1 : x0 + u, ey - 1, E), s.set(i === 0 ? x0 : x0 + u - 1, ey - 1 + 0, P.base);
        break;
      case 'determined':
        s.rect(x0, ey + Math.round(u * 0.5), u, Math.round(1.5 * u), E);
        if (u >= 2) s.rect(i === 0 ? x0 - 1 : x0, ey - 1, u + 1, 1, E);
        break;
      case 'dot':
        s.rect(x0, ey + u - 1, Math.max(1, u >> 1), Math.max(1, u >> 1), E);
        break;
      default:
        s.rect(x0, ey, u, 2 * u, E);
        if (u >= 3) s.set(x0, ey, P.white);
    }
  }
  if (o.blush) {
    s.rect(ox + 3 * u, ey + 2 * u + 1, u, Math.max(1, u >> 1), P.blush);
    s.rect(ox + 12 * u, ey + 2 * u + 1, u, Math.max(1, u >> 1), P.blush);
  }
  if (o.tear) {
    const tx = ex[0] + (u >> 1), ty = ey + 2 * u + ((o.tear * 6) | 0) % (4 * u);
    s.rect(tx, ty, Math.max(1, u >> 1), Math.max(1, u >> 1), 0x9fd8ff);
  }
  if (o.mouth && u >= 2) {
    const mx = ox + 8 * u + look, my = ey + 3 * u;
    if (o.mouth === 'smile') { s.rect(mx - u, my, 2 * u, 1, E); s.set(mx - u - 1, my - 1, E); s.set(mx + u, my - 1, E); }
    else if (o.mouth === 'open') { s.rect(mx - u, my - 1, 2 * u, u + 1, E); s.rect(mx - u + 1, my + u - 1, 2 * u - 2, 1, 0xe0605a); }
    else if (o.mouth === 'o') s.rect(mx - (u >> 1), my - 1, u, u, E);
    else if (o.mouth === 'wobble') { for (let i = 0; i < 2 * u; i++) s.set(mx - u + i, my + (i % 2), E); }
  }

  const spr = o.outline === false ? s : outlined(s, o.line === undefined ? P.line : o.line);
  const pad = o.outline === false ? 0 : 1;
  const sq = o.squash || 0, sx = 1 + sq * 0.35, sy = 1 - sq * 0.35;
  const foot = oy + 10 * u + pad + 1;
  const cx = (ox + 8 * u + pad) * sx;
  fb.blit(spr, x - cx, y - foot * sy, { sx, sy, flip: o.flip, alpha: o.alpha, tint: o.tint, tintK: o.tintK, dither: o.dither });
}
