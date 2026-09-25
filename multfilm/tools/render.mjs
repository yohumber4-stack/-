// Parallel render to MP4: node tools/render.mjs [--from s] [--to s] [--workers n] [--scale 4] [--crf 16] [--out file]
import { fork, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS } from '../src/engine/core.js';
import { DURATION, SCENES } from '../src/film.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const from = +(args.from || 0), to = +(args.to || DURATION);
const workers = +(args.workers || 3), scale = +(args.scale || 4), crf = String(args.crf || 16), preset = args.preset || 'medium';
const outFile = path.resolve(root, args.out || 'out/coming-soon.mp4');
const segDir = path.join(root, 'out', 'segments');
fs.mkdirSync(segDir, { recursive: true });
for (const f of fs.readdirSync(segDir)) fs.unlinkSync(path.join(segDir, f));

const F0 = Math.round(from * FPS), F1 = Math.round(to * FPS), total = F1 - F0;
const chunks = Math.max(workers * 3, 1);
const per = Math.ceil(total / chunks);
const jobs = [];
for (let k = 0; k < chunks; k++) {
  const a = F0 + k * per, b = Math.min(F1, a + per);
  if (a < b) jobs.push({ a, b, out: path.join(segDir, `seg_${String(k).padStart(3, '0')}.mp4`) });
}
console.log(`Rendering ${total} frames (${from}s..${to}s) in ${jobs.length} chunks on ${workers} workers; scenes: ${SCENES.length}`);
const t0 = Date.now();
let done = 0;
const progress = new Map();
const queue = [...jobs];
await Promise.all(Array.from({ length: workers }, async () => {
  while (queue.length) {
    const j = queue.shift();
    await new Promise((res, rej) => {
      const w = fork(path.join(here, 'render-worker.mjs'), [j.a, j.b, j.out, scale, crf, preset]);
      w.on('message', (m) => {
        if (m.f !== undefined) progress.set(j.out, m.f - j.a);
        if (m.done) { done += j.b - j.a; progress.delete(j.out); }
        const cur = done + [...progress.values()].reduce((s, v) => s + v, 0);
        process.stdout.write(`\r${cur}/${total} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s   `);
      });
      w.on('exit', (code) => (code === 0 ? res() : rej(new Error('worker failed ' + code))));
    });
  }
}));
console.log(`\nframes done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const list = path.join(segDir, 'list.txt');
fs.writeFileSync(list, jobs.map((j) => `file '${j.out}'`).join('\n'));
const silent = path.join(segDir, 'video.mp4');
let r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent], { stdio: 'inherit' });
if (r.status !== 0) process.exit(1);
const wav = path.join(root, 'out', 'soundtrack.wav');
if (fs.existsSync(wav) && !args.silent) {
  r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-ss', String(from), '-t', String(to - from), '-i', wav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
} else {
  r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-c', 'copy', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
}
if (r.status !== 0) process.exit(1);
console.log('wrote', outFile, (fs.statSync(outFile).size / 1e6).toFixed(1) + ' MB');
