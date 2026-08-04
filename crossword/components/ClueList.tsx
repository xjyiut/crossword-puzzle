import * as React from 'react';
import { ICrosswordApi, WordStatus } from '../hooks/useCrossword';
import { IPlacedWord } from '../services/layoutEngine';
import styles from '../Crossword.module.scss';

export interface IClueListProps {
  api: ICrosswordApi;
  heading: string;
  words: IPlacedWord[];
}

const ClueList: React.FC<IClueListProps> = (props: IClueListProps) => {
  const { api, heading, words } = props;
  const activeId: string | undefined = api.activeWord ? api.activeWord.id : undefined;
  const activeRef: React.RefObject<HTMLLIElement> = React.useRef<HTMLLIElement>(null);

  React.useEffect(() => {
    if (activeRef.current && activeRef.current.scrollIntoView) {
      activeRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [activeId]);

  return (
    <div className={styles.clueGroup}>
      <h3 className={styles.clueHeading}>{heading}</h3>
      <ol className={styles.clueList}>
        {words.map((word: IPlacedWord) => {
          const isActive: boolean = word.id === activeId;
          const status: WordStatus = api.wordStatus[word.id] || 'unchecked';
          const classes: string[] = [styles.clue];
          if (isActive) { classes.push(styles.clueActive); }
          if (status === 'correct') { classes.push(styles.clueCorrect); }
          if (status === 'incorrect') { classes.push(styles.clueIncorrect); }

          return (
            <li key={word.id} ref={isActive ? activeRef : undefined} className={classes.join(' ')}>
              <button
                type="button"
                className={styles.clueButton}
                onClick={() => api.selectWord(word.id)}
                aria-current={isActive}
              >
                <span className={styles.clueNumber}>{word.number}.</span>
                <span className={styles.clueText}>{word.clue}</span>
                {status === 'correct' ? <span className={styles.tick} aria-label="correct">✓</span> : undefined}
                {status === 'incorrect' ? <span className={styles.cross} aria-label="incorrect">✕</span> : undefined}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default ClueList;
