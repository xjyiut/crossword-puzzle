import type { ICrosswordMessages } from '../models/ICrossword';
import type { IDialogState } from '../models/IDialog';

/**
 * Which pop-up appears when. Kept free of React so the whole escalation --
 * three retries, then the reveal -- can be tested directly.
 */

export interface ICellSolution {
  row: number;
  col: number;
  solution: string;
}

export interface IClearResult {
  entries: { [key: string]: string };
  /** The first square that was wiped, so the caret can jump there. */
  firstCleared?: { row: number; col: number };
  cleared: number;
}

export const entryKey = (row: number, col: number): string => row + '|' + col;

/**
 * The pop-up shown after a failed grid submission.
 *
 * @param attemptsUsed 1-based count of failed submissions, this one included.
 */
export function gridFailureDialog(
  attemptsUsed: number,
  messages: Required<ICrosswordMessages>
): IDialogState {
  const retries: number = messages.gridAttempts.length;

  if (attemptsUsed <= retries) {
    return {
      message: messages.gridAttempts[attemptsUsed - 1],
      buttons: [{ label: messages.labelTryAgain, action: 'gridTryAgain', primary: true }]
    };
  }

  // Out of retries: the only way forward is to show the solution.
  return {
    message: messages.gridExhausted,
    buttons: [{ label: messages.labelShowAnswer, action: 'gridShowAnswer', primary: true }]
  };
}

/** Wrong final answer. Unlimited retries, but with a way out. */
export function bonusWrongDialog(messages: Required<ICrosswordMessages>): IDialogState {
  return {
    message: messages.bonusWrong,
    buttons: [
      { label: messages.labelGiveUp, action: 'giveUp', primary: false },
      { label: messages.labelTryAgain, action: 'close', primary: true }
    ]
  };
}

export function giveUpDialog(messages: Required<ICrosswordMessages>): IDialogState {
  return {
    message: messages.giveUpConfirm,
    buttons: [
      { label: messages.labelShowAnswer, action: 'revealBonusAnswer', primary: false },
      { label: messages.labelTryAgain, action: 'close', primary: true }
    ]
  };
}

export function bonusRevealDialog(
  answer: string,
  messages: Required<ICrosswordMessages>
): IDialogState {
  return {
    message: messages.bonusReveal.replace('{answer}', answer),
    buttons: [{ label: messages.labelContinue, action: 'finish', primary: true }]
  };
}

export function bonusCorrectDialog(messages: Required<ICrosswordMessages>): IDialogState {
  return {
    message: messages.bonusCorrect,
    buttons: [{ label: messages.labelContinue, action: 'finish', primary: true }]
  };
}

/** Remove only the letters that are wrong, leaving correct ones in place. */
export function clearWrongEntries(
  entries: { [key: string]: string },
  cells: ICellSolution[]
): IClearResult {
  const next: { [key: string]: string } = { ...entries };
  let firstCleared: { row: number; col: number } | undefined;
  let cleared: number = 0;

  for (let i: number = 0; i < cells.length; i++) {
    const cell: ICellSolution = cells[i];
    const key: string = entryKey(cell.row, cell.col);
    if (next[key] && next[key] !== cell.solution) {
      delete next[key];
      cleared++;
      if (!firstCleared) { firstCleared = { row: cell.row, col: cell.col }; }
    }
  }

  return { entries: next, firstCleared: firstCleared, cleared: cleared };
}
