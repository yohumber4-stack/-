import type { Game } from './game';
import { tr } from '../ui/i18n';

/** One-shot contextual tutorial hints. Each key is shown at most once per save. */
const TEXT: Record<string, () => string> = {
  intro: () => tr('Мать оставила письмо на столе в доме. Наведите прицел на предмет: <b>ЛКМ</b> — взять, <b>E</b> — действие.', 'Your mother left a letter on the table in the house. Aim at an object: <b>LMB</b> to take, <b>E</b> to interact.'),
  letter: () => tr('Машина в гараже. Возьмите аккумулятор с верстака, откройте капот (<b>E</b>) и поднесите деталь к пустому месту — <b>ЛКМ</b>, чтобы установить.', 'The car is in the garage. Take the battery from the workbench, open the hood (<b>E</b>) and bring the part to the empty spot — <b>LMB</b> to install.'),
  'partInstalled:battery': () => tr('Аккумулятор на месте. Теперь бензин: откройте лючок бака сзади справа (<b>E</b>) и удерживайте <b>ЛКМ</b> с канистрой в руках.', 'Battery installed. Now fuel: open the filler cap at the rear right (<b>E</b>) and hold <b>LMB</b> with the jerry can in hand.'),
  firstCar: () => tr('<b>I</b> — зажигание (удерживайте, чтобы крутить стартер). <b>W/S</b> — газ/тормоз, <b>Пробел</b> — ручник, <b>L</b> — фары, <b>N</b> — радио, <b>E</b> — выйти.', '<b>I</b> — ignition (hold to crank). <b>W/S</b> — throttle/brake, <b>Space</b> — handbrake, <b>L</b> — lights, <b>N</b> — radio, <b>E</b> — exit.'),
  garageDoor: () => tr('Ворота гаража открываются клавишей <b>E</b>.', 'Open the garage gate with <b>E</b>.'),
  partRemoved: () => tr('Снятую деталь можно положить (<b>Q</b>) или установить на любую машину — поднесите её к пустому месту.', 'A removed part can be dropped (<b>Q</b>) or installed on any car — bring it to an empty slot.'),
  wrongFuel: () => tr('Это не бензин! Примеси в баке заглушат мотор. Слейте топливо шлангом: <b>ПКМ</b> с пустой канистрой у открытого бака.', 'That is not petrol! Contaminated fuel will stall the engine. Siphon it out: <b>RMB</b> with an empty can at the open filler.'),
  lowFuel: () => tr('Топливо на исходе. Ищите заправки вдоль трассы или сливайте бензин из брошенных машин.', 'Fuel is running low. Look for gas stations along the highway or siphon petrol from abandoned cars.'),
  overheat: () => tr('Двигатель перегревается! Остановитесь, откройте капот и долейте воду в радиатор.', 'The engine is overheating! Stop, open the hood and top up the radiator with water.'),
  noBattery: () => tr('Стартер молчит: нет аккумулятора или он разряжен. Заряд восстанавливается, пока мотор работает.', 'The starter is silent: no battery or it is flat. It recharges while the engine runs.'),
  noOil: () => tr('Масла почти нет — двигатель может заклинить. Долейте масло под капотом.', 'Oil is almost gone — the engine may seize. Top it up under the hood.'),
  night: () => tr('Темнеет. Включите фары (<b>L</b>) и фонарик (<b>F</b>). Ночью в пустыне выходят твари — держитесь машины.', 'Night is falling. Use the headlights (<b>L</b>) and flashlight (<b>F</b>). Creatures roam the desert at night — stay near the car.'),
  storm: () => tr('Песчаная буря! Видимость падает до десятков метров. Сбавьте скорость или переждите в машине.', 'Sandstorm! Visibility drops to a few dozen metres. Slow down or wait it out in the car.'),
  rain: () => tr('Дождь. Асфальт становится скользким — тормозите заранее. Воду можно набирать из колодцев.', 'Rain. The asphalt gets slippery — brake early. Water can be drawn from wells.'),
  thirst: () => tr('Вас мучает жажда. Возьмите бутылку воды и нажмите <b>ЛКМ</b>, чтобы выпить, или найдите колодец.', 'You are thirsty. Take a bottle of water and press <b>LMB</b> to drink, or find a well.'),
  hunger: () => tr('Вы голодны. Консервы попадаются в домах, мотелях и на заправках.', 'You are hungry. Canned food can be found in houses, motels and gas stations.'),
  tired: () => tr('Вы устали. Поспите на кровати или в машине (<b>X</b> на сиденье).', 'You are tired. Sleep in a bed or in the car (<b>X</b> while seated).'),
  enemy: () => tr('Рядом враг! Бейте ближним оружием (<b>ЛКМ</b>), стреляйте или уезжайте.', 'An enemy is close! Hit it with a melee weapon (<b>LMB</b>), shoot, or drive away.'),
  gun: () => tr('Револьвер: <b>ЛКМ</b> — выстрел, <b>ПКМ</b> — прицел, <b>R</b> — перезарядка (нужны патроны в кармане).', 'Revolver: <b>LMB</b> — fire, <b>RMB</b> — aim, <b>R</b> — reload (needs ammo in a pocket).'),
  station: () => tr('Заправка: наведитесь на колонку. <b>E</b> — заправить машину, <b>ЛКМ</b> — наполнить канистру. Топливо стоит денег.', 'Gas station: aim at a pump. <b>E</b> — refuel the car, <b>LMB</b> — fill a can. Fuel costs money.'),
  wreck: () => tr('Брошенные машины — источник деталей и бензина. Гаечным ключом можно открутить почти всё (удерживайте <b>ЛКМ</b>).', 'Abandoned cars are a source of parts and petrol. A wrench unbolts almost anything (hold <b>LMB</b>).'),
  inventory: () => tr('Мелкие предметы убираются в карманы: <b>1–4</b> — положить/достать.', 'Small items fit in pockets: <b>1–4</b> to stow/take out.'),
  mines: () => tr('Знак предупреждает о минах. Не сходите с дороги возле военных объектов.', 'The sign warns of mines. Do not leave the road near military sites.'),
  flatTire: () => tr('Спущено колесо — машину тянет в сторону. Замените колесо: снимите ключом и поставьте другое.', 'Flat tyre — the car pulls to one side. Replace it: unbolt with a wrench and fit another wheel.'),
};

export class Hints {
  shown = new Set<string>();
  private queue: string[] = [];
  private cool = 0;
  private checkT = 0;

  constructor(private g: Game) {}

  trigger(key: string) {
    if (this.shown.has(key) || this.queue.includes(key)) return;
    if (!TEXT[key]) return;
    this.queue.push(key);
  }

  update(dt: number) {
    const g = this.g;
    this.cool -= dt;
    if (this.queue.length && this.cool <= 0) {
      const k = this.queue.shift()!;
      if (!this.shown.has(k)) {
        this.shown.add(k);
        g.ui.hint(TEXT[k](), 11);
        g.audio.play('notify', { volume: 0.35 });
        this.cool = 9;
      }
    }
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 0.5;
    const p = g.player;
    const st = p.stats;
    if (st.thirst < 30) this.trigger('thirst');
    if (st.hunger < 30) this.trigger('hunger');
    if (st.energy < 25) this.trigger('tired');
    if (g.env.night > 0.45) this.trigger('night');
    if (g.env.cur.sand > 0.4) this.trigger('storm');
    if (g.env.cur.rain > 0.4) this.trigger('rain');
    const car = g.playerCar;
    if (car) {
      if (car.running && car.fuelTotal < 5) this.trigger('lowFuel');
      if (car.temp > 110) this.trigger('overheat');
      if (car.running && (car.parts.engine?.oil ?? 1) < 0.6) this.trigger('noOil');
      if (p.car === car && ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].some((s) => (car.parts as any)[s]?.flat)) this.trigger('flatTire');
    }
    const hand = g.interaction.hand;
    if (hand?.def.tool === 'gun') this.trigger('gun');
    if (hand?.def.storable && !g.interaction.slots.some(Boolean)) this.trigger('inventory');
    const cam = p.camera.position;
    for (const e of g.enemies.list) if (e.alive && e.obj.position.distanceTo(cam) < 22) { this.trigger('enemy'); break; }
    for (const bp of g.worldgen.built.values()) {
      if (!bp.active) continue;
      const d = Math.hypot(bp.plan.x - (cam.x + g.physics.originX), bp.plan.z - (cam.z + g.physics.originZ));
      if (d > 30) continue;
      if (bp.plan.type === 'station') this.trigger('station');
      if (bp.plan.type === 'military') this.trigger('mines');
      if (bp.wrecks.length && bp.plan.type !== 'homestead') this.trigger('wreck');
    }
  }
}
