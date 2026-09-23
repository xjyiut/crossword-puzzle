import { forwardRef, useEffect, useState } from 'react';
import { frameStyle, type FrameName } from '../game/spriteAtlas';
import { useFrameAnimation } from '../hooks/useFrameAnimation';
import { SPRITE_SCALE, STAGE1 } from '../game/constants';
import styles from './Actors.module.scss';

// ---------------------------------------------------------------------------
// LionRider - Charlie riding the lion, Stage 1's player.
// ---------------------------------------------------------------------------

const LION_RUN_FRAMES: FrameName[] = ['lion0000', 'lion0001', 'lion0002'];
const LION_RUN_FRAME_MS = 90;

export type LionRiderPose = 'idle' | 'running' | 'jumping' | 'dead';

/** Charlie riding the lion - Stage 1's player. Position is set imperatively by Stage1 via the forwarded ref. */
export const LionRider = forwardRef<HTMLDivElement, { pose: LionRiderPose }>(function LionRider({ pose }, ref) {
  const [runIndex, setRunIndex] = useState(0);

  useEffect(() => {
    if (pose !== 'running') return undefined;
    const id = setInterval(() => setRunIndex((i) => (i + 1) % LION_RUN_FRAMES.length), LION_RUN_FRAME_MS);
    return () => clearInterval(id);
  }, [pose]);

  let lionFrame: FrameName;
  let clownFrame: FrameName;
  if (pose === 'dead') {
    lionFrame = 'lionburn0000';
    clownFrame = 'clownburn0000';
  } else if (pose === 'jumping') {
    lionFrame = 'lion0002';
    clownFrame = 'clownStandJump0000';
  } else if (pose === 'running') {
    lionFrame = LION_RUN_FRAMES[runIndex];
    clownFrame = 'clownStand0000';
  } else {
    lionFrame = 'lion0000';
    clownFrame = 'clownStand0000';
  }

  return (
    <div ref={ref} style={{ position: 'absolute', left: 0, top: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, ...frameStyle(lionFrame, SPRITE_SCALE) }} />
      <div
        style={{
          position: 'absolute',
          left: 7 * SPRITE_SCALE,
          top: -22 * SPRITE_SCALE,
          ...frameStyle(clownFrame, SPRITE_SCALE),
        }}
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// BalanceWalker - the tightrope-walking clown, Stage 2's player.
// ---------------------------------------------------------------------------

const BALANCE_RUN_FRAMES: FrameName[] = ['walkBalance0', 'walkBalance1', 'walkBalance2'];

export type BalanceWalkerPose = 'idle' | 'running' | 'jumping' | 'dead';

interface BalanceWalkerProps {
  pose: BalanceWalkerPose;
  /** ms per run frame - the original ran this faster moving right (10fps) than left (5fps). */
  runFrameMs: number;
}

/** The tightrope-walking clown - Stage 2's player. Position is set imperatively by Stage2 via the forwarded ref. */
export const BalanceWalker = forwardRef<HTMLDivElement, BalanceWalkerProps>(function BalanceWalker(
  { pose, runFrameMs },
  ref,
) {
  const [runIndex, setRunIndex] = useState(0);

  useEffect(() => {
    if (pose !== 'running') return undefined;
    const id = setInterval(() => setRunIndex((i) => (i + 1) % BALANCE_RUN_FRAMES.length), runFrameMs);
    return () => clearInterval(id);
  }, [pose, runFrameMs]);

  let frame: FrameName;
  if (pose === 'dead') frame = 'clownburn0000';
  else if (pose === 'jumping') frame = 'jumpBalance';
  else if (pose === 'running') frame = BALANCE_RUN_FRAMES[runIndex];
  else frame = 'walkBalance2';

  return <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, ...frameStyle(frame, SPRITE_SCALE) }} />;
});

// ---------------------------------------------------------------------------
// Monkey - Stage 2 obstacle that runs toward the player and occasionally hops.
// ---------------------------------------------------------------------------

const MONKEY_FRAMES = ['monkey0', 'monkey1', 'monkey2'] as const;

/**
 * A Stage 2 obstacle that runs toward the player and occasionally hops.
 * Position is driven imperatively (via the forwarded ref) by Stage2's own
 * game loop rather than React state, so 60fps movement never forces a
 * re-render of the whole stage.
 */
export const Monkey = forwardRef<HTMLDivElement, { initialX: number; initialY: number }>(function Monkey(
  { initialX, initialY },
  ref,
) {
  const frame = useFrameAnimation(MONKEY_FRAMES, 6);
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${initialX}px, ${initialY}px)`,
        ...frameStyle(frame, SPRITE_SCALE),
      }}
    />
  );
});

// ---------------------------------------------------------------------------
// FirePot - static burning-pot obstacle, Stage 1.
// ---------------------------------------------------------------------------

const FIREPOT_FRAMES = ['firepot0000', 'firepot0001'] as const;

/** A static burning-pot obstacle on the ground; deadly on touch, scores once cleared. */
export function FirePot({ x }: { x: number }) {
  const frame = useFrameAnimation(FIREPOT_FRAMES, 10);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: STAGE1.firepotY,
        ...frameStyle(frame, SPRITE_SCALE),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Garland - the original flower-wreath ring sprite from the atlas (its
// scalloped, petaled silhouette already reads as a garland, not fire -
// despite the "firecircle..." frame names). A few garlands hang a small
// money bag near the top, the same spot the original's own hanging charm
// sits in.
// ---------------------------------------------------------------------------

const GARLAND_LEFT_FRAMES = ['firecirclel0000', 'firecirclel0001'] as const;
const GARLAND_RIGHT_FRAMES = ['firecircler0000', 'firecircler0001'] as const;
const GARLAND_LEFT_WIDTH = 12 * SPRITE_SCALE;
const GARLAND_WIDTH = 24 * SPRITE_SCALE; // both halves together
const GARLAND_HEIGHT = 80 * SPRITE_SCALE;

/**
 * A garland ring the lion runs/jumps through - purely decorative (matches
 * the current build, which has ring collision disabled). Drifts left on its
 * own (like the original's `body.velocity.x = -70` on both halves),
 * independent of the player/camera - Stage1 moves it every frame via the
 * forwarded ref, the same imperative pattern used for Monkey.
 */
export const Garland = forwardRef<HTMLDivElement, { initialX: number; hasMoneyBag?: boolean }>(function Garland(
  { initialX, hasMoneyBag },
  ref,
) {
  const leftFrame = useFrameAnimation(GARLAND_LEFT_FRAMES, 5);
  const rightFrame = useFrameAnimation(GARLAND_RIGHT_FRAMES, 5);

  return (
    <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${initialX}px, 0px)` }}>
      <div style={{ position: 'absolute', left: 0, top: STAGE1.hoopY, ...frameStyle(leftFrame, SPRITE_SCALE) }} />
      <div
        style={{
          position: 'absolute',
          left: GARLAND_LEFT_WIDTH,
          top: STAGE1.hoopY,
          ...frameStyle(rightFrame, SPRITE_SCALE),
        }}
      />
      {hasMoneyBag && (
        <div
          className={styles.moneyBag}
          style={{ left: GARLAND_WIDTH / 2, top: STAGE1.hoopY + GARLAND_HEIGHT * 0.22 }}
        />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Pedestal - the striped podium at the end of each stage.
// ---------------------------------------------------------------------------

/** The striped podium at the end of each stage. */
export function Pedestal({ x, y }: { x: number; y: number }) {
  return <div style={{ position: 'absolute', left: x, top: y, ...frameStyle('endLevel1', SPRITE_SCALE) }} />;
}
