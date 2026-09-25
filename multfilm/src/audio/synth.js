// Tiny offline synthesizer: chip voices, FM bells, a soft piano, plucked strings,
// drums, noise effects, reverb and delay. Pure JS (runs in Node and the browser).
export const SR = 44100;

export class Bus {
  constructor(n) { this.n = n; this.L = new Float32Array(n); this.R = new Float32Array(n); }
  add(i, v, pan = 0) {
    if (i < 0 || i >= this.n) return;
    const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
    this.L[i] += v * l * 1.414; this.R[i] += v * r * 1.414;
  }
}

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error('bad note ' + n);
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const hz = (m) => 440 * Math.pow(2, (midi(m) - 69) / 12);

let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };

function adsr(t, dur, a, d, s, r) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * (t - a) / d;
  if (t < dur) return s;
  const k = 1 - (t - dur) / r;
  return k > 0 ? s * k : 0;
}

// ---- voices: each writes one note into a bus ----
// o: vel, pan, a,d,s,r (envelope), vib (depth semitones), vibRate, slide (semitones over note), duty, lp (0..1 smoothing)
export function voice(bus, type, t0, dur, note, o = {}) {
  const f0 = hz(note), vel = o.vel === undefined ? 0.3 : o.vel, pan = o.pan || 0;
  const a = o.a ?? 0.005, d = o.d ?? 0.08, s = o.s ?? 0.7, r = o.r ?? 0.08;
  const n = Math.floor((dur + r) * SR), i0 = Math.floor(t0 * SR);
  let ph = 0, lp = 0, ph2 = 0, ph3 = 0;
  const k = o.lp ?? (type === 'square' || type === 'pulse' ? 0.35 : 1);
  const duty = o.duty ?? 0.5;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const e = adsr(t, dur, a, d, s, r);
    if (e <= 0 && t > dur) break;
    let f = f0;
    if (o.slide) f *= Math.pow(2, (o.slide * Math.min(1, t / (o.slideT || dur))) / 12);
    if (o.vib && t > (o.vibDelay ?? 0.12)) f *= Math.pow(2, (o.vib * Math.sin(2 * Math.PI * (o.vibRate || 5.5) * t)) / 12);
    ph += f / SR; ph -= Math.floor(ph);
    let v;
    if (type === 'square' || type === 'pulse') v = ph < duty ? 1 : -1;
    else if (type === 'tri') v = 4 * Math.abs(ph - 0.5) - 1;
    else if (type === 'saw') {
      ph2 += (f * 1.006) / SR; ph2 -= Math.floor(ph2); ph3 += (f * 0.994) / SR; ph3 -= Math.floor(ph3);
      v = ((ph * 2 - 1) + (ph2 * 2 - 1) + (ph3 * 2 - 1)) / 3;
    } else if (type === 'sine') v = Math.sin(2 * Math.PI * ph);
    else v = 0;
    lp += (v - lp) * k;
    bus.add(i0 + j, lp * e * vel, pan);
  }
}

// FM bell / music box / chime
export function bell(bus, t0, note, o = {}) {
  const f = hz(note), vel = o.vel ?? 0.25, pan = o.pan || 0, dec = o.decay ?? 1.6, ratio = o.ratio ?? 3.5, idx = o.index ?? 2.2;
  const n = Math.floor(dec * 3 * SR), i0 = Math.floor(t0 * SR);
  for (let j = 0; j < n; j++) {
    const t = j / SR, e = Math.exp(-t * (3 / dec)) * Math.min(1, t * 400);
    const I = idx * Math.exp(-t * 4 / dec);
    const v = Math.sin(2 * Math.PI * f * t + I * Math.sin(2 * Math.PI * f * ratio * t));
    bus.add(i0 + j, v * e * vel, pan);
  }
}

// soft piano-ish tone (additive with per-harmonic decay)
export function piano(bus, t0, note, o = {}) {
  const f = hz(note), vel = o.vel ?? 0.28, pan = o.pan || 0, len = o.len ?? 2.4;
  const n = Math.floor(len * SR), i0 = Math.floor(t0 * SR);
  const H = [1, 0.5, 0.28, 0.14, 0.08, 0.04];
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    let v = 0;
    for (let h = 0; h < H.length; h++) v += H[h] * Math.sin(2 * Math.PI * f * (h + 1) * (1 + h * 0.0006) * t) * Math.exp(-t * (1.2 + h * 1.1));
    const atk = Math.min(1, t * 250), rel = o.dur !== undefined && t > o.dur ? Math.max(0, 1 - (t - o.dur) / 0.25) : 1;
    bus.add(i0 + j, v * atk * rel * vel * 0.6, pan);
  }
}

// Karplus-Strong plucked string (pizzicato)
export function pluck(bus, t0, note, o = {}) {
  const f = hz(note), vel = o.vel ?? 0.35, pan = o.pan || 0, len = o.len ?? 0.6, damp = o.damp ?? 0.996;
  const P = Math.max(2, Math.round(SR / f)), buf = new Float32Array(P);
  for (let i = 0; i < P; i++) buf[i] = rnd();
  const n = Math.floor(len * SR), i0 = Math.floor(t0 * SR);
  let idx = 0;
  for (let j = 0; j < n; j++) {
    const nx = (idx + 1) % P;
    const v = buf[idx];
    buf[idx] = (buf[idx] + buf[nx]) * 0.5 * damp;
    idx = nx;
    const e = Math.min(1, (len - j / SR) * 20);
    bus.add(i0 + j, v * vel * e, pan);
  }
}

// ---- drums ----
export function kick(bus, t0, vel = 0.7) {
  const i0 = Math.floor(t0 * SR);
  let ph = 0;
  for (let j = 0; j < SR * 0.35; j++) {
    const t = j / SR, f = 42 + 90 * Math.exp(-t * 28);
    ph += f / SR;
    bus.add(i0 + j, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 9) * vel, 0);
  }
}
export function snare(bus, t0, vel = 0.4, pan = 0) {
  const i0 = Math.floor(t0 * SR);
  let hp = 0, prev = 0;
  for (let j = 0; j < SR * 0.25; j++) {
    const t = j / SR, nz = rnd();
    hp = 0.9 * (hp + nz - prev); prev = nz;
    const v = hp * Math.exp(-t * 16) * 0.7 + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 28) * 0.5;
    bus.add(i0 + j, v * vel, pan);
  }
}
export function hat(bus, t0, vel = 0.12, open = false, pan = 0.2) {
  const i0 = Math.floor(t0 * SR);
  let prev = 0, hp = 0;
  const len = open ? 0.3 : 0.05;
  for (let j = 0; j < SR * len; j++) {
    const t = j / SR, nz = rnd();
    hp = 0.6 * (hp + nz - prev); prev = nz;
    bus.add(i0 + j, hp * Math.exp(-t * (open ? 12 : 70)) * vel, pan);
  }
}
export function crash(bus, t0, vel = 0.25, len = 2.2) {
  const i0 = Math.floor(t0 * SR);
  let prev = 0, hp = 0;
  for (let j = 0; j < SR * len; j++) {
    const t = j / SR, nz = rnd();
    hp = 0.8 * (hp + nz - prev); prev = nz;
    bus.add(i0 + j, hp * Math.exp(-t * (3 / len)) * vel * Math.min(1, t * 300), rnd() * 0.3);
  }
}

// ---- noise-based effects ----
// filtered noise with cutoff and gain curves: fc(t01) in 0..1 (one-pole coefficient), g(t01)
export function noiseFx(bus, t0, len, fc, g, pan = 0, vel = 0.5) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(len * SR);
  let lp = 0, lp2 = 0;
  for (let j = 0; j < n; j++) {
    const u = j / n, k = Math.max(0.001, Math.min(1, fc(u)));
    lp += (rnd() - lp) * k; lp2 += (lp - lp2) * k;
    bus.add(i0 + j, lp2 * g(u) * vel * 2, typeof pan === 'function' ? pan(u) : pan);
  }
}
// pitch sweep tone (zips, boings, whistles)
export function sweep(bus, t0, len, f0, f1, o = {}) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(len * SR), vel = o.vel ?? 0.2, type = o.type || 'sine';
  let ph = 0;
  for (let j = 0; j < n; j++) {
    const u = j / n;
    const f = o.exp === false ? f0 + (f1 - f0) * u : f0 * Math.pow(f1 / f0, u);
    ph += (f * (1 + (o.wobble ? 0.03 * Math.sin(u * 60) : 0))) / SR; ph -= Math.floor(ph);
    const v = type === 'square' ? (ph < 0.5 ? 1 : -1) * 0.6 : type === 'tri' ? 4 * Math.abs(ph - 0.5) - 1 : Math.sin(2 * Math.PI * ph);
    const e = (o.env ? o.env(u) : Math.sin(Math.PI * Math.min(1, u * 1.02))) ;
    bus.add(i0 + j, v * e * vel, o.pan || 0);
  }
}

// ---- effects ----
export function reverb(bus, mix = 0.3, room = 0.84, damp = 0.3) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491], aps = [556, 441, 341];
  const out = new Bus(bus.n);
  for (const [ch, off] of [['L', 0], ['R', 23]]) {
    const inp = bus[ch], o = out[ch];
    for (const c of combs) {
      const len = c + off, buf = new Float32Array(len);
      let idx = 0, lp = 0;
      for (let i = 0; i < inp.length; i++) {
        const y = buf[idx];
        lp = y * (1 - damp) + lp * damp;
        buf[idx] = inp[i] + lp * room;
        o[i] += y / combs.length;
        idx = (idx + 1) % len;
      }
    }
    for (const a of aps) {
      const len = a + off, buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < o.length; i++) {
        const b = buf[idx], x = o[i];
        o[i] = -x + b; buf[idx] = x + b * 0.5;
        idx = (idx + 1) % len;
      }
    }
    for (let i = 0; i < o.length; i++) o[i] *= mix;
  }
  return out;
}
export function delay(bus, time = 0.33, fb = 0.35, mix = 0.25) {
  const d = Math.floor(time * SR), out = new Bus(bus.n);
  for (let i = 0; i < bus.n; i++) {
    const l = i >= d ? out.R[i - d] * fb + bus.L[i - d] : 0;
    const r = i >= d ? out.L[i - d] * fb + bus.R[i - d] : 0;
    out.L[i] = l; out.R[i] = r;
  }
  for (let i = 0; i < bus.n; i++) { out.L[i] *= mix; out.R[i] *= mix; }
  return out;
}

// ---- sequencing helpers ----
// melody string: tokens separated by spaces; '.' rest, '-' extends previous note
export function melody(bus, fn, t0, bpm, str, step = 0.5, o = {}) {
  const sb = (60 / bpm) * step, toks = str.trim().split(/\s+/);
  const notes = [];
  toks.forEach((tk, i) => {
    if (tk === '-') { if (notes.length) notes[notes.length - 1].len += 1; }
    else if (tk !== '.') notes.push({ i, n: tk, len: 1 });
  });
  for (const nt of notes) {
    for (const n of nt.n.split('+')) fn(bus, t0 + nt.i * sb, nt.len * sb, n, o);
  }
  return t0 + toks.length * sb;
}
export const V = (type, extra = {}) => (bus, t, dur, n, o) => voice(bus, type, t, dur * (extra.gate ?? 0.9), n, { ...extra, ...o });
export const BELL = (extra = {}) => (bus, t, dur, n, o) => bell(bus, t, n, { ...extra, ...o });
export const PIANO = (extra = {}) => (bus, t, dur, n, o) => piano(bus, t, n, { dur: dur * 1.2, ...extra, ...o });
export const PLUCK = (extra = {}) => (bus, t, dur, n, o) => pluck(bus, t, n, { ...extra, ...o });

export function toWav(L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  return buf;
}
