import * as React from 'react';
import { ICrosswordApi } from '../hooks/useCrossword';
import { cellKey, ICell } from '../services/gridModel';
import styles from '../Crossword.module.scss';

export interface ICrosswordGridProps {
  api: ICrosswordApi;
  /** Locks the grid once the puzzle has been solved. */
  readOnly?: boolean;
  /**
   * Draw the rings on the bonus squares. Off while the grid is being solved --
   * showing them early hands the player the shape of the final answer.
   */
  showBonusCircles?: boolean;
}

/**
 * The board. Every square is a button; a single invisible <input> is mounted
 * inside the active square so that physical keyboards and mobile soft
 * keyboards both work without one input per cell.
 */
const CrosswordGrid: React.FC<ICrosswordGridProps> = (props: ICrosswordGridProps) => {
  const { api, readOnly, showBonusCircles } = props;
  const { model, entries, cursor, activeWordKeys, wordStatus, showErrors } = api;
  const inputRef: React.RefObject<HTMLInputElement> = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!readOnly && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [cursor, readOnly]);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value: string = event.target.value;
    event.target.value = '';
    if (value) { api.typeLetter(value.charAt(value.length - 1)); }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'Backspace':
        event.preventDefault();
        api.backspace();
        return;
      case 'Delete':
        event.preventDefault();
        api.backspace();
        return;
      case 'ArrowUp':
        event.preventDefault();
        api.moveBy(-1, 0);
        return;
      case 'ArrowDown':
        event.preventDefault();
        api.moveBy(1, 0);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        api.moveBy(0, -1);
        return;
      case 'ArrowRight':
        event.preventDefault();
        api.moveBy(0, 1);
        return;
      case ' ':
        event.preventDefault();
        api.toggleDirection();
        return;
      case 'Tab':
        event.preventDefault();
        api.stepWord(event.shiftKey ? -1 : 1);
        return;
      default:
        return;
    }
  };

  const renderCell = (cell: ICell | undefined, row: number, col: number): JSX.Element => {
    const k: string = cellKey(row, col);

    if (!cell) {
      return <div key={k} className={styles.blank} aria-hidden={true} />;
    }

    const isCursor: boolean = !!cursor && cursor.row === row && cursor.col === col;
    const inWord: boolean = activeWordKeys[k] === true;
    const value: string = entries[k] || '';

    const owningId: string | undefined = cell.acrossWordId || cell.downWordId;
    const wrong: boolean =
      showErrors &&
      !!value &&
      value !== cell.solution &&
      !!owningId &&
      wordStatus[owningId] === 'incorrect';

    const classes: string[] = [styles.cell];
    if (inWord) { classes.push(styles.inWord); }
    if (isCursor) { classes.push(styles.cursor); }
    if (showBonusCircles && cell.bonusOrder !== undefined) { classes.push(styles.bonus); }
    if (wrong) { classes.push(styles.wrong); }

    return (
      <button
        key={k}
        type="button"
        className={classes.join(' ')}
        onClick={() => { if (!readOnly) { api.selectCell(row, col); } }}
        aria-label={'Row ' + (row + 1) + ', column ' + (col + 1)}
        tabIndex={-1}
      >
        {cell.number !== undefined ? <span className={styles.cellNumber}>{cell.number}</span> : undefined}
        <span className={styles.cellLetter}>{value}</span>
        {isCursor && !readOnly ? <span className={styles.caret} /> : undefined}
        {isCursor && !readOnly ? (
          <input
            ref={inputRef}
            className={styles.hiddenInput}
            value=""
            onChange={onChange}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label="Crossword letter entry"
          />
        ) : undefined}
      </button>
    );
  };

  return (
    <div
      className={styles.grid}
      role="grid"
      style={{ gridTemplateColumns: 'repeat(' + model.cols + ', var(--cw-cell-size, 46px))' }}
    >
      {model.cells.map((row: (ICell | undefined)[], r: number) =>
        row.map((cell: ICell | undefined, c: number) => renderCell(cell, r, c))
      )}
    </div>
  );
};

export default CrosswordGrid;
