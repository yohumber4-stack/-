// Bundles src/main.ts into ONE self-contained HTML file (no external assets or network access).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');

export const buildOptions = {
  entryPoints: [path.join(root, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: !dev,
  sourcemap: false,
  write: false,
  outfile: path.join(root, 'dist/game.js'),
  legalComments: 'none',
  define: { __DEV__: dev ? 'true' : 'false' },
  loader: { '.glsl': 'text', '.css': 'text' },
  logLevel: 'warning',
};

function escapeScript(code) {
  return code.replace(/<\/script/gi, '<\\/script');
}

export async function bundleToHtml(result, { compress = !dev } = {}) {
  const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
  const template = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  let scriptTag;
  if (compress) {
    // gzip + base64 the bundle; a tiny loader inflates it with the native DecompressionStream.
    const gz = zlib.gzipSync(Buffer.from(js, 'utf8'), { level: 9 });
    const b64 = gz.toString('base64');
    scriptTag = `<script id="payload" type="application/octet-stream">${b64}</script>\n<script>(async()=>{try{const b=atob(document.getElementById('payload').textContent.trim());const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);const s=new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));const code=await new Response(s).text();const el=document.createElement('script');el.textContent=code;document.body.appendChild(el);}catch(e){document.body.innerHTML='<pre style="color:#fff;padding:24px">Failed to start: '+e+'</pre>';}})();</script>`;
  } else {
    scriptTag = `<script>\n${escapeScript(js)}\n</script>`;
  }
  return template.replace('<!--GAME_SCRIPT-->', () => scriptTag);
}

export async function buildOnce() {
  const t0 = Date.now();
  const result = await esbuild.build(buildOptions);
  const html = await bundleToHtml(result);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const out = path.join(root, 'dist/index.html');
  fs.writeFileSync(out, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`[build] dist/index.html ${kb} KB in ${Date.now() - t0} ms${dev ? ' (dev)' : ''}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildOnce().catch((e) => { console.error(e); process.exit(1); });
}
