import { useState } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { MainMenu, Prestage } from './components/Overlays';
import { Screen, Stage1, Stage2 } from './components/Stages';
import type { SceneName } from './game/types';

function AppInner() {
  const game = useGame();
  const [scene, setScene] = useState<SceneName>('MainMenu');
  const [prestage, setPrestage] = useState<{ text: string; next: SceneName } | null>(null);

  const goPrestage = (text: string, next: SceneName) => {
    setPrestage({ text, next });
    setScene('Prestage');
  };

  return (
    <Screen>
      {/* Skips the "STAGE 01" interstitial for now - not worth announcing a
          stage number while there's only the one stage to go to. */}
      {scene === 'MainMenu' && <MainMenu onStart={() => setScene('Stage1')} />}

      {scene === 'Prestage' && prestage && (
        <Prestage text={prestage.text} onDone={() => setScene(prestage.next)} />
      )}

      {scene === 'Stage1' && (
        // Stage1 shows its own "GAME OVER" / "YOU WIN!" overlay first (on
        // running out of lives, or reaching the podium - just one stage for
        // now), and only calls these once the player dismisses it - so
        // there's no need for a separate Prestage flash here, just record
        // the result and head back to the menu.
        <Stage1
          onComplete={() => {
            game.setLastResult('YOU WIN!');
            setScene('MainMenu');
          }}
          onGameOver={() => {
            game.setLastResult('GAME OVER');
            setScene('MainMenu');
          }}
        />
      )}

      {scene === 'Stage2' && (
        <Stage2
          onComplete={() => {
            game.setLastResult('YOU WIN!');
            goPrestage('YOU WIN!', 'MainMenu');
          }}
          onGameOver={() => {
            game.setLastResult('GAME OVER');
            goPrestage('GAME OVER', 'MainMenu');
          }}
        />
      )}
    </Screen>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
