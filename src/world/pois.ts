import * as THREE from 'three';
import { Kit } from './buildkit';
import { Materials } from '../gfx/materials';
import { RNG } from '../core/math';
import { canvas, toTex, weather, FONT, FONT_COND, cachedTex } from '../gfx/canvasTex';
import { boxUV } from '../models/geom';

export type PoiType = 'station' | 'garage' | 'house' | 'trailer' | 'wrecks' | 'busstop' | 'billboard' | 'military' | 'motel' | 'tower' | 'homestead' | 'shack';

export interface PoiSize {
  hw: number;
  hd: number;
}
export const POI_SIZE: Record<PoiType, PoiSize> = {
  station: { hw: 13, hd: 10 },
  garage: { hw: 6, hd: 6 },
  house: { hw: 7, hd: 6.5 },
  trailer: { hw: 6, hd: 4 },
  wrecks: { hw: 8, hd: 6 },
  busstop: { hw: 3, hd: 2 },
  billboard: { hw: 5, hd: 2 },
  military: { hw: 11, hd: 9 },
  motel: { hw: 14, hd: 7 },
  tower: { hw: 6, hd: 6 },
  homestead: { hw: 17, hd: 15 },
  shack: { hw: 4, hd: 4 },
};

function signTex(key: string, lines: string[], bg: string, fg: string, w = 512, h = 256, font = FONT_COND) {
  return cachedTex('sign:' + key, () => {
    const [c, x] = canvas(w, h);
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.fillStyle = fg;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((l, i) => {
      const fs = (h / (n + 0.6)) * (i === 0 ? 1 : 0.7);
      x.font = `800 ${fs}px ${font}`;
      x.fillText(l, w / 2, (h / (n + 1)) * (i + 1));
    });
    weather(x, w, h, 0.8, key.length * 13);
    return toTex(c);
  });
}

const ADS: [string[], string, string][] = [
  [['МОТЕЛЬ «ОАЗИС»', 'ЧЕРЕЗ 40 КМ'], '#e8d8b0', '#8a2a1a'],
  [['ПЕЙ «БАЙКАЛ»', 'ОСВЕЖАЕТ!'], '#2a5a8a', '#f0e8d0'],
  [['БЕНЗИН · МАСЛО', 'ЗАПЧАСТИ'], '#d8b020', '#1a1a1a'],
  [['ЛЕНИН ЖИЛ', 'ЛЕНИН ЖИВ'], '#b02a1a', '#f0e0c0'],
  [['ТУШЁНКА «ОРЁЛ»', 'СИЛА ДЛЯ ДОРОГИ'], '#e8e0c8', '#2a3a2a'],
  [['БЕРЕГИТЕ', 'ВОДУ'], '#3a78b0', '#ffffff'],
  [['ЗДЕСЬ БЫЛ', 'ГОРОД'], '#c8b898', '#3a2a1a'],
];

/** Build a point of interest into a kit. Local frame: +z faces the road. */
export function buildPoi(type: PoiType, k: Kit, rng: RNG) {
  const m = k.m;
  switch (type) {
    case 'station': return station(k, m, rng);
    case 'garage': return garage(k, m, rng, false);
    case 'house': return house(k, m, rng, 0, 0);
    case 'trailer': return trailer(k, m, rng);
    case 'wrecks': return wrecks(k, rng);
    case 'busstop': return busstop(k, m);
    case 'billboard': return billboard(k, m, rng);
    case 'military': return military(k, m, rng);
    case 'motel': return motel(k, m, rng);
    case 'tower': return tower(k, m, rng);
    case 'homestead': return homestead(k, m, rng);
    case 'shack': return shack(k, m, rng);
  }
}

function station(k: Kit, m: Materials, r: RNG) {
  k.floor(m.concrete, 0, 0, 24, 18, 0.02, 0.2, 3);
  const yellow = r.chance(0.5);
  const pillar = m.painted(yellow ? '#3a3a38' : '#6a6a64', 0.6, 0.6);
  for (const x of [-4.6, 4.6]) for (const z of [1.3, 4.7]) k.box(pillar, 0.28, 4.3, 0.28, x, 2.15, z, 0, true, 1);
  const fascia = yellow ? m.painted('#d8b41c', 0.45, 0.5) : m.corrugatedRust;
  k.box(fascia, 11.4, 0.7, 5.6, 0, 4.6, 3.0, 0, true, 1.2);
  k.box(m.flat('#b8b4a8', 0.9), 11.2, 0.05, 5.4, 0, 4.24, 3.0, 0, false);
  k.box(m.concrete, 5.5, 0.22, 1.2, 0, 0.11, 3.0, 0, true, 3);
  k.interact.push({ kind: 'pump', x: -1.4, y: 0, z: 3.0, r: 0.8, data: { color: yellow ? '#c8281c' : '#2a5a8a', fuel: r.chance(0.25) ? 0 : Math.round(r.range(40, 260)), price: +(r.range(0.35, 0.8)).toFixed(2), kind: 'petrol' } });
  k.interact.push({ kind: 'pump', x: 1.4, y: 0, z: 3.0, r: 0.8, data: { color: yellow ? '#c8281c' : '#2a5a8a', fuel: r.chance(0.35) ? 0 : Math.round(r.range(30, 200)), price: +(r.range(0.3, 0.7)).toFixed(2), kind: r.chance(0.3) ? 'diesel' : 'petrol' } });
  // kiosk
  const W = 7, D = 5, H = 3.0, cz = -4.5;
  const wm = r.chance(0.5) ? m.concrete : m.painted('#d8d0bc', 0.5, 0.8);
  k.floor(m.concrete, 0, cz, W, D, 0.22, 0.2, 3);
  k.wall(wm, -W / 2, cz + D / 2, W / 2, cz + D / 2, H, 0.2, [{ at: 2.2, w: 1.0, y0: 0, y1: 2.1, kind: 'door', hinge: 'r', doorMat: m.painted('#5a6a70', 0.5, 0.5) }, { at: 4.8, w: 2.4, y0: 0.9, y1: 2.3, kind: 'window' }], 0.2, 3);
  k.wall(wm, W / 2, cz - D / 2, -W / 2, cz - D / 2, H, 0.2, [], 0.2, 3);
  k.wall(wm, -W / 2, cz - D / 2, -W / 2, cz + D / 2, H, 0.2, [{ at: 2.5, w: 1.2, y0: 1.0, y1: 2.1, kind: 'window' }], 0.2, 3);
  k.wall(wm, W / 2, cz + D / 2, W / 2, cz - D / 2, H, 0.2, [], 0.2, 3);
  k.box(m.concrete, W + 1.0, 0.25, D + 1.0, 0, 0.2 + H + 0.12, cz, 0, true, 3);
  k.baseY = 0.22;
  k.counter(-1.5, cz + 0.6, 0, 2.6, 'station');
  k.shelf(1.8, cz - 1.9, 0, 1.8, 4, 'station', 0.4);
  k.shelf(-2.6, cz - 1.9, 0, 1.4, 4, 'station', 0.4);
  k.baseY = 0;
  k.lamp(0, 3.0, cz, 0xffe0b0, 16, 10);
  k.interior.push({ x0: -W / 2, z0: cz - D / 2, x1: W / 2, z1: cz + D / 2, y1: H });
  // price sign
  k.box(m.metalDark, 0.18, 6, 0.18, 9.5, 3, 6.5, 0, true, 1);
  const sign = new THREE.Mesh(boxUV(2.4, 1.4, 0.12), [m.painted('#3a3a38', 0.5, 0.5), m.painted('#3a3a38', 0.5, 0.5), m.painted('#3a3a38', 0.5, 0.5), m.painted('#3a3a38', 0.5, 0.5), new THREE.MeshStandardMaterial({ map: signTex('gas', ['БЕНЗИН', 'АИ-76'], '#f0e8d0', '#b02a1a'), roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: signTex('gas', ['БЕНЗИН', 'АИ-76'], '#f0e8d0', '#b02a1a'), roughness: 0.6 })]);
  sign.position.set(9.5, 6.2, 6.5);
  sign.castShadow = true;
  k.extra.push(sign);
  // clutter
  for (let i = 0; i < r.int(2, 4); i++) k.barrel(-6 + i * 0.7, -8.2 + (i % 2) * 0.3, r.pick(['#3a5a8a', '#8a2a1a', '#5a6a3a']), r.chance(0.5) ? { liquid: r.chance(0.7) ? 'petrol' : 'diesel', amount: Math.round(r.range(5, 60)) } : { liquid: null, amount: 0 });
  if (r.chance(0.6)) k.items.push({ id: 'jerrycan', x: 5.2, y: 0.5, z: -2.5, state: { color: '#b8261c', liquid: r.chance(0.5) ? 'petrol' : null, amount: r.chance(0.5) ? Math.round(r.range(2, 12)) : 0 } });
  if (r.chance(0.5)) k.wrecks.push({ x: -9, z: 5, ry: r.range(-0.4, 0.4) });
  if (r.chance(0.4)) k.crates(6, -7, r.int(1, 3));
}

function garage(k: Kit, m: Materials, r: RNG, home: boolean) {
  const W = home ? 7.6 : r.pick([7, 8]), D = home ? 8.4 : r.pick([7, 8]), H = 3.3;
  const wood = m.woodDark;
  k.floor(home || r.chance(0.6) ? m.dirt : m.concrete, 0, 0, W + 0.2, D + 0.2, 0.08, 0.16, 3);
  const gateW = 3.4;
  const gateMat = r.chance(0.7) || home ? m.corrugatedRust : m.woodDark;
  k.wall(wood, -W / 2, D / 2, W / 2, D / 2, H, 0.14, [{ at: W / 2, w: gateW, y0: 0, y1: 2.7, kind: 'gate', double: true, doorMat: gateMat }], 0.08, 2);
  k.wall(wood, W / 2, -D / 2, -W / 2, -D / 2, H, 0.14, [{ at: W * 0.3, w: 1.4, y0: 1.2, y1: 2.2, kind: 'window' }], 0.08, 2);
  k.wall(wood, -W / 2, -D / 2, -W / 2, D / 2, H, 0.14, [{ at: D * 0.35, w: 0.95, y0: 0, y1: 2.05, kind: 'door', hinge: 'l' }, { at: D * 0.72, w: 1.3, y0: 1.2, y1: 2.2, kind: 'window' }], 0.08, 2);
  k.wall(wood, W / 2, D / 2, W / 2, -D / 2, H, 0.14, [{ at: D * 0.5, w: 1.3, y0: 1.2, y1: 2.2, kind: 'window' }], 0.08, 2);
  // open truss roof like the reference sheds
  for (let i = 0; i < 5; i++) {
    const z = -D / 2 + 0.3 + (i * (D - 0.6)) / 4;
    k.box(m.woodLight, W, 0.14, 0.1, 0, H + 0.1, z, 0, false);
  }
  k.gableRoof(m.corrugatedRust, 0, 0, W, D, H + 0.08, 1.35, 0.4, wood);
  // interior furnishings
  k.baseY = 0.08;
  k.shelf(-W / 2 + 0.35, -D / 2 + 1.4, Math.PI / 2, 1.8, 4, 'garage', 0.45);
  k.shelf(W / 2 - 0.35, -D / 2 + 1.4, -Math.PI / 2, 1.8, 4, 'garage', 0.45);
  k.table(0, -D / 2 + 0.55, 0, 2.2, 0.7, 0.9, m.woodLight, home ? undefined : 'garage');
  k.baseY = 0;
  k.lamp(0, H - 0.1, 0, 0xffe2b0, 14, 12);
  k.interior.push({ x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2, y1: H + 1.3 });
  if (!home) {
    if (r.chance(0.35)) k.wrecks.push({ x: 0, z: 0.3, ry: Math.PI, parts: 0.5 });
    else {
      for (let i = 0; i < r.int(1, 3); i++) k.items.push({ id: 'part', x: r.range(-2, 2), y: 0.5, z: r.range(-1, 2), state: { partKind: r.pick(['wheel', 'wheel', 'battery', 'radiator', 'headlight', 'door_fl', 'door_fr', 'hood', 'seat_f', 'engine']) } });
    }
    if (r.chance(0.6)) k.items.push({ id: 'jerrycan', x: W / 2 - 0.6, y: 0.4, z: D / 2 - 1.2, state: { color: r.pick(['#b8261c', '#4a6a2a', '#c8a020']), liquid: r.chance(0.6) ? 'petrol' : null, amount: Math.round(r.range(3, 20)) } });
  }
}

function house(k: Kit, m: Materials, r: RNG, ox: number, oz: number, home = false) {
  const W = 9, D = 7, H = 2.9;
  const painted = r.chance(0.5);
  const wm = painted ? m.painted(r.pick(['#d8ccb0', '#b8c8c0', '#c8b898', '#e0d8c8']), 0.4, 0.85) : m.woodDark;
  const floorY = 0.35;
  k.box(m.concrete, W + 0.3, floorY, D + 0.3, ox, floorY / 2, oz, 0, true, 3);
  k.box(m.woodLight, W, 0.04, D, ox, floorY + 0.02, oz, 0, false, 2);
  const X0 = ox - W / 2, X1 = ox + W / 2, Z0 = oz - D / 2, Z1 = oz + D / 2;
  k.wall(wm, X0, Z1, X1, Z1, H, 0.16, [{ at: 2.2, w: 1.4, y0: 0.9, y1: 2.1, kind: 'window' }, { at: 4.8, w: 0.95, y0: 0, y1: 2.1, kind: 'door', hinge: 'l' }, { at: 7.2, w: 1.4, y0: 0.9, y1: 2.1, kind: 'window' }], floorY, 2);
  k.wall(wm, X1, Z0, X0, Z0, H, 0.16, [{ at: 2.5, w: 1.2, y0: 0.9, y1: 2.0, kind: 'window' }, { at: 6.5, w: 1.2, y0: 0.9, y1: 2.0, kind: 'window' }], floorY, 2);
  k.wall(wm, X0, Z0, X0, Z1, H, 0.16, [{ at: 3.5, w: 1.2, y0: 0.9, y1: 2.0, kind: 'window' }], floorY, 2);
  k.wall(wm, X1, Z1, X1, Z0, H, 0.16, [{ at: 3.5, w: 0.9, y0: 0, y1: 2.05, kind: 'door', hinge: 'r' }], floorY, 2);
  // interior partition
  k.wall(m.woodLight, ox + 1.2, Z0, ox + 1.2, Z1, H, 0.1, [{ at: 2.2, w: 1.0, y0: 0, y1: 2.05, kind: 'gap' }], floorY, 2);
  k.box(m.flat('#c8c0b0', 0.95), W, 0.05, D, ox, floorY + H + 0.02, oz, 0, false, 2);
  k.gableRoof(r.chance(0.5) ? m.corrugated : m.corrugatedRust, ox, oz, W, D, floorY + H, 1.6, 0.5, wm);
  // porch
  k.box(m.woodLight, 4, 0.1, 1.8, ox + 0.3, floorY - 0.05, Z1 + 0.9, 0, true, 2);
  for (const px of [-1.5, 2.1]) k.box(m.woodLight, 0.12, 2.5, 0.12, ox + px, floorY + 1.25, Z1 + 1.65, 0, true);
  k.shedRoof(m.corrugatedRust, ox + 0.3, Z1 + 0.95, 4.2, 1.8, floorY + 2.55, floorY + 2.85, 0.2);
  // kitchen (left) and bedroom (right)
  const fy = floorY;
  k.baseY = fy;
  k.counter(ox - 3.2, Z0 + 0.45, 0, 2.0, 'kitchen');
  k.fridge(ox - 1.6, Z0 + 0.45, 0);
  k.table(ox - 2.5, oz + 0.8, 0, 1.2, 0.8, 0.76, m.woodLight, home ? undefined : 'kitchen');
  k.bed(ox + 3.3, oz - 1.8, 0);
  k.shelf(ox + 3.9, oz + 1.8, -Math.PI / 2, 1.2, 3, 'shelf', 0.35);
  k.baseY = 0;
  k.lamp(ox - 2, floorY + H - 0.05, oz, 0xffdcaa, 14, 10);
  k.lamp(ox + 3, floorY + H - 0.05, oz, 0xffdcaa, 10, 8);
  k.interior.push({ x0: X0, z0: Z0, x1: X1, z1: Z1, y1: floorY + H + 1.6 });
  return floorY;
}

function trailer(k: Kit, m: Materials, r: RNG) {
  const W = 8.5, D = 2.6, H = 2.5, y0 = 0.55;
  const col = r.pick(['#d8d0b8', '#b8c0a8', '#c8b090', '#a8b8c0']);
  const wm = m.painted(col, 0.55, 0.5);
  for (const x of [-3, 0, 3]) k.box(m.concrete, 0.4, y0, 0.4, x, y0 / 2, 0, 0, true);
  k.box(m.woodLight, W, 0.08, D, 0, y0, 0, 0, true, 2);
  k.wall(wm, -W / 2, D / 2, W / 2, D / 2, H, 0.08, [{ at: 2, w: 1.1, y0: 0.9, y1: 1.8, kind: 'window' }, { at: 4.6, w: 0.8, y0: 0, y1: 2.0, kind: 'door', hinge: 'l', doorMat: wm }, { at: 7, w: 1.1, y0: 0.9, y1: 1.8, kind: 'window' }], y0, 1.2, m.metalDark);
  k.wall(wm, W / 2, -D / 2, -W / 2, -D / 2, H, 0.08, [{ at: 4, w: 1.4, y0: 0.9, y1: 1.8, kind: 'window' }], y0, 1.2, m.metalDark);
  k.wall(wm, -W / 2, -D / 2, -W / 2, D / 2, H, 0.08, [], y0, 1.2);
  k.wall(wm, W / 2, D / 2, W / 2, -D / 2, H, 0.08, [], y0, 1.2);
  k.box(m.corrugated, W + 0.2, 0.08, D + 0.3, 0, y0 + H + 0.04, 0, 0, true, 1.2);
  k.baseY = y0;
  k.bed(-3.2, 0, Math.PI / 2);
  k.counter(3.4, -0.9, 0, 1.4, 'kitchen');
  k.baseY = 0;
  k.box(m.woodLight, 0.8, 0.8, 0.2, 2.8 + 0.7, y0 + 0.4, 1.1, 0, false);
  k.interior.push({ x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2, y1: y0 + H });
  k.lamp(0, y0 + H - 0.05, 0, 0xffdcaa, 8, 7);
  if (r.chance(0.5)) k.items.push({ id: 'canister', x: 4.8, y: 0.2, z: 1.8, state: { liquid: 'water', amount: Math.round(r.range(2, 9)), color: '#3a6ab0' } });
}

function wrecks(k: Kit, r: RNG) {
  const n = r.int(1, 3);
  for (let i = 0; i < n; i++) k.wrecks.push({ x: r.range(-5, 5), z: r.range(-3, 3) + i * 1.5, ry: r.range(-1, 1) + (r.chance(0.3) ? Math.PI : 0), parts: r.range(0.3, 0.8) });
  for (let i = 0; i < r.int(0, 3); i++) k.items.push({ id: 'part', x: r.range(-6, 6), y: 0.4, z: r.range(-4, 4), state: { partKind: r.pick(['wheel', 'wheel', 'door_fl', 'door_rr', 'hood', 'bumper_f', 'headlight']) } });
  if (r.chance(0.3)) k.items.push({ id: 'jerrycan', x: r.range(-4, 4), y: 0.4, z: r.range(-3, 3), state: { color: '#b8261c', liquid: 'petrol', amount: Math.round(r.range(1, 8)) } });
}

function busstop(k: Kit, m: Materials) {
  k.floor(m.concrete, 0, 0, 4, 2.2, 0.08, 0.16, 3);
  const cm = m.painted('#6a8a9a', 0.6, 0.6);
  k.box(cm, 3.6, 2.4, 0.1, 0, 1.28, -0.9, 0, true, 2);
  k.box(cm, 0.1, 2.4, 1.8, -1.75, 1.28, 0, 0, true, 2);
  k.box(cm, 0.1, 2.4, 1.8, 1.75, 1.28, 0, 0, true, 2);
  k.box(m.corrugated, 3.9, 0.08, 2.3, 0, 2.52, 0.05, 0, true, 1.2);
  k.box(m.woodLight, 3.0, 0.06, 0.4, 0, 0.5, -0.6, 0, true);
  k.loot.push({ x: 0, y: 0.56, z: -0.6, table: 'shelf', spread: 1, chance: 0.5 });
}

function billboard(k: Kit, m: Materials, r: RNG) {
  for (const x of [-2.2, 2.2]) k.box(m.woodDark, 0.25, 7, 0.25, x, 3.5, 0, 0, true, 2);
  const ad = r.pick(ADS);
  const tex = signTex('ad' + ad[0].join(), ad[0], ad[1], ad[2], 1024, 512);
  const mats = [m.woodDark, m.woodDark, m.woodDark, m.woodDark, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), m.woodDark];
  const b = new THREE.Mesh(boxUV(6.4, 3.2, 0.14, 2), mats);
  b.position.set(0, 5.4, 0.15);
  b.castShadow = true;
  k.extra.push(b);
  k.col(3.2, 1.6, 0.1, 0, 5.4, 0.15, 0);
  k.box(m.woodLight, 6.2, 0.1, 0.8, 0, 3.75, 0.35, 0, false);
}

function military(k: Kit, m: Materials, r: RNG) {
  const sand = m.fabric('#8a8058');
  const bagRow = (x0: number, z0: number, x1: number, z1: number, rows: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.6);
    const ry = Math.atan2(-(z1 - z0) / L, (x1 - x0) / L);
    for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) {
      const t = (i + 0.5 + (j % 2) * 0.5) / n;
      if (t > 1) continue;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      k.box(sand, 0.58, 0.22, 0.34, x, 0.11 + j * 0.21, z, ry, false);
    }
    k.col(L / 2, rows * 0.11, 0.2, (x0 + x1) / 2, rows * 0.11, (z0 + z1) / 2, ry);
  };
  bagRow(-8, 6, -2, 6, 4);
  bagRow(2, 6, 8, 6, 4);
  bagRow(-8, -6, -8, 6, 3);
  // hut
  k.floor(m.woodLight, 3, -2, 5, 4, 0.1, 0.1, 2);
  k.wall(m.corrugated, 0.5, 0, 5.5, 0, 2.6, 0.06, [{ at: 1.2, w: 0.9, y0: 0, y1: 2.0, kind: 'door', hinge: 'l', doorMat: m.corrugated }], 0.1, 1.2, m.metalDark);
  k.wall(m.corrugated, 5.5, -4, 0.5, -4, 2.6, 0.06, [], 0.1, 1.2);
  k.wall(m.corrugated, 0.5, -4, 0.5, 0, 2.6, 0.06, [], 0.1, 1.2);
  k.wall(m.corrugated, 5.5, 0, 5.5, -4, 2.6, 0.06, [{ at: 2, w: 1.0, y0: 1.2, y1: 1.9, kind: 'window' }], 0.1, 1.2);
  k.shedRoof(m.corrugatedRust, 3, -2, 5, 4, 2.7, 3.0, 0.3);
  k.table(3, -3.2, 0, 1.6, 0.7, 0.8, m.woodLight, 'military');
  k.shelf(4.9, -2, -Math.PI / 2, 1.4, 3, 'military', 0.4);
  k.interior.push({ x0: 0.5, z0: -4, x1: 5.5, z1: 0, y1: 3 });
  k.crates(-5, -3, r.int(2, 4));
  // tent
  const tent = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5, 3, 1, false), m.fabric('#5a6a3a'));
  tent.rotation.set(0, 0, Math.PI / 2);
  tent.position.set(-4, 1.1, 1.2);
  tent.scale.set(1, 1, 0.6);
  tent.castShadow = true;
  k.extra.push(tent);
  k.col(2.5, 1.1, 1.3, -4, 1.1, 1.2, 0);
  k.interact.push({ kind: 'sign', x: 8, y: 1, z: 8, r: 1, data: { mines: true } });
}

function motel(k: Kit, m: Materials, r: RNG) {
  const rooms = 4, RW = 4.2, D = 5, H = 2.8;
  const wm = m.painted(r.pick(['#e0c8a0', '#c8d8d0', '#e8d8c0']), 0.45, 0.85);
  const W = rooms * RW;
  k.box(m.concrete, W + 0.3, 0.3, D + 2.5, 0, 0.15, 0.9, 0, true, 3);
  const X0 = -W / 2;
  const front: any[] = [];
  for (let i = 0; i < rooms; i++) {
    front.push({ at: i * RW + 1.0, w: 0.9, y0: 0, y1: 2.05, kind: 'door', hinge: 'l', doorMat: m.painted(r.pick(['#8a3a2a', '#3a5a6a', '#6a6a3a']), 0.4, 0.5) });
    front.push({ at: i * RW + 2.9, w: 1.4, y0: 0.9, y1: 2.0, kind: 'window' });
  }
  k.wall(wm, X0, D / 2, X0 + W, D / 2, H, 0.16, front, 0.3, 2);
  k.wall(wm, X0 + W, -D / 2, X0, -D / 2, H, 0.16, [], 0.3, 2);
  k.wall(wm, X0, -D / 2, X0, D / 2, H, 0.16, [], 0.3, 2);
  k.wall(wm, X0 + W, D / 2, X0 + W, -D / 2, H, 0.16, [], 0.3, 2);
  for (let i = 1; i < rooms; i++) k.wall(wm, X0 + i * RW, -D / 2, X0 + i * RW, D / 2, H, 0.1, [], 0.3, 2);
  k.box(m.concrete, W + 0.8, 0.2, D + 2.6, 0, 0.3 + H + 0.1, 0.8, 0, true, 3);
  for (let i = 0; i <= rooms; i++) k.box(m.painted('#d8d0c0', 0.4, 0.8), 0.14, H, 0.14, X0 + i * RW, 0.3 + H / 2, D / 2 + 2.0, 0, true);
  for (let i = 0; i < rooms; i++) {
    const cx = X0 + i * RW + RW / 2;
    k.baseY = 0.3;
    k.bed(cx + 0.9, -0.8, 0);
    k.table(cx - 1.2, -1.6, 0, 0.8, 0.5, 0.7, m.woodLight, 'shelf');
    k.baseY = 0;
    k.interior.push({ x0: X0 + i * RW, z0: -D / 2, x1: X0 + (i + 1) * RW, z1: D / 2, y1: 0.3 + H });
  }
  const sign = new THREE.Mesh(boxUV(4, 1.2, 0.2), new THREE.MeshStandardMaterial({ map: signTex('motel', ['МОТЕЛЬ'], '#2a3a5a', '#f0c040'), roughness: 0.5, emissive: 0xffffff, emissiveMap: signTex('motel', ['МОТЕЛЬ'], '#2a3a5a', '#f0c040'), emissiveIntensity: 0.0 }));
  sign.position.set(W / 2 + 2, 4.5, 4);
  sign.userData.neon = true;
  k.extra.push(sign);
  k.box(m.metalDark, 0.2, 4, 0.2, W / 2 + 2, 2, 4, 0, true);
}

function tower(k: Kit, m: Materials, r: RNG) {
  const steel = m.painted('#b8b0a0', 0.6, 0.6);
  const Ht = 36, B = 2.6;
  const legs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = legs[i];
    const pts = [new THREE.Vector3(ax * B, 0, az * B), new THREE.Vector3(ax * 0.4, Ht, az * 0.4)];
    const d = pts[1].clone().sub(pts[0]);
    const g = new THREE.CylinderGeometry(0.06, 0.09, d.length(), 5);
    g.translate(0, d.length() / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate(pts[0].x, 0, pts[0].z);
    k.add(steel, g);
  }
  for (let lv = 0; lv < 12; lv++) {
    const y = lv * 3;
    const w = B + (0.4 - B) * (y / Ht);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4];
      const g = new THREE.CylinderGeometry(0.03, 0.03, Math.hypot((bx - ax) * w, (bz - az) * w), 4);
      g.rotateZ(Math.PI / 2);
      g.rotateY(-Math.atan2(bz - az, bx - ax));
      g.translate(((ax + bx) / 2) * w, y, ((az + bz) / 2) * w);
      k.add(steel, g);
    }
  }
  k.col(B, 1, B, 0, 1, 0, 0);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 3 }));
  beacon.position.y = Ht + 0.3;
  beacon.userData.blink = true;
  k.extra.push(beacon);
  // hut
  k.floor(m.concrete, 5, 0, 3.4, 3, 0.1, 0.15, 3);
  k.wall(m.concrete, 3.3, 1.5, 6.7, 1.5, 2.5, 0.15, [{ at: 1.2, w: 0.9, y0: 0, y1: 2.0, kind: 'door', hinge: 'l', doorMat: m.painted('#5a5a58', 0.6, 0.5) }], 0.1, 3);
  k.wall(m.concrete, 6.7, -1.5, 3.3, -1.5, 2.5, 0.15, [], 0.1, 3);
  k.wall(m.concrete, 3.3, -1.5, 3.3, 1.5, 2.5, 0.15, [], 0.1, 3);
  k.wall(m.concrete, 6.7, 1.5, 6.7, -1.5, 2.5, 0.15, [{ at: 1.5, w: 0.9, y0: 1.1, y1: 1.8, kind: 'window' }], 0.1, 3);
  k.box(m.concrete, 3.8, 0.15, 3.4, 5, 2.7, 0, 0, true, 3);
  k.table(5, -0.8, 0, 1.4, 0.6, 0.8, m.metalDark, 'crate');
  k.interior.push({ x0: 3.3, z0: -1.5, x1: 6.7, z1: 1.5, y1: 2.7 });
}

function shack(k: Kit, m: Materials, r: RNG) {
  const W = 4, D = 3.5, H = 2.4;
  k.floor(m.woodLight, 0, 0, W, D, 0.08, 0.1, 2);
  k.wall(m.woodDark, -W / 2, D / 2, W / 2, D / 2, H, 0.08, [{ at: 1.2, w: 0.85, y0: 0, y1: 1.95, kind: 'door', hinge: 'l' }], 0.08, 2);
  k.wall(m.woodDark, W / 2, -D / 2, -W / 2, -D / 2, H, 0.08, [], 0.08, 2);
  k.wall(m.woodDark, -W / 2, -D / 2, -W / 2, D / 2, H, 0.08, [{ at: 1.7, w: 0.8, y0: 1.0, y1: 1.7, kind: 'window' }], 0.08, 2);
  k.wall(m.woodDark, W / 2, D / 2, W / 2, -D / 2, H, 0.08, [], 0.08, 2);
  k.shedRoof(m.corrugatedRust, 0, 0, W, D, H + 0.08, H + 0.5, 0.3);
  k.shelf(0, -D / 2 + 0.3, 0, 1.6, 3, r.chance(0.5) ? 'garage' : 'shelf', 0.35);
  k.interior.push({ x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2, y1: H + 0.5 });
  if (r.chance(0.5)) k.crates(1.2, 0.5, 1);
}

/** The player's home: house, garage with the car, mailbox, well. */
function homestead(k: Kit, m: Materials, r: RNG) {
  // garage on the left (local -x), house on the right
  const gx = -8, gz = 1;
  const gk = new Kit(m);
  garage(gk, m, r, true);
  mergeKit(k, gk, gx, gz);
  const hk = new Kit(m);
  const fy = house(hk, m, r, 0, 0, true);
  mergeKit(k, hk, 7.5, -2);
  // yard details
  k.interact.push({ kind: 'well', x: 0.5, y: 0, z: 9, r: 1.0 });
  const well = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.8, 20, 1, true), m.concrete);
  ring.position.y = 0.4;
  const top = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.06, 6, 20), m.concrete);
  top.rotation.x = Math.PI / 2;
  top.position.y = 0.8;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.05, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.2;
  const posts = new THREE.Mesh(boxUV(0.1, 1.8, 0.1), m.woodDark);
  posts.position.set(-0.8, 0.9, 0);
  const posts2 = posts.clone();
  posts2.position.x = 0.8;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 8), m.woodLight);
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 1.6;
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.25, 12), m.painted('#6a6a60', 0.6, 0.5));
  bucket.position.set(0, 1.1, 0);
  well.add(ring, top, water, posts, posts2, beam, bucket);
  well.position.set(0.5, 0, 9);
  well.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  k.extra.push(well);
  k.col(0.8, 0.4, 0.8, 0.5, 0.4, 9, 0);
  k.interact.push({ kind: 'mailbox', x: 3, y: 1.1, z: 13.2, r: 0.6 });
  // fence along the back
  for (let i = 0; i < 16; i++) k.box(m.woodDark, 0.1, 1.2, 0.1, -16 + i * 2.1, 0.6, -13, 0, true);
  k.box(m.woodDark, 32, 0.1, 0.05, -0.2, 1.0, -13, 0, false);
  k.box(m.woodDark, 32, 0.1, 0.05, -0.2, 0.5, -13, 0, false);
  // starting loot, placed by hand
  const G = (x: number, y: number, z: number) => [gx + x, y, gz + z] as [number, number, number];
  const gD = 8.4;
  const bench = G(0, 0.96, -gD / 2 + 0.55);
  k.items.push({ id: 'part', x: bench[0] - 0.5, y: bench[1] + 0.12, z: bench[2], state: { partKind: 'battery', cond: 0.9, charge: 0.85 } });
  k.items.push({ id: 'wrench', x: bench[0] + 0.4, y: bench[1] + 0.03, z: bench[2], ry: 1.2 });
  k.items.push({ id: 'flashlight', x: bench[0] + 0.8, y: bench[1] + 0.05, z: bench[2] + 0.1, ry: 0.4 });
  k.items.push({ id: 'jerrycan', x: gx + 3.2, y: 0.4, z: gz + 3.2, ry: 0.3, state: { color: '#b8261c', liquid: 'petrol', amount: 16 } });
  k.items.push({ id: 'oilcan', x: gx - 3.4, y: 1.4, z: gz - 2.8, state: { liquid: 'oil', amount: 3 } });
  k.items.push({ id: 'water', x: 7.5 - 3.2, y: fy + 0.98, z: -2 - 3.5 + 0.45, state: { liquid: 'water', amount: 1.5 } });
  k.items.push({ id: 'water', x: 7.5 - 2.9, y: fy + 0.98, z: -2 - 3.5 + 0.45, state: { liquid: 'water', amount: 1.5 } });
  k.items.push({ id: 'stew', x: 7.5 - 2.3, y: fy + 0.8, z: -2 + 0.8 });
  k.items.push({ id: 'beans', x: 7.5 - 2.7, y: fy + 0.8, z: -2 + 0.9 });
  k.items.push({ id: 'note', x: 7.5 - 2.5, y: fy + 0.79, z: -2 + 0.6, state: { text: 'letter' } });
  k.items.push({ id: 'money', x: 7.5 + 3.8, y: fy + 1.0, z: -2 + 1.8, state: { money: 25 } });
  k.items.push({ id: 'compass', x: 7.5 + 3.8, y: fy + 1.0, z: -2 + 1.5 });
  k.items.push({ id: 'canister', x: gx + 3.2, y: 0.25, z: gz + 2.2, state: { liquid: 'water', amount: 6, color: '#3a6ab0' } });
  k.wrecks.length = 0;
  k.loot = k.loot.filter(() => false);
}

function mergeKit(dst: Kit, src: Kit, ox: number, oz: number) {
  for (const [mat, list] of src.geos) for (const g of list) { g.translate(ox, 0, oz); dst.add(mat, g); }
  for (const c of src.cols) dst.cols.push({ ...c, x: c.x + ox, z: c.z + oz });
  for (const d of src.doors) dst.doors.push({ ...d, x: d.x + ox, z: d.z + oz });
  for (const l of src.loot) dst.loot.push({ ...l, x: l.x + ox, z: l.z + oz });
  for (const l of src.lights) dst.lights.push({ ...l, x: l.x + ox, z: l.z + oz });
  for (const i of src.interact) dst.interact.push({ ...i, x: i.x + ox, z: i.z + oz });
  for (const w of src.wrecks) dst.wrecks.push({ ...w, x: w.x + ox, z: w.z + oz });
  for (const i of src.items) dst.items.push({ ...i, x: i.x + ox, z: i.z + oz });
  for (const e of src.extra) { e.position.x += ox; e.position.z += oz; dst.extra.push(e); }
  for (const r of src.interior) dst.interior.push({ x0: r.x0 + ox, z0: r.z0 + oz, x1: r.x1 + ox, z1: r.z1 + oz, y1: r.y1 });
}
