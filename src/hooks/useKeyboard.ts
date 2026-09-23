import { useEffect, useRef } from 'react';

const TRACKED_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter'];

/**
 * Tracks which of the game's control keys are currently held, in a ref
 * (not React state) so components can poll it from their own animation
 * loop without a re-render firing on every keystroke.
 */
export function useKeyboard() {
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (TRACKED_KEYS.includes(e.code)) e.preventDefault();
      keysRef.current.add(e.code);
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  return keysRef;
}
