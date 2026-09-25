// Renders a frame range and pipes raw RGBA into its own ffmpeg segment encode.
import { spawn } from 'node:child_process';
import { FB } from '../src/engine/fb.js';
import { FPS, W, H } from '../src/engine/core.js';
import { renderFrame } from '../src/film.js';

const [f0, f1, out, scale, crf, preset] = process.argv.slice(2);
const S = +scale;
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-vf', `scale=${W * S}:${H * S}:flags=neighbor,format=yuv420p`,
  '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-tune', 'animation', '-g', String(FPS * 2), '-bf', '2',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const fb = new FB();
const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));
const t0 = Date.now();
for (let f = +f0; f < +f1; f++) {
  renderFrame(fb, f / FPS);
  await write(Buffer.from(fb.u8));
  if (process.send && (f - f0) % 15 === 0) process.send({ f });
}
ff.stdin.end();
ff.on('close', (code) => {
  if (process.send) process.send({ done: true, code, ms: Date.now() - t0 });
  process.exit(code);
});
