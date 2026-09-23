import { useEffect, useRef } from 'react';

/**
 * Anything slower than this gets treated as if only this much time passed.
 * Browsers throttle or fully suspend rAF for backgrounded/occluded/minimized
 * tabs (very common - alt-tabbing away and back, switching windows, the OS
 * deprioritizing a covered window), so the very next frame after regaining
 * focus can report a multi-second delta. Without a clamp, that one frame's
 * physics step is proportionally huge: a running player can tunnel straight
 * through an obstacle without the collision check ever seeing an
 * overlapping position, gravity integration can produce wildly wrong
 * velocities, and the game can appear to "jump" or "crash" the instant a
 * user switches back to the tab.
 */
const MAX_DELTA_MS = 100;

/**
 * Runs `callback` once per animation frame while `active` is true, passing
 * the elapsed milliseconds since the previous frame (clamped - see
 * MAX_DELTA_MS above). The callback is stashed in a ref so the effect never
 * has to tear down/rebuild the RAF chain just because the caller passed a
 * fresh closure.
 */
export function useRafLoop(
  callback: (deltaMs: number, elapsedMs: number) => void,
  active: boolean = true,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!active) return;

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      const delta = Math.min(now - lastTime, MAX_DELTA_MS);
      lastTime = now;
      elapsed += delta;
      callbackRef.current(delta, elapsed);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active]);
}
