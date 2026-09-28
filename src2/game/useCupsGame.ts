import { useCallback, useEffect, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { MAX_ATTEMPTS, MAX_CUPS, MIN_CUPS, MOVE_MS, swapCountForRound, TIMING } from './constants';
import type { Phase } from './types';

/**
 * Swaps exactly two ADJACENT slots - mirrors the original's "move" function,
 * which repositions one pair of cups per shuffle beat (both animating at
 * once) while every other cup stays put, rather than reassigning the whole
 * row every beat. Adjacent-only is deliberate: a swap between two slots
 * with a third cup sitting between them would arc directly over that third
 * (stationary) cup's position, and no hop height can clear both that cup
 * and the swapping pair without looking absurdly tall - staying adjacent
 * keeps every crossing clean, and also matches how a real shuffle physically
 * works (a cup can't skip over another one). Also reports which two cup ids
 * were involved so the crossing pair can be kept legible (one stacked in
 * front of the other) instead of visually merging at the midpoint.
 */
function swapPair(order: number[]): { next: number[]; over: number; under: number } {
  const next = [...order];
  const i = Math.floor(Math.random() * next.length);
  const canGoLeft = i > 0;
  const canGoRight = i < next.length - 1;
  const goRight = canGoRight && (!canGoLeft || Math.random() < 0.5);
  const j = goRight ? i + 1 : i - 1;
  [next[i], next[j]] = [next[j], next[i]];
  return { next, over: order[i], under: order[j] };
}

export interface SwapArc {
  over: number;
  under: number;
  /** Identifies this specific swap step, so the hop animation can be forced to restart even if the same cup swaps again on the very next step. */
  id: number;
}

export function useCupsGame() {
  const [cupCount, setCupCount] = useState(MIN_CUPS);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(MAX_ATTEMPTS);
  // Session stopwatch: starts on the player's first-ever "tap to start" and
  // runs continuously (through every phase, not just guessing) until
  // attempts run out and the session resets - not a per-round timer.
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerStartRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [order, setOrder] = useState<number[]>(() => Array.from({ length: MIN_CUPS }, (_, i) => i));
  const [ballCupId, setBallCupId] = useState(0);
  // Which cup(s) are currently tilted open - an array because a wrong
  // guess briefly has two open at once (the empty one clicked, then also
  // the one that truly has the ball).
  const [liftedCupIds, setLiftedCupIds] = useState<number[]>([]);
  const [guessedCupId, setGuessedCupId] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [swapArc, setSwapArc] = useState<SwapArc | null>(null);
  const [gameOver, setGameOver] = useState(false);
  // result phase only: once true, the ball's target position switches to
  // its side spot while the cup stays open, so it visibly travels back out
  // before the cup closes over an empty spot.
  const [resultBallRetreating, setResultBallRetreating] = useState(false);

  const swapsRemaining = useRef(0);
  const swapEventId = useRef(0);
  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const growCupCount = useCallback(() => {
    if (phase !== 'intro') return;
    setCupCount((c) => (c >= MAX_CUPS ? MIN_CUPS : c + 1));
  }, [phase]);

  // Keep the idle display in sync when the player actually changes the cup
  // count via the stepper. Deliberately keyed on cupCount alone, not phase:
  // returning to 'intro' after a round must NOT re-trigger this, or the
  // cups would snap back to their original A/B/C order right after a
  // result instead of staying wherever the shuffle left them.
  useEffect(() => {
    if (phase !== 'intro') return;
    setOrder(Array.from({ length: cupCount }, (_, i) => i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cupCount]);

  const startRound = useCallback(() => {
    if (gameOver) return;
    // Cups stay exactly where they currently are (wherever the last round's
    // shuffle left them, or their default row on the very first round) -
    // only the ball travels, to whichever cup this round's randomly-chosen
    // ballCupId currently occupies, and that one cup opens for it. No
    // repositioning of the row itself at round start.
    setBallCupId(Math.floor(Math.random() * cupCount));
    setLiftedCupIds([]);
    setGuessedCupId(null);
    setLastCorrect(null);
    setResultBallRetreating(false);
    setRound((r) => r + 1);
    setPhase('reveal');
    setTimerRunning((running) => {
      if (!running) timerStartRef.current = Date.now();
      return true;
    });
  }, [cupCount, gameOver]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setElapsedMs(Date.now() - timerStartRef.current), 200);
    return () => clearInterval(id);
  }, [timerRunning]);

  // reveal -> briefly show the ball under its cup, then hide it and shuffle
  useEffect(() => {
    if (phase !== 'reveal') return;
    setLiftedCupIds([ballCupId]);
    const id = setTimeout(() => setPhase('hiding'), TIMING.revealMs);
    return () => clearTimeout(id);
  }, [phase, ballCupId]);

  // hiding -> close the cup, wait for that close animation to actually
  // finish (MOVE_MS), then hold a beat (settleMs) before shuffling starts -
  // previously the settle pause ran concurrently with the close animation
  // instead of after it, which is what made this feel rushed.
  useEffect(() => {
    if (phase !== 'hiding') return;
    setLiftedCupIds([]);
    const id = setTimeout(() => {
      swapsRemaining.current = swapCountForRound(round);
      setPhase('shuffling');
    }, MOVE_MS + TIMING.settleMs);
    return () => clearTimeout(id);
  }, [phase, round]);

  // shuffling -> one pair of cups swaps per beat, chained back-to-back at
  // exactly the CSS transition's own duration so one swap finishes right
  // as the next begins - matches the original's sequential, one-swap-at-a-
  // time shuffle rather than moving every cup at once.
  useEffect(() => {
    if (phase !== 'shuffling') return;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;
      if (swapsRemaining.current <= 0) {
        setSwapArc(null);
        setPhase('guessing');
        return;
      }
      swapsRemaining.current -= 1;
      const { next, over, under } = swapPair(orderRef.current);
      orderRef.current = next;
      swapEventId.current += 1;
      // Outside an event handler, React 17 doesn't auto-batch setState
      // calls - two separate setOrder/setSwapArc commits let the browser
      // paint the intermediate frame between them, which corrupts the CSS
      // transition for one of the two swapping cups. Force one atomic
      // commit so both cups' transform changes are painted together.
      unstable_batchedUpdates(() => {
        setOrder(next);
        setSwapArc({ over, under, id: swapEventId.current });
      });
      setTimeout(step, TIMING.swapStepMs);
    };
    step();

    return () => {
      cancelled = true;
      setSwapArc(null);
    };
  }, [phase]);

  const guess = useCallback(
    (position: number) => {
      if (phase !== 'guessing') return;
      const cupId = order[position];
      const correct = cupId === ballCupId;
      setGuessedCupId(cupId);
      setLastCorrect(correct);
      if (correct) {
        setScore((s) => s + 10);
      } else {
        setAttempts((a) => {
          const next = a - 1;
          if (next <= 0) {
            // Last attempt used up - stop the session timer and leave
            // attempts at 0 so the Game Over screen can show it truthfully;
            // restartGame() resets everything once the player dismisses it.
            setTimerRunning(false);
            return 0;
          }
          return next;
        });
      }
      setPhase('result');
    },
    [phase, order, ballCupId],
  );

  // result, fully sequential - never two cups open at once:
  // - correct guess: the clicked cup IS the ball's cup, so it just opens,
  //   holds, the ball retreats to its side spot, then it closes.
  // - wrong guess: the clicked (empty) cup opens and holds alone, then
  //   CLOSES again; only once it's fully shut does the cup that truly has
  //   the ball open on its own, hold, the ball retreats, then that cup
  //   closes too.
  useEffect(() => {
    if (phase !== 'result' || guessedCupId === null) return;
    const correct = guessedCupId === ballCupId;
    setResultBallRetreating(false);
    setLiftedCupIds([guessedCupId]);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const after = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    // When the true cup opens: immediately if correct (it's the same cup,
    // already open above), or only once the wrong cup has been shown and
    // has fully closed again if not.
    const trueCupOpensAt = correct ? 0 : TIMING.wrongRevealMs + MOVE_MS;
    if (!correct) {
      after(TIMING.wrongRevealMs, () => setLiftedCupIds([])); // close the wrong cup
      after(trueCupOpensAt, () => setLiftedCupIds([ballCupId])); // then open the true cup alone
    }
    after(trueCupOpensAt + TIMING.resultHoldMs, () => setResultBallRetreating(true));
    after(trueCupOpensAt + TIMING.resultHoldMs + MOVE_MS, () => setLiftedCupIds([]));
    after(trueCupOpensAt + TIMING.resultHoldMs + MOVE_MS + MOVE_MS + TIMING.resultCloseSettleMs, () => {
      setPhase('intro');
      setResultBallRetreating(false);
      if (attempts <= 0) setGameOver(true);
    });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const restartGame = useCallback(() => {
    setGameOver(false);
    setScore(0);
    setAttempts(MAX_ATTEMPTS);
    setElapsedMs(0);
    setTimerRunning(false);
    setRound(0);
  }, []);

  return {
    cupCount,
    round,
    score,
    attempts,
    elapsedMs,
    order,
    ballCupId,
    phase,
    liftedCupIds,
    lastCorrect,
    swapArc,
    gameOver,
    resultBallRetreating,
    growCupCount,
    startRound,
    guess,
    restartGame,
  };
}
