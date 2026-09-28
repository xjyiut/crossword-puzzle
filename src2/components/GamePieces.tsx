import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BALL_DISPLAY_SIZE,
  BALL_ORIGIN_Y,
  CUP_Y,
  INTRO_TEXT,
  MAX_CUPS,
  QTY_BADGE,
  QTY_STEPPER,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  STAT_BOX,
} from '../game/constants';
import { BALL_FRAMES, LOGO_LIGHT_FRAME, QTY_BADGE_FRAME, QTY_STEPPER_FRAMES, frameStyle } from '../game/spriteAtlas';
import styles from './GamePieces.module.scss';

// ---------------------------------------------------------------------------
// Scene - letterboxed 854x480 viewport, scaled to fit the browser window.
// ---------------------------------------------------------------------------

/**
 * Letterboxed 854x480 viewport, scaled to fit the browser window while
 * preserving aspect ratio - matches the original Construct 3 export's own
 * canvas scaling (same design resolution, same "show all, centered" fit).
 */
export function Scene({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      const next = Math.min(rect.width / STAGE_WIDTH, rect.height / STAGE_HEIGHT);
      setScale(next > 0 ? next : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={viewportRef} className={styles.viewport}>
      <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ball - sits at ground level under whichever cup currently hides it.
// ---------------------------------------------------------------------------

/**
 * Sits at ground level under whichever cup currently hides it (rendered
 * behind the cups in stacking order, only visible once that cup lifts).
 * Colour is fixed for the whole round, not animated (the atlas's 5
 * "frames" are solid colour variants, not an idle animation).
 */
export function Ball({ x, colorIndex }: { x: number; colorIndex: number }) {
  const left = x - BALL_DISPLAY_SIZE / 2;
  const top = CUP_Y - BALL_DISPLAY_SIZE * BALL_ORIGIN_Y;

  return (
    <div
      className={styles.ball}
      style={{ transform: `translate(${left}px, ${top}px)`, ...frameStyle(BALL_FRAMES[colorIndex], BALL_DISPLAY_SIZE, BALL_DISPLAY_SIZE) }}
    />
  );
}

// ---------------------------------------------------------------------------
// LevelText - "LEVEL n", top-center.
// ---------------------------------------------------------------------------

export function LevelText({ level }: { level: number }) {
  return <div className={styles.levelText}>LEVEL {level}</div>;
}

// ---------------------------------------------------------------------------
// IntroText - "TAP TO START", bottom-center prompt.
// ---------------------------------------------------------------------------

export function IntroText({ text }: { text: string }) {
  return (
    <div className={styles.introText} style={{ left: INTRO_TEXT.x - INTRO_TEXT.w / 2, top: INTRO_TEXT.y - INTRO_TEXT.h / 2, width: INTRO_TEXT.w }}>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatBox - one labelled card (attempts / score / timer), stacked along the
// right side of the stage.
// ---------------------------------------------------------------------------

export function StatBox({ label, value, y }: { label: string; value: string; y: number }) {
  return (
    <div className={styles.statBox} style={{ left: STAT_BOX.x - STAT_BOX.w / 2, top: y - STAT_BOX.h / 2, width: STAT_BOX.w, height: STAT_BOX.h }}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CupCountControl - bottom-left badge showing the chosen cup count, with a
// small stepper button to cycle it (3 -> 4 -> 5 -> back to 3).
// ---------------------------------------------------------------------------

export function CupCountControl({ count, onIncrease, disabled }: { count: number; onIncrease: () => void; disabled?: boolean }) {
  return (
    <div className={styles.qtyWrap}>
      <div
        className={styles.qtyBadge}
        style={{
          left: QTY_BADGE.x - QTY_BADGE.size / 2,
          top: QTY_BADGE.y - QTY_BADGE.size / 2,
          ...frameStyle(QTY_BADGE_FRAME, QTY_BADGE.size, QTY_BADGE.size),
        }}
      >
        <span className={styles.qtyNumber}>{count}</span>
      </div>
      <button
        type="button"
        className={styles.qtyStepper}
        style={{
          left: QTY_STEPPER.x - QTY_STEPPER.size / 2,
          top: QTY_STEPPER.y - QTY_STEPPER.size / 2,
          ...frameStyle(QTY_STEPPER_FRAMES[count >= MAX_CUPS ? 1 : 0], QTY_STEPPER.size, QTY_STEPPER.size),
        }}
        onClick={onIncrease}
        disabled={disabled}
        aria-label="Change cup count"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// IntroOverlay - the splash screen shown once before the game loads in.
// ---------------------------------------------------------------------------

/**
 * The splash screen shown once before the game loads in. The original
 * export's own version of this screen carries a third-party studio's
 * branded logo - replaced here with a plain generic wordmark instead of
 * reproducing that artwork.
 */
export function IntroOverlay({ onContinue }: { onContinue: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className={styles.overlay} onClick={onContinue} role="button">
      <div className={`${styles.introContent} ${visible ? styles.visible : ''}`}>
        <div className={styles.glow} style={frameStyle(LOGO_LIGHT_FRAME, 260, 260)} />
        <div className={styles.logo}>
          Where is the <span>Ball?</span>
        </div>
      </div>
      <div className={styles.tap}>TAP TO CONTINUE</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GameOverOverlay - shown once all attempts are used up, over the game
// board, until the player taps to restart.
// ---------------------------------------------------------------------------

export function GameOverOverlay({ score, onRestart }: { score: number; onRestart: () => void }) {
  return (
    <div className={styles.gameOverOverlay} onClick={onRestart} role="button">
      <div className={styles.gameOverTitle}>GAME OVER</div>
      <div className={styles.gameOverScore}>Final score: {score}</div>
      <div className={styles.gameOverTap}>TAP TO RESTART</div>
    </div>
  );
}
