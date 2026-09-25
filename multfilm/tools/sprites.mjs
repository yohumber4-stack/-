// Sprite QA sheet: node tools/sprites.mjs [out.png] [scale]
import { FB } from '../src/engine/fb.js';
import { text } from '../src/engine/font.js';
import { char, clawdWalk, codexWalk } from '../src/sprites/chars.js';
import { writeFB } from './png.mjs';

const fb = new FB(960, 600).clear(0x2a2a30);
const row = (y, label) => text(fb, label, 4, y - 58, 0x9aa0b0, { font: 'small' });
let y = 70;
row(y, 'CLAWD');
const cl = [{}, { eyes: 'blink' }, { eyes: 'happy', mouth: 'open', armL: -8, armR: -8 }, { eyes: 'sad', mouth: 'frown', blush: false }, { eyes: 'wide', mouth: 'o' },
  { eyes: 'angry', mouth: 'flat' }, { eyes: 'closed', acc: 'nightcap' }, { eyes: 'shock', mouth: 'scream', armL: -14, armR: -14 }, { eyes: 'star', mouth: 'laugh', blush: 'big' }, { ...clawdWalk(0) }, { ...clawdWalk(0.5) }, { sq: 2 }, { sq: -2, armL: -12, armR: -12 }, { eyes: 'teary', mouth: 'wobble' }, { eyes: 'heart', mouth: 'cat' }];
cl.forEach((o, i) => char(fb, 'clawd', 34 + i * 62, y, o));
y += 76;
row(y, 'CODEX');
const cx = [{}, { cursor: false }, { face: 'happy', armL: 'up', armR: 'up' }, { face: 'wow' }, { face: 'squint' }, { face: 'sad' }, { face: 'heart' }, { face: 'code', t: 0.3, armL: 'type', armR: 'type' },
  { face: 'enter' }, { face: 'braces' }, { face: 'check' }, { face: 'bar:0.6' }, { face: 'determined', ...codexWalk(0) }, { face: 'evil', armL: 'hold', armR: 'hold' }, { face: 'excl' }];
cx.forEach((o, i) => char(fb, 'codex', 34 + i * 62, y, o));
y += 76;
row(y, 'GEMINI');
const gm = [{}, { eyes: 'blink' }, { eyes: 'happy', mouth: 'open', handL: -12, handR: -12 }, { eyes: 'sad', mouth: 'frown', grey: 1 }, { eyes: 'wide', mouth: 'o' }, { eyes: 'determined', mouth: 'flat' },
  { eyes: 'closed', mouth: 'smile' }, { eyes: 'teary', mouth: 'wobble', grey: 0.6 }, { eyes: 'star', mouth: 'laugh', blush: 'big' }, { sx: 0.6 }, { sx: 0.25 }, { sy: 0.85, sx: 1.08 }, { rays: { r: 0, y: 0, g: 0, b: 1 }, eyes: 'happy', mouth: 'open' }, { eyes: 'shock', mouth: 'scream' }, { eyes: 'heart', mouth: 'cat' }];
gm.forEach((o, i) => char(fb, 'gemini', 34 + i * 62, y, o));
y += 76;
row(y, 'QWEN');
const qw = [{}, { eyes: 'shifty', mouth: 'smirk' }, { spy: true }, { spy: true, rub: 1, mouth: 'smirk', t: 0.1 }, { eyes: 'shock', mouth: 'scream', handL: -12, handR: -12 }, { eyes: 'happy', mouth: 'open' },
  { eyes: 'sad', mouth: 'frown' }, { goo: 1, eyes: 'dizzy', mouth: 'wobble' }, { spy: true, glasses: false, eyes: 'shifty', mouth: 'smirk' }, { eyes: 'wide', mouth: 'o' }];
qw.forEach((o, i) => char(fb, 'qwen', 36 + i * 66, y, o));
y += 76;
row(y, 'DEEPSEEK · KIMI');
const ds = [{}, { eyes: 'happy', mouth: 'laugh', handL: -8, handR: -8 }, { eyes: 'shifty', mouth: 'smirk' }, { eyes: 'shock', mouth: 'bigo' }, { wet: 1, eyes: 'closed', mouth: 'wobble' }, { eyes: 'angry', mouth: 'frown' }];
ds.forEach((o, i) => char(fb, 'deepseek', 36 + i * 66, y, o));
const km = [{}, { eyes: 'happy', mouth: 'laugh' }, { eyes: 'shifty', mouth: 'smirk' }, { eyes: 'shock', mouth: 'bigo' }, { eyes: 'closed', mouth: 'wobble' }];
km.forEach((o, i) => char(fb, 'kimi', 450 + i * 60, y, o));
y += 90;
row(y, 'SMALL (x0.5)');
['clawd', 'codex', 'gemini', 'qwen', 'deepseek', 'kimi'].forEach((n, i) => char(fb, n, 20 + i * 36, y, {}, { scale: 0.5 }));
char(fb, 'gemini', 240, y, { eyes: 'happy', mouth: 'open' }, { scale: 0.5 });
char(fb, 'clawd', 280, y, { eyes: 'happy', mouth: 'open', armL: -8, armR: -8 }, { scale: 0.5 });
text(fb, 'X2', 330, y - 60, 0x9aa0b0, { font: 'small' });
char(fb, 'gemini', 400, y + 50, { eyes: 'happy', mouth: 'open', handL: -10 }, { scale: 2 });
char(fb, 'clawd', 540, y + 50, {}, { scale: 2 });
char(fb, 'kimi', 660, y + 50, { eyes: 'shifty', mouth: 'smirk' }, { scale: 2 });
char(fb, 'deepseek', 800, y + 50, { eyes: 'happy', mouth: 'laugh' }, { scale: 2 });
writeFB(process.argv[2] || 'out/sprites.png', fb, +(process.argv[3] || 2));
console.log('ok');
