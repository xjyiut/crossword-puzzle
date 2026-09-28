/**
 * All positions/sizes here are lifted directly from the original Construct 3
 * project's data.json (object instance transforms + sprite frame rects), so
 * the layout matches the source pixel-for-pixel at the design resolution.
 */

// The original project's fixed design resolution - everything below is in
// these units, then the Scene component scales the whole thing to fit.
export const STAGE_WIDTH = 854;
export const STAGE_HEIGHT = 480;

// The 5 possible cup slots, evenly spaced (163px apart), all sharing one Y.
export const SLOT_XS = [100.5, 263.5, 426.5, 590.5, 753.5] as const;
// Tuned so the cups' base line lands on the wood table photo's visible
// surface (see GamePieces.module.scss's .stage background) rather than up
// near its back edge where the tabletop meets the blurred backdrop.
export const CUP_Y = 400;
const SLOT_SPACING = SLOT_XS[1] - SLOT_XS[0];
const STAGE_CENTER_X = STAGE_WIDTH / 2;

/**
 * X position for slot `index` of `count` cups, evenly spaced at the same
 * 163px gap as the original and centered on the stage - reproduces the
 * original's fixed 5-slot positions exactly when count is 5.
 */
export function slotX(index: number, count: number): number {
  return STAGE_CENTER_X + (index - (count - 1) / 2) * SLOT_SPACING;
}

export const MIN_CUPS = 3;
export const MAX_CUPS = 5;

// Cup sprite - native frame is 403x500, origin near the base (0.5, 0.886) so
// it "sits" on the table line rather than being centered.
export const CUP_NATIVE_W = 403;
export const CUP_NATIVE_H = 500;
export const CUP_ORIGIN_Y = 0.886;
// Display size used in the actual layout (Game layer instance transform).
export const CUP_DISPLAY_W = 186.10051345641747;
export const CUP_DISPLAY_H = 230.8939372908405;

export const BALL_NATIVE_SIZE = 120;
export const BALL_DISPLAY_SIZE = 60;
export const BALL_ORIGIN_Y = 0.9666666666666667;

export const SHADOW_NATIVE_W = 404;
export const SHADOW_NATIVE_H = 500;

// UI chrome, positions straight from the HUD/BG layer instances.
export const QTY_BADGE = { x: 50, y: 445, size: 60 };
export const QTY_STEPPER = { x: 79, y: 465, size: 26 };
export const INTRO_TEXT = { x: 427, y: 431, w: 307.4380165289256, h: 43.22314049586771 };

// Cup colour is fixed in code rather than user-toggleable - atlas frame
// order is [red, green, yellow, blue]; 3 = blue, matching the original's
// own default.
export const CUP_COLOR_INDEX = 3;

// Ball colour is likewise fixed rather than randomised per round - atlas
// frame order is [red, green, gold, blue, silver]; change here if a
// different fixed colour is wanted.
export const BALL_COLOR_INDEX = 0;

// Stat boxes (attempts / score / timer) - stacked along the right side,
// vertically centered on the stage, clear of the title and cup row.
export const MAX_ATTEMPTS = 3;
export const STAT_BOX = { x: 793, w: 110, h: 52 };
export const STAT_BOX_Y = { attempts: 176, score: 236, timer: 296 };

// Timing - fast, smooth motion: kept the original's Sine-ish easing curve
// but shortened every duration so cup and ball moves read as quick and
// snappy rather than the original's more leisurely ~1s-per-move pace.
export const MOVE_MS = 550;

export const TIMING = {
  // Ball-travel time (MOVE_MS) plus a hold once it's arrived, so the player
  // actually gets to register the cup closing over it rather than the next
  // step firing the instant it arrives.
  revealMs: MOVE_MS + 700,
  liftMs: MOVE_MS,
  // Paused AFTER the cup finishes its own close animation (MOVE_MS) - see
  // the "hiding" effect in useCupsGame.ts, which waits MOVE_MS + settleMs
  // before shuffling starts, not settleMs alone.
  settleMs: 500,
  // Beats chain back-to-back (no artificial gap) so the shuffle reads as
  // one continuous motion instead of stop-start steps.
  swapStepMs: MOVE_MS,
  swapGapMs: 0,
  // Result reveal, in explicit steps:
  // - on a WRONG guess, the clicked (empty) cup opens first and holds
  //   (wrongRevealMs) so the player registers that cup was empty, before
  //   the cup that truly has the ball also opens;
  // - either way, once the true cup is open it holds (resultHoldMs) so the
  //   ball is clearly seen, then travels back to its side spot (MOVE_MS)
  //   while the cup(s) stay open, and only once it's arrived do they close
  //   (another MOVE_MS) - resultCloseSettleMs is a brief pause after that
  //   close before the board goes back to idle.
  wrongRevealMs: 700,
  resultHoldMs: 700,
  resultCloseSettleMs: 300,
} as const;

/**
 * Number of individual pairwise cup swaps per shuffle round, scaled by
 * round number so the game starts easy (an easily-tracked shuffle) and
 * gets progressively harder - rather than a flat difficulty every round.
 * Tune MIN/MAX/STEP to change the difficulty curve.
 */
export const MIN_SWAP_COUNT = 5;
export const MAX_SWAP_COUNT = 24;
export const SWAP_COUNT_STEP = 2;

export function swapCountForRound(round: number): number {
  return Math.min(MIN_SWAP_COUNT + Math.max(round - 1, 0) * SWAP_COUNT_STEP, MAX_SWAP_COUNT);
}

/** Standard easeInOutSine curve - matches the original's Tween "Sine" easing much more closely than a generic ease. */
export const EASE_SINE = 'cubic-bezier(0.37, 0, 0.63, 1)';
