import * as THREE from 'three';
import { Game } from './game/game';

const q = new URLSearchParams(location.search);
const test: Record<string, string> = {};
q.forEach((v, k) => (test[k] = v));

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, test.pr ? Number(test.pr) : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = test.exp ? Number(test.exp) : 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const game = new Game(renderer, { seed: test.seed ? Number(test.seed) : 1337, quality: test.q ? Number(test.q) : 2, test });
(window as any).__game = game;
game.input.noLock = true;

(async () => {
  await game.init((p, l) => console.log('load', (p * 100).toFixed(0) + '%', l));
  if (test.incar && game.playerCar) game.player.enterCar(game.playerCar, 'driver');
  addEventListener('resize', () => game.resize(innerWidth, innerHeight));
  game.resize(innerWidth, innerHeight);
  const loop = (t: number) => {
    game.frame(t);
    (window as any).__frames = game.frames;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  (window as any).__ready = true;
})();
