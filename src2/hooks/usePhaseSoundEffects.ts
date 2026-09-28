import { useEffect, useRef } from 'react';
import type { Phase } from '../game/types';
import type { useSound } from './useSound';

/**
 * Plays the win/lose jingle once per phase transition, and a swoosh on
 * every individual cup swap during shuffling - matching the original,
 * where the swoosh lives inside its per-cup "move" function rather than
 * playing once for the whole shuffle.
 */
export function usePhaseSoundEffects(
  phase: Phase,
  order: number[],
  lastCorrect: boolean | null,
  sounds: { swoosh: ReturnType<typeof useSound>; jingleWin: ReturnType<typeof useSound>; jingleOver: ReturnType<typeof useSound> },
) {
  const prevPhase = useRef<Phase | null>(null);
  const prevOrder = useRef(order);

  useEffect(() => {
    if (phase === 'shuffling' && order !== prevOrder.current) {
      sounds.swoosh.play();
    }
    prevOrder.current = order;
  }, [order, phase, sounds.swoosh]);

  useEffect(() => {
    if (prevPhase.current !== phase) {
      if (phase === 'result') (lastCorrect ? sounds.jingleWin : sounds.jingleOver).play();
      prevPhase.current = phase;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
}
