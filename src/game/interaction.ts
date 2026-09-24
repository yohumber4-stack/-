import * as THREE from 'three';
import type { Game } from './game';
import { ItemEntity } from './items';
import { ITEMS, Liquid, LIQUID_NAME, ItemDef } from './itemDefs';
import { Car } from '../vehicle/car';
import { SlotId, SLOT_POS } from '../vehicle/carModel';
import { PART_INFO, SLOT_KIND, ENGINE_OIL_CAP, RADIATOR_CAP, FUEL_CAP, PartKind, KIND_SLOT } from '../vehicle/parts';
import { clamp, clamp01, damp } from '../core/math';
import { tr, partName, L } from '../ui/i18n';

export interface UiAction {
  key: string; // display key, e.g. 'E', 'ЛКМ'
  label: string;
  hold?: number;
}
export interface UiTarget {
  name: string;
  info: string[];
  actions: UiAction[];
}

type Handler = () => void;
interface ActDef extends UiAction {
  btn: 'E' | 'LMB' | 'RMB';
  run?: Handler; // instant
  tick?: (dt: number) => boolean; // continuous while held; return false to stop
  done?: Handler; // hold completed
}

interface Hit {
  kind: 'item' | 'carpart' | 'carctl' | 'carbody' | 'door' | 'poi' | 'slot' | 'enemy' | 'none';
  item?: ItemEntity;
  car?: Car;
  slot?: SlotId;
  control?: string;
  door?: any;
  poi?: any;
  point: THREE.Vector3;
  dist: number;
  sub?: string;
}

const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3();

export class Interaction {
  hand: ItemEntity | null = null;
  slots: (ItemEntity | null)[] = [null, null, null, null];
  target: UiTarget | null = null;
  holdT = 0;
  holdMax = 0;
  private holding: ActDef | null = null;
  private acts: ActDef[] = [];
  holdDist = 1.35;
  private handObj = new THREE.Group();
  flashlight: THREE.SpotLight;
  flashOn = false;
  private swing = 0;
  private swingCool = 0;
  private recoil = 0;
  aiming = false;
  pouring: { liquid: Liquid; target: string } | null = null;
  private lastHit: Hit | null = null;
  money = 0;

  constructor(private g: Game) {
    g.player.camera.add(this.handObj);
    this.flashlight = new THREE.SpotLight(0xfff2d8, 0, 38, 0.42, 0.55, 1.4);
    this.flashlight.position.set(0.15, -0.1, 0);
    this.flashlight.target.position.set(0.1, -0.2, -10);
    g.player.camera.add(this.flashlight, this.flashlight.target);
  }

  // ------------------------------------------------------------------ inventory helpers
  get handDef(): ItemDef | null {
    return this.hand ? this.hand.def : null;
  }
  /** Is an action bound to this button offered this frame? */
  hasAction(btn: 'E' | 'LMB' | 'RMB') {
    return this.acts.some((a) => a.btn === btn);
  }
  has(tool: string) {
    if (this.hand?.def.tool === tool) return true;
    return this.slots.some((s) => s?.def.tool === tool);
  }
  hasCompass() {
    return this.has('compass');
  }
  totalMoney() {
    let m = 0;
    for (const s of [this.hand, ...this.slots]) if (s?.def.money) m += s.state.money ?? 0;
    return m;
  }
  spendMoney(amount: number): boolean {
    if (this.totalMoney() < amount - 1e-6) return false;
    let need = amount;
    for (const s of [this.hand, ...this.slots]) {
      if (!s?.def.money || need <= 0) continue;
      const take = Math.min(need, s.state.money ?? 0);
      s.state.money = +((s.state.money ?? 0) - take).toFixed(2);
      need -= take;
      if ((s.state.money ?? 0) <= 0.001) this.consume(s);
    }
    return true;
  }
  consume(e: ItemEntity) {
    if (this.hand === e) this.setHand(null);
    const i = this.slots.indexOf(e);
    if (i >= 0) this.slots[i] = null;
    this.g.items.remove(e);
  }
  private setHand(e: ItemEntity | null) {
    if (this.hand && this.hand !== e) {
      this.hand.held = false;
      if (this.hand.obj.parent === this.handObj) this.handObj.remove(this.hand.obj);
    }
    this.hand = e;
    this.aiming = false;
    if (e) {
      e.held = true;
      e.inInventory = false;
      if (this.isViewModel(e)) {
        this.g.items.pick(e);
        this.handObj.add(e.obj);
        e.obj.position.set(0, 0, 0);
        e.obj.quaternion.identity();
        e.obj.visible = true;
      }
    }
    this.g.player.carryMass = e && !this.isViewModel(e) ? e.mass + (e.state.amount ?? 0) * 0.8 : 0;
  }
  private isViewModel(e: ItemEntity) {
    return e.def.storable;
  }
  /** Pick an item from the world into the hands. */
  take(e: ItemEntity) {
    if (this.hand) this.drop(false);
    if (e.spawnKey) this.g.worldgen.collected.add(e.spawnKey);
    e.touched = true;
    e.spawnKey = null;
    if (e.body) e.body.setGravityScale(0, true);
    if (this.isViewModel(e)) this.g.items.removeBody(e);
    this.setHand(e);
    this.g.audio.play('pickup', { volume: 0.6 });
  }
  storeToSlot(e: ItemEntity): boolean {
    const i = this.slots.indexOf(null);
    if (i < 0 || !e.def.storable) return false;
    if (e.spawnKey) this.g.worldgen.collected.add(e.spawnKey);
    e.touched = true;
    e.spawnKey = null;
    this.g.items.pick(e);
    if (this.hand === e) this.setHand(null);
    e.inInventory = true;
    e.held = false;
    e.obj.parent?.remove(e.obj);
    this.slots[i] = e;
    this.g.audio.play('zip', { volume: 0.5 });
    return true;
  }
  slotKey(i: number) {
    const s = this.slots[i];
    const h = this.hand;
    if (h && !h.def.storable) {
      this.g.ui.toast(L('Этот предмет не помещается в карман', 'This item does not fit in a pocket'));
      return;
    }
    this.slots[i] = null;
    if (h) {
      this.setHand(null);
      h.inInventory = true;
      h.obj.parent?.remove(h.obj);
      this.slots[i] = h;
    }
    if (s) {
      s.inInventory = false;
      this.setHand(s);
    }
    this.g.audio.play('zip', { volume: 0.35 });
  }
  drop(throwIt: boolean) {
    const e = this.hand;
    if (!e) return;
    const cam = this.g.player.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let pos: THREE.Vector3;
    if (e.body) {
      const t = e.body.translation();
      pos = new THREE.Vector3(t.x, t.y, t.z);
    } else pos = cam.position.clone().addScaledVector(fwd, 0.6).add(new THREE.Vector3(0, -0.15, 0));
    // keep it out of walls: pull back along the view ray if blocked
    const hit = this.g.physics.castRay(cam.position, fwd, 0.8, 0xffff0001);
    if (hit && !e.body) pos = cam.position.clone().addScaledVector(fwd, Math.max(0.15, hit.timeOfImpact - 0.25));
    this.setHand(null);
    if (e.body) {
      e.body.setGravityScale(1, true);
      if (throwIt) e.body.applyImpulse({ x: fwd.x * 9 * Math.min(e.mass, 4), y: (fwd.y + 0.25) * 9 * Math.min(e.mass, 4), z: fwd.z * 9 * Math.min(e.mass, 4) }, true);
      e.held = false;
    } else {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.g.player.yaw, 0));
      this.g.items.place(e, pos, q, throwIt ? fwd.clone().multiplyScalar(9).add(new THREE.Vector3(0, 2, 0)) : fwd.clone().multiplyScalar(1));
    }
    this.g.audio.play('throw', { volume: throwIt ? 0.6 : 0.3 });
  }

  // ------------------------------------------------------------------ raycast
  private pick(): Hit {
    const g = this.g;
    const cam = g.player.camera;
    ray.set(cam.position, new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion));
    ray.far = g.player.car ? 1.4 : 2.7;
    ray.near = 0.05;
    const list: THREE.Object3D[] = [];
    const P = cam.position;
    for (const e of g.items.items) if (!e.held && !e.inInventory && e.materialized && e.obj.position.distanceToSquared(P) < 25) list.push(e.obj);
    for (const c of g.cars) if (c.visual.root.position.distanceToSquared(P) < 64) list.push(c.visual.root);
    for (const bp of g.worldgen.built.values()) {
      if (!bp.active) continue;
      for (const d of bp.doors) list.push(d.pivot);
      for (const it of bp.interacts) list.push(it.obj);
    }
    for (const en of g.enemies.list) if (en.obj.position.distanceToSquared(P) < 100) list.push(en.obj);
    const hits = ray.intersectObjects(list, true);
    // world blockers (terrain/walls) - a simple occlusion test
    const wall = g.physics.castRay(cam.position, ray.ray.direction, ray.far, 0xffff0001);
    const wallDist = wall ? wall.timeOfImpact : Infinity;
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      const ud = o.userData;
      if (ud.item && ud.item !== this.hand) {
        if (h.distance > wallDist + 0.15) continue;
        return { kind: 'item', item: ud.item, point: h.point, dist: h.distance };
      }
      if (ud.door) return { kind: 'door', door: ud.door, point: h.point, dist: h.distance };
      if (ud.interact) return { kind: 'poi', poi: ud.interact, point: h.point, dist: h.distance };
      if (ud.enemy) return { kind: 'enemy', point: h.point, dist: h.distance };
      // car: walk up to find slot/control
      let car: Car | null = null, slot: SlotId | undefined, control: string | undefined;
      while (o) {
        if (!slot && o.userData.slot) slot = o.userData.slot;
        if (!control && o.userData.control) control = o.userData.control;
        if (o.userData.car) { car = o.userData.car; break; }
        o = o.parent;
      }
      if (car) {
        if (control && control !== 'body') return { kind: 'carctl', car, control, point: h.point, dist: h.distance };
        if (slot) return { kind: 'carpart', car, slot, point: h.point, dist: h.distance };
        return { kind: 'carbody', car, point: h.point, dist: h.distance };
      }
    }
    return { kind: 'none', point: new THREE.Vector3(), dist: 99 };
  }

  /** When carrying a part, find an empty matching slot near the view ray. */
  private findSlot(): Hit | null {
    const e = this.hand;
    if (!e || !e.part) return null;
    const cam = this.g.player.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best: Hit | null = null;
    let bestD = 0.75;
    for (const car of this.g.cars) {
      if (car.visual.root.position.distanceTo(cam.position) > 7) continue;
      for (const s of Object.keys(SLOT_POS) as SlotId[]) {
        if (!car.canAttach(s, e.part.kind)) continue;
        if ((s === 'engine' || s === 'battery' || s === 'radiator') && !car.isOpen('hood')) continue;
        const wp = car.localToWorld(SLOT_POS[s]);
        const to = wp.clone().sub(cam.position);
        const along = to.dot(dir);
        if (along < 0.2 || along > 3.2) continue;
        const perp = to.clone().addScaledVector(dir, -along).length();
        if (perp < bestD) {
          bestD = perp;
          best = { kind: 'slot', car, slot: s, point: wp, dist: along };
        }
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number) {
    const g = this.g;
    const inp = g.input;
    this.acts = [];
    let name = '';
    const info: string[] = [];
    const lang = g.ui.lang;
    const add = (a: ActDef) => this.acts.push(a);
    const hit = g.player.dead ? ({ kind: 'none', point: new THREE.Vector3(), dist: 99 } as Hit) : this.findSlot() ?? this.pick();
    this.lastHit = hit;
    const hand = this.hand;
    const car = hit.car;

    // ---------------- targets
    if (hit.kind === 'slot' && car && hit.slot && hand?.part) {
      name = `${tr('Установить', 'Install')}: ${partName(SLOT_KIND[hit.slot], hit.slot, lang)}`;
      add({ btn: 'LMB', key: 'ЛКМ', label: tr('Установить', 'Install'), hold: PART_INFO[hand.part.kind].bolted ? 1.2 : 0.3, done: () => this.installPart(car, hit.slot!) });
    } else if (hit.kind === 'item' && hit.item) {
      const e = hit.item;
      name = this.itemName(e);
      info.push(...this.itemInfo(e));
      if (!hand) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Взять', 'Pick up'), run: () => this.take(e) });
      if (e.def.storable && this.slots.includes(null)) add({ btn: 'E', key: 'E', label: tr('В карман', 'Pocket'), run: () => this.storeToSlot(e) });
      if (e.def.container && !e.def.breakable) add({ btn: 'E', key: 'E', label: tr('Открыть', 'Open'), run: () => g.combat.breakContainer(e) });
      if (e.def.id === 'box') add({ btn: 'E', key: 'E', label: tr('Открыть', 'Open'), run: () => g.combat.breakContainer(e) });
      if (e.def.tool === 'note') add({ btn: 'E', key: 'E', label: tr('Читать', 'Read'), run: () => g.ui.showNote(e.state.text ?? 'note') });
      // liquid transfer from a barrel / canister on the ground into the held container
      if (hand?.def.liquid && e.def.liquid && hand !== e) {
        const lq = e.state.liquid;
        if (lq && (e.state.amount ?? 0) > 0) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Набрать', 'Fill'), hold: 999, tick: (dt) => this.transfer(e, hand, dt) });
        if (hand.state.liquid && (hand.state.amount ?? 0) > 0) add({ btn: 'RMB', key: 'ПКМ', label: tr('Перелить', 'Pour in'), hold: 999, tick: (dt) => this.transfer(hand, e, dt) });
      }
    } else if ((hit.kind === 'carpart' || hit.kind === 'carctl' || hit.kind === 'carbody') && car) {
      this.carTarget(hit, add, info, (n) => (name = n));
    } else if (hit.kind === 'door' && hit.door) {
      name = hit.door.def.kind === 'gate' ? tr('Ворота', 'Gate') : tr('Дверь', 'Door');
      add({ btn: 'E', key: 'E', label: hit.door.target > 0.5 ? tr('Закрыть', 'Close') : tr('Открыть', 'Open'), run: () => { const o = g.worldgen.toggleDoor(hit.door); g.audio.play(o ? 'door_open' : 'door_close', { pos: hit.point, volume: 0.7 }); } });
    } else if (hit.kind === 'poi' && hit.poi) {
      this.poiTarget(hit, add, info, (n) => (name = n));
    }

    // ---------------- held item default actions
    if (hand && !this.acts.some((a) => a.btn === 'LMB')) {
      const d = hand.def;
      if (d.food) add({ btn: 'LMB', key: 'ЛКМ', label: d.tool === 'medkit' ? tr('Использовать', 'Use') : d.food.sound === 'drink' ? tr('Выпить', 'Drink') : tr('Съесть', 'Eat'), hold: d.food.time, done: () => this.eat(hand) });
      else if (d.liquid?.drinkable && hand.state.liquid === 'water' && (hand.state.amount ?? 0) > 0.05) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Пить', 'Drink'), hold: 999, tick: (dt) => this.drink(hand, dt) });
      else if (d.tool === 'gun') add({ btn: 'LMB', key: 'ЛКМ', label: tr('Выстрел', 'Fire'), run: () => g.combat.shoot(hand) });
      else if (d.weapon) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Удар', 'Swing'), run: () => this.meleeSwing(hand) });
      else if (d.tool === 'light') add({ btn: 'LMB', key: 'ЛКМ', label: tr('Фонарь', 'Light'), run: () => this.toggleFlash() });
      else if (d.tool === 'note') add({ btn: 'LMB', key: 'ЛКМ', label: tr('Читать', 'Read'), run: () => g.ui.showNote(hand.state.text ?? 'note') });
    }
    if (hand && d_throwable(hand) && !this.acts.some((a) => a.btn === 'RMB')) add({ btn: 'RMB', key: 'ПКМ', label: tr('Бросить', 'Throw'), run: () => this.drop(true) });
    if (hand?.def.tool === 'gun' && !this.acts.some((a) => a.btn === 'RMB')) add({ btn: 'RMB', key: 'ПКМ', label: tr('Прицел', 'Aim') });

    // ---------------- input handling
    const btnDown = (b: string) => (b === 'LMB' ? inp.mouseDown(0) : b === 'RMB' ? inp.mouseDown(2) : inp.down('interact'));
    const btnPressed = (b: string) => (b === 'LMB' ? inp.mousePressed(0) : b === 'RMB' ? inp.mousePressed(2) : inp.pressedA('interact'));
    if (this.holding) {
      const a = this.holding;
      if (!btnDown(a.btn) || !this.acts.some((x) => x.label === a.label && x.btn === a.btn)) this.cancelHold();
      else if (a.tick) {
        this.holdT += dt;
        if (!a.tick(dt)) this.cancelHold();
      } else {
        this.holdT += dt;
        if (this.holdT >= this.holdMax) {
          const done = a.done;
          this.cancelHold();
          done?.();
        }
      }
    } else {
      for (const a of this.acts) {
        if (!btnPressed(a.btn)) continue;
        if (a.hold || a.tick) {
          this.holding = a;
          this.holdT = 0;
          this.holdMax = a.hold ?? 999;
          if (a.btn === 'LMB' && (a.label.includes('Открутить') || a.label.includes('Remove') || a.label.includes('Снять'))) g.audio.play('ratchet', { volume: 0.5 });
        } else a.run?.();
        break;
      }
    }
    if (hand?.def.tool === 'gun') this.aiming = inp.mouseDown(2) && !g.player.car;
    if (inp.pressedA('drop') && hand) this.drop(false);
    if (inp.pressedA('reload') && hand?.def.tool === 'gun' && !g.player.car) g.combat.reload(hand, this);
    for (let i = 0; i < 4; i++) if (inp.pressedA(('slot' + (i + 1)) as any)) this.slotKey(i);
    if (inp.pressedA('flashlight') && !g.player.car) this.toggleFlash();
    if (inp.mouse.wheel && hand?.body) this.holdDist = clamp(this.holdDist - inp.mouse.wheel * 0.12, 0.8, 2.2);

    if (!this.acts.length && hit.kind === 'none') this.target = null;
    else this.target = { name, info, actions: this.acts.map((a) => ({ key: a.key, label: a.label, hold: a.hold })) };

    this.updateHand(dt);
  }

  private cancelHold() {
    this.holding = null;
    this.holdT = 0;
    this.holdMax = 0;
    if (this.pouring) {
      this.pouring = null;
      this.g.audio.stopPour();
    }
  }

  // ------------------------------------------------------------------ car interactions
  private carTarget(hit: Hit, add: (a: ActDef) => void, info: string[], setName: (n: string) => void) {
    const g = this.g;
    const car = hit.car!;
    const hand = this.hand;
    const lang = g.ui.lang;
    const inCar = g.player.car === car;
    const wrench = hand?.def.tool === 'wrench';
    if (hit.kind === 'carctl') {
      const c = hit.control!;
      if (c === 'key') {
        setName(tr('Замок зажигания', 'Ignition'));
        info.push(car.running ? tr('Двигатель работает', 'Engine running') : car.ignition ? tr('Зажигание включено', 'Ignition on') : tr('Выключено', 'Off'));
        add({ btn: 'LMB', key: 'ЛКМ', label: car.running ? tr('Заглушить', 'Stop engine') : tr('Завести (удерживать)', 'Start (hold)'), hold: 999, tick: () => { if (car.running && this.holdT < 0.05) { car.setIgnition(false); return false; } car.setCrank(true); return !car.running; } });
        add({ btn: 'RMB', key: 'ПКМ', label: car.ignition ? tr('Выкл. зажигание', 'Ignition off') : tr('Вкл. зажигание', 'Ignition on'), run: () => { car.setIgnition(!car.ignition); g.audio.play('key_turn', { volume: 0.5 }); } });
      } else if (c === 'radio') {
        setName(tr('Радио', 'Radio'));
        info.push(car.radioOn ? `${car.radioFreq.toFixed(1)} MHz · ${g.audio.radio.stationName || tr('помехи', 'static')}` : tr('Выключено', 'Off'));
        add({ btn: 'LMB', key: 'ЛКМ', label: car.radioOn ? tr('Выключить', 'Turn off') : tr('Включить', 'Turn on'), run: () => { car.radioOn = !car.radioOn; g.audio.play('click', { volume: 0.5 }); } });
        add({ btn: 'E', key: tr('Колесо', 'Wheel'), label: tr('Настройка', 'Tune') });
        if (g.input.mouse.wheel) car.radioFreq = clamp(car.radioFreq - g.input.mouse.wheel * 0.1, 87.5, 108);
      } else if (c === 'glovebox') {
        setName(tr('Бардачок', 'Glovebox'));
        add({ btn: 'E', key: 'E', label: car.gloveboxOpen ? tr('Закрыть', 'Close') : tr('Открыть', 'Open'), run: () => { car.gloveboxOpen = !car.gloveboxOpen; g.audio.play('latch', { volume: 0.5 }); } });
      } else if (c === 'fuelcap') {
        this.fuelCapTarget(car, add, info, setName);
      }
      return;
    }
    if (hit.kind === 'carbody') {
      setName(tr('Кузов', 'Body'));
      const lp = car.worldToLocal(hit.point);
      // near the fuel filler (right rear) even if cap is open
      if (lp.x < -0.6 && lp.z < -1.3 && lp.z > -1.85 && lp.y > 0.55) return this.fuelCapTarget(car, add, info, setName);
      if (!inCar) this.seatActions(car, lp, add);
      info.push(`${tr('Пробег', 'Odometer')}: ${car.odometer.toFixed(0)} ${tr('км', 'km')}`);
      return;
    }
    const slot = hit.slot!;
    const st = car.parts[slot];
    if (!st) return;
    const kind = SLOT_KIND[slot];
    setName(partName(kind, slot, lang));
    info.push(`${tr('Состояние', 'Condition')}: ${Math.round(st.cond * 100)}%${st.flat ? ' · ' + tr('спущено', 'flat') : ''}`);
    const hinged = slot.startsWith('door') || slot === 'hood' || slot === 'trunk';
    const lp = car.worldToLocal(hit.point);
    if (slot === 'engine') {
      const oilCap = car.anchor('oil');
      info.push(`${tr('Масло', 'Oil')}: ${(st.oil ?? 0).toFixed(1)} / ${ENGINE_OIL_CAP} ${tr('л', 'L')}`);
      if (lp.distanceTo(oilCap) < 0.16) {
        setName(tr('Крышка маслозаливной горловины', 'Oil filler cap'));
        add({ btn: 'E', key: 'E', label: car.capsOpen.oil ? tr('Закрыть', 'Close') : tr('Открыть', 'Open'), run: () => { car.capsOpen.oil = !car.capsOpen.oil; g.audio.play('cap_open', { volume: 0.5 }); } });
        if (car.capsOpen.oil && hand?.def.liquid && hand.state.liquid && (hand.state.amount ?? 0) > 0) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Залить', 'Pour'), hold: 999, tick: (dt) => this.pourInto(hand, 'oil', car, dt) });
      }
    }
    if (slot === 'radiator') {
      info.push(`${tr('Охлаждающая жидкость', 'Coolant')}: ${(st.coolant ?? 0).toFixed(1)} / ${RADIATOR_CAP} ${tr('л', 'L')}`);
      setName(tr('Радиатор', 'Radiator'));
      add({ btn: 'E', key: 'E', label: car.capsOpen.radiator ? tr('Закрыть крышку', 'Close cap') : tr('Открыть крышку', 'Open cap'), run: () => { car.capsOpen.radiator = !car.capsOpen.radiator; g.audio.play('cap_open', { volume: 0.5 }); } });
      if (car.capsOpen.radiator && hand?.def.liquid && hand.state.liquid && (hand.state.amount ?? 0) > 0) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Залить', 'Pour'), hold: 999, tick: (dt) => this.pourInto(hand, 'radiator', car, dt) });
    }
    if (slot === 'battery') info.push(`${tr('Заряд', 'Charge')}: ${Math.round((st.charge ?? 0) * 100)}% · ${(10.5 + (st.charge ?? 0) * 2.2).toFixed(1)} V`);
    if (hinged && !inCar) add({ btn: 'E', key: 'E', label: car.isOpen(slot) ? tr('Закрыть', 'Close') : tr('Открыть', 'Open'), run: () => { const o = car.toggleHinge(slot); g.audio.play(slot === 'hood' ? (o ? 'hood_open' : 'hood_close') : slot === 'trunk' ? (o ? 'trunk_open' : 'trunk_close') : o ? 'door_open' : 'door_close', { pos: hit.point }); } });
    if (slot.startsWith('seat') && !inCar) this.seatActions(car, lp, add, slot);
    if (slot.startsWith('door') && !inCar) {
      const seatSlot = slot === 'door_fl' ? 'driver' : slot === 'door_fr' ? 'passenger' : null;
      if (seatSlot) add({ btn: 'E', key: 'F', label: seatSlot === 'driver' ? tr('Сесть за руль', 'Drive') : tr('Сесть', 'Sit'), run: () => g.enterCar(car, seatSlot as any) });
    }
    if (this.acts.some((a) => a.key === 'F')) {
      // F as a secondary key for sitting
      if (g.input.pressedA('flashlight')) { const a = this.acts.find((q) => q.key === 'F'); a?.run?.(); }
    }
    // removing parts
    const info_ = PART_INFO[st.kind];
    const needHood = slot === 'engine' || slot === 'battery' || slot === 'radiator';
    if (needHood && !car.isOpen('hood') && car.parts.hood) return;
    if (inCar) return;
    if (info_.bolted) {
      if (wrench) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Открутить', 'Unbolt'), hold: slot === 'engine' ? 4 : slot.startsWith('wheel') ? 2.2 : 1.6, done: () => this.removePart(car, slot) });
      else info.push(tr('Нужен гаечный ключ', 'Needs a wrench'));
    } else if (!hand) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Снять', 'Remove'), hold: 0.6, done: () => this.removePart(car, slot) });
    // repair
    if (hand?.def.tool === 'repair' && st.cond < 0.99) add({ btn: 'RMB', key: 'ПКМ', label: tr('Починить', 'Repair'), hold: 2.5, done: () => this.repair(hand, st) });
  }

  private seatActions(car: Car, lp: THREE.Vector3, add: (a: ActDef) => void, slot?: SlotId) {
    const g = this.g;
    const doorOpenOrMissing = (d: SlotId) => !car.parts[d] || car.isOpen(d);
    const left = lp.x > 0;
    if (lp.z > -0.9 && lp.z < 0.8) {
      if (left && (doorOpenOrMissing('door_fl') || slot === 'seat_d')) add({ btn: 'E', key: 'E', label: tr('Сесть за руль', 'Drive'), run: () => g.enterCar(car, 'driver') });
      if (!left && (doorOpenOrMissing('door_fr') || slot === 'seat_p')) add({ btn: 'E', key: 'E', label: tr('Сесть', 'Sit'), run: () => g.enterCar(car, 'passenger') });
    }
  }

  private fuelCapTarget(car: Car, add: (a: ActDef) => void, info: string[], setName: (n: string) => void) {
    const hand = this.hand;
    setName(tr('Бензобак', 'Fuel tank'));
    info.push(`${tr('Топливо', 'Fuel')}: ${car.fuelTotal.toFixed(1)} / ${FUEL_CAP} ${tr('л', 'L')}`);
    if (car.fuel.diesel + car.fuel.water > 0.3) info.push(tr('Примеси в топливе!', 'Fuel is contaminated!'));
    add({ btn: 'E', key: 'E', label: car.capsOpen.fuel ? tr('Закрыть крышку', 'Close cap') : tr('Открыть крышку', 'Open cap'), run: () => { car.capsOpen.fuel = !car.capsOpen.fuel; this.g.audio.play('cap_open', { volume: 0.5 }); } });
    if (car.capsOpen.fuel && hand?.def.liquid) {
      if (hand.state.liquid && (hand.state.amount ?? 0) > 0) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Залить', 'Pour'), hold: 999, tick: (dt) => this.pourInto(hand, 'fuel', car, dt) });
      if (car.fuelTotal > 0.05 && (hand.state.amount ?? 0) < hand.def.liquid.cap) add({ btn: 'RMB', key: 'ПКМ', label: tr('Слить (шланг)', 'Siphon'), hold: 999, tick: (dt) => this.siphon(car, hand, dt) });
    }
  }

  private poiTarget(hit: Hit, add: (a: ActDef) => void, info: string[], setName: (n: string) => void) {
    const g = this.g;
    const it = hit.poi;
    const hand = this.hand;
    switch (it.kind) {
      case 'pump': {
        const d = it.data;
        setName(`${tr('Колонка', 'Fuel pump')} · ${d.kind === 'diesel' ? tr('Дизель', 'Diesel') : 'АИ-76'}`);
        info.push(`${tr('Цена', 'Price')}: $${d.price.toFixed(2)} / ${tr('л', 'L')}`);
        info.push(d.fuel > 0 ? `${tr('В резервуаре', 'In tank')}: ${Math.round(d.fuel)} ${tr('л', 'L')}` : tr('Резервуар пуст', 'Tank empty'));
        info.push(`${tr('Ваши деньги', 'Your money')}: $${this.totalMoney().toFixed(0)}`);
        if (d.fuel > 0) {
          if (hand?.def.liquid && (!hand.state.liquid || hand.state.liquid === d.kind)) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Наполнить канистру', 'Fill container'), hold: 999, tick: (dt) => this.pumpFill(it, dt, hand) });
          const car = g.playerCar;
          if (car && car.visual.root.position.distanceTo(hit.point) < 7) add({ btn: 'E', key: 'E', label: tr('Заправить машину', 'Refuel car'), hold: 999, tick: (dt) => this.pumpFill(it, dt, null, car) });
        }
        break;
      }
      case 'well':
      case 'tap':
        setName(it.kind === 'well' ? tr('Колодец', 'Well') : tr('Кран', 'Tap'));
        add({ btn: 'E', key: 'E', label: tr('Попить', 'Drink'), hold: 1.2, done: () => { g.player.stats.thirst = Math.min(100, g.player.stats.thirst + 30); g.audio.play('gulp'); } });
        if (hand?.def.liquid && (!hand.state.liquid || hand.state.liquid === 'water')) add({ btn: 'LMB', key: 'ЛКМ', label: tr('Набрать воды', 'Fill water'), hold: 999, tick: (dt) => this.fillFrom(hand, 'water', dt) });
        break;
      case 'bed':
        setName(tr('Кровать', 'Bed'));
        info.push(`${tr('Бодрость', 'Energy')}: ${Math.round(g.player.stats.energy)}%`);
        add({ btn: 'E', key: 'E', label: tr('Спать', 'Sleep'), run: () => g.sleep() });
        break;
      case 'mailbox':
        setName(tr('Почтовый ящик', 'Mailbox'));
        add({ btn: 'E', key: 'E', label: tr('Открыть', 'Open'), run: () => g.ui.showNote('letter') });
        break;
      case 'sign':
        setName(tr('ОСТОРОЖНО, МИНЫ!', 'DANGER: MINES!'));
        info.push(tr('Территория заминирована', 'Minefield ahead'));
        break;
    }
  }

  // ------------------------------------------------------------------ actions
  private removePart(car: Car, slot: SlotId) {
    const r = car.detach(slot);
    if (!r) return;
    const g = this.g;
    g.audio.play('bolt_loosen', { pos: car.localToWorld(SLOT_POS[slot]) });
    const wp = car.localToWorld(SLOT_POS[slot]);
    const q = car.visual.root.quaternion.clone();
    const e = g.items.spawn('part', wp.x + g.physics.originX, wp.y, wp.z + g.physics.originZ, q, { part: r.state }, { partVisual: r.visual });
    e.touched = true;
    if (!this.hand && !PART_INFO[r.state.kind].heavy) this.take(e);
    g.ui.toast(`${partName(r.state.kind, slot, g.ui.lang)} — ${tr('снято', 'removed')}`);
    g.hints.trigger('partRemoved');
  }
  private installPart(car: Car, slot: SlotId) {
    const e = this.hand;
    if (!e?.part) return;
    const g = this.g;
    const pv = e.partVisual;
    this.setHand(null);
    g.items.remove(e);
    if (pv) pv.root.position.set(0, 0, 0);
    car.attach(slot, e.part, pv ?? undefined);
    g.audio.play('bolt_tighten', { pos: car.localToWorld(SLOT_POS[slot]) });
    g.ui.toast(`${partName(e.part.kind, slot, g.ui.lang)} — ${tr('установлено', 'installed')}`);
    g.hints.trigger('partInstalled:' + e.part.kind);
  }
  private repair(tool: ItemEntity, st: any) {
    const amt = tool.def.id === 'repairkit' ? 0.35 : 0.12;
    st.cond = Math.min(1, st.cond + amt);
    if (st.flat && tool.def.id === 'repairkit') st.flat = false;
    tool.state.used = (tool.state.used ?? 0) + 1;
    this.g.audio.play('wrench_clank');
    if (tool.state.used >= (tool.def.id === 'repairkit' ? 4 : 3)) this.consume(tool);
  }
  private eat(e: ItemEntity) {
    const f = e.def.food!;
    const s = this.g.player.stats;
    s.hunger = clamp(s.hunger + f.hunger, 0, 100);
    s.thirst = clamp(s.thirst + f.thirst, 0, 100);
    if (f.energy) s.energy = clamp(s.energy + f.energy, 0, 100);
    if (f.health) s.health = clamp(s.health + f.health, 0, 100);
    this.g.audio.play(f.sound === 'drink' ? 'drink' : 'eat');
    this.consume(e);
  }
  private drink(e: ItemEntity, dt: number): boolean {
    const s = this.g.player.stats;
    const a = Math.min(e.state.amount ?? 0, dt * 0.25);
    if (a <= 0 || s.thirst >= 100) return false;
    e.state.amount = (e.state.amount ?? 0) - a;
    s.thirst = Math.min(100, s.thirst + a * 70);
    if (Math.random() < dt * 2) this.g.audio.play('gulp', { volume: 0.6 });
    if ((e.state.amount ?? 0) <= 0.01) { e.state.amount = 0; e.state.liquid = null; }
    this.refreshHandModel();
    return true;
  }
  private startPour(liquid: Liquid, target: string) {
    if (!this.pouring) {
      this.pouring = { liquid, target };
      this.g.audio.startPour();
    }
  }
  private pourInto(src: ItemEntity, where: 'fuel' | 'oil' | 'radiator', car: Car, dt: number): boolean {
    const lq = src.state.liquid;
    if (!lq) return false;
    const rate = src.def.liquid!.rate;
    let a = Math.min(src.state.amount ?? 0, rate * dt);
    if (a <= 0) return false;
    let accepted = 0;
    if (where === 'fuel') {
      accepted = car.addFuel(lq, a);
      if (lq !== 'petrol') this.g.hints.trigger('wrongFuel');
    } else if (where === 'oil') {
      const e = car.parts.engine;
      if (!e) return false;
      const room = ENGINE_OIL_CAP - (e.oil ?? 0);
      accepted = Math.min(room, a);
      if (lq === 'oil') e.oil = (e.oil ?? 0) + accepted;
      else if (accepted > 0) e.cond = Math.max(0, e.cond - accepted * 0.05);
    } else {
      const r = car.parts.radiator;
      if (!r) return false;
      accepted = Math.min(RADIATOR_CAP - (r.coolant ?? 0), a);
      if (lq === 'water') r.coolant = (r.coolant ?? 0) + accepted;
      else if (accepted > 0) { r.coolant = (r.coolant ?? 0) + accepted * 0.3; r.cond = Math.max(0, r.cond - accepted * 0.02); }
    }
    if (accepted <= 0.0001) return false;
    src.state.amount = (src.state.amount ?? 0) - accepted;
    if ((src.state.amount ?? 0) <= 0.005) { src.state.amount = 0; src.state.liquid = null; }
    this.startPour(lq, where);
    car.updateMass();
    return true;
  }
  private transfer(from: ItemEntity, to: ItemEntity, dt: number): boolean {
    const lq = from.state.liquid;
    if (!lq || !to.def.liquid) return false;
    if (to.state.liquid && to.state.liquid !== lq && (to.state.amount ?? 0) > 0.01) return false;
    const room = to.def.liquid.cap - (to.state.amount ?? 0);
    const a = Math.min(from.state.amount ?? 0, room, Math.max(from.def.liquid!.rate, to.def.liquid.rate) * dt);
    if (a <= 0.0001) return false;
    from.state.amount = (from.state.amount ?? 0) - a;
    to.state.amount = (to.state.amount ?? 0) + a;
    to.state.liquid = lq;
    if ((from.state.amount ?? 0) <= 0.005) { from.state.amount = 0; from.state.liquid = null; }
    this.startPour(lq, 'container');
    this.refreshHandModel();
    return true;
  }
  private siphon(car: Car, to: ItemEntity, dt: number): boolean {
    const room = to.def.liquid!.cap - (to.state.amount ?? 0);
    const total = car.fuelTotal;
    if (total <= 0.01 || room <= 0.001) return false;
    const main: Liquid = car.fuel.petrol >= car.fuel.diesel ? 'petrol' : 'diesel';
    if (to.state.liquid && to.state.liquid !== main && (to.state.amount ?? 0) > 0.01) return false;
    const a = Math.min(room, total, 0.6 * dt);
    const k = a / total;
    car.fuel.petrol -= car.fuel.petrol * k;
    car.fuel.diesel -= car.fuel.diesel * k;
    car.fuel.water -= car.fuel.water * k;
    to.state.amount = (to.state.amount ?? 0) + a;
    to.state.liquid = main;
    car.modified = true;
    this.startPour(main, 'container');
    return true;
  }
  private pumpFill(it: any, dt: number, container: ItemEntity | null, car?: Car): boolean {
    const d = it.data;
    if (d.fuel <= 0) { this.g.ui.toast(tr('Колонка пуста', 'Pump is empty')); return false; }
    const rate = 2.2 * dt;
    let room = 0;
    if (container) room = container.def.liquid!.cap - (container.state.amount ?? 0);
    else if (car) room = FUEL_CAP - car.fuelTotal;
    const a = Math.min(rate, room, d.fuel);
    if (a <= 0.0001) return false;
    const cost = a * d.price;
    if (!this.spendMoney(cost)) { this.g.ui.toast(tr('Недостаточно денег', 'Not enough money')); return false; }
    d.fuel -= a;
    this.g.worldgen.pumpFuel.set(it.key, d.fuel);
    if (container) { container.state.amount = (container.state.amount ?? 0) + a; container.state.liquid = d.kind; }
    else if (car) car.addFuel(d.kind, a);
    this.g.audio.pumpLoop(true);
    this.startPour(d.kind, 'pump');
    return true;
  }
  private fillFrom(to: ItemEntity, lq: Liquid, dt: number): boolean {
    const room = to.def.liquid!.cap - (to.state.amount ?? 0);
    const a = Math.min(room, 1.2 * dt);
    if (a <= 0.0001) return false;
    to.state.amount = (to.state.amount ?? 0) + a;
    to.state.liquid = lq;
    this.startPour(lq, 'water');
    this.refreshHandModel();
    return true;
  }
  private refreshHandModel() {
    const e = this.hand;
    if (!e || e.def.id !== 'water') return;
    const t = Math.round((e.state.amount ?? 0) * 10);
    if (e.obj.userData.fillT === t) return;
    const neo = e.def.build(this.g.mats, e.state);
    const parent = e.obj.parent;
    const pos = e.obj.position.clone(), q = e.obj.quaternion.clone();
    parent?.remove(e.obj);
    neo.position.copy(pos);
    neo.quaternion.copy(q);
    neo.traverse((o) => (o.userData.item = e));
    neo.userData.fillT = t;
    e.obj = neo;
    parent?.add(neo);
  }
  toggleFlash() {
    if (!this.has('light')) return;
    this.flashOn = !this.flashOn;
    this.g.audio.play('switch', { volume: 0.5 });
  }
  private meleeSwing(w: ItemEntity) {
    if (this.swingCool > 0) return;
    this.swingCool = w.def.weapon!.rate;
    this.swing = 1;
    this.g.audio.play('swing', { volume: 0.6 });
    setTimeout(() => this.g.combat.melee(w), 120);
  }

  // ------------------------------------------------------------------ held item presentation
  private updateHand(dt: number) {
    const g = this.g;
    const e = this.hand;
    this.swingCool = Math.max(0, this.swingCool - dt);
    this.swing = Math.max(0, this.swing - dt * 3.2);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    const flashAvail = this.has('light');
    if (!flashAvail) this.flashOn = false;
    this.flashlight.intensity = this.flashOn ? 60 : 0;
    this.flashlight.visible = this.flashOn;
    if (!e) return;
    if (e.obj.parent === this.handObj) {
      // view model
      const bob = g.player.bob;
      const moving = g.player.vel.length() > 0.5 ? 1 : 0;
      const ax = Math.sin(bob * Math.PI) * 0.012 * moving;
      const ay = Math.abs(Math.cos(bob * Math.PI)) * 0.01 * moving;
      let x = 0.24, y = -0.22, z = -0.46;
      let rx = 0, ry = -0.35, rz = 0;
      if (e.def.tool === 'gun') {
        x = this.aiming ? 0.0 : 0.18; y = this.aiming ? -0.1 : -0.17; z = this.aiming ? -0.38 : -0.42; ry = this.aiming ? 0 : -0.08;
        rx = this.recoil * 0.5;
        z += this.recoil * 0.05;
      }
      if (e.def.weapon && e.def.tool !== 'gun') {
        rx = -0.3 - Math.sin(this.swing * Math.PI) * 1.4;
        rz = 0.3;
        y += Math.sin(this.swing * Math.PI) * 0.05;
      }
      if (e.def.tool === 'light') { x = 0.2; y = -0.2; z = -0.4; ry = 0; }
      if (g.player.car) { y -= 0.06; }
      this.handObj.position.set(x + ax, y + ay, z);
      this.handObj.rotation.set(rx, ry, rz);
      this.g.player.camera.fov = damp(this.g.player.camera.fov, this.aiming ? g.baseFov * 0.72 : g.baseFov, 10, dt);
    } else if (e.body) {
      // physically carried item: velocity servo towards a point in front of the camera
      const cam = g.player.camera;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const target = cam.position.clone().addScaledVector(fwd, this.holdDist + Math.max(e.half.x, e.half.z) * 0.8).add(new THREE.Vector3(0, -0.15, 0));
      const t = e.body.translation();
      const cur = new THREE.Vector3(t.x, t.y, t.z);
      const err = target.sub(cur);
      if (err.length() > 2.4) { this.drop(false); return; }
      const heavy = e.mass > 30;
      const k = heavy ? 5 : 12;
      const v = err.multiplyScalar(k);
      if (v.length() > 12) v.setLength(12);
      e.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
      const yaw = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, g.player.yaw, 0));
      const r = e.body.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const dq = yaw.clone().multiply(q.clone().invert());
      if (dq.w < 0) { dq.x *= -1; dq.y *= -1; dq.z *= -1; dq.w *= -1; }
      const angle = 2 * Math.acos(clamp(dq.w, -1, 1));
      const s = Math.sqrt(1 - dq.w * dq.w);
      const axis = s > 1e-4 ? new THREE.Vector3(dq.x / s, dq.y / s, dq.z / s) : new THREE.Vector3();
      const w = axis.multiplyScalar(angle * (heavy ? 3 : 6));
      e.body.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
    }
  }
  kickRecoil() {
    this.recoil = 1;
  }

  // ------------------------------------------------------------------ labels
  itemName(e: ItemEntity) {
    const lang = this.g.ui.lang;
    if (e.part) return partName(e.part.kind, KIND_SLOT[e.part.kind], lang);
    return e.def.name[lang === 'ru' ? 0 : 1];
  }
  itemInfo(e: ItemEntity): string[] {
    const out: string[] = [];
    const s = e.state;
    const lang = this.g.ui.lang;
    if (e.def.liquid) out.push(s.liquid && (s.amount ?? 0) > 0.01 ? `${LIQUID_NAME[s.liquid][lang === 'ru' ? 0 : 1]}: ${(s.amount ?? 0).toFixed(1)} / ${e.def.liquid.cap} ${tr('л', 'L')}` : tr('Пусто', 'Empty'));
    if (e.def.money) out.push(`$${(s.money ?? 0).toFixed(0)}`);
    if (e.def.ammo) out.push(`${s.ammo ?? 0} ${tr('шт.', 'rounds')}`);
    if (e.def.tool === 'gun') out.push(`${tr('Заряжено', 'Loaded')}: ${s.loaded ?? 0}/6`);
    if (e.part) {
      out.push(`${tr('Состояние', 'Condition')}: ${Math.round(e.part.cond * 100)}%`);
      if (e.part.kind === 'engine') out.push(`${tr('Масло', 'Oil')}: ${(e.part.oil ?? 0).toFixed(1)} ${tr('л', 'L')}`);
      if (e.part.kind === 'battery') out.push(`${tr('Заряд', 'Charge')}: ${Math.round((e.part.charge ?? 0) * 100)}%`);
      if (e.part.kind === 'radiator') out.push(`${tr('Вода', 'Water')}: ${(e.part.coolant ?? 0).toFixed(1)} ${tr('л', 'L')}`);
      if (e.part.flat) out.push(tr('Колесо спущено', 'Flat tyre'));
    }
    return out;
  }
}

function d_throwable(e: ItemEntity) {
  return e.def.tool !== 'gun';
}
