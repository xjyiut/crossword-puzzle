import * as React from 'react';
import { ICrosswordApi } from '../hooks/useCrossword';
import styles from '../Crossword.module.scss';

export interface IBonusPanelProps {
  api: ICrosswordApi;
}

/**
 * The final-answer screen: the riddle, the circled letters harvested from the
 * grid, plus any extra letters the puzzle hands you for free.
 */
const BonusPanel: React.FC<IBonusPanelProps> = (props: IBonusPanelProps) => {
  const { api } = props;
  const bonus = api.model.bonus;
  if (!bonus) { return <React.Fragment />; }

  const finished: boolean = api.stage === 'done';
  const tiles: string[] = bonus.gridLetters.concat(bonus.extraLetters || []);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (api.canSubmitBonus && !finished) { api.submitBonus(); }
  };

  return (
    <section className={styles.bonusPanel} aria-label="Final answer">
      <p className={styles.riddle}>{bonus.riddle}</p>
      <p className={styles.instruction}>{bonus.instruction}</p>

      <div className={styles.letterBank} aria-label="Highlighted letters">
        {tiles.map((letter: string, index: number) => (
          <span
            key={index}
            className={
              index >= bonus.gridLetters.length
                ? styles.letterTile + ' ' + styles.letterTileExtra
                : styles.letterTile
            }
          >
            {letter}
          </span>
        ))}
      </div>

      <form className={styles.answerRow} onSubmit={onSubmit}>
        <input
          className={styles.answerInput}
          type="text"
          value={finished ? bonus.answer.toUpperCase() : api.bonusGuess}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => api.setBonusGuess(e.target.value)}
          placeholder="Your answer"
          disabled={finished}
          autoComplete="off"
          spellCheck={false}
          aria-label="Final answer"
        />
        <button type="submit" className={styles.submit} disabled={!api.canSubmitBonus || finished}>
          Submit
        </button>
      </form>

      {finished ? (
        <p className={styles.messageSuccess} role="status">
          The answer was “{bonus.answer.toUpperCase()}”.
        </p>
      ) : undefined}
    </section>
  );
};

export default BonusPanel;
