export type SceneName = 'MainMenu' | 'Prestage' | 'Stage1' | 'Stage2';

export type GameResult = 'GAME OVER' | 'YOU WIN!' | null;

export interface Checkpoint {
  stage: 1 | 2;
  x: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
