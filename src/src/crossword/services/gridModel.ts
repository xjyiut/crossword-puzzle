import type {
  Direction,
  IBonusDefinition,
  IBonusLetterRef,
  ICrosswordDefinition
} from '../models/ICrossword';
import type { AdjacencyMode, ILayoutResult, IPlacedWord } from './layoutEngine';
import { buildLayout, normaliseAnswer } from './layoutEngine';

/**
 * Turns the raw JSON into everything the UI needs: a rectangular matrix of
 * squares, the two clue lists and the bonus metadata. Rebuilt automatically
 * whenever the JSON changes.
 */

export interface ICell {
  row: number;
  col: number;
  /** The correct letter for this square. */
  solution: string;
  /** Number printed in the corner, if a word starts here. */
  number?: number;
  acrossWordId?: string;
  acrossIndex?: number;
  downWordId?: string;
  downIndex?: number;
  /** Circled square feeding the bonus answer. */
  bonusOrder?: number;
}

export interface IBonusModel extends IBonusDefinition {
  /** Circled letters in reading order, as they appear on the grid. */
  gridLetters: string[];
}

export interface IGridModel {
  title: string;
  subtitle?: string;
  rows: number;
  cols: number;
  /** Which rule set the layout engine used. */
  layoutMode: AdjacencyMode;
  /** `null` = blank / blue square. */
  cells: (ICell | null)[][];
  words: IPlacedWord[];
  acrossWords: IPlacedWord[];
  downWords: IPlacedWord[];
  wordsById: { [id: string]: IPlacedWord };
  /** Every playable square, flattened. Handy for "is the grid full?" checks. */
  playableCells: ICell[];
  bonus?: IBonusModel;
  /** Non-fatal problems found in the JSON, surfaced in the UI during dev. */
  warnings: string[];
}

export const cellKey = (row: number, col: number): string => row + '|' + col;

export function buildGridModel(definition: ICrosswordDefinition): IGridModel {
  const layout: ILayoutResult = buildLayout(definition);
  const warnings: string[] = layout.notes.slice();

  for (let i: number = 0; i < layout.unplaced.length; i++) {
    warnings.push('Could not fit "' + layout.unplaced[i].id + '" into the grid.');
  }

  const cells: (ICell | null)[][] = [];
  for (let r: number = 0; r < layout.rows; r++) {
    const row: (ICell | null)[] = [];
    for (let c: number = 0; c < layout.cols; c++) { row.push(null); }
    cells.push(row);
  }

  const wordsById: { [id: string]: IPlacedWord } = {};

  for (let w: number = 0; w < layout.words.length; w++) {
    const word: IPlacedWord = layout.words[w];
    wordsById[word.id] = word;

    for (let i: number = 0; i < word.cells.length; i++) {
      const ref = word.cells[i];
      let cell: ICell | null = cells[ref.row][ref.col];

      if (!cell) {
        cell = { row: ref.row, col: ref.col, solution: word.letters.charAt(i) };
        cells[ref.row][ref.col] = cell;
      }

      if (word.direction === 'across') {
        cell.acrossWordId = word.id;
        cell.acrossIndex = i;
      } else {
        cell.downWordId = word.id;
        cell.downIndex = i;
      }

      if (i === 0) {
        cell.number = cell.number === undefined ? word.number : Math.min(cell.number, word.number);
      }
    }
  }

  /* ------------------------------ bonus ---------------------------- */

  let bonus: IBonusModel | undefined;
  if (definition.bonus && definition.bonus.enabled) {
    const source: IBonusDefinition = definition.bonus;
    const gridLetters: string[] = [];

    for (let i: number = 0; i < source.letters.length; i++) {
      const ref: IBonusLetterRef = source.letters[i];
      const word: IPlacedWord | undefined = wordsById[ref.wordId];

      if (!word) {
        warnings.push('Bonus letter references unknown word "' + ref.wordId + '".');
        continue;
      }
      if (ref.letterIndex < 0 || ref.letterIndex >= word.letters.length) {
        warnings.push(
          'Bonus letter index ' + ref.letterIndex + ' is out of range for "' + ref.wordId + '".'
        );
        continue;
      }

      const target = word.cells[ref.letterIndex];
      const cell: ICell | null = cells[target.row][target.col];
      if (!cell) { continue; }

      cell.bonusOrder = gridLetters.length;
      gridLetters.push(cell.solution);
    }

    const combined: string = normaliseAnswer(gridLetters.join('') + (source.extraLetters || []).join(''));
    const expected: string = normaliseAnswer(source.answer);
    if (combined.split('').sort().join('') !== expected.split('').sort().join('')) {
      warnings.push(
        'Bonus letters "' + combined + '" are not an anagram of the expected answer "' + expected + '".'
      );
    }

    bonus = { ...source, gridLetters: gridLetters };
  }

  const playableCells: ICell[] = [];
  for (let r: number = 0; r < layout.rows; r++) {
    for (let c: number = 0; c < layout.cols; c++) {
      const cell: ICell | null = cells[r][c];
      if (cell) { playableCells.push(cell); }
    }
  }

  const acrossWords: IPlacedWord[] = layout.words
    .filter((w: IPlacedWord) => w.direction === 'across')
    .sort((a: IPlacedWord, b: IPlacedWord) => a.number - b.number);

  const downWords: IPlacedWord[] = layout.words
    .filter((w: IPlacedWord) => w.direction === 'down')
    .sort((a: IPlacedWord, b: IPlacedWord) => a.number - b.number);

  return {
    title: definition.title,
    subtitle: definition.subtitle,
    rows: layout.rows,
    cols: layout.cols,
    layoutMode: layout.layoutMode,
    cells: cells,
    words: layout.words,
    acrossWords: acrossWords,
    downWords: downWords,
    wordsById: wordsById,
    playableCells: playableCells,
    bonus: bonus,
    warnings: warnings
  };
}

export function wordIdAt(cell: ICell, direction: Direction): string | undefined {
  return direction === 'across' ? cell.acrossWordId : cell.downWordId;
}

export function indexAt(cell: ICell, direction: Direction): number | undefined {
  return direction === 'across' ? cell.acrossIndex : cell.downIndex;
}
