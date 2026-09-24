// Static preview server for dist/. With --watch it rebuilds (dev, uncompressed) on every source change.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3000);
const watch = process.argv.includes('--watch');
if (watch) process.argv.push('--dev');
const { buildOptions, bundleToHtml, buildOnce } = await import('./build.mjs');

if (watch) {
  const ctx = await esbuild.context({
    ...buildOptions,
    minify: false,
    define: { __DEV__: 'true' },
    plugins: [{
      name: 'html',
      setup(b) {
        b.onEnd(async (r) => {
          if (r.errors.length) { console.error('[watch] build failed'); return; }
          fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
          fs.writeFileSync(path.join(root, 'dist/index.html'), await bundleToHtml(r, { compress: false }));
          console.log('[watch] rebuilt', new Date().toLocaleTimeString());
        });
      },
    }],
  });
  await ctx.watch();
} else if (!fs.existsSync(path.join(root, 'dist/index.html')) || process.argv.includes('--build')) {
  await buildOnce();
}

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(root, 'dist', url === '/' ? 'index.html' : url);
  if (!file.startsWith(path.join(root, 'dist')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(root, 'dist/index.html');
  }
  res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`[serve] http://0.0.0.0:${port}`));
