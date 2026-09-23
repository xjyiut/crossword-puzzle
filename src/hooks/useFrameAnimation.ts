import { useEffect, useState } from 'react';

/** Cycles through `frames` at a fixed fps, looping. Used for simple decorative animations (flicker, spin). */
export function useFrameAnimation<T extends string>(frames: readonly T[], fps: number): T {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const intervalMs = 1000 / fps;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [frames, fps]);

  return frames[index % frames.length];
}
