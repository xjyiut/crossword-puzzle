import * as React from 'react';
import BonusPanel from './components/BonusPanel';
import ClueList from './components/ClueList';
import CrosswordGrid from './components/CrosswordGrid';
import Dialog from './components/Dialog';
import { ICrosswordApi, useCrossword } from './hooks/useCrossword';
import { ICrosswordDefinition } from './models/ICrossword';
import defaultDefinition from './data';
import styles from './Crossword.module.scss';

export interface ICrosswordProps {
  /** Defaults to `data/crossword.json`. Pass your own to swap puzzles. */
  definition?: ICrosswordDefinition;
  /** Square size in px. The grid scales down on narrow screens. */
  cellSize?: number;
  /** Show data problems (bad pins, unplaceable words). Defaults to true. */
  showWarnings?: boolean;
  /** Fires once the activity is finished, however it ended. */
  onSolved?: () => void;
}

const Crossword: React.FC<ICrosswordProps> = (props: ICrosswordProps) => {
  const definition: ICrosswordDefinition = props.definition || defaultDefinition;
  const api: ICrosswordApi = useCrossword(definition);
  const { model } = api;

  const onSolved: (() => void) | undefined = props.onSolved;
  const solvedRef: React.MutableRefObject<boolean> = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (api.stage === 'done' && !solvedRef.current) {
      solvedRef.current = true;
      if (onSolved) { onSolved(); }
    }
    if (api.stage !== 'done') { solvedRef.current = false; }
  }, [api.stage, onSolved]);

  const solving: boolean = api.stage === 'grid';
  const onGridScreen: boolean = api.stage === 'grid' || api.stage === 'revealed';

  /*
   * Only pin the square size when the caller asks for one. An inline custom
   * property outranks the media queries in the stylesheet, so setting it
   * unconditionally would stop the grid ever scaling down on narrow screens.
   * React's typings do not model custom properties, hence the cast.
   */
  const style: React.CSSProperties | undefined = props.cellSize
    ? ({ '--cw-cell-size': props.cellSize + 'px' } as unknown as React.CSSProperties)
    : undefined;

  return (
    <div className={styles.crossword} style={style}>
      <header className={styles.header}>
        <h2 className={styles.title}>{model.title}</h2>
        {model.subtitle ? <p className={styles.subtitle}>{model.subtitle}</p> : undefined}
      </header>

      {props.showWarnings !== false && model.warnings.length > 0 ? (
        <ul className={styles.warnings}>
          {model.warnings.map((warning: string, i: number) => <li key={i}>{warning}</li>)}
        </ul>
      ) : undefined}

      <div className={styles.board}>
        <div className={styles.gridPane}>
          <CrosswordGrid
            api={api}
            readOnly={!solving}
            showBonusCircles={api.stage === 'bonus' || api.stage === 'done'}
          />
        </div>

        <div className={styles.sidePane}>
          {onGridScreen ? (
            <>
              <ClueList api={api} heading="Across →" words={model.acrossWords} />
              <ClueList api={api} heading="Down ↓" words={model.downWords} />
            </>
          ) : (
            <BonusPanel api={api} />
          )}

          <div className={styles.actions}>
            {solving ? (
              <button
                type="button"
                className={styles.submit}
                onClick={api.submitGrid}
                disabled={!api.canSubmit}
                title={api.canSubmit ? 'Check your answers' : 'Fill in every square first'}
              >
                Submit
              </button>
            ) : undefined}

            {/* Retries used up: the grid now shows the solution, and the only
                way on is through to the final answer. */}
            {api.stage === 'revealed' ? (
              <button type="button" className={styles.submit} onClick={api.goToBonus}>
                Show Answer
              </button>
            ) : undefined}

            <button type="button" className={styles.secondary} onClick={api.reset}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {api.dialog ? <Dialog dialog={api.dialog} onAction={api.runDialog} /> : undefined}
    </div>
  );
};

export { Crossword };
export default Crossword;
