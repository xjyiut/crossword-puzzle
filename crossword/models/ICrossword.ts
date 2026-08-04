/**
 * Public data contract for the crossword.
 *
 * Everything the puzzle needs lives in `data/crossword.json`.
 * Swap the words/clues in that file and the grid is re-generated
 * automatically at runtime by `services/layoutEngine.ts` -- no code
 * changes, no hand-drawn grid, no hard-coded coordinates required.
 */

export type Direction = 'across' | 'down';

export interface IWordDefinition {
  /** Stable key. Referenced by the bonus stage, so keep it meaningful. */
  id: string;
  /** Clue text shown in the Across / Down list. */
  clue: string;
  /** The solution. Spaces / punctuation are stripped when it hits the grid. */
  answer: string;
  /**
   * OPTIONAL manual override. Supply both `row` and `col` to pin a word to a
   * fixed square (0-based, relative to any other pinned word). Omit them and
   * the layout engine places the word for you.
   */
  row?: number;
  col?: number;
}

/** Points at one letter of one word, so the bonus survives a re-layout. */
export interface IBonusLetterRef {
  wordId: string;
  /** 0-based index into the word's answer. */
  letterIndex: number;
}

export interface IBonusDefinition {
  enabled: boolean;
  /** The riddle shown once the grid is solved. */
  riddle: string;
  /** Short instruction under the riddle. */
  instruction: string;
  /** Cells circled on the grid, in the order they should be read. */
  letters: IBonusLetterRef[];
  /** Letters that are NOT on the grid but are part of the answer (e.g. "U"). */
  extraLetters: string[];
  /** The expected final answer. Compared case- and space-insensitively. */
  answer: string;
}

export interface ICrosswordOptions {
  /**
   * `clueOrder`  - square numbers follow the order words appear in the JSON
   *                (Across 1..n, then Down n+1..m). Matches the source puzzle.
   * `standard`   - classic newspaper numbering, top-left to bottom-right.
   */
  numbering?: 'clueOrder' | 'standard';
  /** Blank squares kept around the bounding box of the finished layout. */
  padding?: number;
  /** How many shuffled orderings the engine may try before giving up. */
  layoutAttempts?: number;
  /** Seed for the shuffle, so a given JSON always produces the same grid. */
  seed?: number;
  /**
   * When true the engine may flip a word to the other axis if it cannot be
   * placed on its declared one. Off by default so the Across/Down clue lists
   * stay truthful.
   */
  allowDirectionFlip?: boolean;
  /**
   * `strict`  - classic rules: parallel words may never sit side by side.
   * `relaxed` - allows dense, blocky grids where stacked entries create
   *             incidental letter runs (the style of the source puzzle).
   * `auto`    - (default) try strict first, fall back to relaxed only if the
   *             word list cannot be fitted any other way.
   */
  adjacency?: 'auto' | 'strict' | 'relaxed';
}

/**
 * Every string the pop-ups can show. All optional -- anything omitted falls
 * back to the defaults in `services/messages.ts`.
 */
export interface ICrosswordMessages {
  /**
   * Shown after each failed grid submission, in order. The number of entries
   * decides how many retries the player gets: once they run out, the grid is
   * revealed. Three entries = three retries, then reveal on the fourth.
   */
  gridAttempts?: string[];
  /** Shown when the retries are used up, alongside the Show Answer button. */
  gridExhausted?: string;
  /** Shown for a wrong final answer. Retries here are unlimited. */
  bonusWrong?: string;
  /** Confirmation before giving up on the final answer. */
  giveUpConfirm?: string;
  /** The reveal. `{answer}` is substituted with the bonus answer. */
  bonusReveal?: string;
  /** Shown when the final answer is right. */
  bonusCorrect?: string;

  labelTryAgain?: string;
  labelShowAnswer?: string;
  labelGiveUp?: string;
  labelContinue?: string;
}

export interface ICrosswordDefinition {
  title: string;
  subtitle?: string;
  options?: ICrosswordOptions;
  across: IWordDefinition[];
  down: IWordDefinition[];
  bonus?: IBonusDefinition;
  messages?: ICrosswordMessages;
}
