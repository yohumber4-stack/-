/** AudioWorklet source: 4-stroke engine synthesised from individual combustion pulses. */
export const ENGINE_WORKLET = `
class Reso {
  constructor(){ this.x1=0; this.x2=0; this.y1=0; this.y2=0; this.set(100, 5, 44100); }
  set(f, q, sr){
    const w = 2*Math.PI*Math.min(f, sr*0.45)/sr, a = Math.sin(w)/(2*q), c = Math.cos(w);
    const a0 = 1 + a;
    this.b0 = a/a0; this.b1 = 0; this.b2 = -a/a0; this.a1 = -2*c/a0; this.a2 = (1-a)/a0;
  }
  run(x){
    const y = this.b0*x + this.b1*this.x1 + this.b2*this.x2 - this.a1*this.y1 - this.a2*this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
class EngineProc extends AudioWorkletProcessor {
  constructor(){
    super();
    this.p = { rpm: 0, throttle: 0, load: 0, running: 0, crank: 0, crankStrength: 1, misfire: 0, damage: 0, cyl: 4 };
    this.s = { rpm: 0, throttle: 0, run: 0, crank: 0 };
    this.phase = 0; this.lastQ = 0; this.env = 0; this.envN = 0; this.amp = 0;
    this.r1 = new Reso(); this.r2 = new Reso(); this.r3 = new Reso(); this.r4 = new Reso();
    this.lp = 0; this.lp2 = 0; this.hp = 0; this.noiseLp = 0;
    this.crankPh = 0; this.whine = 0; this.tick = 0; this.knock = 0;
    this.cylAmp = [1, 0.93, 1.05, 0.97];
    this.port.onmessage = (e) => Object.assign(this.p, e.data);
  }
  process(inputs, outputs){
    const out = outputs[0][0];
    if (!out) return true;
    const sr = sampleRate, p = this.p, s = this.s;
    const k = 1 - Math.exp(-1 / (sr * 0.03));
    const kf = 1 - Math.exp(-1 / (sr * 0.004));
    for (let i = 0; i < out.length; i++) {
      s.rpm += (p.rpm - s.rpm) * kf;
      s.throttle += (p.throttle - s.throttle) * k;
      s.run += ((p.running ? 1 : 0) - s.run) * k * 0.5;
      s.crank += ((p.crank ? 1 : 0) - s.crank) * k;
      let y = 0;
      const rpm = Math.max(s.rpm, 1);
      if (i === 0) {
        const f0 = 38 + rpm * 0.012;
        this.r1.set(f0 * 2.1, 3.5, sr);
        this.r2.set(f0 * 5.3 + s.throttle * 90, 4, sr);
        this.r3.set(760 + rpm * 0.05, 2.2, sr);
        this.r4.set(95 + rpm * 0.018, 6, sr);
      }
      // --- combustion
      if (s.run > 0.001) {
        const cyc = rpm / 120;
        this.phase += cyc / sr;
        if (this.phase >= 1) this.phase -= 1;
        const n = p.cyl || 4;
        const q = Math.floor(this.phase * n);
        if (q !== this.lastQ) {
          this.lastQ = q;
          const mis = Math.random() < p.misfire * 0.35;
          const a = (0.55 + 0.65 * s.throttle + 0.2 * p.load) * this.cylAmp[q % 4] * (0.85 + Math.random() * 0.3);
          this.env = mis ? 0.04 : a;
          this.envN = mis ? 0 : a;
          if (mis && Math.random() < 0.3) this.env = 1.8;
          if (p.damage > 0.2 && Math.random() < p.damage * 0.5) this.knock = 0.6 * p.damage;
        }
        const decay = Math.exp(-1 / (sr * (0.0022 + 0.0035 * (1 - s.throttle) + 600 / (rpm * 1000))));
        this.env *= decay;
        this.envN *= Math.exp(-1 / (sr * 0.006));
        const imp = this.env;
        const noise = (Math.random() * 2 - 1);
        this.noiseLp += (noise - this.noiseLp) * (0.12 + s.throttle * 0.3);
        const exc = imp * (0.7 + 0.3 * noise) + this.envN * this.noiseLp * 0.6;
        y += this.r1.run(exc) * 2.2 + this.r2.run(exc) * 1.2 + this.r3.run(exc) * 0.5 * (0.3 + s.throttle) + this.r4.run(exc) * 2.6;
        // intake hiss and valvetrain tick
        y += noise * 0.012 * (s.throttle * 1.5 + rpm / 7000);
        this.tick += rpm / 60 / sr;
        if (this.tick >= 1) { this.tick -= 1; this.knock = Math.max(this.knock, 0.02 + rpm / 60000); }
        this.knock *= Math.exp(-1 / (sr * 0.0015));
        y += this.knock * (Math.random() * 2 - 1);
        y *= s.run;
      }
      // --- starter motor
      if (s.crank > 0.001) {
        const cs = Math.max(0.15, p.crankStrength);
        this.crankPh += (4.2 * cs) / sr;
        if (this.crankPh >= 1) this.crankPh -= 1;
        const comp = Math.pow(Math.sin(this.crankPh * Math.PI), 6);
        this.whine += (180 + 120 * cs - comp * 60) / sr;
        if (this.whine >= 1) this.whine -= 1;
        const w = (this.whine * 2 - 1) * 0.16 + Math.sin(this.whine * Math.PI * 4) * 0.08;
        const chug = comp * 0.5 * (Math.random() * 0.4 + 0.8);
        y += (w * (0.4 + 0.6 * (1 - comp)) + this.r4.run(chug * 0.4) * 2 + chug * 0.25 * (Math.random() * 2 - 1)) * s.crank * cs;
      }
      // soft saturation for growl
      const drive = 1.4 + s.throttle * 2.2;
      y = Math.tanh(y * drive) / Math.tanh(drive);
      this.hp += (y - this.hp) * 0.0035;
      out[i] = (y - this.hp) * 0.55;
    }
    return true;
  }
}
registerProcessor('engine-proc', EngineProc);
`;
