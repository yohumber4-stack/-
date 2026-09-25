// Render the soundtrack: node tools/audio.mjs [out/soundtrack.wav]
import fs from 'node:fs';
import { renderScore } from '../src/audio/score.js';
import { toWav } from '../src/audio/synth.js';

const t0 = Date.now();
const { L, R } = renderScore();
const out = process.argv[2] || 'out/soundtrack.wav';
fs.writeFileSync(out, toWav(L, R));
console.log(`${out}: ${(L.length / 44100).toFixed(1)}s in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
