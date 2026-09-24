import { CSS } from './style';
import { Lang, setLang, tr, LETTER, NOTES } from './i18n';
import type { UiTarget } from '../game/interaction';
import { Action, DEFAULT_BINDINGS } from '../core/input';

export interface Settings {
  lang: Lang;
  quality: number;
  renderScale: number;
  fov: number;
  sensitivity: number;
  invertY: boolean;
  headBob: boolean;
  showFps: boolean;
  master: number;
  sfx: number;
  ambient: number;
  radio: number;
  music: number;
  engine: number;
  auto: boolean;
  hints: boolean;
  dayLength: number;
  carHud: boolean;
  difficulty: number;
  mirrors: boolean;
  bindings: Record<string, string[]>;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'ru', quality: 2, renderScale: 1, fov: 75, sensitivity: 1, invertY: false, headBob: true, showFps: false,
  master: 0.8, sfx: 0.9, ambient: 0.8, radio: 0.7, music: 0.6, engine: 0.9, auto: true, hints: true, dayLength: 24, carHud: true, difficulty: 1, mirrors: true,
  bindings: {},
};

export interface HudState {
  target: UiTarget | null;
  hold: number;
  stats: { health: number; hunger: number; thirst: number; energy: number; stamina: number };
  hand: { name: string; icon: string; qty: string } | null;
  slots: ({ name: string; icon: string; qty: string } | null)[];
  compass: number | null;
  car: { speed: number; gear: string; fuel: number; temp: number; batt: number; running: boolean; warn: string } | null;
  fps: number;
  hurt: number;
  inCar: boolean;
}

export interface UiHooks {
  newGame: (seed: number) => void;
  continueGame: () => void;
  resume: () => void;
  save: () => void;
  load: () => void;
  quitToMenu: () => void;
  applySettings: (s: Settings) => void;
  hasSave: () => boolean;
  journal: () => any;
  click: () => void;
  hover: () => void;
  captureKey: (cb: (code: string) => void) => void;
}

const ICONS: Record<string, string> = {
  health: '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/>',
  hunger: '<path d="M7 2v7a2 2 0 0 0 1.5 1.9V22h2V10.9A2 2 0 0 0 12 9V2h-1.3v6H9.6V2H8.4v6H7.3V2zM16 2c-1.7 0-3 2.4-3 5.5 0 2.2.9 3.9 2 4.5V22h2V2z"/>',
  thirst: '<path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z"/>',
  energy: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  stamina: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
};
const STAT_COLORS: Record<string, string> = { health: '#e0523e', hunger: '#e0a03e', thirst: '#5fa8e8', energy: '#a88be0', stamina: '#e8e0c8' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export class UI {
  root: HTMLDivElement;
  settings: Settings;
  private layers: Record<string, HTMLDivElement> = {};
  private hudEls: Record<string, HTMLElement> = {};
  private lastHud = '';
  private hintTimer = 0;
  private radioTimer = 0;
  state: 'loading' | 'menu' | 'game' | 'pause' | 'settings' | 'journal' | 'note' | 'death' | 'win' = 'loading';
  private settingsReturn: 'menu' | 'pause' = 'menu';
  private compassCanvas!: HTMLCanvasElement;
  hooks!: UiHooks;

  get lang() {
    return this.settings.lang;
  }

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = el('div');
    this.root.id = 'ui';
    document.body.appendChild(this.root);
    this.settings = this.loadSettings();
    setLang(this.settings.lang);
    for (const n of ['hud', 'menu', 'overlay', 'note', 'death', 'win', 'loading']) {
      const l = el('div', 'layer hidden');
      l.id = n;
      this.root.appendChild(l);
      this.layers[n] = l;
    }
    this.buildHud();
  }

  // ------------------------------------------------------------------ settings
  loadSettings(): Settings {
    try {
      const s = JSON.parse(localStorage.getItem('tlr_settings') || '{}');
      return { ...DEFAULT_SETTINGS, ...s, bindings: s.bindings || {} };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  saveSettings() {
    try { localStorage.setItem('tlr_settings', JSON.stringify(this.settings)); } catch {}
  }

  private show(name: string, on = true) {
    this.layers[name].classList.toggle('hidden', !on);
  }
  private logo() {
    return `<div class="logo"><div class="t1">THE <b>LONG</b> ROAD</div><div class="t2">${tr('Пустыня · 1979', 'Desert · 1979')}</div></div>`;
  }

  // ------------------------------------------------------------------ loading
  showLoading() {
    this.state = 'loading';
    const tips = [
      tr('Держитесь дороги: заправки и дома стоят только вдоль неё.', 'Stay on the road: gas stations and houses only line the highway.'),
      tr('Без воды в радиаторе двигатель перегреется за пару минут.', 'Without water in the radiator the engine overheats in minutes.'),
      tr('Дизель в бензиновом моторе — верный способ заглохнуть посреди пустыни.', 'Diesel in a petrol engine is a sure way to stall in the middle of nowhere.'),
      tr('Гаечным ключом можно снять почти любую деталь с брошенной машины.', 'A wrench lets you strip almost any part off an abandoned car.'),
      tr('Ночью в пустыне выходят кролики. Не спорьте с ними пешком.', 'Rabbits come out at night. Do not argue with them on foot.'),
    ];
    this.layers.loading.innerHTML = `${this.logo()}<div class="lbl" id="ldl">${tr('Загрузка', 'Loading')}</div><div class="bar"><i id="ldb"></i></div><div class="tip">${tips[Math.floor(Math.random() * tips.length)]}</div>`;
    this.show('loading');
  }
  setLoading(p: number, label: string) {
    const b = document.getElementById('ldb');
    if (b) b.style.width = `${Math.round(p * 100)}%`;
    const names: Record<string, [string, string]> = {
      physics: ['Физика', 'Physics'], textures: ['Текстуры', 'Textures'], sky: ['Небо', 'Sky'], world: ['Пустыня', 'Desert'], car: ['Машина', 'Car'], terrain: ['Рельеф', 'Terrain'], env: ['Атмосфера', 'Atmosphere'], done: ['Готово', 'Ready'], audio: ['Звук', 'Audio'],
    };
    const l = document.getElementById('ldl');
    if (l) l.textContent = (names[label] ? tr(...names[label]) : label) + ' · ' + Math.round(p * 100) + '%';
  }
  hideLoading() {
    this.show('loading', false);
  }
  /** Loading finished: wait for a click / key press (browsers need a gesture for audio and mouse capture). */
  loadingDone(onGo: () => void, auto = false) {
    const b = document.getElementById('ldb');
    if (b) b.style.width = '100%';
    const l = document.getElementById('ldl');
    if (l) l.textContent = tr('Готово', 'Ready');
    const L = this.layers.loading;
    const go = el('div', 'go', tr('Нажмите любую клавишу, чтобы начать', 'Press any key to start'));
    L.appendChild(go);
    let done = false;
    const fire = (ev?: Event) => {
      if (done) return;
      if (ev instanceof KeyboardEvent && ['Tab', 'Alt', 'Meta', 'ControlLeft'].includes(ev.code)) return;
      done = true;
      window.removeEventListener('keydown', fire, true);
      window.removeEventListener('mousedown', fire, true);
      L.classList.add('fade');
      setTimeout(() => { this.show('loading', false); L.classList.remove('fade'); }, 800);
      onGo();
    };
    if (auto) fire();
    else {
      window.addEventListener('keydown', fire, true);
      window.addEventListener('mousedown', fire, true);
    }
  }

  // ------------------------------------------------------------------ main menu
  showMenu() {
    this.state = 'menu';
    this.hideOverlays();
    this.show('hud', false);
    const L = this.layers.menu;
    L.className = 'layer menu';
    const has = this.hooks.hasSave();
    L.innerHTML = `${this.logo()}
      <div class="items">
        <button class="mbtn" data-a="continue" ${has ? '' : 'disabled'}>${tr('Продолжить', 'Continue')}<small>${has ? tr('Последнее сохранение', 'Last save') : tr('Нет сохранений', 'No saves')}</small></button>
        <button class="mbtn" data-a="new">${tr('Новая игра', 'New game')}</button>
        <button class="mbtn" data-a="settings">${tr('Настройки', 'Settings')}</button>
        <button class="mbtn" data-a="controls">${tr('Управление', 'Controls')}</button>
        <button class="mbtn" data-a="about">${tr('Об игре', 'About')}</button>
      </div>
      <div class="foot">v1.0 · <b>THE LONG ROAD</b> · ${tr('процедурная пустыня, созданная кодом', 'a procedural desert made entirely of code')}</div>`;
    this.bindButtons(L, {
      continue: () => this.hooks.continueGame(),
      new: () => this.showNewGame(),
      settings: () => this.showSettings('menu'),
      controls: () => this.showSettings('menu', 'controls'),
      about: () => this.showAbout(),
    });
    this.show('menu');
  }
  private bindButtons(root: HTMLElement, map: Record<string, () => void>) {
    root.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => {
      b.addEventListener('mouseenter', () => this.hooks.hover());
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.hooks.click();
        map[b.dataset.a!]?.();
      });
    });
  }
  private showNewGame() {
    const seed = Math.floor(Math.random() * 99999);
    this.overlay(`<h2>${tr('Новая <b>игра</b>', 'New <b>game</b>')}</h2>
      <div class="row"><label>${tr('Сид мира', 'World seed')}</label><div class="v"><input type="text" id="seed" value="${seed}"></div></div>
      <div class="row"><label>${tr('Сложность', 'Difficulty')}</label><div class="v">${this.seg('difficulty', [[0.6, tr('Легко', 'Easy')], [1, tr('Норма', 'Normal')], [1.5, tr('Сурово', 'Harsh')]])}</div></div>
      <div class="row"><label>${tr('Коробка передач', 'Transmission')}</label><div class="v">${this.seg('auto', [[true, tr('Автомат', 'Automatic')], [false, tr('Механика', 'Manual')]])}</div></div>
      <p style="color:var(--mut);font-size:13px;max-width:560px;line-height:1.55">${tr('Мать ждёт вас на побережье — в пяти тысячах километров по старому шоссе. Машина в гараже, аккумулятор на верстаке. Удачи.', 'Your mother is waiting on the coast — five thousand kilometres down the old highway. The car is in the garage, the battery on the workbench. Good luck.')}</p>
      <div class="btnrow"><button class="btn" data-a="back">${tr('Назад', 'Back')}</button><button class="btn pri" data-a="go">${tr('В путь', 'Start')}</button></div>`);
    this.wireSegs(this.layers.overlay);
    this.bindButtons(this.layers.overlay, {
      back: () => this.hideOverlays(),
      go: () => {
        const v = Number((document.getElementById('seed') as HTMLInputElement).value.replace(/\D/g, '')) || 1;
        this.saveSettings();
        this.hooks.applySettings(this.settings);
        this.hooks.newGame(v);
      },
    });
  }
  private showAbout() {
    this.overlay(`<h2>${tr('Об <b>игре</b>', '<b>About</b>')}</h2>
      <p style="max-width:620px;line-height:1.7;color:#ddd3c3">${tr('THE LONG ROAD — бесконечная процедурная пустыня, старый седан и дорога длиной в пять тысяч километров. Ищите топливо и воду, чините и дорабатывайте машину, исследуйте брошенные заправки и дома, прячьтесь от песчаных бурь и тех, кто выходит ночью.', 'THE LONG ROAD is an endless procedural desert, an old sedan and a five-thousand-kilometre highway. Scavenge fuel and water, repair and rebuild your car, explore abandoned stations and homes, hide from sandstorms and from whatever comes out at night.')}</p>
      <p style="max-width:620px;line-height:1.7;color:var(--mut);font-size:13px">${tr('Все модели, текстуры, звуки и музыка сгенерированы кодом в реальном времени. Вдохновлено The Long Drive.', 'Every model, texture, sound and piece of music is generated by code at runtime. Inspired by The Long Drive.')}</p>
      <div class="btnrow"><button class="btn" data-a="back">${tr('Закрыть', 'Close')}</button></div>`);
    this.bindButtons(this.layers.overlay, { back: () => this.hideOverlays() });
  }

  private overlay(html: string) {
    const L = this.layers.overlay;
    L.className = 'layer overlay';
    L.innerHTML = `<div class="panel">${html}</div>`;
    this.show('overlay');
  }
  hideOverlays() {
    this.show('overlay', false);
    this.show('note', false);
  }

  // ------------------------------------------------------------------ settings
  private seg(key: keyof Settings, opts: [any, string][]) {
    const cur = this.settings[key];
    return `<div class="seg" data-seg="${key}">${opts.map(([v, l]) => `<button data-v='${JSON.stringify(v)}' class="${JSON.stringify(v) === JSON.stringify(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  }
  private range(key: keyof Settings, min: number, max: number, step: number, fmt: (v: number) => string) {
    const v = this.settings[key] as number;
    return `<input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${v}"><span data-rv="${key}">${fmt(v)}</span>`;
  }
  private wireSegs(root: HTMLElement, fmts: Record<string, (v: number) => string> = {}) {
    root.querySelectorAll<HTMLElement>('[data-seg]').forEach((s) => {
      s.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.hooks.click();
          (this.settings as any)[s.dataset.seg!] = JSON.parse(b.dataset.v!);
          s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          if (s.dataset.seg === 'lang') { setLang(this.settings.lang); this.saveSettings(); this.hooks.applySettings(this.settings); this.showSettings(this.settingsReturn, 'game'); }
          else this.hooks.applySettings(this.settings);
        }),
      );
    });
    root.querySelectorAll<HTMLInputElement>('[data-range]').forEach((r) =>
      r.addEventListener('input', () => {
        const k = r.dataset.range!;
        (this.settings as any)[k] = Number(r.value);
        const lbl = root.querySelector<HTMLElement>(`[data-rv="${k}"]`);
        if (lbl) lbl.textContent = (fmts[k] ?? ((v: number) => String(v)))(Number(r.value));
        this.hooks.applySettings(this.settings);
      }),
    );
  }
  showSettings(from: 'menu' | 'pause', tab = 'graphics') {
    this.settingsReturn = from;
    this.state = 'settings';
    const pct = (v: number) => Math.round(v * 100) + '%';
    const fmts: Record<string, (v: number) => string> = { renderScale: pct, master: pct, sfx: pct, ambient: pct, radio: pct, music: pct, engine: pct, fov: (v) => v + '°', sensitivity: (v) => v.toFixed(2), dayLength: (v) => v + ' ' + tr('мин', 'min') };
    const tabs: Record<string, string> = {
      graphics: `
        <div class="row"><label>${tr('Качество графики', 'Graphics quality')}</label><div class="v">${this.seg('quality', [[0, tr('Низкое', 'Low')], [1, tr('Среднее', 'Medium')], [2, tr('Высокое', 'High')], [3, tr('Ультра', 'Ultra')]])}</div></div>
        <div class="row"><label>${tr('Масштаб рендера', 'Render scale')}</label><div class="v">${this.range('renderScale', 0.5, 1, 0.05, fmts.renderScale)}</div></div>
        <div class="row"><label>${tr('Поле зрения', 'Field of view')}</label><div class="v">${this.range('fov', 60, 100, 1, fmts.fov)}</div></div>
        <div class="row"><label>${tr('Зеркала заднего вида', 'Rear-view mirrors')}</label><div class="v">${this.seg('mirrors', [[true, tr('Вкл', 'On')], [false, tr('Выкл', 'Off')]])}</div></div>
        <div class="row"><label>${tr('Покачивание камеры', 'Head bob')}</label><div class="v">${this.seg('headBob', [[true, tr('Вкл', 'On')], [false, tr('Выкл', 'Off')]])}</div></div>
        <div class="row"><label>${tr('Счётчик FPS', 'FPS counter')}</label><div class="v">${this.seg('showFps', [[true, tr('Вкл', 'On')], [false, tr('Выкл', 'Off')]])}</div></div>`,
      audio: ['master', 'sfx', 'engine', 'ambient', 'radio', 'music']
        .map((k) => `<div class="row"><label>${{ master: tr('Общая громкость', 'Master volume'), sfx: tr('Эффекты', 'Effects'), engine: tr('Двигатель', 'Engine'), ambient: tr('Окружение', 'Ambience'), radio: tr('Радио', 'Radio'), music: tr('Музыка меню', 'Menu music') }[k]}</label><div class="v">${this.range(k as any, 0, 1, 0.01, pct)}</div></div>`)
        .join(''),
      controls: `
        <div class="row"><label>${tr('Чувствительность мыши', 'Mouse sensitivity')}</label><div class="v">${this.range('sensitivity', 0.2, 3, 0.05, fmts.sensitivity)}</div></div>
        <div class="row"><label>${tr('Инверсия по вертикали', 'Invert Y')}</label><div class="v">${this.seg('invertY', [[false, tr('Нет', 'No')], [true, tr('Да', 'Yes')]])}</div></div>
        <div class="row"><label>${tr('Коробка передач', 'Transmission')}</label><div class="v">${this.seg('auto', [[true, tr('Автомат', 'Automatic')], [false, tr('Механика', 'Manual')]])}</div></div>
        ${this.bindRows()}
        <div class="btnrow" style="justify-content:flex-start"><button class="btn" data-a="resetkeys">${tr('Сбросить клавиши', 'Reset keys')}</button></div>`,
      game: `
        <div class="row"><label>${tr('Язык', 'Language')}</label><div class="v">${this.seg('lang', [['ru', 'Русский'], ['en', 'English']])}</div></div>
        <div class="row"><label>${tr('Подсказки', 'Hints')}</label><div class="v">${this.seg('hints', [[true, tr('Вкл', 'On')], [false, tr('Выкл', 'Off')]])}</div></div>
        <div class="row"><label>${tr('Панель машины на экране', 'On-screen car panel')}</label><div class="v">${this.seg('carHud', [[true, tr('Вкл', 'On')], [false, tr('Выкл', 'Off')]])}</div></div>
        <div class="row"><label>${tr('Длина суток', 'Day length')}</label><div class="v">${this.range('dayLength', 12, 60, 6, fmts.dayLength)}</div></div>
        <div class="row"><label>${tr('Сложность', 'Difficulty')}</label><div class="v">${this.seg('difficulty', [[0.6, tr('Легко', 'Easy')], [1, tr('Норма', 'Normal')], [1.5, tr('Сурово', 'Harsh')]])}</div></div>`,
    };
    const names: Record<string, string> = { graphics: tr('Графика', 'Graphics'), audio: tr('Звук', 'Audio'), controls: tr('Управление', 'Controls'), game: tr('Игра', 'Game') };
    this.overlay(`<h2>${tr('<b>Настройки</b>', '<b>Settings</b>')}</h2>
      <div class="tabs">${Object.keys(tabs).map((k) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${names[k]}</button>`).join('')}</div>
      <div style="min-width:min(640px,86vw)">${tabs[tab]}</div>
      <div class="btnrow"><button class="btn pri" data-a="done">${tr('Готово', 'Done')}</button></div>`);
    const L = this.layers.overlay;
    L.querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => t.addEventListener('click', (ev) => { ev.stopPropagation(); this.hooks.click(); this.showSettings(from, t.dataset.tab); }));
    this.wireSegs(L, fmts);
    L.querySelectorAll<HTMLElement>('[data-bind]').forEach((b) =>
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        b.classList.add('wait');
        b.textContent = '…';
        this.hooks.captureKey((code) => {
          if (code !== 'Escape') this.settings.bindings[b.dataset.bind!] = [code];
          this.saveSettings();
          this.hooks.applySettings(this.settings);
          this.showSettings(from, 'controls');
        });
      }),
    );
    this.bindButtons(L, {
      done: () => {
        this.saveSettings();
        this.hooks.applySettings(this.settings);
        if (from === 'pause') this.showPause();
        else { this.hideOverlays(); this.state = 'menu'; }
      },
      resetkeys: () => { this.settings.bindings = {}; this.saveSettings(); this.hooks.applySettings(this.settings); this.showSettings(from, 'controls'); },
    });
  }
  private bindRows() {
    const acts: [Action, string][] = [
      ['forward', tr('Вперёд / газ', 'Forward / throttle')], ['back', tr('Назад / тормоз', 'Back / brake')], ['left', tr('Влево', 'Left')], ['right', tr('Вправо', 'Right')],
      ['jump', tr('Прыжок / ручник', 'Jump / handbrake')], ['sprint', tr('Бег', 'Sprint')], ['crouch', tr('Присесть', 'Crouch')], ['interact', tr('Взаимодействие', 'Interact')],
      ['drop', tr('Выбросить', 'Drop')], ['reload', tr('Перезарядка / передача +', 'Reload / gear up')], ['flashlight', tr('Фонарик / передача −', 'Flashlight / gear down')],
      ['ignition', tr('Зажигание (держать)', 'Ignition (hold)')], ['headlights', tr('Фары', 'Headlights')], ['horn', tr('Сигнал', 'Horn')], ['radio', tr('Радио', 'Radio')],
      ['camera', tr('Вид камеры', 'Camera view')], ['journal', tr('Журнал', 'Journal')], ['sleep', tr('Спать в машине', 'Sleep in car')],
    ];
    return acts
      .map(([a, n]) => {
        const code = (this.settings.bindings[a] ?? DEFAULT_BINDINGS[a])[0] ?? '?';
        return `<div class="row"><label>${n}</label><div class="v"><span class="key bind" data-bind="${a}">${keyLabel(code)}</span></div></div>`;
      })
      .join('');
  }

  // ------------------------------------------------------------------ pause / journal / death
  showPause() {
    this.state = 'pause';
    this.overlay(`<h2>${tr('<b>Пауза</b>', '<b>Paused</b>')}</h2>
      <div class="col">
        <button class="mbtn" data-a="resume">${tr('Продолжить', 'Resume')}</button>
        <button class="mbtn" data-a="journal">${tr('Журнал', 'Journal')}</button>
        <button class="mbtn" data-a="save">${tr('Сохранить', 'Save')}</button>
        <button class="mbtn" data-a="load" ${this.hooks.hasSave() ? '' : 'disabled'}>${tr('Загрузить', 'Load')}</button>
        <button class="mbtn" data-a="settings">${tr('Настройки', 'Settings')}</button>
        <button class="mbtn" data-a="quit">${tr('Выйти в меню', 'Quit to menu')}</button>
      </div>`);
    this.bindButtons(this.layers.overlay, {
      resume: () => this.hooks.resume(),
      journal: () => this.showJournal(true),
      save: () => { this.hooks.save(); this.toast(tr('Игра сохранена', 'Game saved')); },
      load: () => this.hooks.load(),
      settings: () => this.showSettings('pause'),
      quit: () => this.hooks.quitToMenu(),
    });
  }
  showJournal(fromPause = false) {
    this.state = 'journal';
    const j = this.hooks.journal();
    const line = (a: string, b: string) => `<div class="jl"><span>${a}</span><span>${b}</span></div>`;
    const meter = (a: string, v: number, txt: string, col = 'var(--acc)') => `${line(a, txt)}<div class="meter"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;background:${col}"></i></div>`;
    const car = j.car;
    this.overlay(`<h2>${tr('<b>Журнал</b>', '<b>Journal</b>')}</h2>
      <div class="jgrid">
        <div class="jbox"><h3>${tr('Путь', 'Journey')}</h3>
          ${meter(tr('До побережья', 'To the coast'), j.km / j.goal, `${Math.max(0, j.goal - j.km).toFixed(0)} ${tr('км', 'km')}`)}
          ${line(tr('Пройдено по трассе', 'Along the highway'), `${j.km.toFixed(1)} ${tr('км', 'km')}`)}
          ${line(tr('День', 'Day'), `${j.day} · ${j.time}`)}
          ${line(tr('Погода', 'Weather'), j.weather)}
          ${line(tr('Температура', 'Temperature'), `${j.temp.toFixed(0)} °C`)}
          ${line(tr('Деньги', 'Money'), `$${j.money.toFixed(0)}`)}
          ${line(tr('Убито тварей', 'Creatures killed'), String(j.kills))}
        </div>
        <div class="jbox"><h3>${tr('Машина', 'Car')}</h3>
          ${car ? `
          ${meter(tr('Топливо', 'Fuel'), car.fuel / 40, `${car.fuel.toFixed(1)} / 40 ${tr('л', 'L')}`)}
          ${meter(tr('Масло', 'Oil'), car.oil / 3.5, car.hasEngine ? `${car.oil.toFixed(1)} / 3.5 ${tr('л', 'L')}` : tr('нет двигателя', 'no engine'), '#c8a060')}
          ${meter(tr('Охлаждение', 'Coolant'), car.coolant / 5, car.hasRad ? `${car.coolant.toFixed(1)} / 5 ${tr('л', 'L')}` : tr('нет радиатора', 'no radiator'), 'var(--blu)')}
          ${meter(tr('Аккумулятор', 'Battery'), car.batt, car.hasBatt ? `${Math.round(car.batt * 100)}%` : tr('нет', 'none'), 'var(--grn)')}
          ${meter(tr('Двигатель', 'Engine'), car.engine, car.hasEngine ? `${Math.round(car.engine * 100)}%` : '—', '#e0a03e')}
          ${line(tr('Пробег', 'Odometer'), `${car.odo.toFixed(0)} ${tr('км', 'km')}`)}
          ${line(tr('Недостающие детали', 'Missing parts'), car.missing || tr('нет', 'none'))}` : `<div style="color:var(--mut)">${tr('Машина потеряна', 'Car lost')}</div>`}
        </div>
        <div class="jbox" style="grid-column:1 / span 2"><h3>${tr('Управление', 'Controls')}</h3>
          <div class="ctl">${controlsHelp()}</div>
        </div>
      </div>
      <div class="btnrow"><button class="btn pri" data-a="close">${tr('Закрыть', 'Close')}</button></div>`);
    this.bindButtons(this.layers.overlay, { close: () => (fromPause ? this.showPause() : this.hooks.resume()) });
  }
  showDeath(cause: string, stats: { km: number; days: number; kills: number; time: string }) {
    this.state = 'death';
    this.hideOverlays();
    const L = this.layers.death;
    L.innerHTML = `<h1>${tr('ВЫ ПОГИБЛИ', 'YOU DIED')}</h1><div class="cause">${cause}</div>
      <div class="statsg"><div>${tr('Пройдено', 'Distance')}<b>${stats.km.toFixed(1)} ${tr('км', 'km')}</b></div><div>${tr('Дней', 'Days')}<b>${stats.days}</b></div><div>${tr('Убито', 'Kills')}<b>${stats.kills}</b></div><div>${tr('Время', 'Time')}<b>${stats.time}</b></div></div>
      <div class="btnrow" style="justify-content:center">
        <button class="btn" data-a="load" ${this.hooks.hasSave() ? '' : 'disabled'}>${tr('Загрузить сохранение', 'Load save')}</button>
        <button class="btn pri" data-a="new">${tr('Новая игра', 'New game')}</button>
        <button class="btn" data-a="menu">${tr('Главное меню', 'Main menu')}</button>
      </div>`;
    this.bindButtons(L, { load: () => this.hooks.load(), new: () => { this.show('death', false); this.showMenu(); this.showNewGame(); }, menu: () => this.hooks.quitToMenu() });
    this.show('death');
  }
  hideDeath() {
    this.show('death', false);
    this.show('win', false);
  }
  showWin(stats: { km: number; days: number; kills: number; time: string }) {
    this.state = 'win';
    const L = this.layers.win;
    L.innerHTML = `<h1>${tr('ВЫ ДОЕХАЛИ', 'YOU MADE IT')}</h1><div class="cause" style="color:var(--acc2);margin-top:12px;letter-spacing:.12em">${tr('Пять тысяч километров позади. Впереди — море.', 'Five thousand kilometres behind you. The sea lies ahead.')}</div>
      <div class="statsg"><div>${tr('Пройдено', 'Distance')}<b>${stats.km.toFixed(0)} ${tr('км', 'km')}</b></div><div>${tr('Дней', 'Days')}<b>${stats.days}</b></div><div>${tr('Убито', 'Kills')}<b>${stats.kills}</b></div><div>${tr('Время', 'Time')}<b>${stats.time}</b></div></div>
      <div class="btnrow" style="justify-content:center"><button class="btn pri" data-a="go">${tr('Ехать дальше', 'Keep driving')}</button><button class="btn" data-a="menu">${tr('Главное меню', 'Main menu')}</button></div>`;
    this.bindButtons(L, { go: () => { this.show('win', false); this.hooks.resume(); }, menu: () => this.hooks.quitToMenu() });
    this.show('win');
  }
  showNote(key: string) {
    this.state = 'note';
    const text = key === 'letter' ? LETTER[this.lang] : NOTES[key] ? NOTES[key][this.lang === 'ru' ? 0 : 1] : key;
    const L = this.layers.note;
    L.className = 'layer overlay';
    L.innerHTML = `<div class="paper">${text.replace(/</g, '&lt;')}<div class="close">${tr('Нажмите E или ЛКМ, чтобы закрыть', 'Press E or click to close')}</div></div>`;
    L.onclick = () => this.hooks.resume();
    this.show('note');
  }

  // ------------------------------------------------------------------ HUD
  private buildHud() {
    const H = this.layers.hud;
    H.innerHTML = `
      <div id="blood"></div>
      <div id="compass"><canvas width="420" height="32"></canvas></div>
      <div id="cross"></div>
      <svg id="ring" viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" stroke="rgba(0,0,0,.35)"/><circle id="ringv" cx="23" cy="23" r="19" stroke="#f3c77a" stroke-dasharray="119.4" stroke-dashoffset="119.4" stroke-linecap="round"/></svg>
      <div id="target"></div>
      <div id="stats">${['health', 'hunger', 'thirst', 'energy', 'stamina'].map((k) => `<div class="st" id="st_${k}"><svg viewBox="0 0 24 24" fill="${STAT_COLORS[k]}">${ICONS[k]}</svg><div class="b"><i style="background:${STAT_COLORS[k]}"></i></div></div>`).join('')}</div>
      <div id="handname"></div>
      <div id="hotbar">${[1, 2, 3, 4].map((i) => `<div class="slot" id="slot${i}"><span class="n">${i}</span></div>`).join('')}<div class="slot hand" id="slothand"><span class="n">✋</span></div></div>
      <div id="toasts"></div>
      <div id="hint" class="hidden"></div>
      <div id="radioname" style="opacity:0"></div>
      <div id="carhud" class="hidden"><div class="spd"><span id="ch_s">0</span><small>${tr('км/ч', 'km/h')}</small><span class="gear" id="ch_g">N</span></div><div class="row2"><span id="ch_w" class="warn"></span><svg class="ficon" viewBox="0 0 24 24"><path d="M5 3h8a1 1 0 0 1 1 1v7h1.5a2 2 0 0 1 2 2v4a1 1 0 0 0 2 0V9.4l-2.2-2.2 1.4-1.4 2.6 2.6c.4.4.7.9.7 1.4V17a3 3 0 0 1-6 0v-4H14v8H4V4a1 1 0 0 1 1-1zm1 2v5h6V5z"/></svg><span class="fuel"><i id="ch_f"></i></span></div></div>
      <div id="fps" class="hidden"></div>
      <div id="blackout"></div>`;
    for (const id of ['cross', 'ring', 'ringv', 'target', 'handname', 'toasts', 'hint', 'radioname', 'carhud', 'ch_s', 'ch_g', 'ch_w', 'ch_f', 'fps', 'blood', 'blackout', 'compass', 'hotbar', 'stats']) this.hudEls[id] = H.querySelector('#' + id) as HTMLElement;
    this.compassCanvas = H.querySelector('#compass canvas') as HTMLCanvasElement;
  }
  showHud(on: boolean) {
    this.show('hud', on);
    if (on) { this.state = 'game'; this.show('menu', false); }
  }
  setBlackout(v: number) {
    this.hudEls.blackout.style.opacity = String(v);
  }
  updateHud(s: HudState, dt: number) {
    const E = this.hudEls;
    // target prompt
    const t = s.target;
    const key = t ? t.name + '|' + t.info.join('|') + '|' + t.actions.map((a) => a.key + a.label).join('|') : '';
    if (key !== this.lastHud) {
      this.lastHud = key;
      if (t) {
        const hl = t.info.length && /\d/.test(t.info[0]) && /(л|L|%|\$)/.test(t.info[0]);
        E.target.innerHTML = `<div class="nm">${t.name}</div>${t.info.map((i, n) => `<div class="inf ${n === 0 && hl ? 'hl' : ''}">${i}</div>`).join('')}<div class="acts">${t.actions.map((a) => `<div class="act"><span class="key">${a.key}</span><span>${a.label}</span></div>`).join('')}</div>`;
      } else E.target.innerHTML = '';
    }
    E.cross.classList.toggle('act', !!t && t.actions.length > 0);
    E.ring.style.opacity = s.hold > 0 ? '1' : '0';
    (E.ringv as any).style.strokeDashoffset = String(119.4 * (1 - Math.min(1, s.hold)));
    // stats
    const st = s.stats;
    for (const k of ['health', 'hunger', 'thirst', 'energy', 'stamina'] as const) {
      const box = document.getElementById('st_' + k)!;
      const v = st[k];
      (box.querySelector('i') as HTMLElement).style.width = `${Math.max(0, Math.min(100, v))}%`;
      box.classList.toggle('low', v < 20 && k !== 'stamina');
      if (k === 'stamina') box.style.opacity = v < 99 ? '0.95' : '0';
    }
    // hotbar
    const slotHtml = (it: { name: string; icon: string; qty: string } | null, n: string) => `<span class="n">${n}</span>${it ? `<img src="${it.icon}" alt=""><span class="q">${it.qty}</span>` : ''}`;
    s.slots.forEach((it, i) => {
      const d = document.getElementById('slot' + (i + 1))!;
      const k2 = it ? it.icon + it.qty : '';
      if (d.dataset.k !== k2) { d.dataset.k = k2; d.innerHTML = slotHtml(it, String(i + 1)); }
    });
    const hd = document.getElementById('slothand')!;
    const hk = s.hand ? s.hand.icon + s.hand.qty : '';
    if (hd.dataset.k !== hk) { hd.dataset.k = hk; hd.innerHTML = slotHtml(s.hand, '✋'); }
    E.handname.textContent = s.hand ? s.hand.name : '';
    E.hotbar.style.opacity = s.inCar ? '0.55' : '1';
    // compass
    E.compass.style.display = s.compass === null ? 'none' : 'block';
    if (s.compass !== null) this.drawCompass(s.compass);
    // car
    const c = s.car;
    E.carhud.classList.toggle('hidden', !c || !this.settings.carHud);
    if (c) {
      E.ch_s.textContent = String(Math.round(Math.abs(c.speed)));
      E.ch_g.textContent = c.gear;
      (E.ch_f as HTMLElement).style.width = `${Math.round(c.fuel * 100)}%`;
      E.ch_w.textContent = c.warn;
    }
    E.fps.classList.toggle('hidden', !this.settings.showFps);
    if (this.settings.showFps) E.fps.textContent = `${s.fps.toFixed(0)} FPS`;
    E.blood.style.opacity = String(Math.min(0.9, s.hurt));
    // timers
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) E.hint.style.opacity = '0';
      if (this.hintTimer <= -0.7) E.hint.classList.add('hidden');
    }
    if (this.radioTimer > 0) {
      this.radioTimer -= dt;
      if (this.radioTimer <= 0) E.radioname.style.opacity = '0';
    }
  }
  private drawCompass(yaw: number) {
    const c = this.compassCanvas;
    const x = c.getContext('2d')!;
    x.clearRect(0, 0, c.width, c.height);
    // yaw 0 looks along -z (south); heading in degrees clockwise from north (+z)
    let heading = ((-yaw * 180) / Math.PI + 180) % 360;
    if (heading < 0) heading += 360;
    const pxPerDeg = 2.4;
    x.textAlign = 'center';
    x.font = '600 13px Segoe UI, Arial';
    for (let d = -100; d <= 100; d += 5) {
      const deg = Math.round(heading + d);
      const ang = ((deg % 360) + 360) % 360;
      const px = c.width / 2 + (deg - heading) * pxPerDeg;
      if (ang % 5 !== 0) continue;
      x.fillStyle = 'rgba(255,255,255,0.8)';
      x.shadowColor = 'rgba(0,0,0,.8)';
      x.shadowBlur = 3;
      if (ang % 45 === 0) {
        const lbl = ({ 0: tr('С', 'N'), 45: tr('СВ', 'NE'), 90: tr('В', 'E'), 135: tr('ЮВ', 'SE'), 180: tr('Ю', 'S'), 225: tr('ЮЗ', 'SW'), 270: tr('З', 'W'), 315: tr('СЗ', 'NW') } as any)[ang];
        x.fillStyle = ang === 0 ? '#f3c77a' : '#fff';
        x.fillText(lbl, px, 15);
      } else x.fillRect(px - 0.5, ang % 15 === 0 ? 18 : 22, 1, ang % 15 === 0 ? 8 : 4);
    }
    x.fillStyle = '#e8a74a';
    x.fillRect(c.width / 2 - 1, 24, 2, 8);
  }
  toast(msg: string, bad = false) {
    const T = this.hudEls.toasts;
    if (!T) return;
    const last = T.lastElementChild as HTMLElement | null;
    if (last && last.dataset.m === msg) { last.dataset.t = String(Date.now()); return; }
    const d = el('div', 'toast' + (bad ? ' bad' : ''), msg);
    d.dataset.m = msg;
    T.appendChild(d);
    while (T.children.length > 5) T.removeChild(T.firstChild!);
    setTimeout(() => { d.style.opacity = '0'; }, 3800);
    setTimeout(() => d.remove(), 4500);
  }
  hint(msg: string, secs = 8) {
    if (!this.settings.hints) return;
    const H = this.hudEls.hint;
    H.innerHTML = `<small>${tr('Подсказка', 'Hint')}</small>${msg}`;
    H.classList.remove('hidden');
    H.style.opacity = '1';
    this.hintTimer = secs;
  }
  radioName(txt: string) {
    const R = this.hudEls.radioname;
    if (R.textContent !== txt) R.textContent = txt;
    R.style.opacity = '1';
    this.radioTimer = 2.5;
  }
}

export function keyLabel(code: string) {
  const map: Record<string, string> = { Space: tr('Пробел', 'Space'), ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', Escape: 'Esc', Tab: 'Tab', BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return map[code] ?? code.replace('Key', '').replace('Digit', '');
}

function controlsHelp() {
  const rows: [string, string][] = [
    ['W A S D', tr('Ходьба / езда', 'Walk / drive')],
    ['Shift', tr('Бег', 'Sprint')],
    ['E', tr('Взаимодействие, открыть, сесть / выйти', 'Interact, open, enter / exit')],
    [tr('ЛКМ', 'LMB'), tr('Взять / использовать (держать — снять деталь, залить)', 'Take / use (hold to unbolt, pour)')],
    [tr('ПКМ', 'RMB'), tr('Бросить предмет / прицел', 'Throw item / aim')],
    ['Q', tr('Положить предмет', 'Drop item')],
    ['1–4', tr('Карманы инвентаря', 'Inventory pockets')],
    ['I', tr('Зажигание (держать — стартер)', 'Ignition (hold to crank)')],
    ['L / H / N', tr('Фары / сигнал / радио', 'Lights / horn / radio')],
    [tr('Пробел', 'Space'), tr('Прыжок / ручной тормоз', 'Jump / handbrake')],
    ['R / F', tr('Передачи (механика), перезарядка / фонарик', 'Gears (manual), reload / flashlight')],
    ['V', tr('Вид из машины', 'Car camera')],
    ['Tab', tr('Журнал', 'Journal')],
    ['Esc', tr('Пауза', 'Pause')],
  ];
  return rows.map(([k, v]) => `<span class="key">${k}</span><span>${v}</span>`).join('');
}
