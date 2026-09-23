/**
 * All the tunable numbers that define how the game looks and plays,
 * gathered in one place. Values were chosen to match the feel of the
 * original build (same sprite scale, same ground lines, same obstacle
 * spacing) rather than copied from Phaser/Arcade-physics-specific
 * quirks that were never intentional gameplay.
 */

export const SCREEN_WIDTH = 1024;
export const SCREEN_HEIGHT = 768;

/** Every sprite in the original was drawn at 3x its native pixel size. */
export const SPRITE_SCALE = 3;

export const WORLD_WIDTH = 1024 * 8;

export const STARTING_LIVES = 3;
export const STARTING_BONUS = 5000;
export const BONUS_TICK_MS = 300;
export const BONUS_TICK_AMOUNT = 10;

/** Bonus -> score "tally" pace once standing on the end pedestal. */
export const BONUS_TALLY_MS = 40;
export const BONUS_TALLY_AMOUNT = 120;
/** Minimum time to stay posed on the pedestal before moving on. */
export const PEDESTAL_HOLD_MS = 2500;

// Tuned low "for now" per the current playtest pass - easy to raise later.
export const SCORE_FIREPOT = 10;
export const SCORE_HOOP = 10;
export const SCORE_MONKEY = 50;

/** Bonus added on top of SCORE_HOOP for a garland that's hiding a money bag - 10 + 10 = 20 "for now". */
export const SCORE_MONEYBAG = 10;
/** Roughly one garland in this many carries a money bag - "a few", not most. */
export const MONEYBAG_HOOP_EVERY = 3;

/** How far back from the death point a retry resumes. */
export const CHECKPOINT_BACKOFF = 150;

export const GAME_OVER_FREEZE_MS = 3100;
export const PRESTAGE_MS = 1000;

export const STAGE1 = {
  groundY: 630,
  gravity: 700,
  runVelocityRight: 200,
  runVelocityLeft: -100,
  jumpVelocity: -480,
  spawnX: 85,
  firepotStartX: 1200,
  firepotSpacing: 800,
  firepotY: 585,
  hoopSpacing: 800,
  hoopY: 335,
  hoopJitterMax: 100,
  meterSpacing: 780,
  pedestalX: WORLD_WIDTH - 300,
  pedestalY: 620,
} as const;

export const STAGE2 = {
  groundY: 348,
  gravity: 800,
  runVelocityRight: 150,
  runVelocityLeft: -130,
  jumpVelocity: -480,
  spawnX: 85,
  monkeySpawnMs: 1000,
  monkeyVelocity: -90,
  monkeyJumpVelocity: -500,
  monkeyMaxOnScreen: 4,
  meterSpacing: 705,
  pedestalX: WORLD_WIDTH - 300,
  pedestalY: 620,
} as const;
