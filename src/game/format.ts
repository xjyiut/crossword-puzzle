/** Zero-pads a non-negative integer to a fixed width, e.g. pad(42, 6) -> "000042". */
export function pad(n: number, width: number): string {
  const s = String(Math.max(0, Math.floor(n)));
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

/** Formats elapsed milliseconds as "m:ss", e.g. formatTime(125_000) -> "2:05". */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${pad(seconds, 2)}`;
}
