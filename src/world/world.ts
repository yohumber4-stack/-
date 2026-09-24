import * as THREE from 'three';
import { WorldFn } from './worldfn';
import { Terrain, makeTerrainMaterial, WORLD_UNIFORMS } from './terrain';
import { Road, makeRoadMaterial } from './road';
import { Scatter, desertRules, mesaRules, PropKind } from './scatter';
import { Roadside } from './roadside';
import { Materials } from '../gfx/materials';
import { makeSaguaro, makeBarrelCactus, makeGrassTuft, makeDryBush, makeRock, makeDeadTree, makeMesa, MesaKind } from '../models/nature';
import { mod } from '../core/math';

/** All streamed world visuals: terrain, road, vegetation, rock formations, roadside furniture. */
export class World {
  group = new THREE.Group();
  fn: WorldFn;
  terrain: Terrain;
  road: Road;
  scatter: Scatter;
  mesas: Scatter;
  roadside: Roadside;
  originX = 0;
  originZ = 0;
  propKinds: PropKind[];

  constructor(seed: number, public mats: Materials, quality: number) {
    this.fn = new WorldFn(seed);
    this.terrain = new Terrain(this.fn, makeTerrainMaterial(mats.tex));
    this.terrain.viewRadius = quality >= 2 ? 4200 : 3000;
    this.road = new Road(this.fn, makeRoadMaterial(mats.tex));
    const kinds: PropKind[] = [];
    const hi = quality >= 2;
    for (let i = 0; i < 6; i++)
      kinds.push({
        id: 'saguaro' + i, material: mats.cactus, collider: { r: 0.28, h: 4 },
        lods: [
          { geo: makeSaguaro(100 + i, 28), maxDist: hi ? 220 : 150, castShadow: true, capacity: 500 },
          { geo: makeSaguaro(100 + i, 10), maxDist: hi ? 1400 : 900, castShadow: false, capacity: 3000 },
        ],
      });
    kinds.push({ id: 'barrel', material: mats.cactus, collider: { r: 0.3, h: 0.7 }, lods: [{ geo: makeBarrelCactus(5), maxDist: 350, castShadow: true, capacity: 2000 }] });
    for (let i = 0; i < 3; i++) kinds.push({ id: 'bush' + i, material: mats.bush, lods: [{ geo: makeDryBush(200 + i), maxDist: hi ? 380 : 250, castShadow: true, capacity: 4000 }] });
    kinds.push({ id: 'grass', material: mats.grass, lods: [{ geo: makeGrassTuft(), maxDist: hi ? 190 : 120, castShadow: false, capacity: 12000 }] });
    for (let i = 0; i < 4; i++)
      kinds.push({
        id: 'rock' + i, material: mats.rock, collider: { r: 0.85, h: 0.8 },
        lods: [
          { geo: makeRock(300 + i, 3), maxDist: 260, castShadow: true, capacity: 3000 },
          { geo: makeRock(300 + i, 1), maxDist: hi ? 800 : 500, castShadow: false, capacity: 4000 },
        ],
      });
    for (let i = 0; i < 3; i++) kinds.push({ id: 'tree' + i, material: mats.deadWood, collider: { r: 0.18, h: 3 }, lods: [{ geo: makeDeadTree(400 + i), maxDist: 900, castShadow: true, capacity: 600 }] });
    this.propKinds = kinds;
    this.scatter = new Scatter(this.fn, kinds, desertRules(), 128, seed);
    const mk: MesaKind[] = ['butte', 'mesa', 'stack', 'spire', 'hoodoo', 'stack', 'butte', 'mesa', 'stack', 'butte', 'hoodoo', 'mesa'];
    const mesaKinds: PropKind[] = [];
    for (let i = 0; i < 12; i++) mesaKinds.push({ id: 'mesa' + i, material: mats.rock, lods: [{ geo: makeMesa(500 + i + seed * 13, mk[i]), maxDist: hi ? 7000 : 5000, castShadow: false, capacity: 60 }] });
    this.mesas = new Scatter(this.fn, mesaKinds, mesaRules(), 1024, seed);
    this.roadside = new Roadside(this.fn, mats, seed);
    this.group.add(this.terrain.group, this.road.group, this.scatter.group, this.mesas.group, this.roadside.group);
  }

  setOrigin(ox: number, oz: number) {
    this.originX = ox;
    this.originZ = oz;
    this.terrain.setOrigin(ox, oz);
    this.road.setOrigin(ox, oz);
    this.scatter.setOrigin(ox, oz);
    this.mesas.setOrigin(ox, oz);
    this.roadside.setOrigin(ox, oz);
    WORLD_UNIFORMS.uOriginMod.value.set(mod(ox, 2048), mod(oz, 2048));
  }

  /** cam* are world coordinates. */
  update(camX: number, camY: number, camZ: number, budgetMs: number, force = false) {
    this.terrain.update(camX, camY, camZ, budgetMs, force);
    this.road.update(camX, camZ, force ? 1e9 : 3);
    this.scatter.update(camX, camZ);
    this.mesas.update(camX, camZ);
    this.roadside.update(camX, camZ);
  }
}
