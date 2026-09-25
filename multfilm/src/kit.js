// Scene-authoring helpers: motion curves, camera shake, blinking, hops.
import { clamp, seg, E, hash, noise1, lerp } from './engine/core.js';

export { clamp, seg, E, lerp };

// parabolic hop of height h between t0 and t0+d; returns negative y offset
export function hop(t, t0, d, h) {
  const k = (t - t0) / d;
  if (k <= 0 || k >= 1) return 0;
  return -4 * h * k * (1 - k);
}
// repeating hops (bounce in place)
export function bounce(t, period, h, t0 = 0) {
  if (t < t0) return 0;
  const k = ((t - t0) % period) / period;
  return -4 * h * k * (1 - k);
}
// idle float
export const float = (t, amp = 1.5, sp = 2, ph = 0) => Math.sin(t * sp + ph) * amp;
// natural blinking: returns true while eyes are closed
export function blink(t, seed = 0, every = 3.2) {
  const k = t + hash(seed) * every;
  const ph = k % every;
  return ph < 0.12 || (hash(Math.floor(k / every) + seed * 7) > 0.7 && ph > 0.3 && ph < 0.42);
}
// camera shake offset
export function shake(t, t0, dur, amp) {
  const k = seg(t, t0, t0 + dur);
  if (k <= 0 || k >= 1) return [0, 0];
  const a = amp * (1 - k);
  return [Math.round((noise1(t * 40) - 0.5) * 2 * a), Math.round((noise1(t * 40 + 99) - 0.5) * 2 * a)];
}
// move along x between keyframes with a walk phase; returns {x, moving, phase, dir}
export function walkTo(t, keys, stride = 1.6) {
  let x = keys[0][1], moving = false, dir = 1;
  for (let i = 1; i < keys.length; i++) {
    const [t0, x0] = keys[i - 1], [t1, x1] = keys[i];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0);
      x = lerp(x0, x1, E.inOutSine(k));
      moving = x1 !== x0;
      dir = x1 >= x0 ? 1 : -1;
      break;
    }
    if (t > t1) { x = x1; dir = x1 >= x0 ? dir : -1; }
  }
  return { x, moving, phase: moving ? t * stride : undefined, dir };
}
// pick an eye state with blinking
export const eyesB = (t, base, seed = 0) => (blink(t, seed) && (base === 'normal' || base === undefined) ? 'closed' : base);
