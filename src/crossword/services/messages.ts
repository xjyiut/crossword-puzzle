import type { ICrosswordMessages } from '../models/ICrossword';

/**
 * Default pop-up copy. Override any of it from `messages` in the puzzle JSON.
 */
export const DEFAULT_MESSAGES: Required<ICrosswordMessages> = {
  gridAttempts: [
    "Oops, that's not it!",
    'Close, but not quite!',
    "Keep trying! You're getting closer!"
  ],
  gridExhausted: 'Great effort!',
  bonusWrong: "Keep trying! You're getting closer!",
  giveUpConfirm: "Are you sure? Remember, you won't get any points for this activity if you pass.",
  bonusReveal: 'Correct answer to this activity is "{answer}"',
  bonusCorrect: 'Bang on! You got that right!',

  labelTryAgain: 'Try again',
  labelShowAnswer: 'Show Answer',
  labelGiveUp: 'I give up',
  labelContinue: 'Continue'
};

export function resolveMessages(overrides?: ICrosswordMessages): Required<ICrosswordMessages> {
  const merged: Required<ICrosswordMessages> = { ...DEFAULT_MESSAGES };
  if (!overrides) { return merged; }

  const keys: string[] = Object.keys(overrides);
  for (let i: number = 0; i < keys.length; i++) {
    const key: string = keys[i];
    const value: unknown = (overrides as { [k: string]: unknown })[key];
    if (value !== undefined && value !== null) {
      (merged as unknown as { [k: string]: unknown })[key] = value;
    }
  }
  return merged;
}
