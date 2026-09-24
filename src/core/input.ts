export type Action =
  | 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sprint' | 'crouch' | 'interact' | 'drop' | 'reload' | 'flashlight'
  | 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'pause' | 'headlights' | 'ignition' | 'horn' | 'handbrake' | 'shiftUp' | 'shiftDown'
  | 'radio' | 'tuneUp' | 'tuneDown' | 'camera' | 'lean' | 'journal' | 'sleep';

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  interact: ['KeyE'],
  drop: ['KeyQ'],
  reload: ['KeyR'],
  flashlight: ['KeyF'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  slot4: ['Digit4'],
  pause: ['Escape'],
  headlights: ['KeyL'],
  ignition: ['KeyI'],
  horn: ['KeyH'],
  handbrake: ['Space'],
  shiftUp: ['KeyR'],
  shiftDown: ['KeyF'],
  radio: ['KeyN'],
  tuneUp: ['BracketRight', 'Period'],
  tuneDown: ['BracketLeft', 'Comma'],
  camera: ['KeyV'],
  lean: ['KeyZ'],
  journal: ['KeyJ', 'Tab'],
  sleep: ['KeyX'],
};

export class Input {
  bindings: Record<Action, string[]> = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  mouse = { dx: 0, dy: 0, wheel: 0, buttons: 0 };
  private mPressed = 0;
  private mReleased = 0;
  locked = false;
  enabled = true;
  sensitivity = 1;
  invertY = false;
  /** When true, input works without pointer lock (automated tests). */
  noLock = false;
  onLockChange: ((locked: boolean) => void) | null = null;
  onKeyCapture: ((code: string) => void) | null = null;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (this.onKeyCapture) {
        e.preventDefault();
        const cb = this.onKeyCapture;
        this.onKeyCapture = null;
        cb(e.code);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Quote', 'Slash'].includes(e.code) || e.ctrlKey) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.noLock) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    });
    el.addEventListener('mousedown', (e) => {
      this.mouse.buttons |= 1 << e.button;
      this.mPressed |= 1 << e.button;
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons &= ~(1 << e.button);
      this.mReleased |= 1 << e.button;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (this.locked || this.noLock) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    });
  }

  requestLock() {
    if (this.noLock) return;
    try {
      const p = (this.el as any).requestPointerLock({ unadjustedMovement: false });
      if (p && p.catch) p.catch(() => (this.el as any).requestPointerLock());
    } catch {
      (this.el as any).requestPointerLock?.();
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
  get active() {
    return this.enabled && (this.locked || this.noLock);
  }
  down(a: Action) {
    if (!this.active) return false;
    for (const k of this.bindings[a]) if (this.keys.has(k)) return true;
    return false;
  }
  pressedA(a: Action) {
    if (!this.active) return false;
    for (const k of this.bindings[a]) if (this.pressed.has(k)) return true;
    return false;
  }
  releasedA(a: Action) {
    for (const k of this.bindings[a]) if (this.released.has(k)) return true;
    return false;
  }
  rawPressed(code: string) {
    return this.pressed.has(code);
  }
  mouseDown(b = 0) {
    return this.active && (this.mouse.buttons & (1 << b)) !== 0;
  }
  mousePressed(b = 0) {
    return this.active && (this.mPressed & (1 << b)) !== 0;
  }
  mouseReleased(b = 0) {
    return (this.mReleased & (1 << b)) !== 0;
  }
  /** Simulate key state (tests). */
  simKey(code: string, down: boolean) {
    if (down) { if (!this.keys.has(code)) this.pressed.add(code); this.keys.add(code); }
    else { this.keys.delete(code); this.released.add(code); }
  }
  simMouse(button: number, down: boolean) {
    if (down) { this.mouse.buttons |= 1 << button; this.mPressed |= 1 << button; }
    else { this.mouse.buttons &= ~(1 << button); this.mReleased |= 1 << button; }
  }
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0;
    this.mPressed = this.mReleased = 0;
  }
  keyName(code: string) {
    return code.replace('Key', '').replace('Digit', '').replace('Left', ' L').replace('Right', ' R').replace('Bracket', '').replace('Arrow', '');
  }
  label(a: Action) {
    return this.keyName(this.bindings[a][0] ?? '?');
  }
}
