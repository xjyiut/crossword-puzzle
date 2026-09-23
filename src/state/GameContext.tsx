import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  STARTING_BONUS,
  STARTING_LIVES,
} from '../game/constants';
import type { Checkpoint, GameResult } from '../game/types';

interface GameState {
  score: number;
  hiScore: number;
  lives: number;
  stage: 1 | 2;
  bonus: number;
  checkpoint: Checkpoint;
  lastResult: GameResult;
}

interface GameApi extends GameState {
  addScore: (points: number) => void;
  /** Returns true if that was the last life (game over). */
  loseLife: () => boolean;
  resetGame: () => void;
  resetBonus: () => void;
  setBonus: (value: number | ((prev: number) => number)) => void;
  setStage: (stage: 1 | 2) => void;
  saveCheckpoint: (stage: 1 | 2, x: number) => void;
  startStageAt: (stage: 1 | 2) => void;
  setLastResult: (result: GameResult) => void;
}

const GameContext = createContext<GameApi | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [score, setScore] = useState(0);
  const [hiScore, setHiScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [stage, setStageState] = useState<1 | 2>(1);
  const [bonus, setBonusState] = useState(STARTING_BONUS);
  const [checkpoint, setCheckpoint] = useState<Checkpoint>({ stage: 1, x: 0 });
  const [lastResult, setLastResult] = useState<GameResult>(null);

  // Read synchronously inside the same tick a life is lost, before the
  // state update above has flushed - avoids reporting "game over" a life
  // early or late.
  const livesRef = useRef(lives);
  livesRef.current = lives;

  const addScore = useCallback((points: number) => {
    setScore((prev) => {
      const next = prev + points;
      setHiScore((prevHi) => Math.max(prevHi, next));
      return next;
    });
  }, []);

  const loseLife = useCallback((): boolean => {
    const next = livesRef.current - 1;
    livesRef.current = next;
    setLives(next);
    return next <= 0;
  }, []);

  const resetGame = useCallback(() => {
    setScore(0);
    setLives(STARTING_LIVES);
    livesRef.current = STARTING_LIVES;
    setStageState(1);
    setBonusState(STARTING_BONUS);
    setCheckpoint({ stage: 1, x: 0 });
    setLastResult(null);
  }, []);

  const resetBonus = useCallback(() => {
    setBonusState(STARTING_BONUS);
  }, []);

  const setBonus = useCallback((value: number | ((prev: number) => number)) => {
    setBonusState(value);
  }, []);

  const setStage = useCallback((s: 1 | 2) => {
    setStageState(s);
  }, []);

  const saveCheckpoint = useCallback((s: 1 | 2, x: number) => {
    setCheckpoint((prev) => {
      if (s > prev.stage) return { stage: s, x };
      if (s === prev.stage) return { stage: s, x: Math.max(prev.x, x) };
      return prev;
    });
  }, []);

  const startStageAt = useCallback((s: 1 | 2) => {
    setCheckpoint({ stage: s, x: 0 });
  }, []);

  const value: GameApi = {
    score,
    hiScore,
    lives,
    stage,
    bonus,
    checkpoint,
    lastResult,
    addScore,
    loseLife,
    resetGame,
    resetBonus,
    setBonus,
    setStage,
    saveCheckpoint,
    startStageAt,
    setLastResult,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameApi {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
