import * as THREE from 'three';

type Ctx = AudioContext;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Small synth instrument set shared by the radio stations and the menu theme. */
class Instruments {
  private ks = new Map<number, AudioBuffer>();
  constructor(private ctx: Ctx, private noise: AudioBuffer) {}
  private g(dest: AudioNode, t: number, a: number, d: number, peak: number, sustain = 0, r = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (sustain > 0) {
      g.gain.setTargetAtTime(peak * 0.7, t + a, d * 0.3);
      g.gain.setValueAtTime(peak * 0.7, t + a + sustain);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + sustain + r);
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest);
    return g;
  }
  private osc(type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.1);
    return o;
  }
  pad(dest: AudioNode, t: number, notes: number[], dur: number, vol = 0.05, cutoff = 1400) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff * 0.6, t);
    f.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(cutoff * 0.7, t + dur);
    const g = this.g(dest, t, dur * 0.25, dur, vol, dur * 0.55, dur * 0.35);
    f.connect(g);
    for (const n of notes) for (const dt of [-7, 7]) this.osc('sawtooth', mtof(n), t, dur * 1.2, f, dt);
  }
  arp(dest: AudioNode, t: number, n: number, dur: number, vol = 0.04, type: OscillatorType = 'square') {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = this.g(dest, t, 0.005, dur, vol);
    f.connect(g);
    this.osc(type, mtof(n), t, dur, f);
  }
  bass(dest: AudioNode, t: number, n: number, dur: number, vol = 0.18) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = this.g(dest, t, 0.01, dur, vol);
    f.connect(g);
    this.osc('triangle', mtof(n), t, dur, f);
    this.osc('sine', mtof(n - 12), t, dur, g);
  }
  upright(dest: AudioNode, t: number, n: number, dur: number, vol = 0.22) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    const g = this.g(dest, t, 0.008, dur * 1.2, vol);
    f.connect(g);
    this.osc('triangle', mtof(n), t, dur * 1.2, f);
  }
  epiano(dest: AudioNode, t: number, notes: number[], dur: number, vol = 0.05) {
    for (const n of notes) {
      const car = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const mg = this.ctx.createGain();
      car.frequency.value = mtof(n);
      mod.frequency.value = mtof(n) * 1;
      mg.gain.setValueAtTime(mtof(n) * 2.2, t);
      mg.gain.exponentialRampToValueAtTime(mtof(n) * 0.2, t + 0.6);
      mod.connect(mg).connect(car.frequency);
      const g = this.g(dest, t, 0.004, dur, vol);
      car.connect(g);
      car.start(t); mod.start(t);
      car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
    }
  }
  /** Karplus-Strong plucked string rendered once per pitch. */
  pluck(dest: AudioNode, t: number, n: number, vol = 0.25, rate = 1) {
    let b = this.ks.get(n);
    if (!b) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 2.4);
      b = this.ctx.createBuffer(1, len, sr);
      const d = b.getChannelData(0);
      const N = Math.max(2, Math.round(sr / mtof(n)));
      const ring = new Float32Array(N);
      for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin((i / N) * Math.PI));
      let idx = 0, prev = 0;
      const damp = 0.996 - Math.max(0, (n - 60) * 0.0004);
      for (let i = 0; i < len; i++) {
        const cur = ring[idx];
        const nx = ring[(idx + 1) % N];
        const v = (cur + nx) * 0.5 * damp;
        ring[idx] = v;
        d[i] = cur * 0.8 + prev * 0.2;
        prev = cur;
        idx = (idx + 1) % N;
      }
      this.ks.set(n, b);
    }
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(dest);
    s.start(t);
    s.stop(t + 2.4);
  }
  private noiseHit(dest: AudioNode, t: number, type: BiquadFilterType, f: number, q: number, d: number, vol: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const fl = this.ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = this.g(dest, t, 0.002, d, vol);
    s.connect(fl).connect(g);
    s.start(t, Math.random());
    s.stop(t + d + 0.05);
  }
  kick(dest: AudioNode, t: number, vol = 0.5) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.g(dest, t, 0.002, 0.28, vol);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.35);
  }
  snare(dest: AudioNode, t: number, vol = 0.18) {
    this.noiseHit(dest, t, 'bandpass', 1900, 0.8, 0.16, vol);
    const o = this.ctx.createOscillator();
    o.frequency.value = 190;
    const g = this.g(dest, t, 0.002, 0.08, vol * 0.6);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.12);
  }
  hat(dest: AudioNode, t: number, vol = 0.06, open = false) {
    this.noiseHit(dest, t, 'highpass', 7500, 0.5, open ? 0.2 : 0.035, vol);
  }
  brush(dest: AudioNode, t: number, vol = 0.08) {
    this.noiseHit(dest, t, 'bandpass', 3500, 0.6, 0.18, vol);
  }
  ride(dest: AudioNode, t: number, vol = 0.05) {
    this.noiseHit(dest, t, 'bandpass', 6000, 3, 0.5, vol);
    for (const r of [1, 1.47, 2.11]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = 3200 * r;
      const g = this.g(dest, t, 0.001, 0.4, vol * 0.08);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.5);
    }
  }
  beep(dest: AudioNode, t: number, f: number, d: number, vol = 0.1) {
    const g = this.g(dest, t, 0.005, d, vol);
    this.osc('sine', f, t, d, g);
  }
  voice(dest: AudioNode, t: number, pitch: number, d: number, vol = 0.12) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.linearRampToValueAtTime(pitch * 0.92, t + d);
    const f1 = this.ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 650 + Math.random() * 300; f1.Q.value = 8;
    const f2 = this.ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100 + Math.random() * 900; f2.Q.value = 10;
    const g = this.g(dest, t, 0.02, d, vol);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    o.start(t);
    o.stop(t + d + 0.1);
  }
}

type BarFn = (inst: Instruments, dest: AudioNode, t: number, bar: number, beat: number, rnd: () => number) => void;
interface Station { freq: number; name: string; bpm: number; beats: number; bar: BarFn }

const CH = {
  Am: [57, 60, 64], F: [53, 57, 60], C: [48, 52, 55], G: [55, 59, 62], Dm: [50, 53, 57], E: [52, 56, 59], Em: [52, 55, 59], D: [50, 54, 57],
};

function stations(): Station[] {
  return [
    {
      freq: 89.3, name: 'Пустыня FM', bpm: 104, beats: 4,
      bar: (I, d, t, bar, beat, R) => {
        const sec = Math.floor(bar / 8) % 3;
        const prog = sec === 1 ? [CH.Am, CH.F, CH.Dm, CH.E] : [CH.Am, CH.F, CH.C, CH.G];
        const ch = prog[bar % 4];
        I.pad(d, t, ch.map((n) => n + 12), beat * 4, 0.022, 1600);
        const drums = sec !== 2 || bar % 8 > 3;
        for (let i = 0; i < 16; i++) {
          const tt = t + (i * beat) / 4;
          if (sec !== 2 || i % 2 === 0) I.arp(d, tt, ch[(i + (bar % 2)) % 3] + (i % 8 < 4 ? 24 : 12) + (R() < 0.08 ? 7 : 0), beat / 3, 0.022);
          if (drums) {
            if (i % 8 === 0 || (i === 10 && R() < 0.5)) I.kick(d, tt, 0.4);
            if (i % 8 === 4) I.snare(d, tt, 0.13);
            if (i % 2 === 0) I.hat(d, tt, 0.035, i % 8 === 6);
          }
          if (i % 2 === 0) I.bass(d, tt, ch[0] - 12, beat / 2.2, 0.13);
        }
      },
    },
    {
      freq: 94.2, name: 'Радио «Дорожник»', bpm: 96, beats: 4,
      bar: (I, d, t, bar, beat, R) => {
        const sec = Math.floor(bar / 8) % 2;
        const prog = sec ? [CH.Em, CH.C, CH.G, CH.D] : [CH.G, CH.C, CH.D, CH.G];
        const ch = prog[bar % 4];
        const shape = [ch[0] - 12, ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12];
        for (const b of [0, 2, 2.5, 3]) shape.forEach((n, i) => I.pluck(d, t + b * beat + i * 0.012, n, b === 0 ? 0.13 : 0.09));
        for (let q = 0; q < 4; q++) I.upright(d, t + q * beat, (q % 2 ? ch[2] : ch[0]) - 24, beat * 0.9, 0.2);
        I.brush(d, t + beat, 0.07);
        I.brush(d, t + beat * 3, 0.07);
        if (sec && R() < 0.7) {
          const pent = [67, 69, 71, 74, 76, 79];
          for (let i = 0; i < 4; i++) if (R() < 0.6) I.pluck(d, t + i * beat + beat / 2, pent[Math.floor(R() * pent.length)], 0.12);
        }
      },
    },
    {
      freq: 99.7, name: 'Джаз 99.7', bpm: 118, beats: 4,
      bar: (I, d, t, bar, beat, R) => {
        const prog = [[48, 51, 55, 58], [53, 57, 60, 63], [46, 50, 53, 57], [55, 59, 62, 65]];
        const ch = prog[bar % 4];
        const sw = beat * 0.66;
        for (let q = 0; q < 4; q++) {
          const walk = [ch[0], ch[1], ch[2], ch[3] - 1][q] - 12;
          I.upright(d, t + q * beat, walk + (R() < 0.2 ? 2 : 0), beat * 0.95, 0.22);
          I.ride(d, t + q * beat, 0.04);
          if (q % 2 === 1) I.ride(d, t + q * beat + sw, 0.03);
        }
        const comps = [0, 1.66, 2.66, 3.33].filter(() => R() < 0.55);
        for (const c of comps) I.epiano(d, t + c * beat, ch.map((n) => n + 12), beat * 1.2, 0.028);
        if (bar % 4 === 3) I.hat(d, t + beat * 3.66, 0.03);
      },
    },
    {
      freq: 103.5, name: 'Кочевник', bpm: 62, beats: 4,
      bar: (I, d, t, bar, beat, R) => {
        const roots = [50, 53, 48, 55];
        const r = roots[Math.floor(bar / 2) % 4];
        if (bar % 2 === 0) I.pad(d, t, [r, r + 7, r + 14, r + 15], beat * 8, 0.018, 900);
        I.bass(d, t, 38, beat * 4, 0.08);
        const pent = [62, 64, 65, 67, 69, 72, 74];
        for (let i = 0; i < 8; i++) if (R() < 0.3) I.pluck(d, t + (i * beat) / 2, pent[Math.floor(R() * pent.length)] + (R() < 0.3 ? 12 : 0), 0.1, 1);
      },
    },
    {
      freq: 106.1, name: '—', bpm: 60, beats: 4,
      bar: (I, d, t, bar, beat, R) => {
        if (bar % 4 === 0) { for (let i = 0; i < 3; i++) I.beep(d, t + i * 0.4, 1100, 0.25, 0.06); return; }
        const n = Math.floor(R() * 10);
        for (let i = 0; i < 4; i++) I.voice(d, t + i * beat * 0.9, 140 + (n + i) * 4, 0.45, 0.1);
        I.beep(d, t + beat * 3.7, 700 + n * 40, 0.1, 0.03);
      },
    },
  ];
}

/** FM car radio with generative stations and static between them. */
export class Radio {
  on = false;
  freq = 94.2;
  private list = stations();
  private inst: Instruments;
  private stationBus: GainNode;
  private staticSrc: AudioBufferSourceNode;
  private staticGain: GainNode;
  private out: GainNode;
  private muff: BiquadFilterNode;
  panner: PannerNode;
  private cur: Station | null = null;
  private nextBar = 0;
  private barN = 0;
  private seed = 1;
  signal = 0;
  stationName = '';
  private power = 0;
  constructor(private ctx: Ctx, dest: AudioNode, noise: AudioBuffer, mkPanner: (d: number) => PannerNode) {
    this.inst = new Instruments(ctx, noise);
    this.stationBus = ctx.createGain();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4800;
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
    ws.curve = curve;
    this.staticSrc = ctx.createBufferSource();
    this.staticSrc.buffer = noise;
    this.staticSrc.loop = true;
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2200; sf.Q.value = 0.5;
    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    this.staticSrc.connect(sf).connect(this.staticGain);
    this.staticSrc.start();
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.muff = ctx.createBiquadFilter();
    this.muff.type = 'lowpass';
    this.muff.frequency.value = 20000;
    this.panner = mkPanner(1.5);
    this.stationBus.connect(hp).connect(lp).connect(ws).connect(this.out);
    this.staticGain.connect(this.out);
    this.out.connect(this.muff).connect(this.panner).connect(dest);
  }
  setPos(p: THREE.Vector3, listenerInCar: boolean) {
    const t = this.ctx.currentTime;
    if (this.panner.positionX) {
      this.panner.positionX.setTargetAtTime(p.x, t, 0.02);
      this.panner.positionY.setTargetAtTime(p.y, t, 0.02);
      this.panner.positionZ.setTargetAtTime(p.z, t, 0.02);
    }
    this.muff.frequency.setTargetAtTime(listenerInCar ? 20000 : 1300, t, 0.1);
  }
  update(dt: number) {
    const ctx = this.ctx;
    this.power += ((this.on ? 1 : 0) - this.power) * Math.min(1, dt * 6);
    let best: Station | null = null, bs = 0;
    for (const s of this.list) {
      const sig = Math.max(0, 1 - Math.abs(this.freq - s.freq) / 0.35);
      if (sig > bs) { bs = sig; best = s; }
    }
    this.signal = bs;
    this.stationName = best && bs > 0.3 ? best.name : '';
    const t = ctx.currentTime;
    this.out.gain.setTargetAtTime(this.power * 0.9, t, 0.05);
    this.stationBus.gain.setTargetAtTime(Math.pow(bs, 0.7), t, 0.08);
    this.staticGain.gain.setTargetAtTime((1 - bs) * 0.09 + (Math.random() < 0.02 ? 0.05 : 0), t, 0.05);
    if (!this.on || this.power < 0.01) { this.cur = null; return; }
    if (best !== this.cur) {
      this.cur = bs > 0.02 ? best : null;
      this.nextBar = t + 0.05;
      this.barN = Math.floor(Math.random() * 16);
    }
    if (!this.cur) return;
    const beat = 60 / this.cur.bpm;
    while (this.nextBar < t + 0.35) {
      let s = (this.seed = (this.seed * 16807) % 2147483647);
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      this.cur.bar(this.inst, this.stationBus, this.nextBar, this.barN, beat, rnd);
      this.nextBar += beat * this.cur.beats;
      this.barN++;
    }
  }
  get stations() {
    return this.list.map((s) => ({ freq: s.freq, name: s.name }));
  }
}

/** Melancholic desert theme for the main menu. */
export class MenuMusic {
  private inst: Instruments;
  private bus: GainNode;
  private next = 0;
  private bar = 0;
  private playing = false;
  constructor(private ctx: Ctx, dest: AudioNode, noise: AudioBuffer) {
    this.inst = new Instruments(ctx, noise);
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    const rev = ctx.createConvolver();
    const n = ctx.sampleRate * 3;
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5) * 0.4; }
    rev.buffer = b;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    this.bus.connect(dest);
    this.bus.connect(rev).connect(wet).connect(dest);
  }
  start() {
    if (this.playing) return;
    this.playing = true;
    this.next = this.ctx.currentTime + 0.2;
    this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bus.gain.setTargetAtTime(0.9, this.ctx.currentTime, 1.5);
  }
  stop() {
    if (!this.playing) return;
    this.playing = false;
    this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8);
  }
  update() {
    if (!this.playing) return;
    const beat = 60 / 68;
    const t = this.ctx.currentTime;
    while (this.next < t + 0.4) {
      const prog = [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62], [40, 47, 52, 56, 59]];
      const ch = prog[this.bar % 4];
      const T = this.next;
      this.inst.pad(this.bus, T, [ch[1], ch[2], ch[3]], beat * 4, 0.012, 800);
      const pattern = [0, 2, 3, 4, 3, 2, 4, 1];
      pattern.forEach((pi, i) => this.inst.pluck(this.bus, T + (i * beat) / 2, ch[pi], 0.16 - (i % 2) * 0.04));
      if (this.bar % 8 >= 4 && Math.random() < 0.8) {
        const mel = [69, 72, 71, 67, 64, 67, 69];
        this.inst.pluck(this.bus, T + beat * (1 + Math.floor(Math.random() * 3)), mel[Math.floor(Math.random() * mel.length)] + 12, 0.1, 1);
      }
      this.next += beat * 4;
      this.bar++;
    }
  }
}
