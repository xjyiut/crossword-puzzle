import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/GameContext';
import { useKeyboard } from '../hooks/useKeyboard';
import { useRafLoop } from '../hooks/useRafLoop';
import { useSound } from '../hooks/useSound';
import { applyGravity, bodyRect, type Body } from '../game/physics';
import { rectsOverlap, type Rect } from '../game/types';
import {
  BONUS_TALLY_AMOUNT,
  BONUS_TALLY_MS,
  BONUS_TICK_AMOUNT,
  BONUS_TICK_MS,
  CHECKPOINT_BACKOFF,
  GAME_OVER_FREEZE_MS,
  MONEYBAG_HOOP_EVERY,
  PEDESTAL_HOLD_MS,
  SCORE_FIREPOT,
  SCORE_HOOP,
  SCORE_MONEYBAG,
  SCORE_MONKEY,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  STAGE1,
  STAGE2,
  WORLD_WIDTH,
} from '../game/constants';
import type { GameResult } from '../game/types';
import { DistanceMeters, GameOverOverlay, Hud, RunHud } from './Overlays';
import { BalanceWalker, FirePot, Garland, LionRider, Monkey, Pedestal, type BalanceWalkerPose, type LionRiderPose } from './Actors';
import stage1Bg from '../assets/images/stage01.png';
import stage2Bg from '../assets/images/stage02.png';
import stageMusic from '../assets/audio/stage1-4.mp3';
import failureSfx from '../assets/audio/failure.mp3';
import styles from './Stages.module.scss';

// ---------------------------------------------------------------------------
// Screen - letterboxed 1024x768 viewport, scaled to fit the browser window.
// ---------------------------------------------------------------------------

/**
 * Letterboxed 1024x768 viewport, scaled to fit the browser window while
 * preserving aspect ratio - the same "show all, no cropping, no
 * stretching" behaviour the original Phaser build got from its
 * ScaleManager.SHOW_ALL mode.
 */
export function Screen({ children }: { children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      const next = Math.min(rect.width / SCREEN_WIDTH, rect.height / SCREEN_HEIGHT);
      setScale(next > 0 ? next : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={viewportRef} className={styles.viewport}>
      <div className={styles.viewportStage} style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParallaxBackground - the tiled circus-tent backdrop.
// ---------------------------------------------------------------------------

/** The tiled circus-tent backdrop, repeated across the whole level width. */
export function ParallaxBackground({ image }: { image: string }) {
  return <div className={styles.background} style={{ width: WORLD_WIDTH, backgroundImage: `url(${image})` }} />;
}

// ---------------------------------------------------------------------------
// Stage1 - the lion-riding, fire-jumping level.
// ---------------------------------------------------------------------------

const S1_PLAYER_WIDTH = 99; // lion sprite, 33 * 3
const S1_PLAYER_HEIGHT = 48; // 16 * 3
const FIREPOT_WIDTH = 72; // 24 * 3, visual sprite size - used for layout/scoring
const FIREPOT_HEIGHT = 93; // 31 * 3, visual sprite size - used for layout/scoring
// The *collision* box is deliberately smaller than the visual sprite and
// anchored to the pot's base rather than the flame's flicker above it -
// standard forgiving-hitbox practice, and needed here specifically: a
// same-height, full-width box (matching the sprite bounds exactly) means
// even a well-timed jump can still catch the tail of its arc against the
// pot, since the low point of a jump's rise/fall is still within the
// sprite's full height for a brief stretch on both ends.
const FIREPOT_HITBOX_INSET_X = 14;
const FIREPOT_HITBOX_TOP_INSET = 35;
const HOOP_WIDTH = 72; // both halves together, 24 * 3
const S1_PEDESTAL_WIDTH = 111; // 37 * 3
/** Matches the original's `firecirclesLeft/Right.setAll('body.velocity.x', -70)` - the hoops drift left on their own, independent of the player. */
const HOOP_VELOCITY = -70;

type StagePhase = 'playing' | 'dying' | 'reachedEnd' | 'gameOver';

export function Stage1({ onComplete, onGameOver }: { onComplete: () => void; onGameOver: () => void }) {
  const game = useGame();
  const keysRef = useKeyboard();
  const music = useSound(stageMusic, { loop: true });
  const failure = useSound(failureSfx);

  const worldRef = useRef<HTMLDivElement | null>(null);
  const playerElRef = useRef<HTMLDivElement | null>(null);

  const [pose, setPose] = useState<LionRiderPose>('idle');
  const [gameOverResult, setGameOverResult] = useState<Exclude<GameResult, null> | null>(null);
  const startedAtRef = useRef(performance.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  const firepotXs = useMemo(() => {
    const list: number[] = [];
    for (let x = STAGE1.firepotStartX; x < WORLD_WIDTH - 800; x += STAGE1.firepotSpacing) list.push(x);
    return list;
  }, []);

  const hoopXs = useMemo(() => {
    const list: number[] = [];
    for (let i = 800; i < WORLD_WIDTH; i += 800) {
      let x = i;
      if (x % 2) x -= 300 + Math.floor(Math.random() * STAGE1.hoopJitterMax) + 1;
      x += 1;
      list.push(x);
    }
    return list;
  }, []);

  // A few garlands (not most) hide a small money-bag bonus.
  const hoopHasMoneyBag = useMemo(
    () => hoopXs.map((_, idx) => idx % MONEYBAG_HOOP_EVERY === MONEYBAG_HOOP_EVERY - 1),
    [hoopXs],
  );

  const scoredFirepots = useRef<Set<number>>(new Set());
  const scoredHoops = useRef<Set<number>>(new Set());

  const hoopBodiesRef = useRef<Map<number, { x: number }>>(new Map());
  const hoopElsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const resetHoops = useCallback(() => {
    hoopXs.forEach((x, idx) => {
      hoopBodiesRef.current.set(idx, { x });
      const el = hoopElsRef.current.get(idx);
      if (el) el.style.transform = `translate(${x}px, 0px)`;
    });
    scoredHoops.current.clear();
  }, [hoopXs]);

  const bodyRef = useRef<Body>({
    x: STAGE1.spawnX,
    y: STAGE1.groundY,
    vx: 0,
    vy: 0,
    width: S1_PLAYER_WIDTH,
    height: S1_PLAYER_HEIGHT,
    onGround: true,
  });

  const phaseRef = useRef<StagePhase>('playing');
  const dyingUntilRef = useRef(0);
  const reachedEndAtRef = useRef(0);
  const lastBonusTickRef = useRef(0);
  const lastBonusTallyRef = useRef(0);

  // "Time taken" - ticks independently of the 60fps physics loop (no point
  // re-rendering that often for a once-a-second display), and simply stops
  // updating once the run ends so the overlay shows a frozen final time.
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current === 'gameOver') return;
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const applyPlayerDom = useCallback((x: number, y: number) => {
    const el = playerElRef.current;
    if (el) el.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const applyCamera = useCallback((playerX: number) => {
    const el = worldRef.current;
    if (!el) return;
    // Clamped so the viewport never scrolls past the level's right edge -
    // otherwise, once the player is near the end (e.g. standing on the
    // pedestal), the camera pushes past the world's actual content and
    // the empty space beyond it shows as a black void filling a big
    // chunk of the screen, making the background look like it "shrank".
    const camX = Math.min(Math.max(0, playerX - 100), WORLD_WIDTH - SCREEN_WIDTH);
    el.style.transform = `translateX(${-camX}px)`;
  }, []);

  const startAttempt = useCallback(() => {
    const startX = game.checkpoint.stage === 1 && game.checkpoint.x > 0 ? game.checkpoint.x : STAGE1.spawnX;

    bodyRef.current = {
      x: startX,
      y: STAGE1.groundY,
      vx: 0,
      vy: 0,
      width: S1_PLAYER_WIDTH,
      height: S1_PLAYER_HEIGHT,
      onGround: true,
    };
    phaseRef.current = 'playing';
    game.resetBonus();
    setPose('idle');
    applyPlayerDom(startX, STAGE1.groundY);
    applyCamera(startX);
    resetHoops();
    music.play();
  }, [applyCamera, applyPlayerDom, game, music, resetHoops]);

  useEffect(() => {
    startAttempt();
    return () => music.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerDeath = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'dying';
    dyingUntilRef.current = performance.now() + GAME_OVER_FREEZE_MS;
    setPose('dead');
    music.stop();
    failure.play();
    game.saveCheckpoint(1, Math.max(0, bodyRef.current.x - CHECKPOINT_BACKOFF));
  }, [failure, game, music]);

  const triggerWin = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'reachedEnd';
    reachedEndAtRef.current = performance.now();
    lastBonusTallyRef.current = performance.now();
    setPose('idle');

    const body = bodyRef.current;
    body.vx = 0;
    body.vy = 0;
    body.x = STAGE1.pedestalX + (S1_PEDESTAL_WIDTH - body.width) / 2;
    body.y = STAGE1.pedestalY - body.height;
    applyPlayerDom(body.x, body.y);
  }, [applyPlayerDom]);

  useRafLoop((deltaMs) => {
    const dt = deltaMs / 1000;
    const now = performance.now();
    const body = bodyRef.current;
    const keys = keysRef.current;
    const phase = phaseRef.current;

    if (phase === 'gameOver') {
      return;
    }

    if (phase === 'dying') {
      if (now >= dyingUntilRef.current) {
        const wasFinal = game.loseLife();
        if (wasFinal) {
          phaseRef.current = 'gameOver';
          setGameOverResult('GAME OVER');
        } else {
          startAttempt();
        }
      }
      return;
    }

    if (phase === 'reachedEnd') {
      if (now - lastBonusTallyRef.current > BONUS_TALLY_MS) {
        lastBonusTallyRef.current = now;
        game.setBonus((prev) => {
          if (prev <= 0) return 0;
          const chunk = Math.min(BONUS_TALLY_AMOUNT, prev);
          game.addScore(chunk);
          return prev - chunk;
        });
      }
      // Only one stage "for now" - reaching the podium ends the run here
      // too, instead of continuing on into Stage 2.
      if (game.bonus <= 0 && now - reachedEndAtRef.current > PEDESTAL_HOLD_MS) {
        phaseRef.current = 'gameOver';
        setGameOverResult('YOU WIN!');
      }
      return;
    }

    // --- normal play ---
    const isJumping = !body.onGround;
    if (keys.has('ArrowUp') && !isJumping) {
      body.vy = STAGE1.jumpVelocity;
    }
    applyGravity(body, STAGE1.gravity, STAGE1.groundY, dt);

    if (!isJumping) {
      if (keys.has('ArrowRight')) {
        body.vx = STAGE1.runVelocityRight;
        setPose((p) => (p === 'running' ? p : 'running'));
      } else if (keys.has('ArrowLeft')) {
        body.vx = STAGE1.runVelocityLeft;
        setPose((p) => (p === 'running' ? p : 'running'));
      } else {
        body.vx = 0;
        setPose((p) => (p === 'idle' ? p : 'idle'));
      }
    } else {
      setPose((p) => (p === 'jumping' ? p : 'jumping'));
    }

    body.x = Math.max(0, body.x + body.vx * dt);

    if (now - lastBonusTickRef.current > BONUS_TICK_MS) {
      lastBonusTickRef.current = now;
      game.setBonus((prev) => Math.max(0, prev - BONUS_TICK_AMOUNT));
    }

    for (const fx of firepotXs) {
      if (!scoredFirepots.current.has(fx) && body.x > fx + FIREPOT_WIDTH) {
        scoredFirepots.current.add(fx);
        game.addScore(SCORE_FIREPOT);
      }
    }

    // Hoops drift left on their own, independent of the player/camera.
    hoopBodiesRef.current.forEach((hoop, idx) => {
      hoop.x += HOOP_VELOCITY * dt;
      const el = hoopElsRef.current.get(idx);
      if (el) el.style.transform = `translate(${hoop.x}px, 0px)`;

      if (!scoredHoops.current.has(idx) && body.x > hoop.x + HOOP_WIDTH) {
        scoredHoops.current.add(idx);
        game.addScore(hoopHasMoneyBag[idx] ? SCORE_HOOP + SCORE_MONEYBAG : SCORE_HOOP);
      }
    });

    const playerRect = bodyRect(body);
    for (const fx of firepotXs) {
      const rect: Rect = {
        left: fx + FIREPOT_HITBOX_INSET_X,
        right: fx + FIREPOT_WIDTH - FIREPOT_HITBOX_INSET_X,
        top: STAGE1.firepotY + FIREPOT_HITBOX_TOP_INSET,
        bottom: STAGE1.firepotY + FIREPOT_HEIGHT,
      };
      if (rectsOverlap(playerRect, rect)) {
        triggerDeath();
        break;
      }
    }

    if (phaseRef.current === 'playing' && body.x + body.width / 2 >= STAGE1.pedestalX) {
      triggerWin();
      applyCamera(bodyRef.current.x);
      return;
    }

    applyPlayerDom(body.x, body.y);
    applyCamera(body.x);
  });

  const handleContinue = useCallback(() => {
    if (gameOverResult === 'YOU WIN!') onComplete();
    else onGameOver();
  }, [gameOverResult, onComplete, onGameOver]);

  return (
    <div className={styles.stageFrame}>
      {/* The original red HUD bar is hidden for now, in favour of the RunHud boxes below. */}
      <RunHud timeMs={elapsedMs} score={game.score} lives={game.lives} />
      <div ref={worldRef} className={styles.world} style={{ width: WORLD_WIDTH }}>
        <ParallaxBackground image={stage1Bg} />
        <DistanceMeters spacing={STAGE1.meterSpacing} />
        {firepotXs.map((x) => (
          <FirePot key={x} x={x} />
        ))}
        {hoopXs.map((x, idx) => (
          <Garland
            key={idx}
            initialX={x}
            hasMoneyBag={hoopHasMoneyBag[idx]}
            ref={(el) => {
              if (el) hoopElsRef.current.set(idx, el);
              else hoopElsRef.current.delete(idx);
            }}
          />
        ))}
        <Pedestal x={STAGE1.pedestalX} y={STAGE1.pedestalY} />
        <LionRider ref={playerElRef} pose={pose} />
      </div>
      {gameOverResult && (
        <GameOverOverlay result={gameOverResult} timeMs={elapsedMs} score={game.score} onContinue={handleContinue} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage2 - the tightrope-walking, monkey-dodging level.
// ---------------------------------------------------------------------------

const S2_PLAYER_WIDTH = 48; // 16 * 3
const S2_PLAYER_HEIGHT = 72; // 24 * 3
const MONKEY_WIDTH = 48;
const MONKEY_HEIGHT = 48;
const S2_PEDESTAL_WIDTH = 111;

interface MonkeyBody extends Body {
  jumpAt: number;
  scored: boolean;
}

interface MonkeyRecord {
  id: number;
  spawnX: number;
  spawnY: number;
}

let nextMonkeyId = 1;

export function Stage2({ onComplete, onGameOver }: { onComplete: () => void; onGameOver: () => void }) {
  const game = useGame();
  const keysRef = useKeyboard();
  const music = useSound(stageMusic, { loop: true });
  const failure = useSound(failureSfx);

  const worldRef = useRef<HTMLDivElement | null>(null);
  const playerElRef = useRef<HTMLDivElement | null>(null);

  const [pose, setPose] = useState<BalanceWalkerPose>('idle');
  const [runFrameMs, setRunFrameMs] = useState(100);
  const [monkeys, setMonkeys] = useState<MonkeyRecord[]>([]);

  const monkeyBodiesRef = useRef<Map<number, MonkeyBody>>(new Map());
  const monkeyElsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const bodyRef = useRef<Body>({
    x: STAGE2.spawnX,
    y: STAGE2.groundY,
    vx: 0,
    vy: 0,
    width: S2_PLAYER_WIDTH,
    height: S2_PLAYER_HEIGHT,
    onGround: true,
  });

  const phaseRef = useRef<StagePhase>('playing');
  const dyingUntilRef = useRef(0);
  const reachedEndAtRef = useRef(0);
  const lastBonusTickRef = useRef(0);
  const lastBonusTallyRef = useRef(0);
  const lastSpawnRef = useRef(0);

  const applyPlayerDom = useCallback((x: number, y: number) => {
    const el = playerElRef.current;
    if (el) el.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const applyCamera = useCallback((playerX: number) => {
    const el = worldRef.current;
    if (!el) return;
    // Clamped so the viewport never scrolls past the level's right edge -
    // otherwise, once the player is near the end (e.g. standing on the
    // pedestal), the camera pushes past the world's actual content and
    // the empty space beyond it shows as a black void filling a big
    // chunk of the screen, making the background look like it "shrank".
    const camX = Math.min(Math.max(0, playerX - 120), WORLD_WIDTH - SCREEN_WIDTH);
    el.style.transform = `translateX(${-camX}px)`;
  }, []);

  const startAttempt = useCallback(() => {
    const startX = game.checkpoint.stage === 2 && game.checkpoint.x > 0 ? game.checkpoint.x : STAGE2.spawnX;

    bodyRef.current = {
      x: startX,
      y: STAGE2.groundY,
      vx: 0,
      vy: 0,
      width: S2_PLAYER_WIDTH,
      height: S2_PLAYER_HEIGHT,
      onGround: true,
    };
    phaseRef.current = 'playing';
    game.resetBonus();
    setPose('idle');
    setMonkeys([]);
    monkeyBodiesRef.current.clear();
    lastSpawnRef.current = performance.now();
    applyPlayerDom(startX, STAGE2.groundY);
    applyCamera(startX);
    music.play();
  }, [applyCamera, applyPlayerDom, game, music]);

  useEffect(() => {
    startAttempt();
    return () => music.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerDeath = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'dying';
    dyingUntilRef.current = performance.now() + GAME_OVER_FREEZE_MS;
    setPose('dead');
    music.stop();
    failure.play();
    game.saveCheckpoint(2, Math.max(0, bodyRef.current.x - CHECKPOINT_BACKOFF));
  }, [failure, game, music]);

  const triggerWin = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'reachedEnd';
    reachedEndAtRef.current = performance.now();
    lastBonusTallyRef.current = performance.now();
    setPose('idle');

    const body = bodyRef.current;
    body.vx = 0;
    body.vy = 0;
    body.x = STAGE2.pedestalX + (S2_PEDESTAL_WIDTH - body.width) / 2;
    body.y = STAGE2.pedestalY - body.height;
    applyPlayerDom(body.x, body.y);
  }, [applyPlayerDom]);

  const spawnMonkeys = useCallback(() => {
    if (monkeyBodiesRef.current.size > STAGE2.monkeyMaxOnScreen) return;

    const difficulty = Math.floor(Math.random() * 100) + 1;
    const count = difficulty > 40 ? Math.floor(Math.random() * 4) + 1 : 1;
    const baseX = bodyRef.current.x + 950 + Math.floor(Math.random() * 600) - 400;

    const created: MonkeyRecord[] = [];
    let lastX = baseX;
    for (let i = 0; i < count; i += 1) {
      const x = i === 0 ? baseX : lastX + (i > 1 ? 100 * i : 50);
      lastX = x;
      const id = nextMonkeyId;
      nextMonkeyId += 1;

      const willJump = difficulty > 70 && Math.random() * 100 > 30;
      const body: MonkeyBody = {
        x,
        y: STAGE2.groundY + (S2_PLAYER_HEIGHT - MONKEY_HEIGHT),
        vx: STAGE2.monkeyVelocity,
        vy: 0,
        width: MONKEY_WIDTH,
        height: MONKEY_HEIGHT,
        onGround: true,
        jumpAt: willJump ? performance.now() + Math.random() * 1500 + 200 : -1,
        scored: false,
      };
      monkeyBodiesRef.current.set(id, body);
      created.push({ id, spawnX: x, spawnY: body.y });
    }
    setMonkeys((prev) => [...prev, ...created]);
  }, []);

  useRafLoop((deltaMs) => {
    const dt = deltaMs / 1000;
    const now = performance.now();
    const body = bodyRef.current;
    const keys = keysRef.current;
    const phase = phaseRef.current;

    if (phase === 'dying') {
      if (now >= dyingUntilRef.current) {
        const wasFinal = game.loseLife();
        if (wasFinal) {
          onGameOver();
        } else {
          startAttempt();
        }
      }
      return;
    }

    if (phase === 'reachedEnd') {
      if (now - lastBonusTallyRef.current > BONUS_TALLY_MS) {
        lastBonusTallyRef.current = now;
        game.setBonus((prev) => {
          if (prev <= 0) return 0;
          const chunk = Math.min(BONUS_TALLY_AMOUNT, prev);
          game.addScore(chunk);
          return prev - chunk;
        });
      }
      if (game.bonus <= 0 && now - reachedEndAtRef.current > PEDESTAL_HOLD_MS) {
        onComplete();
      }
      return;
    }

    // --- spawn monkeys ---
    if (now - lastSpawnRef.current > STAGE2.monkeySpawnMs) {
      lastSpawnRef.current = now;
      spawnMonkeys();
    }

    // --- player physics ---
    const isJumping = !body.onGround;
    if (keys.has('ArrowUp') && !isJumping) {
      body.vy = STAGE2.jumpVelocity;
    }
    applyGravity(body, STAGE2.gravity, STAGE2.groundY, dt);

    if (!isJumping) {
      if (keys.has('ArrowRight')) {
        body.vx = STAGE2.runVelocityRight;
        setRunFrameMs(100);
        setPose((p) => (p === 'running' ? p : 'running'));
      } else if (keys.has('ArrowLeft')) {
        body.vx = STAGE2.runVelocityLeft;
        setRunFrameMs(200);
        setPose((p) => (p === 'running' ? p : 'running'));
      } else {
        body.vx = 0;
        setPose((p) => (p === 'idle' ? p : 'idle'));
      }
    } else {
      setPose((p) => (p === 'jumping' ? p : 'jumping'));
    }

    body.x = Math.max(0, body.x + body.vx * dt);

    if (now - lastBonusTickRef.current > BONUS_TICK_MS) {
      lastBonusTickRef.current = now;
      game.setBonus((prev) => Math.max(0, prev - BONUS_TICK_AMOUNT));
    }

    // --- monkeys ---
    const toRemove: number[] = [];
    const playerRect = bodyRect(body);
    monkeyBodiesRef.current.forEach((m, id) => {
      if (m.jumpAt > 0 && now >= m.jumpAt && m.onGround) {
        m.vy = STAGE2.monkeyJumpVelocity;
        m.jumpAt = -1;
      }
      applyGravity(m, STAGE2.gravity, STAGE2.groundY + (S2_PLAYER_HEIGHT - MONKEY_HEIGHT), dt);
      m.x += m.vx * dt;

      const el = monkeyElsRef.current.get(id);
      if (el) el.style.transform = `translate(${m.x}px, ${m.y}px)`;

      if (rectsOverlap(playerRect, bodyRect(m))) {
        triggerDeath();
      }

      if (!m.scored && m.x + m.width < body.x) {
        m.scored = true;
        game.addScore(SCORE_MONKEY);
      }

      if (m.x + m.width < body.x - 900) {
        toRemove.push(id);
      }
    });
    if (toRemove.length > 0) {
      toRemove.forEach((id) => {
        monkeyBodiesRef.current.delete(id);
        monkeyElsRef.current.delete(id);
      });
      setMonkeys((prev) => prev.filter((m) => !toRemove.includes(m.id)));
    }

    if (phaseRef.current === 'playing' && body.x + body.width / 2 >= STAGE2.pedestalX) {
      triggerWin();
      applyCamera(bodyRef.current.x);
      return;
    }

    applyPlayerDom(body.x, body.y);
    applyCamera(body.x);
  });

  return (
    <div className={styles.stageFrame}>
      <Hud />
      <div ref={worldRef} className={styles.world} style={{ width: WORLD_WIDTH }}>
        <ParallaxBackground image={stage2Bg} />
        <DistanceMeters spacing={STAGE2.meterSpacing} />
        {monkeys.map((m) => (
          <Monkey
            key={m.id}
            ref={(el) => {
              if (el) monkeyElsRef.current.set(m.id, el);
              else monkeyElsRef.current.delete(m.id);
            }}
            initialX={m.spawnX}
            initialY={m.spawnY}
          />
        ))}
        <Pedestal x={STAGE2.pedestalX} y={STAGE2.pedestalY} />
        <BalanceWalker ref={playerElRef} pose={pose} runFrameMs={runFrameMs} />
      </div>
    </div>
  );
}
