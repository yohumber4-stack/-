import * as THREE from 'three';
import { Game, readSave, takeBoot, StartSpec } from './game/game';
import { UI } from './ui/ui';
import { tr } from './ui/i18n';

const q = new URLSearchParams(location.search);
const test: Record<string, string> = {};
q.forEach((v, k) => (test[k] = v));

const ui = new UI();
ui.showLoading();

// What to boot into: the menu (default), a fresh game or the saved game. Switching between them
// reloads the page, which guarantees a clean world for every seed.
const boot = takeBoot();
let start: StartSpec = { kind: 'menu' };
let seed = 1979;
if (test.play) {
  start = { kind: 'new', difficulty: 1, auto: true };
  seed = test.seed ? Number(test.seed) : 1337;
} else if (boot?.mode === 'new') {
  start = { kind: 'new', difficulty: boot.difficulty ?? 1, auto: boot.auto ?? true };
  seed = boot.seed ?? Math.floor(Math.random() * 99999);
} else if (boot?.mode === 'load') {
  const s = readSave();
  if (s) {
    start = { kind: 'load', save: s };
    seed = s.seed;
  }
} else if (test.seed) seed = Number(test.seed);

function fatal(msg: string) {
  const l = document.getElementById('ldl');
  if (l) {
    l.textContent = msg;
    l.style.color = '#e0523e';
  }
}

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
} catch (e) {
  fatal(tr('WebGL 2 недоступен: обновите браузер или драйвер видеокарты', 'WebGL 2 is not available: update your browser or graphics driver'));
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * (test.pr ? Number(test.pr) : ui.settings.renderScale));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = test.exp ? Number(test.exp) : 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const game = new Game(renderer, ui, { seed, quality: test.q ? Number(test.q) : ui.settings.quality, test });
ui.hooks = game.uiHooks();
(window as any).__game = game;
if (test.auto || test.nolock) game.input.noLock = true;

(async () => {
  try {
    await game.init((p, l) => ui.setLoading(p, l), start);
  } catch (e) {
    console.error(e);
    fatal(tr('Ошибка загрузки: ', 'Loading failed: ') + (e as Error).message);
    return;
  }
  if (test.incar && game.playerCar) game.enterCar(game.playerCar, 'driver', true);
  addEventListener('resize', () => game.resize(innerWidth, innerHeight));
  game.resize(innerWidth, innerHeight);
  let errors = 0;
  const loop = (t: number) => {
    requestAnimationFrame(loop);
    try {
      game.frame(t);
    } catch (e) {
      // keep the game alive; report the first few failures
      if (errors++ < 5) console.error(e);
    }
    (window as any).__frames = game.frames;
  };
  requestAnimationFrame(loop);
  ui.loadingDone(() => game.start(), !!test.auto);
  (window as any).__ready = true;
})();
