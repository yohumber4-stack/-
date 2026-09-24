import * as THREE from 'three';
import { ENGINE_WORKLET } from './engineWorklet';
import { Radio, MenuMusic } from './music';

export interface PlayOpts {
  pos?: THREE.Vector3;
  volume?: number;
  pitch?: number;
  delay?: number;
  muffled?: boolean;
}
export interface Volumes {
  master: number;
  sfx: number;
  ambient: number;
  radio: number;
  music: number;
  engine: number;
}
export interface EngineParams {
  rpm: number;
  throttle: number;
  load: number;
  running: boolean;
  cranking: boolean;
  crankStrength: number;
  misfire: number;
  damage: number;
  pos: THREE.Vector3;
  inside: boolean;
}
export interface AmbientParams {
  wind: number;
  carSpeed: number;
  insideCar: boolean;
  insideBuilding: boolean;
  night: number;
  rain: number;
  sand: number;
}
export interface CarAudio {
  speed: number;
  skid: number;
  sand: number;
  inside: boolean;
  pos: THREE.Vector3;
  horn: boolean;
  bumps: number;
}

type Ctx = AudioContext;

export class EngineSound {
  private node: AudioWorkletNode | null = null;
  private lp: BiquadFilterNode;
  private shelf: BiquadFilterNode;
  private gain: GainNode;
  panner: PannerNode;
  constructor(private a: AudioSystem, ctx: Ctx, dest: AudioNode) {
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 5000;
    this.shelf = ctx.createBiquadFilter();
    this.shelf.type = 'lowshelf';
    this.shelf.frequency.value = 180;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.panner = a.makePanner(3);
    this.lp.connect(this.shelf).connect(this.gain).connect(this.panner).connect(dest);
    if (a.workletReady) {
      this.node = new AudioWorkletNode(ctx, 'engine-proc', { numberOfInputs: 0, outputChannelCount: [1] });
      this.node.connect(this.lp);
    }
  }
  set(p: EngineParams) {
    if (!this.node) return;
    this.node.port.postMessage({ rpm: p.rpm, throttle: p.throttle, load: p.load, running: p.running ? 1 : 0, crank: p.cranking ? 1 : 0, crankStrength: p.crankStrength, misfire: p.misfire, damage: p.damage });
    const t = this.a.ctx!.currentTime;
    const active = p.running || p.cranking;
    this.gain.gain.setTargetAtTime(active ? (p.inside ? 1.05 : 1.3) : 0, t, 0.08);
    this.lp.frequency.setTargetAtTime(p.inside ? 1400 + p.throttle * 1600 : 3500 + p.throttle * 4500, t, 0.1);
    this.shelf.gain.setTargetAtTime(p.inside ? 5 : 0, t, 0.2);
    this.a.placePanner(this.panner, p.pos);
  }
  dispose() {
    try { this.node?.disconnect(); this.gain.disconnect(); } catch {}
  }
}

/** Procedural sound engine: every sound is synthesised at runtime. */
export class AudioSystem {
  ctx: Ctx | null = null;
  workletReady = false;
  private master!: GainNode;
  private comp!: DynamicsCompressorNode;
  buses: Record<'sfx' | 'ambient' | 'radio' | 'music' | 'engine' | 'ui', GainNode> = {} as any;
  private world!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private brown!: AudioBuffer;
  private vols: Volumes = { master: 0.8, sfx: 0.9, ambient: 0.8, radio: 0.7, music: 0.6, engine: 0.9 };
  radio!: Radio;
  private menu: MenuMusic | null = null;
  private amb: Record<string, { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode }> = {};
  private loops: Record<string, { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode; panner?: PannerNode } | null> = {};
  private hornNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private pourT = 0;
  private pumpT = 0;
  private cricketT = 0;
  private birdT = 20;
  private listenerPos = new THREE.Vector3();
  insideCar = false;
  private voices = 0;
  paused = false;

  get ready() {
    return !!this.ctx;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
      return;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: Ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.connect(this.comp).connect(ctx.destination);
    this.world = ctx.createGain();
    this.world.connect(this.master);
    for (const k of ['sfx', 'ambient', 'radio', 'engine'] as const) {
      this.buses[k] = ctx.createGain();
      this.buses[k].connect(this.world);
    }
    this.buses.music = ctx.createGain();
    this.buses.music.connect(this.master);
    this.buses.ui = ctx.createGain();
    this.buses.ui.connect(this.master);
    this.noise = this.makeNoise(2.5, 'white');
    this.brown = this.makeNoise(4, 'brown');
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeIR(2.4, 2.2);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.5;
    this.reverbSend.connect(this.reverb).connect(this.buses.sfx);
    try {
      const url = URL.createObjectURL(new Blob([ENGINE_WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      this.workletReady = true;
    } catch (e) {
      console.warn('engine worklet unavailable', e);
    }
    this.radio = new Radio(ctx, this.buses.radio, this.noise, (d) => this.makePanner(d));
    this.startAmbient();
    this.applyVolumes();
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
  }

  // ------------------------------------------------------------------ helpers
  makeNoise(sec: number, kind: 'white' | 'brown'): AudioBuffer {
    const ctx = this.ctx!;
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return b;
  }
  private makeIR(sec: number, decay: number) {
    const ctx = this.ctx!;
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // sparse early echo (slap-back off distant terrain) + diffuse tail
        const early = i > ctx.sampleRate * 0.09 && i < ctx.sampleRate * 0.1 ? 0.6 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + early * (Math.random() * 2 - 1)) * 0.6;
      }
    }
    return b;
  }
  makePanner(ref = 2.5): PannerNode {
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = 1.1;
    p.maxDistance = 600;
    return p;
  }
  placePanner(p: PannerNode, pos: THREE.Vector3) {
    const t = this.ctx!.currentTime;
    if (p.positionX) {
      p.positionX.setTargetAtTime(pos.x, t, 0.02);
      p.positionY.setTargetAtTime(pos.y, t, 0.02);
      p.positionZ.setTargetAtTime(pos.z, t, 0.02);
    } else (p as any).setPosition(pos.x, pos.y, pos.z);
  }
  setVolumes(v: Partial<Volumes>) {
    Object.assign(this.vols, v);
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = this.vols;
    this.master.gain.setTargetAtTime(v.master, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(v.sfx, t, 0.05);
    this.buses.ambient.gain.setTargetAtTime(v.ambient * 0.9, t, 0.05);
    this.buses.radio.gain.setTargetAtTime(v.radio, t, 0.05);
    this.buses.music.gain.setTargetAtTime(v.music * 0.7, t, 0.05);
    this.buses.engine.gain.setTargetAtTime(v.engine * 0.8, t, 0.05);
    this.buses.ui.gain.setTargetAtTime(v.sfx * 0.6, t, 0.05);
  }
  setPaused(p: boolean) {
    this.paused = p;
    if (!this.ctx) return;
    this.world.gain.setTargetAtTime(p ? 0 : 1, this.ctx.currentTime, 0.12);
  }
  duck(amount: number, sec: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.world.gain.cancelScheduledValues(t);
    this.world.gain.setValueAtTime(this.world.gain.value, t);
    this.world.gain.linearRampToValueAtTime(1 - amount, t + 0.05);
    this.world.gain.linearRampToValueAtTime(1, t + sec);
  }
  setListener(pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3) {
    if (!this.ctx) return;
    this.listenerPos.copy(pos);
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02); l.positionY.setTargetAtTime(pos.y, t, 0.02); l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02); l.forwardY.setTargetAtTime(fwd.y, t, 0.02); l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02); l.upY.setTargetAtTime(up.y, t, 0.02); l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      (l as any).setPosition(pos.x, pos.y, pos.z);
      (l as any).setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  /** Output chain for a one-shot: optional panner + muffling, auto-disconnect. */
  private out(opts: PlayOpts | undefined, bus: GainNode, dur: number, reverb = 0): AudioNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = opts?.volume ?? 1;
    let tail: AudioNode = g;
    if (opts?.muffled) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      g.connect(f);
      tail = f;
    }
    if (opts?.pos) {
      const p = this.makePanner(2.5);
      this.placePanner(p, opts.pos);
      tail.connect(p);
      tail = p;
    }
    tail.connect(bus);
    if (reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      tail.connect(s).connect(this.reverbSend);
      setTimeout(() => s.disconnect(), (dur + 3) * 1000);
    }
    this.voices++;
    setTimeout(() => { try { g.disconnect(); tail.disconnect(); } catch {} this.voices--; }, (dur + 0.3 + (opts?.delay ?? 0)) * 1000);
    return g;
  }
  private env(g: GainNode, t: number, a: number, d: number, peak = 1, shape: 'exp' | 'lin' = 'exp') {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (shape === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    else g.gain.linearRampToValueAtTime(0.0001, t + a + d);
  }
  /** Filtered noise burst. */
  private burst(dest: AudioNode, t: number, o: { type?: BiquadFilterType; f: number; q?: number; a?: number; d: number; g?: number; f2?: number; brown?: boolean; rate?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = o.brown ? this.brown : this.noise;
    src.playbackRate.value = o.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.f, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.a ?? 0.002) + o.d);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    this.env(g, t, o.a ?? 0.002, o.d, o.g ?? 1);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + (o.a ?? 0.002) + o.d + 0.05);
  }
  /** Oscillator tone with pitch sweep. */
  private tone(dest: AudioNode, t: number, o: { type?: OscillatorType; f: number; f2?: number; a?: number; d: number; g?: number; detune?: number }) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.f2), t + (o.a ?? 0.003) + o.d);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    this.env(g, t, o.a ?? 0.003, o.d, o.g ?? 1);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + (o.a ?? 0.003) + o.d + 0.05);
  }
  /** Inharmonic modal ring (metal / glass). */
  private modal(dest: AudioNode, t: number, base: number, ratios: number[], decay: number, g = 0.3) {
    ratios.forEach((r, i) => this.tone(dest, t, { f: base * r * (1 + (Math.random() - 0.5) * 0.02), d: decay / (1 + i * 0.6), g: g / (1 + i * 0.7), a: 0.001 }));
  }

  // ------------------------------------------------------------------ one-shots
  play(name: string, opts: PlayOpts = {}) {
    if (!this.ctx || this.voices > 40) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts.delay ?? 0) + 0.005;
    const R = Math.random;
    const p = opts.pitch ?? 1;
    const ui = name.startsWith('ui_');
    const bus = ui ? this.buses.ui : this.buses.sfx;
    if (!ui && opts.pos && opts.muffled === undefined) opts.muffled = this.insideCar && this.listenerPos.distanceTo(opts.pos) > 2.2;
    const o = (dur: number, rev = 0) => this.out(opts, bus, dur, rev);
    switch (name) {
      case 'door_open': {
        const d = o(0.9);
        this.burst(d, t, { type: 'highpass', f: 2500, d: 0.03, g: 0.6 });
        this.tone(d, t + 0.05, { type: 'sawtooth', f: 520 * p, f2: 380, a: 0.08, d: 0.35, g: 0.025 });
        this.burst(d, t + 0.02, { f: 900, q: 6, a: 0.05, d: 0.4, g: 0.12 });
        break;
      }
      case 'door_close': case 'trunk_close': case 'hood_close': {
        const big = name !== 'door_close' ? 1.2 : 1;
        const d = o(0.8);
        this.tone(d, t, { f: 85 * big * p, f2: 50, d: 0.25, g: 0.9 });
        this.burst(d, t, { type: 'lowpass', f: 900, d: 0.18, g: 0.9 });
        this.modal(d, t, 180 * p, [1, 2.3, 3.9], 0.25, 0.12);
        this.burst(d, t + 0.06, { type: 'highpass', f: 3000, d: 0.025, g: 0.4 });
        break;
      }
      case 'hood_open': case 'trunk_open': {
        const d = o(1.0);
        this.burst(d, t, { type: 'highpass', f: 2200, d: 0.03, g: 0.5 });
        this.tone(d, t + 0.02, { type: 'triangle', f: 300, f2: 180, a: 0.2, d: 0.5, g: 0.04 });
        this.burst(d, t + 0.1, { f: 600, q: 3, a: 0.15, d: 0.4, g: 0.12 });
        break;
      }
      case 'latch': case 'click': case 'switch': case 'key_turn': case 'cap_open': case 'cap_close': case 'battery_click': {
        const d = o(0.3);
        this.burst(d, t, { type: 'highpass', f: name === 'key_turn' ? 2600 : 3200, d: 0.018, g: 0.7 });
        this.tone(d, t, { type: 'square', f: 1800 * p, d: 0.012, g: 0.05 });
        if (name === 'key_turn') this.modal(d, t + 0.02, 2200, [1, 1.7, 2.4], 0.15, 0.04);
        if (name === 'cap_open') this.burst(d, t + 0.03, { f: 1200, q: 2, d: 0.12, g: 0.2 });
        break;
      }
      case 'starter_fail': {
        const d = o(0.8);
        for (let i = 0; i < 3; i++) this.burst(d, t + i * 0.18, { type: 'highpass', f: 1800, d: 0.03, g: 0.7 });
        break;
      }
      case 'pickup': case 'zip': case 'paper': {
        const d = o(0.4);
        if (name === 'zip') this.burst(d, t, { f: 3000, f2: 5000, q: 1.5, a: 0.02, d: 0.12, g: 0.3 });
        else this.burst(d, t, { f: name === 'paper' ? 4000 : 1400, q: 0.8, a: 0.01, d: 0.12, g: 0.45 });
        break;
      }
      case 'drop': case 'throw': case 'swing': {
        const d = o(0.5);
        this.burst(d, t, { f: 700, f2: name === 'swing' ? 1800 : 300, q: 1, a: 0.04, d: 0.2, g: name === 'swing' ? 0.35 : 0.2 });
        break;
      }
      case 'impact_metal': case 'wrench_clank': case 'melee_hit': {
        const d = o(1.2);
        const b = (200 + R() * 400) * p;
        this.modal(d, t, b, [1, 2.76, 5.4, 8.9], 0.5 + R() * 0.4, 0.28);
        this.burst(d, t, { type: 'highpass', f: 1500, d: 0.05, g: 0.5 });
        this.tone(d, t, { f: 90, f2: 50, d: 0.12, g: 0.5 });
        break;
      }
      case 'impact_wood': {
        const d = o(0.6);
        this.tone(d, t, { f: (180 + R() * 80) * p, f2: 120, d: 0.12, g: 0.7 });
        this.burst(d, t, { f: 700 + R() * 400, q: 3, d: 0.1, g: 0.6 });
        break;
      }
      case 'impact_soft': case 'flesh_hit': case 'land': {
        const d = o(0.5);
        this.tone(d, t, { f: 110 * p, f2: 55, d: 0.14, g: 0.7 });
        this.burst(d, t, { type: 'lowpass', f: name === 'flesh_hit' ? 1400 : 700, d: 0.12, g: 0.7 });
        break;
      }
      case 'impact_plastic': {
        const d = o(0.4);
        this.burst(d, t, { f: 1600 + R() * 800, q: 4, d: 0.07, g: 0.6 });
        this.tone(d, t, { f: 400 * p, f2: 250, d: 0.06, g: 0.3 });
        break;
      }
      case 'impact_glass': case 'glass_break': {
        const d = o(1.5);
        this.burst(d, t, { type: 'highpass', f: 3000, d: name === 'glass_break' ? 0.5 : 0.05, g: 0.6 });
        for (let i = 0; i < (name === 'glass_break' ? 14 : 3); i++) this.modal(d, t + R() * (name === 'glass_break' ? 0.6 : 0.05), 2000 + R() * 4000, [1, 2.2], 0.2, 0.05);
        break;
      }
      case 'footstep_sand': case 'footstep_asphalt': case 'footstep_concrete': case 'footstep_wood': case 'footstep_metal': {
        const d = o(0.4);
        const v = 0.8 + R() * 0.4;
        if (name === 'footstep_sand') { this.burst(d, t, { f: 900 * v, q: 0.7, a: 0.012, d: 0.12, g: 0.55 }); this.burst(d, t + 0.03, { type: 'highpass', f: 3500, a: 0.01, d: 0.07, g: 0.15 }); }
        else if (name === 'footstep_wood') { this.tone(d, t, { f: 120 * v, f2: 80, d: 0.09, g: 0.6 }); this.burst(d, t, { f: 500 * v, q: 3, d: 0.06, g: 0.4 }); }
        else if (name === 'footstep_metal') { this.modal(d, t, 300 * v, [1, 2.6, 4.1], 0.2, 0.12); this.burst(d, t, { type: 'highpass', f: 2000, d: 0.03, g: 0.3 }); }
        else { this.burst(d, t, { f: 1600 * v, q: 1.1, d: 0.05, g: 0.45 }); this.tone(d, t, { f: 90, f2: 60, d: 0.05, g: 0.3 }); }
        break;
      }
      case 'eat': {
        const d = o(1.3);
        for (let i = 0; i < 4; i++) this.burst(d, t + i * 0.28 + R() * 0.05, { f: 1200 + R() * 800, q: 1.5, a: 0.02, d: 0.08, g: 0.35 });
        break;
      }
      case 'drink': case 'gulp': {
        const d = o(1.2);
        const n = name === 'gulp' ? 1 : 3;
        for (let i = 0; i < n; i++) { this.tone(d, t + i * 0.35, { f: 180, f2: 420, a: 0.02, d: 0.12, g: 0.4 }); this.burst(d, t + i * 0.35, { f: 500, q: 5, d: 0.1, g: 0.2 }); }
        break;
      }
      case 'gunshot': {
        const d = o(2.5, 0.9);
        this.burst(d, t, { type: 'highpass', f: 800, d: 0.06, g: 1.4 });
        this.burst(d, t, { type: 'lowpass', f: 2400, f2: 300, d: 0.35, g: 1.2 });
        this.tone(d, t, { f: 160, f2: 40, d: 0.3, g: 1.2 });
        this.burst(d, t + 0.001, { f: 4000, q: 2, d: 0.02, g: 0.8 });
        break;
      }
      case 'reload': case 'revolver_cock': {
        const d = o(0.8);
        this.modal(d, t, 1800, [1, 1.6], 0.08, 0.1);
        this.burst(d, t + 0.25, { type: 'highpass', f: 2500, d: 0.03, g: 0.4 });
        this.modal(d, t + 0.45, 1600, [1, 1.9], 0.1, 0.12);
        break;
      }
      case 'empty_click': {
        const d = o(0.3);
        this.burst(d, t, { type: 'highpass', f: 3000, d: 0.015, g: 0.6 });
        break;
      }
      case 'explosion': {
        const d = o(5, 1.2);
        this.burst(d, t, { type: 'lowpass', f: 3000, f2: 120, a: 0.004, d: 2.5, g: 1.6, brown: false });
        this.burst(d, t, { type: 'lowpass', f: 400, f2: 60, a: 0.01, d: 3.8, g: 1.8, brown: true });
        this.tone(d, t, { f: 70, f2: 22, d: 1.5, g: 1.6 });
        for (let i = 0; i < 10; i++) this.burst(d, t + 0.2 + R() * 1.5, { f: 600 + R() * 2000, q: 2, d: 0.05, g: 0.3 });
        break;
      }
      case 'thunder': {
        const d = o(7, 0.6);
        const dl = 0.2 + R() * 0.3;
        this.burst(d, t + dl, { type: 'lowpass', f: 900, f2: 90, a: 0.05, d: 4.5, g: 1.4, brown: true });
        this.burst(d, t + dl + 0.4, { type: 'lowpass', f: 300, f2: 60, a: 0.6, d: 4, g: 1.2, brown: true });
        break;
      }
      case 'crash_light': case 'crash_heavy': {
        const heavy = name === 'crash_heavy';
        const d = o(2, 0.3);
        this.tone(d, t, { f: heavy ? 60 : 90, f2: 30, d: heavy ? 0.5 : 0.25, g: 1.3 });
        this.burst(d, t, { type: 'lowpass', f: 1800, d: heavy ? 0.6 : 0.25, g: 1.1 });
        this.modal(d, t, 150 + R() * 100, [1, 2.4, 3.7, 5.3], heavy ? 1.2 : 0.6, 0.3);
        if (heavy) for (let i = 0; i < 8; i++) this.modal(d, t + R() * 0.5, 800 + R() * 3000, [1, 2.1], 0.2, 0.06);
        break;
      }
      case 'bolt_loosen': case 'bolt_tighten': case 'ratchet': {
        const d = o(1.0);
        const n = name === 'ratchet' ? 6 : 4;
        for (let i = 0; i < n; i++) { this.burst(d, t + i * 0.09, { type: 'highpass', f: 2800, d: 0.02, g: 0.5 }); this.modal(d, t + i * 0.09, 1400 + i * 30, [1, 1.8], 0.06, 0.05); }
        if (name !== 'ratchet') this.modal(d, t + n * 0.09 + 0.05, 900, [1, 2.7], 0.3, 0.12);
        break;
      }
      case 'crate_break': {
        const d = o(1.2, 0.2);
        for (let i = 0; i < 6; i++) { this.tone(d, t + R() * 0.15, { f: 150 + R() * 200, f2: 90, d: 0.1, g: 0.5 }); this.burst(d, t + R() * 0.2, { f: 800 + R() * 1500, q: 3, d: 0.08, g: 0.4 }); }
        break;
      }
      case 'rabbit_squeal': case 'rabbit_attack': case 'rabbit_die': {
        const d = o(1.0);
        const base = (name === 'rabbit_attack' ? 1500 : name === 'rabbit_die' ? 1100 : 1900) * (0.85 + R() * 0.3);
        const n = name === 'rabbit_die' ? 1 : 2 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) {
          const s = t + i * 0.09;
          this.tone(d, s, { type: 'sawtooth', f: base, f2: base * (name === 'rabbit_die' ? 0.4 : 1.35), a: 0.01, d: name === 'rabbit_die' ? 0.5 : 0.07, g: 0.08 });
          this.burst(d, s, { f: base * 1.5, q: 6, d: 0.07, g: 0.25 });
        }
        break;
      }
      case 'husk_growl': case 'husk_attack': case 'husk_die': {
        const d = o(1.8, 0.2);
        const len = name === 'husk_die' ? 1.4 : name === 'husk_attack' ? 0.5 : 0.9;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(70 + R() * 30, t);
        osc.frequency.linearRampToValueAtTime(name === 'husk_die' ? 40 : 90, t + len);
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 500; f1.Q.value = 5;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 7;
        const g = ctx.createGain();
        this.env(g, t, 0.08, len, 0.6);
        osc.connect(f1).connect(g);
        osc.connect(f2).connect(g);
        g.connect(d);
        this.burst(d, t, { f: 700, q: 2, a: 0.1, d: len, g: 0.25 });
        osc.start(t);
        osc.stop(t + len + 0.2);
        break;
      }
      case 'hurt': {
        const d = o(0.6);
        this.tone(d, t, { f: 130, f2: 70, d: 0.25, g: 0.8 });
        this.burst(d, t, { type: 'lowpass', f: 900, d: 0.15, g: 0.6 });
        break;
      }
      case 'death': {
        const d = o(3);
        this.tone(d, t, { f: 90, f2: 30, a: 0.05, d: 2.5, g: 0.6 });
        this.burst(d, t, { type: 'lowpass', f: 500, f2: 80, a: 0.2, d: 2.5, g: 0.5, brown: true });
        break;
      }
      case 'heartbeat': {
        const d = o(1);
        this.tone(d, t, { f: 60, f2: 40, d: 0.12, g: 0.9 });
        this.tone(d, t + 0.22, { f: 55, f2: 38, d: 0.14, g: 0.7 });
        break;
      }
      case 'ui_hover': {
        const d = o(0.2);
        this.tone(d, t, { f: 1800, d: 0.03, g: 0.06 });
        break;
      }
      case 'ui_click': case 'ui_open': {
        const d = o(0.3);
        this.tone(d, t, { f: 900, f2: 1300, d: 0.05, g: 0.12 });
        this.burst(d, t, { type: 'highpass', f: 4000, d: 0.015, g: 0.2 });
        break;
      }
      case 'ui_back': {
        const d = o(0.3);
        this.tone(d, t, { f: 1100, f2: 700, d: 0.06, g: 0.12 });
        break;
      }
      case 'notify': {
        const d = o(0.8);
        this.tone(d, t, { type: 'triangle', f: 880, d: 0.25, g: 0.12 });
        this.tone(d, t + 0.09, { type: 'triangle', f: 1320, d: 0.35, g: 0.1 });
        break;
      }
      case 'coins': {
        const d = o(0.8);
        for (let i = 0; i < 4; i++) this.modal(d, t + i * 0.07 + R() * 0.03, 3000 + R() * 1500, [1, 1.5, 2.3], 0.15, 0.06);
        break;
      }
      case 'mine_beep': {
        const d = o(0.5);
        this.tone(d, t, { type: 'square', f: 2400, d: 0.08, g: 0.15 });
        this.tone(d, t + 0.14, { type: 'square', f: 2400, d: 0.08, g: 0.15 });
        break;
      }
      case 'tire_pop': {
        const d = o(1);
        this.burst(d, t, { type: 'lowpass', f: 2500, f2: 300, d: 0.4, g: 1.2 });
        this.tone(d, t, { f: 120, f2: 40, d: 0.2, g: 0.8 });
        break;
      }
      case 'backfire': {
        const d = o(1.2, 0.5);
        this.burst(d, t, { type: 'lowpass', f: 1800, f2: 200, d: 0.18, g: 1.2 });
        this.tone(d, t, { f: 110, f2: 45, d: 0.15, g: 1 });
        break;
      }
      case 'shift': {
        const d = o(0.4);
        this.burst(d, t, { f: 900, q: 3, d: 0.05, g: 0.25 });
        this.modal(d, t + 0.05, 600, [1, 2.2], 0.08, 0.06);
        break;
      }
      case 'bell': {
        const d = o(2);
        this.modal(d, t, 660, [1, 2.0, 2.76, 5.4], 1.5, 0.2);
        break;
      }
      case 'sleep': {
        const d = o(3);
        this.tone(d, t, { type: 'triangle', f: 440, a: 0.8, d: 2, g: 0.06 });
        this.tone(d, t + 0.3, { type: 'triangle', f: 330, a: 0.8, d: 2, g: 0.05 });
        break;
      }
      default: {
        const d = o(0.3);
        this.burst(d, t, { f: 1000, d: 0.05, g: 0.3 });
      }
    }
  }

  // ------------------------------------------------------------------ loops
  private loopSrc(name: string, buf: AudioBuffer, type: BiquadFilterType, f: number, q: number, dest: AudioNode, pan = false) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filt).connect(gain);
    let panner: PannerNode | undefined;
    if (pan) { panner = this.makePanner(3); gain.connect(panner).connect(dest); } else gain.connect(dest);
    src.start(0, Math.random() * 2);
    const l = { src, filt, gain, panner };
    this.loops[name] = l;
    return l;
  }
  startPour() {
    this.pourT = 0.25;
  }
  stopPour() {
    this.pourT = 0;
  }
  pumpLoop(on: boolean) {
    if (on) this.pumpT = 0.25;
  }
  private startAmbient() {
    const ctx = this.ctx!;
    const mk = (name: string, buf: AudioBuffer, type: BiquadFilterType, f: number, q: number) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = type;
      filt.frequency.value = f;
      filt.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filt).connect(gain).connect(this.buses.ambient);
      src.start(0, Math.random() * 3);
      this.amb[name] = { src, filt, gain };
    };
    mk('wind', this.brown, 'bandpass', 380, 0.6);
    mk('gust', this.noise, 'bandpass', 900, 2.5);
    mk('rush', this.noise, 'lowpass', 900, 0.5);
    mk('storm', this.noise, 'bandpass', 1200, 0.4);
    mk('rain', this.noise, 'highpass', 2500, 0.5);
    mk('roof', this.brown, 'lowpass', 600, 0.7);
    mk('road', this.brown, 'lowpass', 220, 0.7);
    mk('gravel', this.noise, 'bandpass', 700, 0.9);
    mk('skid', this.noise, 'bandpass', 1400, 6);
    mk('pour', this.noise, 'bandpass', 700, 8);
    mk('pump', this.brown, 'bandpass', 220, 4);
  }
  private windPh = 0;
  setAmbient(p: AmbientParams, dt: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const A = this.amb;
    this.windPh += dt;
    const gust = 0.6 + 0.4 * Math.sin(this.windPh * 0.33) * Math.sin(this.windPh * 0.11 + 1);
    const inB = p.insideBuilding ? 0.35 : 1;
    const inC = p.insideCar ? 0.3 : 1;
    const w = Math.min(1, p.wind / 14);
    A.wind.gain.gain.setTargetAtTime((0.08 + w * 0.5) * gust * inB * inC, t, 0.5);
    A.wind.filt.frequency.setTargetAtTime(260 + w * 500 + gust * 120, t, 0.5);
    A.gust.gain.gain.setTargetAtTime(Math.max(0, w - 0.3) * 0.12 * gust * inB * inC, t, 0.4);
    A.gust.filt.frequency.setTargetAtTime(600 + gust * 900, t, 0.3);
    const rush = Math.min(1, p.carSpeed / 38);
    A.rush.gain.gain.setTargetAtTime(rush * rush * (p.insideCar ? 0.35 : 0.9), t, 0.2);
    A.rush.filt.frequency.setTargetAtTime(p.insideCar ? 500 + rush * 500 : 1200 + rush * 2500, t, 0.2);
    A.storm.gain.gain.setTargetAtTime(p.sand * 0.55 * (p.insideCar || p.insideBuilding ? 0.45 : 1), t, 1);
    A.rain.gain.gain.setTargetAtTime(p.rain * 0.35 * (p.insideCar || p.insideBuilding ? 0.3 : 1), t, 1);
    A.roof.gain.gain.setTargetAtTime(p.rain * (p.insideCar || p.insideBuilding ? 0.5 : 0), t, 1);
    // pour & pump
    this.pourT -= dt;
    this.pumpT -= dt;
    A.pour.gain.gain.setTargetAtTime(this.pourT > 0 ? 0.35 : 0, t, 0.05);
    A.pour.filt.frequency.setTargetAtTime(500 + Math.sin(this.windPh * 23) * 150 + Math.random() * 200, t, 0.02);
    A.pump.gain.gain.setTargetAtTime(this.pumpT > 0 ? 0.3 : 0, t, 0.08);
    // night crickets, daytime birds
    if (p.night > 0.4 && p.sand < 0.2 && p.rain < 0.2 && !p.insideCar) {
      this.cricketT -= dt;
      if (this.cricketT <= 0) {
        this.cricketT = 0.3 + Math.random() * 1.2;
        const d = this.out({ volume: 0.05 * p.night * inB }, this.buses.ambient, 1);
        const f = 4200 + Math.random() * 900;
        const s = t + Math.random() * 0.1;
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;
        pan.connect(d);
        for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) this.tone(pan, s + i * 0.045, { f, d: 0.025, g: 1, a: 0.004 });
      }
    } else if (p.night < 0.2 && p.sand < 0.2 && !p.insideCar) {
      this.birdT -= dt;
      if (this.birdT <= 0) {
        this.birdT = 25 + Math.random() * 50;
        const d = this.out({ volume: 0.06 }, this.buses.ambient, 2, 0.6);
        const s = t;
        this.tone(d, s, { type: 'sawtooth', f: 2400, f2: 1300, a: 0.05, d: 0.9, g: 0.08 });
        this.burst(d, s, { f: 2000, q: 8, a: 0.05, d: 0.8, g: 0.15 });
      }
    }
  }
  setCar(c: CarAudio | null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const A = this.amb;
    const s = c ? Math.min(1, Math.abs(c.speed) / 35) : 0;
    const k = c?.inside ? 1 : c ? 0.5 : 0;
    A.road.gain.gain.setTargetAtTime(s * (1 - c!.sand * 0.6) * 0.5 * k, t, 0.1);
    A.road.filt.frequency.setTargetAtTime(140 + s * 260, t, 0.1);
    A.gravel.gain.gain.setTargetAtTime(s * (c?.sand ?? 0) * 0.35 * k + (c?.bumps ?? 0) * 0.2 * k, t, 0.1);
    A.gravel.filt.frequency.setTargetAtTime(500 + s * 600 + Math.random() * 200, t, 0.05);
    A.skid.gain.gain.setTargetAtTime((c?.skid ?? 0) * (1 - (c?.sand ?? 0)) * 0.35 * k, t, 0.05);
    A.skid.filt.frequency.setTargetAtTime(1100 + Math.random() * 500, t, 0.03);
    // horn
    if (c?.horn && !this.hornNodes) {
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.18, t, 0.01);
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 1.2;
      const osc = [415, 523].map((hz) => {
        const o = this.ctx!.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz;
        o.connect(f);
        o.start();
        return o;
      });
      const pn = this.makePanner(4);
      this.placePanner(pn, c.pos);
      f.connect(g).connect(pn).connect(this.buses.sfx);
      this.hornNodes = { osc, gain: g };
    } else if (!c?.horn && this.hornNodes) {
      const h = this.hornNodes;
      h.gain.gain.setTargetAtTime(0, t, 0.02);
      setTimeout(() => h.osc.forEach((o) => o.stop()), 200);
      this.hornNodes = null;
    }
  }
  createEngine(): EngineSound | null {
    if (!this.ctx) return null;
    return new EngineSound(this, this.ctx, this.buses.engine);
  }
  playMenuMusic() {
    if (!this.ctx) return;
    if (!this.menu) this.menu = new MenuMusic(this.ctx, this.buses.music, this.noise);
    this.menu.start();
  }
  stopMenuMusic() {
    this.menu?.stop();
  }
  update(dt: number) {
    if (!this.ctx) return;
    this.radio?.update(dt);
    this.menu?.update();
  }
}
