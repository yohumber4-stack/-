// The soundtrack: every cue is timed against the scene timeline, so the music
// follows the picture. Gemini's theme returns in many moods: festive, broken
// ("coming soon" — the title phrase never resolves), sad piano in the rain,
// music box by the fire, triumphant for Gemini 4, and resolved at the very end.
import { SR, Bus, midi, hz, voice, bell, piano, pluck, kick, snare, hat, crash, noiseFx, sweep, reverb, delay, melody, V, BELL, PIANO, PLUCK } from './synth.js';
import { SCENES, DURATION } from '../film.js';

const S = (i) => SCENES[i].start;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = (m) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const tr = (str, k) => str.replace(/([A-G][#b]?)(-?\d)/g, (m) => nameOf(midi(m) + k));

// Gemini's theme (C major, eighth notes)
const TH = {
  A: 'E5 - G5 - A5 - G5 - E5 - D5 - C5 - - -',
  B: 'D5 - E5 - G5 - E5 - D5 - - - . . . .',
  C: 'E5 - G5 - A5 - C6 - B5 - A5 - G5 - E5 -',
  D: 'F5 - E5 - D5 - G5 - C5 - - - - - . .',
};
const CH = { A: ['C3', 'A2'], B: ['D3', 'G2'], C: ['C3', 'E3'], D: ['F2', 'G2'] }; // bass roots per bar
const CHORD = { C: 'C4+E4+G4', Am: 'A3+C4+E4', Dm: 'D4+F4+A4', G: 'G3+B3+D4', F: 'F3+A3+C4', Em: 'E3+G3+B3' };
const BARCH = { A: ['C', 'Am'], B: ['Dm', 'G'], C: ['C', 'Em'], D: ['F', 'G'] };

export function renderScore() {
  const n = Math.ceil((DURATION + 1) * SR);
  const M = new Bus(n), SND = new Bus(n), FX = new Bus(n), LEAD = new Bus(n);
  const lead = V('pulse', { duty: 0.25, vib: 0.12, a: 0.01, d: 0.1, s: 0.65, r: 0.12, vel: 0.13 });
  const leadSoft = V('tri', { a: 0.02, d: 0.1, s: 0.7, r: 0.2, vel: 0.2, vib: 0.1 });
  const bass = V('tri', { a: 0.005, d: 0.1, s: 0.8, r: 0.05, vel: 0.28, gate: 0.85 });
  const pad = V('saw', { a: 0.5, d: 0.6, s: 0.75, r: 1.0, lp: 0.035, vel: 0.07, gate: 1 });
  const brass = V('square', { duty: 0.5, lp: 0.12, a: 0.03, d: 0.15, s: 0.7, r: 0.15, vel: 0.08 });
  const box = BELL({ ratio: 2, index: 1.1, decay: 1.3, vel: 0.14 });
  const chime = BELL({ ratio: 3.5, index: 2, decay: 1.2, vel: 0.1 });
  const pno = PIANO({ vel: 0.3 });
  const piz = PLUCK({ vel: 0.4, len: 0.5, damp: 0.994 });

  // ---------- sfx helpers ----------
  const whoosh = (t, len = 0.8, vel = 0.25, pan = 0) => noiseFx(FX, t, len, (u) => 0.02 + 0.35 * Math.sin(Math.PI * u), (u) => Math.sin(Math.PI * u), pan, vel);
  const pop = (t, vel = 0.4) => { noiseFx(FX, t, 0.25, (u) => 0.6 - 0.5 * u, (u) => Math.exp(-u * 6), 0, vel); sweep(FX, t, 0.2, 900, 120, { vel: vel * 0.6, env: (u) => 1 - u }); };
  const firework = (t, vel = 0.3, pan = 0) => {
    sweep(FX, t, 0.45, 700, 2600, { vel: vel * 0.25, env: (u) => u, pan });
    noiseFx(FX, t + 0.45, 0.5, (u) => 0.5 - 0.4 * u, (u) => Math.exp(-u * 5), pan, vel);
    for (let i = 0; i < 14; i++) noiseFx(FX, t + 0.6 + i * 0.07 + (i % 3) * 0.02, 0.03, () => 0.8, (u) => 1 - u, pan + (i % 2 ? 0.3 : -0.3), vel * 0.4);
  };
  const click = (t, f = 1800, vel = 0.12, pan = 0) => sweep(FX, t, 0.025, f, f * 0.8, { vel, env: (u) => 1 - u, pan });
  const wood = (t, f = 900, vel = 0.14, pan = 0) => sweep(FX, t, 0.07, f, f * 0.9, { vel, env: (u) => Math.exp(-u * 8), pan });
  const paper = (t, vel = 0.2) => noiseFx(FX, t, 0.12, () => 0.35, (u) => Math.sin(Math.PI * u), 0.2, vel);
  const squeak = (t, up = true, vel = 0.08) => sweep(FX, t, 0.14, up ? 700 : 1000, up ? 1000 : 700, { type: 'square', vel });
  const boing = (t, vel = 0.2) => sweep(FX, t, 0.35, 180, 720, { type: 'tri', wobble: true, vel });
  const zip = (t, vel = 0.15) => sweep(FX, t, 0.2, 400, 3200, { vel, env: (u) => Math.sin(Math.PI * u) });
  const thud = (t, vel = 0.4) => sweep(FX, t, 0.2, 110, 50, { vel, env: (u) => Math.exp(-u * 5) });
  const clang = (t, vel = 0.3) => { bell(FX, t, 'A3', { ratio: 1.41, index: 5, decay: 1.4, vel }); noiseFx(FX, t, 0.2, () => 0.7, (u) => Math.exp(-u * 8), 0, vel * 0.5); };
  const splash = (t, vel = 0.3) => noiseFx(FX, t, 0.5, (u) => 0.4 - 0.3 * u, (u) => Math.exp(-u * 4), 0, vel);
  const ha = (t, base = 520, vel = 0.1, pan = 0) => { for (let i = 0; i < 3; i++) sweep(FX, t + i * 0.13, 0.1, base * (1 - i * 0.06), base * 0.8 * (1 - i * 0.06), { type: 'square', vel, pan }); };
  const giggle = (t, base = 600, vel = 0.08, pan = 0) => { for (let i = 0; i < 4; i++) sweep(FX, t + i * 0.07, 0.06, base * (1 + i * 0.1), base * (1.15 + i * 0.1), { type: 'tri', vel, pan }); };
  const thunder = (t, vel = 0.5) => noiseFx(FX, t, 3.2, (u) => 0.015 + 0.02 * Math.exp(-u * 3), (u) => Math.min(1, u * 20) * Math.exp(-u * 2.2) * (0.7 + 0.3 * Math.sin(u * 40)), 0, vel);
  const rainAmb = (t0, t1, vel = 0.12) => {
    noiseFx(FX, t0, t1 - t0, () => 0.22, (u) => Math.min(1, u * (t1 - t0) / 1.2) * Math.min(1, (1 - u) * (t1 - t0) / 1.2), (u) => Math.sin(u * 30) * 0.2, vel);
    for (let t = t0; t < t1; t += 0.037) { const r = Math.sin(t * 991.7) * 0.5 + 0.5; if (r > 0.55) click(t, 2400 + r * 3000, 0.02 + r * 0.02, (r - 0.5) * 1.6); }
  };
  const crowd = (t0, len, vel = 0.1) => noiseFx(FX, t0, len, () => 0.06, (u) => Math.sin(Math.PI * u) * (0.8 + 0.2 * Math.sin(u * 23)), 0, vel);
  const cheer = (t, vel = 0.16) => noiseFx(FX, t, 1.4, (u) => 0.12 + 0.1 * Math.sin(u * 3), (u) => Math.min(1, u * 8) * Math.exp(-u * 1.8), 0, vel);
  const crackle = (t0, t1, vel = 0.05) => { for (let t = t0; t < t1; t += 0.05) { const r = Math.sin(t * 777.7) * 0.5 + 0.5; if (r > 0.6) noiseFx(FX, t, 0.02, () => 0.9, (u) => 1 - u, -0.5, vel * r); } noiseFx(FX, t0, t1 - t0, () => 0.03, () => 1, -0.4, vel * 0.6); };
  const heartbeat = (t, vel = 0.25) => { kick(FX, t, vel); kick(FX, t + 0.22, vel * 0.7); };
  const scratch = (t) => noiseFx(FX, t, 0.3, (u) => 0.1 + u * 0.6, (u) => Math.sin(Math.PI * u), 0, 0.3);
  const chords = (t0, bpm, list, beats, fn = pad, oct = 0) => list.forEach((c, i) => melody(M, fn, t0 + i * beats * 60 / bpm, bpm, tr(CHORD[c] || c, oct) + ' -'.repeat(beats * 2 - 1), 0.5));
  const drums = (t0, bpm, bars, o = {}) => {
    const b = 60 / bpm;
    for (let bar = 0; bar < bars; bar++)
      for (let k = 0; k < 8; k++) {
        const t = t0 + (bar * 4 + k * 0.5) * b;
        if (k === 0 || k === 4 || (o.four && k % 2 === 0)) kick(M, t, o.kv ?? 0.5);
        if (k === 2 || k === 6) snare(M, t, o.sv ?? 0.22);
        hat(M, t, k % 2 ? 0.05 : 0.08, false, 0.3);
      }
  };
  const theme = (t0, bpm, parts, k = 0, o = {}) => {
    let t = t0;
    for (const p of parts) {
      const dur = (TH[p].split(/\s+/).length * 0.5 * 60) / bpm;
      melody(o.leadBus || LEAD, o.fn || lead, t, bpm, tr(TH[p], k + (o.oct || 0)), 0.5, o.vo || {});
      if (o.bass !== false) BARCH[p].forEach((c, i) => melody(M, bass, t + (i * 4 * 60) / bpm, bpm, tr(CH[p][i].replace(/\d/, (d) => d), k) + ' . ' + tr(CH[p][i], k + 7) + ' . ' + tr(CH[p][i], k) + ' . ' + tr(CH[p][i], k + 7) + ' .', 0.5));
      if (o.pad !== false) BARCH[p].forEach((c, i) => melody(SND, pad, t + (i * 4 * 60) / bpm, bpm, tr(CHORD[c], k) + ' - - - - - - -', 0.5));
      if (o.drums) drums(t, bpm, 2, o.drums);
      t += dur;
    }
    return t;
  };

  // ===== S0: ident =====
  let T = S(0);
  melody(SND, pad, T + 0.6, 60, 'C3+G3+E4 - - - - - - -', 0.5);
  melody(M, chime, T + 0.75, 110, 'C5 E5 G5 B5 D6 . . .', 0.25);
  for (let i = 0; i < 14; i++) click(T + 1.25 + i * 0.068, 2600 + (i % 3) * 300, 0.08);
  bell(M, T + 2.3, 'G5', { vel: 0.12, decay: 1.5 }); bell(M, T + 2.3, 'C6', { vel: 0.1, decay: 1.5 });
  sweep(FX, T + 2.36, 0.12, 300, 600, { type: 'tri', vel: 0.12 });
  sweep(FX, T + 2.62, 0.08, 800, 1000, { type: 'square', vel: 0.06 });
  boing(T + 3.36, 0.16); thud(T + 3.6, 0.2);
  bell(M, T + 3.95, 'E5', { vel: 0.08, decay: 1.2 });

  // ===== S1: prologue (festival, D major) =====
  T = S(1);
  melody(SND, pad, T + 0.2, 60, 'D3+A3+F#4 - - - - - B2+F#3+D4 - - -', 0.5);
  melody(M, chime, T + 0.5, 112, tr('D5 F#5 A5 D6 A5 F#5 D5 A4 E5 G5 B5 E6 B5 G5 E5 B4', 0), 0.5);
  melody(M, chime, T + 3.2, 180, 'A5 B5 C#6 D6 E6 F#6 A6', 0.25);
  whoosh(T + 3.9, 1.2, 0.2);
  theme(T + 3.95, 112, ['A'], 2, { drums: { kv: 0.45 } });
  [4.6, 5.1, 5.7, 6.3, 6.9, 7.4].forEach((d, i) => firework(T + d, 0.22, (i % 2 ? 0.4 : -0.4)));
  cheer(T + 4.3, 0.1);
  theme(T + 8.3, 112, ['B'], 2, { fn: leadSoft, pad: true });
  melody(M, brass, T + 10.7, 100, 'G4 - F#4 - - -', 0.5); // the Opus lantern passes "3"
  melody(M, brass, T + 12.6, 100, 'F#4 - F4 - - -', 0.5); // ...and GPT-5.2
  whoosh(T + 9.3, 1.0, 0.15, -0.3); whoosh(T + 11.8, 1.0, 0.15, 0.3);
  melody(SND, pad, T + 13.2, 60, 'B2+F#3+D4 - - - - -', 0.5);

  // ===== S2: time-lapse + title =====
  T = S(2);
  for (let t = 0.6; t < 6.6; t += 0.25) wood(T + t, t % 0.5 < 0.25 ? 1300 : 1000, 0.07);
  melody(M, chime, T + 0.6, 140, tr('D5 F#5 A5 F#5 A4 C#5 E5 C#5 B4 D5 F#5 D5 G4 B4 D5 B4', 0) + ' ' + tr('D5 F#5 A5 F#5 A4 C#5 E5 C#5 B4 D5 F#5 D5 G4 B4 D5 B4', 12), 0.25);
  melody(M, chime, T + 0.6 + 32 * 0.25 * 60 / 140, 140, tr('D5 F#5 A5 F#5 A4 C#5 E5 C#5 B4 D5 F#5 D5 G4 B4 D5 B4', 2), 0.25);
  melody(M, bass, T + 0.6, 140, 'D2 . D3 . A2 . A3 . B2 . B3 . G2 . G3 . D2 . D3 . A2 . A3 . B2 . B3 . G2 . G3 . D2 . D3 . A2 . A3 .', 0.5);
  [[0.8, 'A5'], [1.3, 'B5'], [2.0, 'D4'], [2.4, 'C#6'], [2.9, 'D6'], [3.3, 'F#5'], [3.7, 'E6'], [4.1, 'G5'], [4.4, 'F#6'], [4.8, 'Eb6'], [5.2, 'A6'], [5.6, 'B6']].forEach(([d, nte]) => { whoosh(T + d, 0.7, 0.08); bell(M, T + d + 0.3, nte, { vel: 0.06, decay: 1 }); });
  pop(T + 1.65, 0.2); pop(T + 5.95, 0.2);
  [0.9, 1.9, 2.9, 3.9, 4.9].forEach((d) => paper(T + d, 0.12));
  crash(M, T + 6.7, 0.22, 3); kick(M, T + 6.7, 0.6);
  melody(SND, pad, T + 6.7, 60, 'C3+G3+E4+D5 - - - - - - -', 0.5);
  melody(M, box, T + 7.2, 90, TH.A.split(' ').slice(0, 12).join(' '), 0.5); // ends on D: unresolved, "coming soon"
  boing(T + 7.8, 0.1);
  sweep(FX, T + 9.2, 0.8, 500, 260, { type: 'tri', vel: 0.08 });

  // ===== S3: the promise =====
  T = S(3);
  crowd(T, 6.2, 0.07);
  melody(M, brass, T + 0.2, 120, 'C4+E4+G4 - - - F4+A4+C5 - - - G4+B4+D5 - - - - - . .', 0.5);
  whoosh(T + 1.9, 0.6, 0.2); crash(M, T + 1.95, 0.18, 1.8); melody(M, brass, T + 1.95, 120, 'C4+E4+G4+C5 - - - - -', 0.5); cheer(T + 2.0, 0.14);
  bell(M, T + 3.3, 'C6', { vel: 0.14 }); bell(M, T + 3.3, 'G5', { vel: 0.1 });
  theme(T + 3.4, 120, ['C'], 0, { drums: { kv: 0.4 }, pad: true });
  cheer(T + 3.5, 0.14);
  melody(M, V('square', { duty: 0.3, lp: 0.1, vel: 0.1, a: 0.01, r: 0.05 }), T + 6.2, 100, 'E3 . G3 . F#3 . . . E3 . G3 . A3 . . .', 0.5);
  for (let t = 6.3; t < 9; t += 0.18) noiseFx(FX, T + t, 0.06, () => 0.5, (u) => Math.sin(Math.PI * u), -0.6, 0.05);
  sweep(FX, T + 7.9, 0.2, 400, 330, { type: 'square', vel: 0.05 });

  // ===== S4: workshop =====
  T = S(4);
  for (let t = 0.3; t < 18; t += 0.5) if (t < 12.8 || t > 15.6) wood(T + t, Math.round(t * 2) % 2 ? 1250 : 950, 0.05);
  melody(M, piz, T + 0.2, 100, 'A2 . E3 . A2 . E3 . F2 . C3 . E2 . B2 . A2 . E3 . A2 . E3 . F2 . C3 . E2 . G#2 .', 0.5);
  melody(M, piz, T + 5.0, 100, 'A2 . E3 . A2 . E3 . F2 . C3 . E2 . B2 . A2 . E3 . A2 . E3 . D2 . A2 . E2 . G#2 .', 0.5);
  melody(M, piz, T + 9.8, 100, 'A2 . E3 . A2 . E3 . F2 . C3 . E2 . B2 .', 0.5);
  [0.05, 4.1, 8.15, 12.0].forEach((d) => { paper(T + d, 0.2); bell(M, T + d + 0.25, 'E6', { vel: 0.05, decay: 0.6 }); });
  for (let k = 0; k < 5; k++) { squeak(T + 0.95 + k * 0.4, true); squeak(T + 1.15 + k * 0.4, false); noiseFx(FX, T + 0.95 + k * 0.4, 0.3, () => 0.1, (u) => Math.sin(Math.PI * u), 0, 0.06); }
  noiseFx(FX, T + 3.0, 0.7, (u) => 0.4 - 0.35 * u, (u) => Math.exp(-u * 2), 0.3, 0.28);
  melody(M, V('square', { duty: 0.5, lp: 0.08, vel: 0.12, a: 0.02, vib: 0.3, vibDelay: 0.3 }), T + 3.2, 90, 'G3 - - F#3 - - F3 - - E3 - - - - - -', 0.5);
  whoosh(T + 5.0, 0.5, 0.12, 0.4); whoosh(T + 5.8, 0.7, 0.14, -0.2);
  const flashHope = (t) => { sweep(FX, t, 0.6, 500, 2400, { vel: 0.08, env: (u) => u }); pop(t + 0.6, 0.32); melody(M, chime, t + 0.62, 160, 'G5 B5 D6 G6', 0.25); sweep(FX, t + 1.2, 0.8, 900, 400, { vel: 0.04 }); };
  flashHope(T + 6.65); flashHope(T + 10.45);
  paper(T + 9.7, 0.14); noiseFx(FX, T + 10.0, 0.25, () => 0.5, (u) => Math.sin(Math.PI * u), 0, 0.06);
  melody(SND, V('saw', { a: 0.3, d: 0.5, s: 0.8, r: 1.2, lp: 0.05, vel: 0.12, gate: 1 }), T + 12.8, 60, 'D3+A3+F#4 - G3+B3+D4+G4 - A3+E4+C#5 - - -', 0.5);
  [12.9, 13.3, 13.8, 14.2].forEach((d, i) => { whoosh(T + d, 1.2, 0.14, (i % 2 ? 0.4 : -0.4)); bell(M, T + d + 0.8, ['D6', 'A5', 'F#6', 'E6'][i], { vel: 0.08, decay: 2 }); });
  melody(M, pno, T + 13.0, 72, 'C5 - E5 - F5 - E5 - C5 - - -', 0.5);
  bell(FX, T + 13.8, 'E7', { vel: 0.04, decay: 0.3 });
  melody(M, pno, T + 15.6, 70, 'A4 . . C5 . . B4 . E5 - - -', 0.5);
  melody(M, brass, T + 16.6, 120, 'E4 - A4 - B4 - C5 - - -', 0.5);
  zip(T + 17.2, 0.14); whoosh(T + 17.2, 0.6, 0.2, 0.5);

  // ===== S5: the hill =====
  T = S(5);
  melody(SND, pad, T, 60, 'F3+A3+C4 - - - - - C3+G3+E4 - - - - -', 0.5);
  whoosh(T + 0.8, 1.2, 0.14, -0.4); whoosh(T + 1.3, 1.2, 0.14, 0.2);
  melody(M, chime, T + 1.0, 90, 'F5 A5 C6 . E5 G5 C6 . F5 A5 C6 E6 - - . .', 0.5);
  for (let k = 0; k < 14; k++) snare(M, T + 2.7 + k * 0.05, 0.04 + k * 0.004);
  sweep(FX, T + 3.4, 0.9, 400, 2200, { vel: 0.12, env: (u) => u });
  pop(T + 4.3, 0.42); melody(M, box, T + 4.3, 140, 'C6 E6 G6 B6', 0.25);
  sweep(FX, T + 4.8, 0.9, 900, 250, { type: 'tri', vel: 0.1 });
  melody(M, V('square', { duty: 0.5, lp: 0.08, vel: 0.12, a: 0.01, r: 0.05 }), T + 5.8, 110, 'C3 . Eb3 . C3 . G2 . C3 . Eb3 . F#3 . G3 .', 0.5);
  whoosh(T + 6.9, 1, 0.12, 0.4); whoosh(T + 7.3, 1, 0.12, 0.5);
  const taunt = V('pulse', { duty: 0.5, lp: 0.3, vel: 0.1, a: 0.005, r: 0.05 });
  melody(M, taunt, T + 8.4, 150, 'G4 E4 A4 G4 E4 . . . G4 E4 A4 G4 E4 . . .', 0.5);
  for (let k = 0; k < 5; k++) ha(T + 8.45 + k * 0.5, 560 - (k % 2) * 60, 0.07, 0.5);
  noiseFx(FX, T + 9.25, 0.06, () => 0.6, (u) => 1 - u, 0, 0.32); thud(T + 9.25, 0.18);
  noiseFx(FX, T + 9.7, 1.2, () => 0.25, (u) => Math.sin(Math.PI * u), 0.3, 0.22);
  splash(T + 10.2, 0.2); splash(T + 10.6, 0.14);
  ha(T + 10.3, 600, 0.08, -0.3); ha(T + 10.45, 500, 0.07, 0.3);
  melody(M, leadSoft, T + 11.3, 70, 'E5 - D5 - C5 - B4 - A4 - - -', 0.5);
  melody(SND, pad, T + 11.3, 60, 'A2+E3+C4 - - - F2+C3+A3 - - -', 0.5);
  thunder(T + 12.6, 0.4);
  rainAmb(T + 12.8, T + 14.2, 0.08);

  // ===== S6: rain =====
  T = S(6);
  rainAmb(T, T + 12, 0.13);
  thunder(T + 2.5, 0.55);
  const pn = PIANO({ vel: 0.34 });
  melody(M, pn, T + 0.6, 66, 'A4 - C5 - D5 - C5 - A4 - G4 - E4 - - -', 0.5);
  melody(M, pn, T + 4.4, 66, 'F4 - G4 - A4 - C5 - B4 - - - . . . .', 0.5);
  melody(SND, pad, T + 0.6, 33, 'A2+E3+C4 - F2+C3+A3 - C3+G3+E4 - G2+D3+B3 -', 0.5);
  bell(M, T + 6.4, 'E7', { vel: 0.08, decay: 0.5 }); piano(M, T + 6.45, 'Bb3', { vel: 0.15 }); piano(M, T + 6.45, 'E4', { vel: 0.12 });
  bell(M, T + 7.0, 'B6', { vel: 0.04, decay: 1.5 });
  melody(M, piz, T + 8.3, 118, 'E2 . G2 . A2 . Bb2 . E2 . G2 . A2 . Bb2 .', 0.5, { vel: 0.32 });
  for (let t = 8.4; t < 10.4; t += 0.25) pluck(FX, T + t, 'E5', { vel: 0.05, len: 0.1 });
  for (let k = 0; k < 4; k++) bell(M, T + 8.5 + k * 0.4, ['E6', 'D6', 'B5', 'A5'][k], { vel: 0.035, decay: 0.6 });
  bell(M, T + 10.55, 'A5', { vel: 0.12, decay: 0.8 }); sweep(FX, T + 10.55, 0.2, 600, 1200, { type: 'tri', vel: 0.08 });
  melody(M, brass, T + 11.0, 120, 'A3+E4 - - C4+G4 - -', 0.5);

  // ===== S7: heist (spy theme) =====
  T = S(7);
  rainAmb(T, T + 16, 0.05);
  const spyBass = 'E2 . E2 G2 . E2 A2 Bb2 E2 . E2 G2 . E2 B2 Bb2';
  melody(M, piz, T + 0.1, 118, spyBass + ' ' + spyBass + ' ' + spyBass, 0.5);
  const stab = V('square', { duty: 0.3, lp: 0.2, vel: 0.06, a: 0.002, d: 0.05, s: 0.2, r: 0.03 });
  melody(M, stab, T + 0.1, 118, '. E4+G4 . . . E4+G4 . . . E4+A4 . . . E4+Bb4 . . . E4+G4 . . . E4+G4 . . . E4+A4 . . . D#4+B4 . .', 0.5);
  for (let t = 0.1; t < 6.2; t += 60 / 118 / 2) hat(M, T + t, 0.04, false, -0.3);
  for (let t = 1.4; t < 10.0; t += 0.5) noiseFx(FX, T + t, 0.12, () => 0.3, (u) => Math.sin(Math.PI * u), 0.4, 0.05);
  for (let t = 1.9; t < 10.0; t += 0.4) bell(FX, T + t, 'G6', { vel: 0.015, decay: 0.25 });
  giggle(T + 5.0, 420, 0.08, -0.2); giggle(T + 5.6, 460, 0.07, -0.2);
  melody(SND, V('saw', { a: 0.3, s: 0.9, r: 0.5, lp: 0.03, vel: 0.1, gate: 1 }), T + 6.2, 60, 'E2+B2 - - - - - - -', 0.5);
  heartbeat(T + 6.3, 0.2); heartbeat(T + 7.1, 0.2); heartbeat(T + 7.9, 0.22);
  ha(T + 7.6, 380, 0.04, 0); ha(T + 8.1, 360, 0.035, 0);
  melody(M, chime, T + 8.8, 150, 'E4 G4 B4 D5 G5 B5', 0.25);
  noiseFx(FX, T + 8.6, 0.8, (u) => 0.05 + u * 0.4, (u) => u, 0, 0.12);
  zip(T + 9.3, 0.15);
  for (let k = 0; k < 4; k++) bell(FX, T + 9.8 + k * 0.3, 'E6', { ratio: 2.76, index: 3, decay: 1.8, vel: 0.13 });
  crash(M, T + 10.0, 0.2, 2); whoosh(T + 9.95, 0.8, 0.3); melody(SND, pad, T + 10.0, 60, 'E3+G#3+B3+E4 - - - - -', 0.5);
  for (let k = 0; k < 6; k++) wood(T + 10.3 + k * 0.12, 700 - k * 30, 0.1);
  sweep(FX, T + 10.1, 0.25, 500, 1400, { type: 'square', vel: 0.06 });
  melody(M, V('pulse', { duty: 0.25, vel: 0.08, a: 0.002, r: 0.02 }), T + 11.6, 160, 'B5 A5 G5 F#5 E5 D5 C5 B4 A4 G4 F#4 E4', 0.25);
  for (let t = 11.6; t < 13.4; t += 0.09) click(T + t, 400, 0.08, -0.4);
  noiseFx(FX, T + 12.3, 0.4, () => 0.8, (u) => Math.exp(-u * 5), 0, 0.2); for (let k = 0; k < 6; k++) bell(FX, T + 12.32 + k * 0.05, ['E7', 'C7', 'G7', 'D7', 'A6', 'F7'][k], { vel: 0.03, decay: 0.3 });
  bell(M, T + 14.0, 'G5', { vel: 0.06 });

  // ===== S8: friendship =====
  T = S(8);
  rainAmb(T, T + 7.2, 0.08);
  sweep(FX, T + 0.2, 0.5, 120, 90, { type: 'square', wobble: true, vel: 0.05 });
  sweep(FX, T + 1.5, 0.18, 500, 800, { type: 'tri', vel: 0.06 });
  noiseFx(FX, T + 3.8, 0.3, () => 0.05, (u) => Math.exp(-u * 4), 0, 0.3); sweep(FX, T + 3.8, 0.25, 300, 700, { type: 'tri', vel: 0.06 });
  theme(T + 4.2, 84, ['A', 'B'], 5, { fn: box, leadBus: M, bass: false });
  melody(M, V('tri', { a: 0.01, r: 0.1, vel: 0.14, gate: 0.8 }), T + 4.2, 84, 'F2 . . . C3 . . . D2 . . . A2 . . . Bb2 . . . F2 . . . C3 . . . C3 . . .', 0.5);
  crackle(T + 7, T + 14, 0.05);
  noiseFx(FX, T + 7.4, 0.3, () => 0.4, (u) => Math.sin(Math.PI * u) * (0.5 + 0.5 * Math.sin(u * 50)), 0, 0.1);
  melody(M, chime, T + 8.8, 150, 'A5 C6 F6 A6', 0.25); giggle(T + 8.85, 700, 0.07, 0); giggle(T + 9.2, 800, 0.06, 0.2);
  for (let k = 0; k < 4; k++) noiseFx(FX, T + 9.2 + k * 0.18, 0.05, () => 0.7, (u) => 1 - u, 0, 0.1);
  thud(T + 10.7, 0.25); thud(T + 10.92, 0.25);
  sweep(FX, T + 11.2, 0.4, 150, 110, { type: 'square', wobble: true, vel: 0.04 });
  sweep(FX, T + 11.1, 0.08, 700, 900, { type: 'square', vel: 0.05 }); sweep(FX, T + 11.2, 0.08, 900, 1200, { type: 'square', vel: 0.05 });
  bell(M, T + 12.6, 'F6', { vel: 0.07, decay: 0.6 }); bell(M, T + 13.0, 'C7', { vel: 0.05, decay: 1 });

  // ===== S9: montage =====
  T = S(9);
  theme(T, 128, ['A', 'C', 'D'], 7, { drums: { kv: 0.5, sv: 0.2 } });
  for (let t = 0.2; t < 3.3; t += 0.09) click(T + t, 2200 + ((t * 100) % 7) * 150, 0.03, -0.5);
  for (let k = 0; k < 10; k++) bell(M, T + 3.5 + k * 0.3, nameOf(64 + k * 2), { vel: 0.04, decay: 0.3 });
  paper(T + 7.0, 0.2); whoosh(T + 8.1, 0.4, 0.15);
  whoosh(T + 8.5, 1.0, 0.25); melody(M, chime, T + 8.55, 180, 'C6 E6 G6 C7', 0.25);
  for (let k = 0; k < 8; k++) snare(M, T + 9.5 + k * 0.06, 0.08 + k * 0.02);

  // ===== S10: Gemini 4 =====
  T = S(10);
  melody(SND, V('saw', { a: 0.8, s: 0.9, r: 0.8, lp: 0.025, vel: 0.12, gate: 1 }), T, 60, 'D2+A2 - - - - - -', 0.5);
  noiseFx(FX, T, 3.2, () => 0.03, (u) => Math.sin(Math.PI * u), 0, 0.08);
  for (let k = 0; k < 4; k++) heartbeat(T + 0.4 + k * 0.85, 0.16 + k * 0.03);
  ['D5', 'F#5', 'A5', 'D6'].forEach((nt, i) => {
    const t = T + [3.8, 4.5, 5.2, 5.9][i];
    bell(M, t, nt, { ratio: 2, index: 1.6, decay: 2.8, vel: 0.2 });
    bell(M, t, tr(nt, -12), { ratio: 2, index: 1, decay: 2.5, vel: 0.1 });
    whoosh(t, 0.5, 0.12, [0, 0.5, 0, -0.5][i]);
  });
  noiseFx(FX, T + 5.9, 0.45, (u) => 0.05 + u * 0.5, (u) => u, 0, 0.2);
  crash(M, T + 6.3, 0.3, 3); kick(M, T + 6.3, 0.7);
  melody(SND, pad, T + 6.3, 60, 'D3+A3+F#4+D5 - - - - -', 0.5); melody(M, brass, T + 6.3, 60, 'D4+F#4+A4 - - -', 0.5);
  melody(M, chime, T + 7.2, 150, 'D5 F#5 A5 D6 F#6 A6 D5 F#5 A5 D6 F#6 A6 E5 G5 B5 E6 G6 B6 F#5 A5 C#6 F#6 A6 C#7', 0.25);
  noiseFx(FX, T + 7.2, 3.4, (u) => 0.02 + u * 0.6, (u) => u * u, 0, 0.18);
  // click into the slot: the big hit and the triumphant theme
  const hitT = T + 9.6 + 1.2;
  crash(M, hitT, 0.35, 4); kick(M, hitT, 0.9); clang(hitT, 0.12);
  melody(M, brass, hitT, 60, 'D3+A3+D4+F#4+A4 - - -', 0.5);
  sweep(FX, hitT + 0.1, 1.2, 1200, 300, { vel: 0.05, wobble: true });
  const triStart = hitT + 0.35;
  theme(triStart, 120, ['A', 'C', 'B', 'D'], 2, { drums: { kv: 0.55, sv: 0.25, four: false }, vo: { vel: 0.15 } });
  melody(M, box, triStart, 120, tr(TH.A + ' ' + TH.C, 14), 0.5, { vel: 0.05 });
  [12.6, 13.1, 13.7, 14.2, 14.8, 15.3].forEach((d, i) => firework(T + d, 0.16, i % 2 ? 0.5 : -0.5));
  cheer(T + 12.4, 0.12);

  // ===== S11: walk (theme continues, then the stand-off) =====
  T = S(11);
  scratch(T + 5.0);
  melody(M, V('square', { duty: 0.5, lp: 0.08, vel: 0.12, a: 0.01, r: 0.05 }), T + 5.3, 110, 'C3 . Eb3 . C3 . G2 . . .', 0.5);
  noiseFx(FX, T + 6.2, 0.5, (u) => 0.05 + u * 0.3, (u) => u, 0.3, 0.12);
  noiseFx(FX, T + 6.6, 0.8, () => 0.3, (u) => Math.sin(Math.PI * u), 0.4, 0.2);
  melody(M, chime, T + 7.3, 200, 'C6 D6 E6 G6 A6 C7 D7 E7 G7', 0.25);
  for (let k = 0; k < 5; k++) splash(T + 8.0 + k * 0.3, 0.12);
  melody(M, V('square', { duty: 0.5, lp: 0.08, vel: 0.1, a: 0.02, vib: 0.3, vibDelay: 0.2 }), T + 8.6, 100, 'Eb3 - D3 - Db3 - C3 - - -', 0.5);
  theme(T + 9.8, 120, ['D'], 2, { drums: { kv: 0.5 } });
  noiseFx(FX, T + 10.7, 0.06, () => 0.9, (u) => 1 - u, 0, 0.3);

  // ===== S12: ambush =====
  T = S(12);
  melody(M, piz, T + 0.1, 132, spyBass + ' ' + spyBass, 0.5);
  melody(M, stab, T + 0.1, 132, '. E4+G4 . . . E4+G4 . . . E4+A4 . . . E4+Bb4 . . . E4+G4 . . . E4+G4 . . . E4+A4 . . . D#4+B4 . .', 0.5);
  for (let t = 0.3; t < 3.2; t += 0.26) pluck(FX, T + t, 'E5', { vel: 0.08, len: 0.1 });
  click(T + 3.8, 900, 0.15);
  noiseFx(FX, T + 3.9, 0.3, () => 0.2, (u) => u, 0, 0.1);
  noiseFx(FX, T + 4.2, 1.1, (u) => 0.5 - 0.45 * u, (u) => Math.exp(-u * 1.5), 0, 0.25); sweep(FX, T + 4.2, 1.0, 900, 200, { type: 'square', wobble: true, vel: 0.05 });
  boing(T + 5.2, 0.12);
  piano(M, T + 5.6, 'E2', { vel: 0.3 }); piano(M, T + 5.6, 'F2', { vel: 0.25 });
  bell(FX, T + 5.7, 'B6', { vel: 0.05, decay: 0.3 }); bell(FX, T + 5.85, 'E7', { vel: 0.05, decay: 0.3 }); bell(FX, T + 6.0, 'G7', { vel: 0.05, decay: 0.3 });
  click(T + 7.0, 1500, 0.15); sweep(FX, T + 7.05, 0.3, 1600, 200, { vel: 0.1 }); clang(T + 7.4, 0.3);
  whoosh(T + 7.3, 0.7, 0.3); crash(M, T + 7.4, 0.2, 2); melody(SND, pad, T + 7.4, 60, 'E3+G#3+B3+E4 - - -', 0.5);
  noiseFx(FX, T + 8.6, 0.6, (u) => 0.2 - 0.15 * u, (u) => Math.exp(-u * 4), 0, 0.35); sweep(FX, T + 8.62, 0.4, 200, 60, { vel: 0.2 });
  sweep(FX, T + 9.4, 0.35, 600, 1800, { type: 'square', vel: 0.07 }); sweep(FX, T + 9.75, 0.3, 1500, 1900, { type: 'square', vel: 0.06 });
  melody(M, V('pulse', { duty: 0.25, vel: 0.08, a: 0.002, r: 0.02 }), T + 10.8, 170, 'B5 A5 G5 F#5 E5 D5 C5 B4 A4 G4 F#4 E4', 0.25);
  for (let t = 10.8; t < 12.8; t += 0.07) click(T + t, 380, 0.06, 0.4);
  for (let k = 0; k < 3; k++) giggle(T + 11.0 + k * 0.45, 600 + k * 40, 0.06, (k % 2 ? 0.4 : -0.4));
  noiseFx(FX, T + 12.15, 0.06, () => 0.9, (u) => 1 - u, 0, 0.3);
  melody(M, brass, T + 12.2, 140, 'C4+E4+G4 - C5+E5+G5 -', 0.5);

  // ===== S13: finale (the theme finally resolves) =====
  T = S(13);
  melody(SND, pad, T + 0.4, 40, 'C3+G3+E4 - F3+C4+A4 - G3+D4+B4 - C3+G3+E4 - - -', 0.5);
  melody(M, box, T + 0.6, 80, 'E5 - G5 - A5 - C6 - F5 - E5 - D5 - G5 - C5 - - - - - . .', 0.5);
  melody(M, pno, T + 0.6, 80, 'C4 . . . A3 . . . F3 . . . G3 . . . C3 - - - - - . .', 0.5);
  bell(M, T + 2.0, 'E7', { vel: 0.04, decay: 1 }); bell(M, T + 2.2, 'G7', { vel: 0.03, decay: 1 });
  bell(M, T + 5.6, 'C5', { ratio: 2, index: 1, decay: 3, vel: 0.12 }); bell(M, T + 5.6, 'G5', { ratio: 2, index: 1, decay: 3, vel: 0.08 });
  // cast roll: a little chime for each character
  ['C5', 'E5', 'G5', 'A5', 'C6', 'E6'].forEach((n, i) => { bell(M, T + 6.5 + i * 0.35, n, { vel: 0.08, decay: 0.8 }); sweep(FX, T + 6.5 + i * 0.35, 0.12, 300, 600, { type: 'tri', vel: 0.05 }); });
  melody(M, V('tri', { a: 0.01, r: 0.2, vel: 0.14, gate: 0.9 }), T + 6.5, 120, 'C4 . G3 . A3 . E3 . F3 . C4 . G3 . . .', 0.5);
  rainAmb(T + 10.4, T + 15, 0.05);
  melody(M, V('square', { duty: 0.5, lp: 0.08, vel: 0.08, a: 0.02, vib: 0.35, vibDelay: 0.15 }), T + 12.4, 110, 'D3 - C#3 - C3 - - -', 0.5);

  // ---------- mix ----------
  const rv = reverb(SND, 0.9, 0.86, 0.35);
  const rvM = reverb(M, 0.22, 0.8, 0.4);
  const rvL = reverb(LEAD, 0.25, 0.8, 0.4);
  const dl = delay(LEAD, 60 / 112 * 0.75, 0.3, 0.18);
  const rvF = reverb(FX, 0.12, 0.7, 0.5);
  const L = new Float32Array(n), R = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let l = M.L[i] + SND.L[i] * 0.6 + LEAD.L[i] + FX.L[i] + rv.L[i] + rvM.L[i] + rvL.L[i] + dl.L[i] + rvF.L[i];
    let r = M.R[i] + SND.R[i] * 0.6 + LEAD.R[i] + FX.R[i] + rv.R[i] + rvM.R[i] + rvL.R[i] + dl.R[i] + rvF.R[i];
    l = Math.tanh(l * 1.1); r = Math.tanh(r * 1.1);
    L[i] = l; R[i] = r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  const g = 0.89 / Math.max(0.01, peak);
  for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  return { L, R };
}
