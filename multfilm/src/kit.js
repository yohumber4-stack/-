// Scene-authoring helpers: motion curves, camera shake, blinking, hops.
import { clamp, seg, E, hash, lerp } from './engine/core.js';

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
