import * as React from 'react';
import type { Direction, ICrosswordDefinition, ICrosswordMessages } from '../models/ICrossword';
import { buildGridModel, cellKey, ICell, IGridModel, wordIdAt } from '../services/gridModel';
import { IPlacedWord, normaliseAnswer } from '../services/layoutEngine';
import { resolveMessages } from '../services/messages';
import {
  bonusCorrectDialog,
  bonusRevealDialog,
  bonusWrongDialog,
  clearWrongEntries,
  giveUpDialog,
  gridFailureDialog,
  ICellSolution
} from '../services/flow';
import type { DialogAction, IDialogState } from '../models/IDialog';

export type { DialogAction, IDialogButton, IDialogState } from '../models/IDialog';

/**
 * `grid`     - solving the crossword
 * `revealed` - retries used up, the solution is on screen with tick marks
 * `bonus`    - the riddle / final answer screen
 * `done`     - finished, one way or another
 */
export type Stage = 'grid' | 'revealed' | 'bonus' | 'done';

export type WordStatus = 'unchecked' | 'correct' | 'incorrect';

export interface ICursor {
  row: number;
  col: number;
}

export interface ICrosswordApi {
  model: IGridModel;
  entries: { [key: string]: string };
  cursor: ICursor | undefined;
  direction: Direction;
  activeWord: IPlacedWord | undefined;
  activeWordKeys: { [key: string]: true };
  wordStatus: { [id: string]: WordStatus };
  showErrors: boolean;
  isComplete: boolean;
  canSubmit: boolean;
  stage: Stage;

  /** Failed grid submissions so far. */
  attempts: number;
  /** Grid retries remaining before the answer is revealed. */
  retriesLeft: number;

  bonusGuess: string;
  canSubmitBonus: boolean;

  /** The pop-up currently on screen, if any. */
  dialog: IDialogState | undefined;
  runDialog: (action: DialogAction) => void;

  selectCell: (row: number, col: number) => void;
  selectWord: (wordId: string) => void;
  typeLetter: (letter: string) => void;
  backspace: () => void;
  moveBy: (rowDelta: number, colDelta: number) => void;
  toggleDirection: () => void;
  stepWord: (delta: number) => void;
  submitGrid: () => void;
  goToBonus: () => void;
  setBonusGuess: (value: string) => void;
  submitBonus: () => void;
  reset: () => void;
}

function emptyStatus(model: IGridModel): { [id: string]: WordStatus } {
  const status: { [id: string]: WordStatus } = {};
  for (let i: number = 0; i < model.words.length; i++) { status[model.words[i].id] = 'unchecked'; }
  return status;
}

export function useCrossword(definition: ICrosswordDefinition): ICrosswordApi {
  const model: IGridModel = React.useMemo(() => buildGridModel(definition), [definition]);
  const messages: Required<ICrosswordMessages> = React.useMemo(
    () => resolveMessages(definition.messages),
    [definition]
  );

  /*
   * The starting square is derived during the very first render rather than in
   * an effect. Setting it in an effect meant the first paint had no active
   * square and therefore no caret, and server rendering never showed one at all.
   */
  const firstWord: IPlacedWord | undefined = model.acrossWords[0] || model.downWords[0];

  const [entries, setEntries] = React.useState<{ [key: string]: string }>({});
  const [cursor, setCursor] = React.useState<ICursor | undefined>(
    () => (firstWord ? { row: firstWord.row, col: firstWord.col } : undefined)
  );
  const [direction, setDirection] = React.useState<Direction>(
    () => (firstWord ? firstWord.direction : 'across')
  );
  const [wordStatus, setWordStatus] = React.useState<{ [id: string]: WordStatus }>(() => emptyStatus(model));
  const [showErrors, setShowErrors] = React.useState<boolean>(false);
  const [stage, setStage] = React.useState<Stage>('grid');
  const [attempts, setAttempts] = React.useState<number>(0);
  const [dialog, setDialog] = React.useState<IDialogState | undefined>(undefined);
  const [bonusGuess, setBonusGuessState] = React.useState<string>('');

  const maxGridAttempts: number = messages.gridAttempts.length;

  /* Lets `runDialog` read the current grid without depending on it. */
  const entriesRef: React.MutableRefObject<{ [key: string]: string }> =
    React.useRef<{ [key: string]: string }>(entries);
  entriesRef.current = entries;

  /* Start over whenever the puzzle itself is swapped out. The initial state is
     already correct, so skip the first run. */
  const knownModel: React.MutableRefObject<IGridModel> = React.useRef<IGridModel>(model);
  React.useEffect(() => {
    if (knownModel.current === model) { return; }
    knownModel.current = model;

    setEntries({});
    setWordStatus(emptyStatus(model));
    setShowErrors(false);
    setStage('grid');
    setAttempts(0);
    setDialog(undefined);
    setBonusGuessState('');

    const first: IPlacedWord | undefined = model.acrossWords[0] || model.downWords[0];
    setCursor(first ? { row: first.row, col: first.col } : undefined);
    setDirection(first ? first.direction : 'across');
  }, [model]);

  const cellAt = React.useCallback(
    (row: number, col: number): ICell | undefined => {
      if (row < 0 || col < 0 || row >= model.rows || col >= model.cols) { return undefined; }
      return model.cells[row][col];
    },
    [model]
  );

  const activeWord: IPlacedWord | undefined = React.useMemo(() => {
    if (!cursor) { return undefined; }
    const cell: ICell | undefined = cellAt(cursor.row, cursor.col);
    if (!cell) { return undefined; }
    const id: string | undefined =
      wordIdAt(cell, direction) || wordIdAt(cell, direction === 'across' ? 'down' : 'across');
    return id ? model.wordsById[id] : undefined;
  }, [cursor, direction, cellAt, model]);

  const activeWordKeys: { [key: string]: true } = React.useMemo(() => {
    const keys: { [key: string]: true } = {};
    if (activeWord) {
      for (let i: number = 0; i < activeWord.cells.length; i++) {
        keys[cellKey(activeWord.cells[i].row, activeWord.cells[i].col)] = true;
      }
    }
    return keys;
  }, [activeWord]);

  const isComplete: boolean = React.useMemo(() => {
    for (let i: number = 0; i < model.playableCells.length; i++) {
      const cell: ICell = model.playableCells[i];
      if (!entries[cellKey(cell.row, cell.col)]) { return false; }
    }
    return model.playableCells.length > 0;
  }, [entries, model]);

  /* --------------------------- navigation -------------------------- */

  const selectCell = React.useCallback(
    (row: number, col: number): void => {
      const cell: ICell | undefined = cellAt(row, col);
      if (!cell) { return; }

      const isSameCell: boolean = !!cursor && cursor.row === row && cursor.col === col;
      const hasBoth: boolean = !!cell.acrossWordId && !!cell.downWordId;

      if (isSameCell) {
        // Second click on a shared square flips to the vertical word.
        if (hasBoth) { setDirection(direction === 'across' ? 'down' : 'across'); }
        return;
      }

      setCursor({ row: row, col: col });
      // First click always lights up the horizontal word when there is one.
      setDirection(cell.acrossWordId ? 'across' : 'down');
    },
    [cellAt, cursor, direction]
  );

  const selectWord = React.useCallback(
    (wordId: string): void => {
      const word: IPlacedWord | undefined = model.wordsById[wordId];
      if (!word) { return; }
      setCursor({ row: word.row, col: word.col });
      setDirection(word.direction);
    },
    [model]
  );

  const toggleDirection = React.useCallback((): void => {
    if (!cursor) { return; }
    const cell: ICell | undefined = cellAt(cursor.row, cursor.col);
    if (!cell || !cell.acrossWordId || !cell.downWordId) { return; }
    setDirection(direction === 'across' ? 'down' : 'across');
  }, [cursor, cellAt, direction]);

  const indexInActiveWord = React.useCallback((): number => {
    if (!activeWord || !cursor) { return -1; }
    for (let i: number = 0; i < activeWord.cells.length; i++) {
      if (activeWord.cells[i].row === cursor.row && activeWord.cells[i].col === cursor.col) { return i; }
    }
    return -1;
  }, [activeWord, cursor]);

  const stepWithinWord = React.useCallback(
    (delta: number): void => {
      if (!activeWord) { return; }
      const index: number = indexInActiveWord();
      if (index < 0) { return; }
      const next: number = index + delta;
      if (next < 0 || next >= activeWord.cells.length) { return; }
      setCursor({ row: activeWord.cells[next].row, col: activeWord.cells[next].col });
    },
    [activeWord, indexInActiveWord]
  );

  const moveBy = React.useCallback(
    (rowDelta: number, colDelta: number): void => {
      if (!cursor) { return; }
      const wanted: Direction = rowDelta !== 0 ? 'down' : 'across';
      const cell: ICell | undefined = cellAt(cursor.row, cursor.col);

      // An arrow across the grain just re-orients the highlight first.
      if (cell && wanted !== direction && wordIdAt(cell, wanted)) {
        setDirection(wanted);
        return;
      }

      let row: number = cursor.row + rowDelta;
      let col: number = cursor.col + colDelta;
      while (row >= 0 && col >= 0 && row < model.rows && col < model.cols) {
        if (cellAt(row, col)) {
          setCursor({ row: row, col: col });
          return;
        }
        row += rowDelta;
        col += colDelta;
      }
    },
    [cursor, cellAt, direction, model]
  );

  const stepWord = React.useCallback(
    (delta: number): void => {
      const ordered: IPlacedWord[] = model.acrossWords.concat(model.downWords);
      if (ordered.length === 0) { return; }
      let index: number = 0;
      if (activeWord) {
        for (let i: number = 0; i < ordered.length; i++) {
          if (ordered[i].id === activeWord.id) { index = i; break; }
        }
      }
      selectWord(ordered[(index + delta + ordered.length) % ordered.length].id);
    },
    [model, activeWord, selectWord]
  );

  /* ----------------------------- typing ---------------------------- */

  const typeLetter = React.useCallback(
    (letter: string): void => {
      if (!cursor || stage !== 'grid' || dialog) { return; }
      const cell: ICell | undefined = cellAt(cursor.row, cursor.col);
      if (!cell) { return; }

      const value: string = letter.toUpperCase().charAt(0);
      if (!/[A-Z0-9]/.test(value)) { return; }

      setEntries((prev: { [key: string]: string }) => {
        const next: { [key: string]: string } = { ...prev };
        next[cellKey(cursor.row, cursor.col)] = value;
        return next;
      });
      setShowErrors(false);
      // Typing walks along whichever word is currently highlighted.
      stepWithinWord(1);
    },
    [cursor, cellAt, stepWithinWord, stage, dialog]
  );

  const backspace = React.useCallback((): void => {
    if (!cursor || stage !== 'grid' || dialog) { return; }
    const k: string = cellKey(cursor.row, cursor.col);
    setShowErrors(false);

    if (entries[k]) {
      setEntries((prev: { [key: string]: string }) => {
        const next: { [key: string]: string } = { ...prev };
        delete next[k];
        return next;
      });
      return;
    }

    const index: number = indexInActiveWord();
    stepWithinWord(-1);
    if (activeWord && index > 0) {
      const prevCell = activeWord.cells[index - 1];
      setEntries((prev: { [key: string]: string }) => {
        const next: { [key: string]: string } = { ...prev };
        delete next[cellKey(prevCell.row, prevCell.col)];
        return next;
      });
    }
  }, [cursor, entries, activeWord, stepWithinWord, indexInActiveWord, stage, dialog]);

  /* --------------------------- grid submit -------------------------- */

  const gradeGrid = React.useCallback((): { status: { [id: string]: WordStatus }; allCorrect: boolean } => {
    const status: { [id: string]: WordStatus } = {};
    let allCorrect: boolean = true;

    for (let i: number = 0; i < model.words.length; i++) {
      const word: IPlacedWord = model.words[i];
      let ok: boolean = true;
      for (let j: number = 0; j < word.cells.length; j++) {
        const entry: string = entries[cellKey(word.cells[j].row, word.cells[j].col)] || '';
        if (entry !== word.letters.charAt(j)) { ok = false; break; }
      }
      status[word.id] = ok ? 'correct' : 'incorrect';
      if (!ok) { allCorrect = false; }
    }

    return { status: status, allCorrect: allCorrect };
  }, [entries, model]);

  const submitGrid = React.useCallback((): void => {
    const graded = gradeGrid();
    setWordStatus(graded.status);

    if (graded.allCorrect) {
      setShowErrors(false);
      setStage('bonus');
      return;
    }

    setShowErrors(true);
    const used: number = attempts + 1;
    setAttempts(used);

    setDialog(gridFailureDialog(used, messages));
  }, [gradeGrid, attempts, messages]);

  const goToBonus = React.useCallback((): void => {
    setStage(model.bonus ? 'bonus' : 'done');
  }, [model]);

  /* --------------------------- bonus round -------------------------- */

  const setBonusGuess = React.useCallback((value: string): void => {
    setBonusGuessState(value);
  }, []);

  const submitBonus = React.useCallback((): void => {
    if (!model.bonus) { return; }

    if (normaliseAnswer(bonusGuess) === normaliseAnswer(model.bonus.answer)) {
      setDialog(bonusCorrectDialog(messages));
      return;
    }

    setDialog(bonusWrongDialog(messages));
  }, [bonusGuess, model, messages]);

  /* ---------------------------- dialogs ----------------------------- */

  const runDialog = React.useCallback(
    (action: DialogAction): void => {
      switch (action) {
        case 'close':
          setDialog(undefined);
          return;

        case 'gridTryAgain': {
          // Wipe only the letters that are wrong; keep everything they got right.
          const cleared = clearWrongEntries(entriesRef.current, model.playableCells as ICellSolution[]);
          setEntries(cleared.entries);
          const firstWrong: ICursor | undefined = cleared.firstCleared;

          // Drop the crosses, keep the ticks.
          setWordStatus((prev: { [id: string]: WordStatus }) => {
            const next: { [id: string]: WordStatus } = { ...prev };
            const ids: string[] = Object.keys(next);
            for (let i: number = 0; i < ids.length; i++) {
              if (next[ids[i]] === 'incorrect') { next[ids[i]] = 'unchecked'; }
            }
            return next;
          });

          setShowErrors(false);
          setDialog(undefined);
          if (firstWrong) {
            const target: ICursor = firstWrong;
            setCursor(target);
            const cell: ICell | undefined = cellAt(target.row, target.col);
            if (cell) { setDirection(cell.acrossWordId ? 'across' : 'down'); }
          }
          return;
        }

        case 'gridShowAnswer': {
          // Fill in the solution but leave `wordStatus` alone, so the ticks and
          // crosses still describe what the player actually typed.
          const solved: { [key: string]: string } = {};
          for (let i: number = 0; i < model.playableCells.length; i++) {
            const cell: ICell = model.playableCells[i];
            solved[cellKey(cell.row, cell.col)] = cell.solution;
          }
          setEntries(solved);
          setShowErrors(false);
          setStage('revealed');
          setDialog(undefined);
          return;
        }

        case 'giveUp':
          setDialog(giveUpDialog(messages));
          return;

        case 'revealBonusAnswer':
          setDialog(bonusRevealDialog(model.bonus ? model.bonus.answer : '', messages));
          return;

        case 'finish':
          setDialog(undefined);
          setStage('done');
          return;

        default:
          return;
      }
    },
    [model, messages, cellAt]
  );

  const reset = React.useCallback((): void => {
    setEntries({});
    setWordStatus(emptyStatus(model));
    setShowErrors(false);
    setStage('grid');
    setAttempts(0);
    setDialog(undefined);
    setBonusGuessState('');
    const first: IPlacedWord | undefined = model.acrossWords[0] || model.downWords[0];
    setCursor(first ? { row: first.row, col: first.col } : undefined);
    setDirection(first ? first.direction : 'across');
  }, [model]);

  return {
    model: model,
    entries: entries,
    cursor: cursor,
    direction: direction,
    activeWord: activeWord,
    activeWordKeys: activeWordKeys,
    wordStatus: wordStatus,
    showErrors: showErrors,
    isComplete: isComplete,
    canSubmit: isComplete && !dialog,
    stage: stage,
    attempts: attempts,
    retriesLeft: Math.max(0, maxGridAttempts - attempts),
    bonusGuess: bonusGuess,
    canSubmitBonus: normaliseAnswer(bonusGuess).length > 0 && !dialog,
    dialog: dialog,
    runDialog: runDialog,
    selectCell: selectCell,
    selectWord: selectWord,
    typeLetter: typeLetter,
    backspace: backspace,
    moveBy: moveBy,
    toggleDirection: toggleDirection,
    stepWord: stepWord,
    submitGrid: submitGrid,
    goToBonus: goToBonus,
    setBonusGuess: setBonusGuess,
    submitBonus: submitBonus,
    reset: reset
  };
}
