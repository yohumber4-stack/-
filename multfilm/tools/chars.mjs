// Character sheet for visual QA: node tools/chars.mjs [out.png] [scale]
import { FB } from '../src/engine/fb.js';
import { text } from '../src/engine/font.js';
import { clawd } from '../src/chars/clawd.js';
import { gemini } from '../src/chars/gemini.js';
import { codex } from '../src/chars/codex.js';
import { qwen } from '../src/chars/qwen.js';
import { whale, moon } from '../src/chars/extras.js';
import { writeFB } from './png.mjs';

const fb = new FB();
fb.gradV(0, 0, 480, 270, [0x2b3a67, 0x4d5d8f, 0x8fa3c7]);
text(fb, 'CLAWD', 6, 4, 0xffffff, { font: 'small' });
const eyes = ['normal', 'happy', 'closed', 'wide', 'sad', 'determined', 'dot'];
eyes.forEach((e, i) => clawd(fb, 26 + i * 38, 46, { u: 2, eyes: e, armL: i === 1 ? 1 : 0, armR: i === 1 ? 1 : i === 3 ? 0.5 : 0, blush: i === 1, mouth: i === 3 ? 'open' : i === 1 ? 'smile' : undefined }));
clawd(fb, 300, 46, { u: 2, walk: 0.25 });
clawd(fb, 336, 46, { u: 2, walk: 0.75 });
clawd(fb, 372, 46, { u: 1 });
clawd(fb, 420, 58, { u: 3, eyes: 'normal', hat: 'nightcap' });

text(fb, 'GEMINI', 6, 64, 0xffffff, { font: 'small' });
gemini(fb, 24, 90, { size: 30 });
gemini(fb, 60, 90, { size: 30, eyes: 'happy', armL: 0.8, armR: 0.8, mouth: 'grin', blush: true });
gemini(fb, 96, 90, { size: 30, eyes: 'sad', droop: 1, sat: 0.1, mouth: 'frown' });
gemini(fb, 132, 90, { size: 30, eyes: 'wide', mouth: 'open' });
gemini(fb, 168, 90, { size: 30, pts: [1, 0, 0, 0], sat: 1 });
gemini(fb, 204, 90, { size: 30, pts: [1, 1, 0.2, 0.2], armR: -0.6, armL: 0.6 });
gemini(fb, 250, 94, { size: 44, eyes: 'determined', mouth: 'flat' });
gemini(fb, 310, 94, { size: 56, eyes: 'normal', rot: 0.3 });
gemini(fb, 380, 94, { size: 20 });
gemini(fb, 420, 94, { size: 64, eyes: 'happy', mouth: 'grin', blush: true, armR: 1 });

text(fb, 'CODEX', 6, 128, 0xffffff, { font: 'small' });
const faces = ['>_', '^_^', 'o_o', '>_<', '-_-', 'T_T', '>:)', 'code', 'bar:0.6'];
faces.forEach((f, i) => codex(fb, 22 + i * 36, 170, { face: f, t: 0.2 }));
codex(fb, 380, 176, { u: 2, face: '^_^', hands: { l: [-3, 8], r: [29, 6] }, pet: true, t: 0.1 });

text(fb, 'QWEN / DEEPSEEK / KIMI', 6, 182, 0xffffff, { font: 'small' });
qwen(fb, 22, 262, {});
qwen(fb, 54, 262, { eyes: 'shifty', look: 1, arms: 'sneak', tiptoe: true });
qwen(fb, 86, 262, { spy: true, arms: 'sneak' });
qwen(fb, 118, 262, { eyes: 'scared', mouth: 'open', fur: 1, sweat: true, arms: 'flail', t: 0.3 });
qwen(fb, 150, 262, { spy: true, mustache: true, glasses: false, eyes: 'smug', mouth: 'smirk' });
qwen(fb, 190, 262, { u: 2, eyes: 'wide', mouth: 'o' });
whale(fb, 260, 262, { eyes: 'smug' });
whale(fb, 304, 262, { eyes: 'laugh', mouth: 'laugh', flip: true });
moon(fb, 350, 262, { eyes: 'smug' });
moon(fb, 385, 262, { eyes: 'laugh', mouth: 'laugh', arms: 'laugh', t: 0.1 });
whale(fb, 440, 262, { eyes: 'shock', mouth: 'o', wet: true });

writeFB(process.argv[2] || 'out/chars.png', fb, +(process.argv[3] || 3));
console.log('ok');
