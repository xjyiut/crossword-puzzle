import { useState } from 'react';
import { useCupsGame } from '../game/useCupsGame';
import { BALL_COLOR_INDEX, slotX, STAT_BOX, STAT_BOX_Y } from '../game/constants';
import { useSound } from '../hooks/useSound';
import { usePhaseSoundEffects } from '../hooks/usePhaseSoundEffects';
import { Ball, CupCountControl, GameOverOverlay, IntroOverlay, IntroText, LevelText, Scene, StatBox } from './GamePieces';
import { Cups3D } from './Cups3D';
import type { Phase } from '../game/types';
import swooshSrc from '../assets/audio/swoosh.webm';
import clickSrc from '../assets/audio/click.webm';
import jingleWinSrc from '../assets/audio/jingle-b.webm';
import jingleOverSrc from '../assets/audio/jingle-a.webm';
import styles from './CupsGame.module.scss';

const PHASE_MESSAGES: Partial<Record<Phase, string>> = {
  intro: 'TAP TO START',
  shuffling: 'Shuffling...',
  guessing: 'Where is the ball?',
};

export function CupsGame() {
  const [showSplash, setShowSplash] = useState(true);
  const game = useCupsGame();
  const click = useSound(clickSrc);
  const swoosh = useSound(swooshSrc);
  const jingleWin = useSound(jingleWinSrc);
  const jingleOver = useSound(jingleOverSrc);

  usePhaseSoundEffects(game.phase, game.order, game.lastCorrect, { swoosh, jingleWin, jingleOver });

  const handleStart = () => {
    click.play();
    game.startRound();
  };

  const handleGuess = (position: number) => {
    click.play();
    game.guess(position);
  };

  const handleGrowCupCount = () => {
    click.play();
    game.growCupCount();
  };

  const handleRestart = () => {
    click.play();
    game.restartGame();
  };

  const clickable = game.phase === 'guessing';
  const ballPosition = game.order.indexOf(game.ballCupId);
  // Idle: the ball waits just to the right of the last cup, in full view,
  // then travels from there to its chosen cup once a round starts - rather
  // than simply appearing already in place under the leftmost cup. Clamped
  // so it never overlaps the stat boxes at higher cup counts.
  const lastCupX = slotX(game.cupCount - 1, game.cupCount);
  const ballSideX = Math.min(lastCupX + 100, STAT_BOX.x - 90);
  const ballAtSide = game.phase === 'intro' || (game.phase === 'result' && game.resultBallRetreating);
  const ballX = ballAtSide ? ballSideX : slotX(ballPosition, game.cupCount);
  const totalSeconds = Math.floor(game.elapsedMs / 1000);
  const timerText = `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;

  const message = game.phase === 'result' ? (game.lastCorrect ? 'Correct!' : 'Wrong!') : PHASE_MESSAGES[game.phase];

  return (
    <Scene>
      {showSplash && (
        <IntroOverlay
          onContinue={() => {
            click.play();
            setShowSplash(false);
          }}
        />
      )}
      <div className={styles.stage}>
        <LevelText level={game.round} />
        <StatBox label="Attempts" value={`${game.attempts}`} y={STAT_BOX_Y.attempts} />
        <StatBox label="Score" value={`${game.score}`} y={STAT_BOX_Y.score} />
        <StatBox label="Timer" value={timerText} y={STAT_BOX_Y.timer} />
        <CupCountControl count={game.cupCount} onIncrease={handleGrowCupCount} disabled={game.phase !== 'intro'} />

        <div className={styles.table} onClick={game.phase === 'intro' ? handleStart : undefined}>
          {/*
            Only mounted during phases where the ball is legitimately meant
            to be seen (idle at the side, the opening reveal, closing back
            up, or the final result reveal). While 'shuffling'/'guessing' -
            when its hiding spot must stay secret - it's covered only by
            z-index, which is nothing but a visual layering hint: DevTools'
            Elements panel highlights an element's true position regardless
            of what's stacked on top of it, and the same position was
            momentarily exposed during a browser zoom/resize reflow. Not
            rendering it at all removes the information from the page
            entirely, rather than just styling it out of sight.
          */}
          {(game.phase === 'intro' || game.phase === 'reveal' || game.phase === 'hiding' || game.phase === 'result') && (
            <Ball x={ballX} colorIndex={BALL_COLOR_INDEX} />
          )}
          <Cups3D
            cupCount={game.cupCount}
            order={game.order}
            liftedCupIds={game.liftedCupIds}
            clickable={clickable}
            swapArc={game.swapArc}
            onGuess={handleGuess}
          />
        </div>

        {message && !game.gameOver && <IntroText text={message} />}
        {game.gameOver && <GameOverOverlay score={game.score} onRestart={handleRestart} />}
      </div>
    </Scene>
  );
}
