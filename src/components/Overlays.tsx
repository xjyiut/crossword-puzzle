import { useEffect, useState } from 'react';
import { useGame } from '../state/GameContext';
import { pad, formatTime } from '../game/format';
import { frameStyle } from '../game/spriteAtlas';
import { useFrameAnimation } from '../hooks/useFrameAnimation';
import { PRESTAGE_MS } from '../game/constants';
import type { GameResult } from '../game/types';
import starsImg from '../assets/images/stars.png';
import logoImg from '../assets/images/logo.png';
import styles from './Overlays.module.scss';

// ---------------------------------------------------------------------------
// Hud - the always-on-screen score/hi-score/stage/bonus/lives banner.
// ---------------------------------------------------------------------------

const LIFE_ICON_SCALE = 1.6;

/** The always-on-screen score/hi-score/stage/bonus/lives banner. */
export function Hud() {
  const { score, hiScore, stage, bonus, lives } = useGame();

  return (
    <div className={styles.banner}>
      <div className={`${styles.row} ${styles.row1} ${styles.score}`}>1P-{pad(score, 6)}</div>
      <div className={`${styles.row} ${styles.row1} ${styles.hi}`}>HI-{pad(hiScore, 6)}</div>
      <div className={`${styles.row} ${styles.row1} ${styles.stageLabel}`}>STAGE-{pad(stage, 2)}</div>
      <div className={`${styles.row} ${styles.row2} ${styles.bonus}`}>BONUS-{pad(bonus, 4)}</div>
      <div className={styles.lives}>
        {Array.from({ length: lives }).map((_, i) => (
          <div key={i} className={styles.lifeIcon} style={frameStyle('clownStand0000', LIFE_ICON_SCALE)} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DistanceMeters - "100 m" .. "0 m" markers spaced through the level.
// ---------------------------------------------------------------------------

/** "100 m" .. "0 m" markers spaced through the level, scrolling with the world. */
export function DistanceMeters({ spacing }: { spacing: number }) {
  const markers = Array.from({ length: 11 }, (_, idx) => 10 - idx);

  return (
    <>
      {markers.map((tens, idx) => (
        <div key={tens} className={styles.meter} style={{ left: idx * spacing }}>
          <span className={styles.label}>{tens * 10} m</span>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// MainMenu - title screen: logo, twinkling stars, "press enter", final score.
// ---------------------------------------------------------------------------

const MENU_RUN_FRAMES = ['clown0000', 'clown0001', 'clown0002'] as const;

/** Title screen: logo, twinkling stars, "press enter", and (if a game just ended) a final-score summary. */
export function MainMenu({ onStart }: { onStart: () => void }) {
  const game = useGame();
  const [showText, setShowText] = useState(true);
  const [starting, setStarting] = useState(false);
  const runFrame = useFrameAnimation(MENU_RUN_FRAMES, 8);

  useEffect(() => {
    if (!starting) return undefined;
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      setShowText((v) => !v);
      if (count > 10) {
        clearInterval(id);
        game.resetGame();
        onStart();
      }
    }, 30);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starting]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && !starting) {
        e.preventDefault();
        setStarting(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [starting]);

  return (
    <div className={styles.menu}>
      <img src={starsImg} className={styles.stars} alt="" />
      <img src={logoImg} className={styles.logo} alt="Circus HTML5" />
      {showText && <div className={styles.pressEnter}>{'Press  ENTER  to\nstart playing'}</div>}
      <div className={styles.clown} style={frameStyle(runFrame, 4)} />

      {game.lastResult && (
        <div className={styles.summary}>
          <div className={styles.summaryResult}>{game.lastResult}</div>
          <div className={styles.summaryStats}>
            <span>1P-{pad(game.score, 6)}</span>
            <span>HI-{pad(game.hiScore, 6)}</span>
            <span>STAGE-{pad(game.stage, 2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prestage - brief "STAGE 01" / "GAME OVER" / "YOU WIN!" interstitial screen.
// ---------------------------------------------------------------------------

/** Brief "STAGE 01" / "GAME OVER" / "YOU WIN!" interstitial screen. */
export function Prestage({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, PRESTAGE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.prestage}>
      <div className={styles.text}>{text}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RunHud - time/points/lives boxes shown during a stage attempt.
// ---------------------------------------------------------------------------

const LIVES_ICON_SCALE = 2;

/** Time taken, points, and remaining lives, as three small pill boxes. */
export function RunHud({ timeMs, score, lives }: { timeMs: number; score: number; lives: number }) {
  return (
    <div className={styles.runHud}>
      <div className={styles.pill}>
        <span className={styles.pillIcon} aria-hidden>
          ⏱
        </span>
        {formatTime(timeMs)}
      </div>
      <div className={styles.pill}>
        <span className={styles.pillIcon} aria-hidden>
          🪙
        </span>
        {pad(score, 3)}
      </div>
      <div className={`${styles.pill} ${styles.livesPill}`}>
        <span className={styles.livesLabel}>Lives:</span>
        <div className={styles.livesIcons}>
          {Array.from({ length: lives }).map((_, i) => (
            <div key={i} className={styles.lifeIcon} style={frameStyle('clownStand0000', LIVES_ICON_SCALE)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GameOverOverlay - shown over the frozen stage once lives hit 0 or the
// player reaches the podium (there's only one stage "for now").
// ---------------------------------------------------------------------------

/** Overlay shown directly on top of the game once a run ends, either way. */
export function GameOverOverlay({
  result,
  timeMs,
  score,
  onContinue,
}: {
  result: Exclude<GameResult, null>;
  timeMs: number;
  score: number;
  onContinue: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onContinue]);

  const subtitle = result === 'YOU WIN!' ? 'You reached the podium!' : 'Out of lives!';

  return (
    <div className={styles.gameOverOverlay}>
      <div className={styles.gameOverBox}>
        <div className={styles.gameOverTitle}>{result}</div>
        <div className={styles.gameOverSubtitle}>{subtitle}</div>
        <div className={styles.gameOverStats}>
          <span>Time {formatTime(timeMs)}</span>
          <span>Points {pad(score, 3)}</span>
        </div>
        <button type="button" className={styles.gameOverButton} onClick={onContinue}>
          Press ENTER to continue
        </button>
      </div>
    </div>
  );
}
