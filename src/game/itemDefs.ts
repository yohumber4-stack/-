import * as THREE from 'three';
import { Materials } from '../gfx/materials';
import { merge, lathe, extrude, roundRectShape, tube, placed } from '../models/geom';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvas, toTex, weather, FONT, FONT_COND, cachedTex } from '../gfx/canvasTex';
import { PartKind } from '../vehicle/parts';

export type Liquid = 'petrol' | 'diesel' | 'water' | 'oil';
export const LIQUID_NAME: Record<Liquid, [string, string]> = {
  petrol: ['Бензин', 'Petrol'],
  diesel: ['Дизель', 'Diesel'],
  water: ['Вода', 'Water'],
  oil: ['Масло', 'Oil'],
};
export const LIQUID_COLOR: Record<Liquid, number> = { petrol: 0xd8c070, diesel: 0x9a8a40, water: 0x9ec8e8, oil: 0x3a2408 };

export interface ItemDef {
  id: string;
  name: [string, string];
  mass: number;
  shape: 'box' | 'cyl' | 'ball';
  half: [number, number, number]; // box half extents, or [r, halfHeight, r] for cyl
  storable: boolean;
  liquid?: { cap: number; kinds: Liquid[]; rate: number; drinkable?: boolean };
  food?: { hunger: number; thirst: number; energy?: number; health?: number; time: number; sound: 'eat' | 'drink' };
  tool?: 'wrench' | 'melee' | 'gun' | 'light' | 'compass' | 'repair' | 'medkit' | 'note';
  weapon?: { damage: number; range: number; rate: number };
  part?: PartKind;
  money?: boolean;
  ammo?: number;
  material?: 'metal' | 'wood' | 'soft' | 'glass' | 'plastic';
  heavy?: boolean;
  container?: boolean; // crate/box with loot inside
  breakable?: boolean;
  build: (m: Materials, s: ItemState) => THREE.Object3D;
}

export interface ItemState {
  liquid?: Liquid | null;
  amount?: number;
  ammo?: number;
  loaded?: number;
  money?: number;
  color?: string;
  cond?: number;
  part?: any;
  label?: string;
  text?: string;
  loot?: { id: string; state?: ItemState }[];
  used?: number;
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};
const group = (...o: THREE.Object3D[]) => {
  const g = new THREE.Group();
  g.add(...o);
  return g;
};

// ------------------------------------------------------------------ labels
function labelTex(key: string, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 256) {
  return cachedTex('label:' + key, () => {
    const [c, x] = canvas(w, h);
    draw(x, w, h);
    weather(x, w, h, 0.6, key.length * 7);
    return toTex(c);
  });
}
function canLabel(key: string, bg: string, stripe: string, title: string, sub: string, dark = false) {
  return labelTex(key, (x, w, h) => {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.fillStyle = stripe;
    x.fillRect(0, h * 0.12, w, h * 0.1);
    x.fillRect(0, h * 0.78, w, h * 0.1);
    x.fillStyle = dark ? '#1a1a1a' : '#f4efe0';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (const off of [0.25, 0.75]) {
      x.font = `800 ${h * 0.24}px ${FONT_COND}`;
      x.fillText(title, w * off, h * 0.44);
      x.font = `600 ${h * 0.1}px ${FONT}`;
      x.fillText(sub, w * off, h * 0.64);
    }
  });
}

// ------------------------------------------------------------------ builders
function jerrycan(m: Materials, s: ItemState, small = false) {
  const col = s.color ?? '#b8261c';
  const k = small ? 0.78 : 1;
  const W = 0.165 * k, H = 0.46 * k, D = 0.34 * k;
  const body = new RoundedBoxGeometry(W, H, D, 3, 0.022 * k);
  const paint = m.painted(col, 0.35, 0.42);
  const g = group(mesh(body, paint));
  // embossed X on both sides
  for (const sx of [-1, 1]) {
    for (const a of [0.66, -0.66]) {
      const r = new RoundedBoxGeometry(0.012, Math.hypot(H, D) * 0.72, 0.03 * k, 1, 0.005);
      r.rotateX(a);
      r.translate(sx * (W / 2 + 0.002), -0.01 * k, 0);
      g.add(mesh(r, paint));
    }
  }
  // three handles
  for (let i = 0; i < 3; i++) {
    const z = (-0.1 + i * 0.1) * k;
    const hdl = tube([new THREE.Vector3(0, H / 2 - 0.005, z - 0.035 * k), new THREE.Vector3(0, H / 2 + 0.035 * k, z - 0.02 * k), new THREE.Vector3(0, H / 2 + 0.035 * k, z + 0.02 * k), new THREE.Vector3(0, H / 2 - 0.005, z + 0.035 * k)], () => 0.009 * k, 6);
    g.add(mesh(hdl, paint));
  }
  // spout + cap
  const spout = new THREE.CylinderGeometry(0.022 * k, 0.026 * k, 0.05 * k, 14);
  spout.rotateX(-0.6);
  spout.translate(0, H / 2 + 0.01, D / 2 - 0.045 * k);
  g.add(mesh(spout, m.metalDark));
  const cap = new THREE.CylinderGeometry(0.027 * k, 0.027 * k, 0.03 * k, 14);
  cap.rotateX(-0.6);
  cap.translate(0, H / 2 + 0.03 * k, D / 2 - 0.03 * k);
  g.add(mesh(cap, m.painted(col, 0.5, 0.5)));
  // label plate
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(D * 0.34, H * 0.2), new THREE.MeshStandardMaterial({ map: canLabel('jc' + (s.liquid ?? ''), '#e8dfc8', '#222', s.liquid === 'diesel' ? 'DIESEL' : s.liquid === 'water' ? 'WATER' : 'BENZIN', '20 L'), roughness: 0.7 }));
  lbl.rotation.y = Math.PI / 2;
  lbl.position.set(W / 2 + 0.005, H * 0.28, -D * 0.2);
  g.add(lbl);
  return g;
}

/** Moulded HDPE water canister: grip arch, screw cap, vent, side ribs and a sticker. Fits 0.26×0.34×0.18. */
function waterCanister(m: Materials, s: ItemState) {
  const plastic = m.flat(s.color ?? '#7d9a8c', 0.58);
  const dark = m.flat('#2c3430', 0.5);
  const body = new RoundedBoxGeometry(0.26, 0.27, 0.18, 4, 0.04);
  body.translate(0, -0.035, 0);
  const g = group(mesh(body, plastic));
  const shoulder = new RoundedBoxGeometry(0.22, 0.06, 0.15, 3, 0.025);
  shoulder.translate(0, 0.1, 0);
  g.add(mesh(shoulder, plastic));
  // carry handle moulded into the top
  const arch = tube([new THREE.Vector3(-0.1, 0.11, 0), new THREE.Vector3(-0.085, 0.16, 0), new THREE.Vector3(-0.02, 0.165, 0), new THREE.Vector3(0.035, 0.16, 0), new THREE.Vector3(0.045, 0.12, 0)], () => 0.014, 8);
  g.add(mesh(arch, plastic));
  // screw cap with knurled rim + small vent plug
  const neck = new THREE.CylinderGeometry(0.022, 0.024, 0.03, 16);
  neck.translate(0.085, 0.14, 0);
  g.add(mesh(neck, plastic));
  const cap = new THREE.CylinderGeometry(0.027, 0.027, 0.026, 20);
  cap.translate(0.085, 0.16, 0);
  g.add(mesh(cap, m.flat('#c8b24a', 0.45)));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const k = new THREE.BoxGeometry(0.004, 0.024, 0.004);
    k.translate(0.085 + Math.cos(a) * 0.027, 0.16, Math.sin(a) * 0.027);
    g.add(mesh(k, m.flat('#b09c3e', 0.5)));
  }
  const vent = new THREE.CylinderGeometry(0.009, 0.009, 0.012, 10);
  vent.translate(-0.095, 0.135, 0.045);
  g.add(mesh(vent, dark));
  // stiffening ribs on both broad faces
  for (const sz of [-1, 1]) for (const y of [-0.12, -0.06, 0.0]) {
    const rib = new RoundedBoxGeometry(0.2, 0.012, 0.008, 1, 0.003);
    rib.translate(0, y, sz * 0.09);
    g.add(mesh(rib, plastic));
  }
  // canLabel repeats its artwork twice (for cans); a flat sticker shows only the left copy
  const sticker = new THREE.PlaneGeometry(0.1, 0.1);
  const suv = sticker.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < suv.count; i++) suv.setX(i, suv.getX(i) * 0.5);
  const lbl = new THREE.Mesh(sticker, new THREE.MeshStandardMaterial({ map: canLabel('water_can', '#e9e4d2', '#2a6aa8', 'ВОДА', '10 Л', true), roughness: 0.8 }));
  lbl.position.set(0, 0.035, 0.0925);
  g.add(lbl);
  return g;
}

function oilCan(m: Materials) {
  const body = new RoundedBoxGeometry(0.18, 0.26, 0.09, 2, 0.012);
  const mat = new THREE.MeshStandardMaterial({ map: canLabel('oil', '#1f3a78', '#e0b020', 'MOTOR', 'OIL · 4 L'), roughness: 0.45, metalness: 0.4 });
  const g = group(mesh(body, mat));
  const neck = new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12);
  neck.translate(0.05, 0.145, 0);
  const cap = new THREE.CylinderGeometry(0.024, 0.024, 0.025, 12);
  cap.translate(0.05, 0.17, 0);
  g.add(mesh(neck, m.metalBare), mesh(cap, m.flat('#d8b020', 0.4)));
  const handle = tube([new THREE.Vector3(-0.07, 0.13, 0), new THREE.Vector3(-0.06, 0.18, 0), new THREE.Vector3(0.0, 0.18, 0), new THREE.Vector3(0.01, 0.13, 0)], () => 0.008, 6);
  g.add(mesh(handle, m.flat('#1f3a78', 0.5)));
  return g;
}

function bottle(m: Materials, s: ItemState) {
  const prof: [number, number][] = [[0.001, -0.15], [0.038, -0.15], [0.042, -0.14], [0.042, 0.05], [0.036, 0.1], [0.016, 0.13], [0.014, 0.15], [0.001, 0.15]];
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8f4, roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false });
  const g = group(mesh(lathe(prof, 20), glass));
  const fill = (s.amount ?? 0) / 1.5;
  if (fill > 0.02) {
    const h = 0.26 * fill;
    const wat = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, h, 16), new THREE.MeshStandardMaterial({ color: 0x8ab8d8, transparent: true, opacity: 0.55, roughness: 0.1 }));
    wat.position.y = -0.145 + h / 2;
    g.add(wat);
  }
  const cap = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12);
  cap.translate(0, 0.16, 0);
  g.add(mesh(cap, m.flat('#2a5ab0', 0.4)));
  const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.0425, 0.0425, 0.07, 20, 1, true), new THREE.MeshStandardMaterial({ map: canLabel('water', '#3a78c8', '#fff', 'AQUA', '1.5 L'), roughness: 0.5 }));
  g.add(lbl);
  return g;
}

function tinCan(m: Materials, key: string, bg: string, stripe: string, title: string, sub: string, r = 0.042, h = 0.11) {
  const body = new THREE.CylinderGeometry(r, r, h, 20, 1, true);
  const lab = new THREE.MeshStandardMaterial({ map: canLabel(key, bg, stripe, title, sub), roughness: 0.5, metalness: 0.2 });
  const g = group(mesh(body, lab));
  const lidG = new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.006, 20);
  const top = mesh(lidG, m.metalBare);
  top.position.y = h / 2;
  const bot = mesh(lidG, m.metalBare);
  bot.position.y = -h / 2;
  g.add(top, bot);
  return g;
}

function medkit(m: Materials) {
  const body = new RoundedBoxGeometry(0.26, 0.17, 0.09, 2, 0.015);
  const g = group(mesh(body, m.flat('#e8e4dc', 0.5)));
  for (const r of [0, Math.PI / 2]) {
    const c = new THREE.BoxGeometry(0.06, 0.018, 0.002);
    c.rotateZ(r);
    c.translate(0, 0, 0.046);
    g.add(mesh(c, m.flat('#c01e1e', 0.5)));
  }
  const h = tube([new THREE.Vector3(-0.05, 0.085, 0), new THREE.Vector3(-0.04, 0.115, 0), new THREE.Vector3(0.04, 0.115, 0), new THREE.Vector3(0.05, 0.085, 0)], () => 0.007, 6);
  g.add(mesh(h, m.flat('#333', 0.5)));
  return g;
}

function wrench(m: Materials) {
  const handle = new RoundedBoxGeometry(0.022, 0.26, 0.008, 2, 0.003);
  const g = group(mesh(handle, m.chrome));
  for (const [y, s] of [[0.14, 1], [-0.14, 0.8]] as [number, number][]) {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 0.022 * s, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.moveTo(-0.008 * s, 0.03 * s);
    hole.lineTo(-0.008 * s, -0.004 * s);
    hole.lineTo(0.008 * s, -0.004 * s);
    hole.lineTo(0.008 * s, 0.03 * s);
    sh.holes.push(hole);
    const head = extrude(sh, 0.009, 0.002, 1, 12);
    head.translate(0, y, 0);
    if (y < 0) head.rotateZ(Math.PI);
    g.add(mesh(head, m.chrome));
  }
  return g;
}

function crowbar(m: Materials) {
  const pts = [new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0.01, 0.3, 0), new THREE.Vector3(0.045, 0.32, 0), new THREE.Vector3(0.07, 0.3, 0)];
  return group(mesh(tube(pts, () => 0.011, 6), m.painted('#8a1e16', 0.6, 0.5)));
}
function pipe(m: Materials) {
  const g = new THREE.CylinderGeometry(0.018, 0.018, 0.62, 10);
  return group(mesh(g, m.rust));
}

function revolver(m: Materials) {
  const steel = m.flat('#2a2b2e', 0.32, 0.9);
  const g = new THREE.Group();
  const barrel = new THREE.CylinderGeometry(0.009, 0.009, 0.16, 12);
  barrel.rotateX(Math.PI / 2);
  barrel.translate(0, 0.03, -0.1);
  const rib = new THREE.BoxGeometry(0.008, 0.008, 0.16);
  rib.translate(0, 0.041, -0.1);
  const cyl = new THREE.CylinderGeometry(0.02, 0.02, 0.045, 12);
  cyl.rotateX(Math.PI / 2);
  cyl.translate(0, 0.022, 0.0);
  const frame = new RoundedBoxGeometry(0.018, 0.045, 0.09, 2, 0.004);
  frame.translate(0, 0.02, 0.02);
  const grip = new RoundedBoxGeometry(0.024, 0.09, 0.035, 2, 0.008);
  grip.rotateX(-0.3);
  grip.translate(0, -0.03, 0.065);
  const guard = new THREE.TorusGeometry(0.014, 0.003, 5, 12, Math.PI);
  guard.rotateY(Math.PI / 2);
  guard.rotateX(Math.PI);
  guard.translate(0, -0.004, 0.02);
  const hammer = new THREE.BoxGeometry(0.006, 0.014, 0.012);
  hammer.translate(0, 0.048, 0.055);
  g.add(mesh(merge([barrel, rib, cyl, frame, guard, hammer].map((q) => q.toNonIndexed())), steel));
  g.add(mesh(grip, m.woodLight));
  return g;
}

function ammoBox(m: Materials) {
  const b = new RoundedBoxGeometry(0.1, 0.05, 0.07, 1, 0.004);
  return group(mesh(b, new THREE.MeshStandardMaterial({ map: canLabel('ammo', '#b88a30', '#5a1a0a', '.38', '36 PATRONOV', true), roughness: 0.8 })));
}

function flashlight(m: Materials) {
  const body = lathe([[0.001, -0.1], [0.016, -0.1], [0.016, 0.04], [0.024, 0.07], [0.024, 0.09], [0.001, 0.09]], 16);
  body.rotateX(Math.PI / 2);
  const g = group(mesh(body, m.flat('#2e3a2e', 0.5, 0.3)));
  const lens = new THREE.CircleGeometry(0.021, 16);
  lens.rotateX(Math.PI);
  lens.translate(0, 0, -0.0905);
  g.add(mesh(lens, m.emissive('#fff6d0', 0.6)));
  return g;
}

function banknotes(m: Materials) {
  const g = new THREE.Group();
  const tex = labelTex('money', (x, w, h) => {
    x.fillStyle = '#8fae84';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3a5a3a';
    x.lineWidth = 6;
    x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#2a4a2a';
    x.font = `800 ${h * 0.4}px ${FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('10', w * 0.2, h * 0.5);
    x.fillText('10', w * 0.8, h * 0.5);
    x.beginPath();
    x.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
    x.stroke();
  }, 256, 128);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.BoxGeometry(0.15, 0.0015, 0.07);
    const o = mesh(b, mat);
    o.position.y = i * 0.0016;
    o.rotation.y = (i - 1.5) * 0.08;
    g.add(o);
  }
  const band = new THREE.BoxGeometry(0.02, 0.008, 0.072);
  g.add(mesh(band, m.flat('#c8b890', 0.9)));
  return g;
}

function compass(m: Materials) {
  const body = lathe([[0.001, 0], [0.035, 0], [0.038, 0.004], [0.038, 0.014], [0.034, 0.016], [0.001, 0.016]], 20);
  const g = group(mesh(body, m.flat('#9a7a3a', 0.35, 0.8)));
  const face = new THREE.CircleGeometry(0.031, 20);
  face.rotateX(-Math.PI / 2);
  face.translate(0, 0.0165, 0);
  const tex = labelTex('compass', (x, w, h) => {
    x.fillStyle = '#efe8d8';
    x.fillRect(0, 0, w, h);
    x.translate(w / 2, h / 2);
    x.fillStyle = '#222';
    x.font = `700 ${w * 0.12}px ${FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    ['N', 'E', 'S', 'W'].forEach((l, i) => { x.save(); x.rotate((i * Math.PI) / 2); x.fillText(l, 0, -w * 0.36); x.restore(); });
    x.fillStyle = '#c02020';
    x.beginPath(); x.moveTo(0, -w * 0.28); x.lineTo(w * 0.04, 0); x.lineTo(-w * 0.04, 0); x.fill();
    x.fillStyle = '#333';
    x.beginPath(); x.moveTo(0, w * 0.28); x.lineTo(w * 0.04, 0); x.lineTo(-w * 0.04, 0); x.fill();
  }, 256, 256);
  g.add(mesh(face, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })));
  return g;
}

function toolbox(m: Materials) {
  const b = new RoundedBoxGeometry(0.36, 0.16, 0.18, 2, 0.01);
  const g = group(mesh(b, m.painted('#a82a1c', 0.4, 0.45)));
  const h = tube([new THREE.Vector3(-0.08, 0.08, 0), new THREE.Vector3(-0.07, 0.12, 0), new THREE.Vector3(0.07, 0.12, 0), new THREE.Vector3(0.08, 0.08, 0)], () => 0.008, 6);
  g.add(mesh(h, m.chrome));
  return g;
}
function tapeRoll(m: Materials) {
  const g = new THREE.TorusGeometry(0.04, 0.018, 10, 20);
  g.scale(1, 1, 1.5);
  return group(mesh(g, m.flat('#8a8e92', 0.6, 0.2)));
}
function crate(m: Materials, s: ItemState) {
  const g = new THREE.Group();
  const S = 0.55;
  const plank = m.woodRaw;
  for (let i = 0; i < 3; i++)
    for (const [ax, sgn] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]] as [string, number][]) {
      const b = new THREE.BoxGeometry(ax === 'x' ? 0.02 : S, S / 3 - 0.012, ax === 'x' ? S : 0.02);
      const o = mesh(b, plank);
      o.position.set(ax === 'x' ? sgn * (S / 2 - 0.01) : 0, -S / 2 + S / 6 + i * (S / 3), ax === 'z' ? sgn * (S / 2 - 0.01) : 0);
      g.add(o);
    }
  for (const y of [-1, 1]) {
    const lid = mesh(new THREE.BoxGeometry(S, 0.02, S), plank);
    lid.position.y = y * (S / 2 - 0.01);
    g.add(lid);
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.05, S, 0.05), m.woodLight);
    post.position.set(x * (S / 2 - 0.02), 0, z * (S / 2 - 0.02));
    g.add(post);
  }
  return g;
}
function barrel(m: Materials, s: ItemState) {
  const prof: [number, number][] = [[0.001, -0.44], [0.29, -0.44], [0.3, -0.42], [0.3, -0.3], [0.305, -0.29], [0.3, -0.28], [0.3, 0.28], [0.305, 0.29], [0.3, 0.3], [0.3, 0.42], [0.29, 0.44], [0.001, 0.44]];
  const col = s.color ?? '#3a5a8a';
  const g = group(mesh(lathe(prof, 28), m.painted(col, 0.7, 0.5)));
  const bung = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10);
  bung.translate(0.18, 0.445, 0);
  g.add(mesh(bung, m.metalDark));
  return g;
}
function box(m: Materials) {
  const b = new THREE.BoxGeometry(0.4, 0.3, 0.3);
  return group(mesh(b, m.cardboard));
}
function note(m: Materials, s: ItemState) {
  const p = new THREE.PlaneGeometry(0.15, 0.2);
  p.rotateX(-Math.PI / 2);
  const o = mesh(p, new THREE.MeshStandardMaterial({ color: 0xefe6cf, roughness: 0.95, side: THREE.DoubleSide }));
  return group(o);
}
function sodaCan(m: Materials) {
  return tinCan(m, 'soda', '#c8201a', '#fff', 'COLA', '0.33', 0.033, 0.115);
}
function chocolate(m: Materials) {
  const b = new THREE.BoxGeometry(0.16, 0.012, 0.07);
  return group(mesh(b, new THREE.MeshStandardMaterial({ map: canLabel('choc', '#5a2a14', '#d8b060', 'SHOKOLAD', 'ALYONKA'), roughness: 0.6 })));
}
function chips(m: Materials) {
  const g = new THREE.SphereGeometry(0.1, 12, 8);
  g.scale(1, 1.3, 0.35);
  return group(mesh(g, new THREE.MeshStandardMaterial({ map: canLabel('chips', '#e0a020', '#c02020', 'CHIPS', 'KARTOFEL'), roughness: 0.3, metalness: 0.4 })));
}
function bandage(m: Materials) {
  const g = new THREE.CylinderGeometry(0.03, 0.03, 0.06, 14);
  g.rotateZ(Math.PI / 2);
  return group(mesh(g, m.flat('#f0ece0', 0.9)));
}
function thermos(m: Materials) {
  const g = lathe([[0.001, -0.14], [0.04, -0.14], [0.04, 0.1], [0.032, 0.12], [0.032, 0.16], [0.001, 0.16]], 16);
  return group(mesh(g, m.painted('#2a5a3a', 0.3, 0.4)));
}
function spray(m: Materials) {
  const g = lathe([[0.001, -0.1], [0.032, -0.1], [0.032, 0.07], [0.02, 0.1], [0.008, 0.11], [0.001, 0.11]], 16);
  return group(mesh(g, m.flat('#30c030', 0.3, 0.3)));
}

export const ITEMS: Record<string, ItemDef> = {
  jerrycan: { id: 'jerrycan', name: ['Канистра 20 л', 'Jerry can 20 L'], mass: 4, shape: 'box', half: [0.085, 0.24, 0.17], storable: false, material: 'metal', liquid: { cap: 20, kinds: ['petrol', 'diesel', 'water', 'oil'], rate: 1.4 }, build: (m, s) => jerrycan(m, s) },
  jerrycan_s: { id: 'jerrycan_s', name: ['Канистра 10 л', 'Jerry can 10 L'], mass: 2.5, shape: 'box', half: [0.066, 0.19, 0.135], storable: false, material: 'metal', liquid: { cap: 10, kinds: ['petrol', 'diesel', 'water', 'oil'], rate: 1.1 }, build: (m, s) => jerrycan(m, s, true) },
  oilcan: { id: 'oilcan', name: ['Моторное масло', 'Motor oil'], mass: 1, shape: 'box', half: [0.09, 0.13, 0.045], storable: true, material: 'metal', liquid: { cap: 4, kinds: ['oil'], rate: 0.45 }, build: (m) => oilCan(m) },
  water: { id: 'water', name: ['Бутылка воды', 'Water bottle'], mass: 0.3, shape: 'cyl', half: [0.042, 0.15, 0.042], storable: true, material: 'plastic', liquid: { cap: 1.5, kinds: ['water'], rate: 0.35, drinkable: true }, build: (m, s) => bottle(m, s) },
  canister: { id: 'canister', name: ['Бидон для воды', 'Water canister'], mass: 1.2, shape: 'box', half: [0.13, 0.17, 0.09], storable: false, material: 'plastic', liquid: { cap: 10, kinds: ['water', 'petrol', 'diesel', 'oil'], rate: 1.0, drinkable: true }, build: (m, s) => waterCanister(m, s) },
  stew: { id: 'stew', name: ['Тушёнка', 'Canned stew'], mass: 0.4, shape: 'cyl', half: [0.042, 0.055, 0.042], storable: true, material: 'metal', food: { hunger: 34, thirst: -4, time: 1.4, sound: 'eat' }, build: (m) => tinCan(m, 'stew', '#b8a060', '#8a1a14', 'ТУШЁНКА', 'ГОВЯЖЬЯ') },
  beans: { id: 'beans', name: ['Фасоль', 'Beans'], mass: 0.4, shape: 'cyl', half: [0.042, 0.055, 0.042], storable: true, material: 'metal', food: { hunger: 26, thirst: -2, time: 1.2, sound: 'eat' }, build: (m) => tinCan(m, 'beans', '#6a2a1a', '#e8c040', 'ФАСОЛЬ', 'В ТОМАТЕ') },
  sprats: { id: 'sprats', name: ['Шпроты', 'Sprats'], mass: 0.25, shape: 'cyl', half: [0.055, 0.015, 0.055], storable: true, material: 'metal', food: { hunger: 20, thirst: -6, time: 1.2, sound: 'eat' }, build: (m) => { const o = tinCan(m, 'sprats', '#d8b040', '#1a2a5a', 'ШПРОТЫ', 'В МАСЛЕ', 0.055, 0.028); return o; } },
  soda: { id: 'soda', name: ['Газировка', 'Soda'], mass: 0.35, shape: 'cyl', half: [0.033, 0.058, 0.033], storable: true, material: 'metal', food: { hunger: 4, thirst: 22, energy: 6, time: 1.0, sound: 'drink' }, build: (m) => sodaCan(m) },
  chocolate: { id: 'chocolate', name: ['Шоколад', 'Chocolate'], mass: 0.1, shape: 'box', half: [0.08, 0.006, 0.035], storable: true, material: 'soft', food: { hunger: 14, thirst: -3, energy: 8, time: 0.8, sound: 'eat' }, build: (m) => chocolate(m) },
  chips: { id: 'chips', name: ['Чипсы', 'Crisps'], mass: 0.1, shape: 'box', half: [0.1, 0.13, 0.035], storable: true, material: 'soft', food: { hunger: 12, thirst: -8, time: 1.0, sound: 'eat' }, build: (m) => chips(m) },
  coffee: { id: 'coffee', name: ['Термос с кофе', 'Coffee thermos'], mass: 0.9, shape: 'cyl', half: [0.04, 0.15, 0.04], storable: true, material: 'metal', food: { hunger: 2, thirst: 14, energy: 35, time: 1.4, sound: 'drink' }, build: (m) => thermos(m) },
  medkit: { id: 'medkit', name: ['Аптечка', 'First aid kit'], mass: 0.8, shape: 'box', half: [0.13, 0.085, 0.045], storable: true, material: 'plastic', tool: 'medkit', food: { hunger: 0, thirst: 0, health: 55, time: 2.2, sound: 'eat' }, build: (m) => medkit(m) },
  bandage: { id: 'bandage', name: ['Бинт', 'Bandage'], mass: 0.05, shape: 'cyl', half: [0.03, 0.03, 0.03], storable: true, material: 'soft', tool: 'medkit', food: { hunger: 0, thirst: 0, health: 20, time: 1.5, sound: 'eat' }, build: (m) => bandage(m) },
  wrench: { id: 'wrench', name: ['Гаечный ключ', 'Wrench'], mass: 0.6, shape: 'box', half: [0.022, 0.16, 0.01], storable: true, material: 'metal', tool: 'wrench', weapon: { damage: 22, range: 1.8, rate: 0.55 }, build: (m) => wrench(m) },
  crowbar: { id: 'crowbar', name: ['Монтировка', 'Crowbar'], mass: 1.6, shape: 'box', half: [0.04, 0.31, 0.02], storable: false, material: 'metal', tool: 'melee', weapon: { damage: 38, range: 2.0, rate: 0.8 }, build: (m) => crowbar(m) },
  pipe: { id: 'pipe', name: ['Труба', 'Iron pipe'], mass: 1.4, shape: 'cyl', half: [0.02, 0.31, 0.02], storable: false, material: 'metal', tool: 'melee', weapon: { damage: 30, range: 2.0, rate: 0.75 }, build: (m) => pipe(m) },
  revolver: { id: 'revolver', name: ['Револьвер', 'Revolver'], mass: 1.0, shape: 'box', half: [0.015, 0.05, 0.12], storable: true, material: 'metal', tool: 'gun', weapon: { damage: 90, range: 120, rate: 0.45 }, build: (m) => revolver(m) },
  ammo: { id: 'ammo', name: ['Патроны .38', '.38 ammo'], mass: 0.4, shape: 'box', half: [0.05, 0.025, 0.035], storable: true, material: 'soft', ammo: 12, build: (m) => ammoBox(m) },
  flashlight: { id: 'flashlight', name: ['Фонарик', 'Flashlight'], mass: 0.4, shape: 'cyl', half: [0.024, 0.1, 0.024], storable: true, material: 'metal', tool: 'light', build: (m) => flashlight(m) },
  money: { id: 'money', name: ['Деньги', 'Money'], mass: 0.02, shape: 'box', half: [0.075, 0.006, 0.036], storable: true, material: 'soft', money: true, build: (m) => banknotes(m) },
  compass: { id: 'compass', name: ['Компас', 'Compass'], mass: 0.2, shape: 'cyl', half: [0.038, 0.009, 0.038], storable: true, material: 'metal', tool: 'compass', build: (m) => compass(m) },
  repairkit: { id: 'repairkit', name: ['Ремкомплект', 'Repair kit'], mass: 3, shape: 'box', half: [0.18, 0.08, 0.09], storable: false, material: 'metal', tool: 'repair', build: (m) => toolbox(m) },
  tape: { id: 'tape', name: ['Изолента', 'Duct tape'], mass: 0.2, shape: 'cyl', half: [0.058, 0.03, 0.058], storable: true, material: 'soft', tool: 'repair', build: (m) => tapeRoll(m) },
  spray: { id: 'spray', name: ['Баллончик краски', 'Spray paint'], mass: 0.4, shape: 'cyl', half: [0.032, 0.105, 0.032], storable: true, material: 'metal', build: (m) => spray(m) },
  crate: { id: 'crate', name: ['Деревянный ящик', 'Wooden crate'], mass: 14, shape: 'box', half: [0.275, 0.275, 0.275], storable: false, material: 'wood', container: true, breakable: true, heavy: true, build: (m, s) => crate(m, s) },
  box: { id: 'box', name: ['Коробка', 'Cardboard box'], mass: 2, shape: 'box', half: [0.2, 0.15, 0.15], storable: false, material: 'soft', container: true, breakable: true, build: (m) => box(m) },
  barrel: { id: 'barrel', name: ['Бочка', 'Barrel'], mass: 30, shape: 'cyl', half: [0.3, 0.44, 0.3], storable: false, material: 'metal', heavy: true, liquid: { cap: 120, kinds: ['petrol', 'diesel', 'water', 'oil'], rate: 1.6 }, build: (m, s) => barrel(m, s) },
  note: { id: 'note', name: ['Записка', 'Note'], mass: 0.01, shape: 'box', half: [0.075, 0.003, 0.1], storable: true, material: 'soft', tool: 'note', build: (m, s) => note(m, s) },
  part: { id: 'part', name: ['Деталь', 'Car part'], mass: 10, shape: 'box', half: [0.2, 0.2, 0.2], storable: false, material: 'metal', build: () => new THREE.Group() },
};

export const LOOT_TABLES: Record<string, [string, number][]> = {
  shelf: [['stew', 10], ['beans', 8], ['sprats', 6], ['water', 12], ['soda', 7], ['chocolate', 6], ['chips', 5], ['oilcan', 6], ['medkit', 3], ['bandage', 5], ['money', 7], ['ammo', 3], ['flashlight', 3], ['tape', 4], ['coffee', 3], ['spray', 2]],
  garage: [['oilcan', 10], ['jerrycan', 6], ['jerrycan_s', 5], ['wrench', 3], ['crowbar', 3], ['pipe', 2], ['repairkit', 4], ['tape', 6], ['canister', 4], ['money', 4], ['flashlight', 3], ['water', 4]],
  kitchen: [['stew', 10], ['beans', 10], ['sprats', 8], ['water', 12], ['soda', 6], ['chocolate', 5], ['coffee', 5], ['chips', 4], ['money', 4]],
  crate: [['stew', 6], ['beans', 5], ['water', 8], ['money', 6], ['ammo', 4], ['medkit', 3], ['bandage', 5], ['oilcan', 4], ['flashlight', 2], ['compass', 2], ['soda', 4], ['revolver', 1], ['tape', 3]],
  military: [['ammo', 10], ['revolver', 3], ['medkit', 6], ['bandage', 6], ['water', 6], ['stew', 6], ['compass', 3], ['flashlight', 3], ['money', 3]],
  station: [['oilcan', 10], ['soda', 8], ['chips', 7], ['chocolate', 7], ['water', 8], ['money', 5], ['jerrycan_s', 3], ['tape', 3], ['compass', 1]],
};
