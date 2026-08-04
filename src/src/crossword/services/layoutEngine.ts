import type { Direction, ICrosswordDefinition, ICrosswordOptions, IWordDefinition } from '../models/ICrossword';

/* ------------------------------------------------------------------ *
 * Automatic crossword layout
 *
 * Given a bag of words + their declared axis, work out where each word
 * physically sits so that:
 *   - every word (after the first) crosses at least one other word
 *   - crossing letters match
 *   - no two parallel words ever end up glued side by side
 *   - no word is accidentally extended by a neighbour
 *
 * Words that carry explicit `row`/`col` in the JSON are pinned first and
 * everything else is fitted around them. Remove the coordinates from the
 * JSON and the whole grid is generated from scratch.
 * ------------------------------------------------------------------ */

export interface ICellRef {
  row: number;
  col: number;
}

export interface IPlacedWord {
  id: string;
  clue: string;
  /** Original answer text, e.g. "ON IT". */
  answer: string;
  /** Grid letters, e.g. "ONIT". */
  letters: string;
  direction: Direction;
  row: number;
  col: number;
  /** Number rendered in the clue list and in the first square. */
  number: number;
  cells: ICellRef[];
  /** Was this word pinned in the JSON rather than auto-placed? */
  pinned: boolean;
}

export type AdjacencyMode = 'strict' | 'relaxed';

export interface ILayoutResult {
  words: IPlacedWord[];
  /** Words the engine could not fit. Should normally be empty. */
  unplaced: IWordDefinition[];
  /** Recoverable data problems (bad pins, duplicate ids, stub answers). */
  notes: string[];
  rows: number;
  cols: number;
  /** Which rule set actually produced this grid. */
  layoutMode: AdjacencyMode;
}

interface ICandidateWord {
  def: IWordDefinition;
  direction: Direction;
  letters: string;
  /** Position in the JSON (across list, then down list). Drives numbering. */
  order: number;
  pinned: boolean;
}

interface IPlacement {
  row: number;
  col: number;
  direction: Direction;
  score: number;
}

const DEFAULTS: Required<ICrosswordOptions> = {
  numbering: 'clueOrder',
  padding: 0,
  layoutAttempts: 300,
  seed: 1,
  allowDirectionFlip: false,
  adjacency: 'auto'
};

/** Strip anything that is not a letter or digit and upper-case it. */
export function normaliseAnswer(answer: string): string {
  return answer.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const key = (row: number, col: number): string => row + '|' + col;

/* ---------------------------- the board ---------------------------- */

class Board {
  public letters: Map<string, string> = new Map<string, string>();
  public axes: Map<string, number> = new Map<string, number>(); // bitmask: 1 across, 2 down
  public minRow: number = Number.POSITIVE_INFINITY;
  public maxRow: number = Number.NEGATIVE_INFINITY;
  public minCol: number = Number.POSITIVE_INFINITY;
  public maxCol: number = Number.NEGATIVE_INFINITY;

  public get isEmpty(): boolean {
    return this.letters.size === 0;
  }

  public letterAt(row: number, col: number): string | undefined {
    return this.letters.get(key(row, col));
  }

  public hasAxis(row: number, col: number, direction: Direction): boolean {
    const mask: number = this.axes.get(key(row, col)) || 0;
    return (mask & (direction === 'across' ? 1 : 2)) !== 0;
  }

  public clone(): Board {
    const next: Board = new Board();
    next.letters = new Map<string, string>(this.letters);
    next.axes = new Map<string, number>(this.axes);
    next.minRow = this.minRow;
    next.maxRow = this.maxRow;
    next.minCol = this.minCol;
    next.maxCol = this.maxCol;
    return next;
  }

  public commit(letters: string, row: number, col: number, direction: Direction): void {
    for (let i: number = 0; i < letters.length; i++) {
      const r: number = direction === 'down' ? row + i : row;
      const c: number = direction === 'across' ? col + i : col;
      const k: string = key(r, c);
      this.letters.set(k, letters.charAt(i));
      this.axes.set(k, (this.axes.get(k) || 0) | (direction === 'across' ? 1 : 2));
      if (r < this.minRow) { this.minRow = r; }
      if (r > this.maxRow) { this.maxRow = r; }
      if (c < this.minCol) { this.minCol = c; }
      if (c > this.maxCol) { this.maxCol = c; }
    }
  }

  /**
   * @param strict when true the word must also keep clear of parallel
   *        neighbours. Auto-placed words are validated strictly; words the
   *        author pinned by hand are not, because a hand-built puzzle is
   *        allowed to stack entries into a solid block (as the source puzzle
   *        does with COACH / INSHA / VITE / ITEE).
   * @returns number of crossings if the word may legally sit here, else -1.
   */
  public evaluate(letters: string, row: number, col: number, direction: Direction, strict: boolean): number {
    const dr: number = direction === 'down' ? 1 : 0;
    const dc: number = direction === 'across' ? 1 : 0;

    // The square immediately before and after the word must stay blank,
    // otherwise we would silently lengthen an existing entry.
    if (this.letterAt(row - dr, col - dc) !== undefined) { return -1; }
    if (this.letterAt(row + dr * letters.length, col + dc * letters.length) !== undefined) { return -1; }

    let crossings: number = 0;

    for (let i: number = 0; i < letters.length; i++) {
      const r: number = row + dr * i;
      const c: number = col + dc * i;
      const existing: string | undefined = this.letterAt(r, c);

      if (existing !== undefined) {
        if (existing !== letters.charAt(i)) { return -1; }
        // Never overlap a word running on the same axis -- that is a merge,
        // not a crossing.
        if (this.hasAxis(r, c, direction)) { return -1; }
        crossings++;
      } else if (strict) {
        // A brand-new square may not touch anything sideways, or we create
        // an unintended two-letter word next to the entry.
        const sideA: string | undefined = this.letterAt(r - dc, c - dr);
        const sideB: string | undefined = this.letterAt(r + dc, c + dr);
        if (sideA !== undefined || sideB !== undefined) { return -1; }
      }
    }

    return crossings;
  }
}

/* --------------------------- placement ----------------------------- */

function mulberry32(seed: number): () => number {
  let a: number = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t: number = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const copy: T[] = items.slice();
  for (let i: number = copy.length - 1; i > 0; i--) {
    const j: number = Math.floor(rand() * (i + 1));
    const tmp: T = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function growth(board: Board, row: number, col: number, len: number, direction: Direction): number {
  const endRow: number = direction === 'down' ? row + len - 1 : row;
  const endCol: number = direction === 'across' ? col + len - 1 : col;
  const height: number = Math.max(board.maxRow, endRow) - Math.min(board.minRow, row);
  const width: number = Math.max(board.maxCol, endCol) - Math.min(board.minCol, col);
  // Penalise long thin grids as well as raw area.
  return height * width + Math.abs(height - width) * 2;
}

function bestPlacement(
  board: Board,
  letters: string,
  directions: Direction[],
  strict: boolean
): IPlacement | undefined {
  let best: IPlacement | undefined;

  board.letters.forEach((boardLetter: string, k: string) => {
    const parts: string[] = k.split('|');
    const anchorRow: number = parseInt(parts[0], 10);
    const anchorCol: number = parseInt(parts[1], 10);

    for (let d: number = 0; d < directions.length; d++) {
      const direction: Direction = directions[d];
      for (let i: number = 0; i < letters.length; i++) {
        if (letters.charAt(i) !== boardLetter) { continue; }

        const row: number = direction === 'down' ? anchorRow - i : anchorRow;
        const col: number = direction === 'across' ? anchorCol - i : anchorCol;

        const crossings: number = board.evaluate(letters, row, col, direction, strict);
        if (crossings < 1) { continue; }

        const score: number = crossings * 1000 - growth(board, row, col, letters.length, direction);
        if (!best || score > best.score) {
          best = { row: row, col: col, direction: direction, score: score };
        }
      }
    }
  });

  return best;
}

function attemptLayout(
  pinned: ICandidateWord[],
  free: ICandidateWord[],
  allowFlip: boolean,
  strict: boolean
): { board: Board; placed: Map<string, IPlacement> } | undefined {
  const board: Board = new Board();
  const placed: Map<string, IPlacement> = new Map<string, IPlacement>();

  // 1. Honour every pinned word exactly as authored. Conflicting pins were
  //    already demoted to the free pool by `validatePins`, so these all fit.
  for (let i: number = 0; i < pinned.length; i++) {
    const word: ICandidateWord = pinned[i];
    const row: number = word.def.row as number;
    const col: number = word.def.col as number;
    board.commit(word.letters, row, col, word.direction);
    placed.set(word.def.id, { row: row, col: col, direction: word.direction, score: 0 });
  }

  // 2. Fit the rest around them, longest first within the given ordering.
  //    A word that has nowhere to go yet is deferred rather than failing the
  //    whole attempt: Down words can only hang off Across words (and vice
  //    versa), so the first pass often has to lay the groundwork before the
  //    remaining words have anything to cross.
  let remaining: ICandidateWord[] = free.slice();

  while (remaining.length > 0) {
    const deferred: ICandidateWord[] = [];
    let progressed: boolean = false;

    for (let i: number = 0; i < remaining.length; i++) {
      const word: ICandidateWord = remaining[i];

      if (board.isEmpty) {
        board.commit(word.letters, 0, 0, word.direction);
        placed.set(word.def.id, { row: 0, col: 0, direction: word.direction, score: 0 });
        progressed = true;
        continue;
      }

      const directions: Direction[] = allowFlip
        ? [word.direction, word.direction === 'across' ? 'down' : 'across']
        : [word.direction];

      const spot: IPlacement | undefined = bestPlacement(board, word.letters, directions, strict);
      if (!spot) {
        deferred.push(word);
        continue;
      }

      board.commit(word.letters, spot.row, spot.col, spot.direction);
      placed.set(word.def.id, spot);
      progressed = true;
    }

    if (!progressed) { return undefined; }
    remaining = deferred;
  }

  return { board: board, placed: placed };
}

/* --------------------------- numbering ----------------------------- */

function assignNumbers(words: IPlacedWord[], mode: 'clueOrder' | 'standard', order: Map<string, number>): void {
  if (mode === 'clueOrder') {
    for (let i: number = 0; i < words.length; i++) {
      words[i].number = (order.get(words[i].id) as number) + 1;
    }
    return;
  }

  const sorted: IPlacedWord[] = words.slice().sort((a: IPlacedWord, b: IPlacedWord) => {
    if (a.row !== b.row) { return a.row - b.row; }
    if (a.col !== b.col) { return a.col - b.col; }
    return a.direction === b.direction ? 0 : a.direction === 'across' ? -1 : 1;
  });

  let next: number = 1;
  const seen: Map<string, number> = new Map<string, number>();
  for (let i: number = 0; i < sorted.length; i++) {
    const k: string = key(sorted[i].row, sorted[i].col);
    let n: number | undefined = seen.get(k);
    if (n === undefined) {
      n = next++;
      seen.set(k, n);
    }
    sorted[i].number = n;
  }
}

/* ------------------------------ api -------------------------------- */

export function buildLayout(definition: ICrosswordDefinition): ILayoutResult {
  const options: Required<ICrosswordOptions> = { ...DEFAULTS, ...(definition.options || {}) };

  const order: Map<string, number> = new Map<string, number>();
  const candidates: ICandidateWord[] = [];

  /*
   * Bad data is reported, never thrown. This engine runs inside a React
   * `useMemo`, so a thrown error would take the whole component tree down and
   * leave a blank page -- a miserable way to find out you fat-fingered an
   * answer. Everything recoverable becomes a note and the puzzle still draws.
   */
  const notes: string[] = [];

  const collect = (defs: IWordDefinition[], direction: Direction): void => {
    for (let i: number = 0; i < defs.length; i++) {
      const def: IWordDefinition = defs[i];
      const letters: string = normaliseAnswer(def.answer);

      if (letters.length < 2) {
        notes.push('"' + def.id + '" needs at least two letters - skipped.');
        continue;
      }
      if (order.has(def.id)) {
        notes.push('Duplicate word id "' + def.id + '" - only the first one is used.');
        continue;
      }

      order.set(def.id, candidates.length);
      candidates.push({
        def: def,
        direction: direction,
        letters: letters,
        order: candidates.length,
        pinned: typeof def.row === 'number' && typeof def.col === 'number'
      });
    }
  };

  collect(definition.across || [], 'across');
  collect(definition.down || [], 'down');

  /*
   * Check the hand-authored coordinates against each other before we rely on
   * them. A pin that collides with an earlier one (easily done by editing an
   * answer without touching its row/col) is demoted to the free pool and
   * placed automatically instead of blowing up.
   */
  const pinned: ICandidateWord[] = [];
  const free: ICandidateWord[] = [];
  const probe: Board = new Board();

  for (let i: number = 0; i < candidates.length; i++) {
    const word: ICandidateWord = candidates[i];

    if (!word.pinned) {
      free.push(word);
      continue;
    }

    const row: number = word.def.row as number;
    const col: number = word.def.col as number;

    if (probe.evaluate(word.letters, row, col, word.direction, false) < 0) {
      notes.push(
        '"' + word.def.id + '" (' + word.letters + ') is pinned to row ' + row + ', col ' + col +
        ' but collides with a word already placed there - positioning it automatically instead.'
      );
      word.pinned = false;
      free.push(word);
      continue;
    }

    probe.commit(word.letters, row, col, word.direction);
    pinned.push(word);
  }

  // Longest first is the single biggest win for greedy crossword packing.
  const byLength: ICandidateWord[] = free.slice().sort(
    (a: ICandidateWord, b: ICandidateWord) => b.letters.length - a.letters.length
  );

  const attempts: number = Math.max(1, options.layoutAttempts);

  /*
   * Escalating strategies. We only loosen the rules when the previous, tighter
   * strategy could not fit every word, so a well-behaved word list still gets
   * a classic newspaper-style grid.
   */
  const plans: Array<{ mode: AdjacencyMode; flip: boolean }> = [];
  if (options.adjacency === 'auto') {
    plans.push({ mode: 'strict', flip: options.allowDirectionFlip });
    plans.push({ mode: 'relaxed', flip: options.allowDirectionFlip });
    if (!options.allowDirectionFlip) {
      // Last resort: let words move to the other axis. Lop-sided word lists
      // (e.g. 3 Across vs 8 Down) simply cannot be fitted otherwise.
      plans.push({ mode: 'relaxed', flip: true });
    }
  } else {
    plans.push({ mode: options.adjacency, flip: options.allowDirectionFlip });
  }

  let winner: { board: Board; placed: Map<string, IPlacement> } | undefined;
  let winnerArea: number = Number.POSITIVE_INFINITY;
  // Pinned words bypass the strict adjacency rule, so a puzzle that carries
  // hand-authored coordinates is reported as 'relaxed'.
  let layoutMode: AdjacencyMode = pinned.length > 0 ? 'relaxed' : plans[0].mode;

  for (let m: number = 0; m < plans.length && !winner; m++) {
    const strict: boolean = plans[m].mode === 'strict';
    const rand: () => number = mulberry32(options.seed);

    for (let attempt: number = 0; attempt < attempts; attempt++) {
      const ordering: ICandidateWord[] = attempt === 0 ? byLength : shuffled(byLength, rand);
      const result: { board: Board; placed: Map<string, IPlacement> } | undefined =
        attemptLayout(pinned, ordering, plans[m].flip, strict);

      if (!result) { continue; }

      const area: number =
        (result.board.maxRow - result.board.minRow + 1) * (result.board.maxCol - result.board.minCol + 1);
      if (area < winnerArea) {
        winner = result;
        winnerArea = area;
        layoutMode = pinned.length > 0 ? 'relaxed' : plans[m].mode;
      }
      // A fully pinned puzzle is deterministic -- no point re-rolling.
      if (free.length === 0) { break; }
    }
  }

  // Last resort: place what we can and report the rest instead of throwing.
  const unplaced: IWordDefinition[] = [];
  if (!winner) {
    const board: Board = new Board();
    const placed: Map<string, IPlacement> = new Map<string, IPlacement>();
    for (let i: number = 0; i < pinned.length; i++) {
      const w: ICandidateWord = pinned[i];
      board.commit(w.letters, w.def.row as number, w.def.col as number, w.direction);
      placed.set(w.def.id, { row: w.def.row as number, col: w.def.col as number, direction: w.direction, score: 0 });
    }
    let leftovers: ICandidateWord[] = byLength.slice();
    let progressed: boolean = true;
    while (leftovers.length > 0 && progressed) {
      const deferred: ICandidateWord[] = [];
      progressed = false;
      for (let i: number = 0; i < leftovers.length; i++) {
        const w: ICandidateWord = leftovers[i];
        if (board.isEmpty) {
          board.commit(w.letters, 0, 0, w.direction);
          placed.set(w.def.id, { row: 0, col: 0, direction: w.direction, score: 0 });
          progressed = true;
          continue;
        }
        const spot: IPlacement | undefined = bestPlacement(
          board,
          w.letters,
          [w.direction, w.direction === 'across' ? 'down' : 'across'],
          false
        );
        if (!spot) {
          deferred.push(w);
          continue;
        }
        board.commit(w.letters, spot.row, spot.col, spot.direction);
        placed.set(w.def.id, spot);
        progressed = true;
      }
      leftovers = deferred;
    }
    for (let i: number = 0; i < leftovers.length; i++) { unplaced.push(leftovers[i].def); }
    winner = { board: board, placed: placed };
    layoutMode = 'relaxed';
  }

  const board: Board = winner.board;
  const padding: number = Math.max(0, options.padding);
  const rowShift: number = padding - board.minRow;
  const colShift: number = padding - board.minCol;

  const words: IPlacedWord[] = [];
  for (let i: number = 0; i < candidates.length; i++) {
    const candidate: ICandidateWord = candidates[i];
    const spot: IPlacement | undefined = winner.placed.get(candidate.def.id);
    if (!spot) { continue; }

    const row: number = spot.row + rowShift;
    const col: number = spot.col + colShift;
    const cells: ICellRef[] = [];
    for (let j: number = 0; j < candidate.letters.length; j++) {
      cells.push({
        row: spot.direction === 'down' ? row + j : row,
        col: spot.direction === 'across' ? col + j : col
      });
    }

    words.push({
      id: candidate.def.id,
      clue: candidate.def.clue,
      answer: candidate.def.answer,
      letters: candidate.letters,
      direction: spot.direction,
      row: row,
      col: col,
      number: 0,
      cells: cells,
      pinned: candidate.pinned
    });
  }

  assignNumbers(words, options.numbering, order);

  return {
    words: words,
    unplaced: unplaced,
    notes: notes,
    rows: board.maxRow - board.minRow + 1 + padding * 2,
    cols: board.maxCol - board.minCol + 1 + padding * 2,
    layoutMode: layoutMode
  };
}
