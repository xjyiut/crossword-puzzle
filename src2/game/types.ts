export type Phase = 'intro' | 'ready' | 'reveal' | 'hiding' | 'shuffling' | 'guessing' | 'result';

export interface CupState {
  /** Stable identity - the cup's slot in the shuffle order never changes, only its screen position does. */
  id: number;
}
