import type { CSSProperties } from 'react';
import sheet0 from '../assets/images/sheet0.png';
import sheet1 from '../assets/images/sheet1.png';
import sheet2 from '../assets/images/sheet2.png';

/**
 * Frame rects lifted directly from the original Construct 3 project's
 * data.json (each object type's animation frame list: sheet file + crop
 * rect), so every sprite renders from the exact same source pixels as the
 * original - packed sheets referenced via CSS background-position/size
 * rather than sliced into separate files.
 */
export interface AtlasFrame {
  sheet: string;
  naturalW: number;
  naturalH: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const SHEET0 = { file: sheet0, w: 1024, h: 2048 };
const SHEET1 = { file: sheet1, w: 128, h: 2048 };
const SHEET2 = { file: sheet2, w: 64, h: 128 };

function frame(sheet: typeof SHEET0, x: number, y: number, w: number, h: number): AtlasFrame {
  return { sheet: sheet.file, naturalW: sheet.w, naturalH: sheet.h, x, y, w, h };
}

/** cup_skin's 4 colour variants. */
export const CUP_FRAMES: AtlasFrame[] = [
  frame(SHEET0, 513, 1, 403, 500),
  frame(SHEET0, 1, 1025, 403, 500),
  frame(SHEET0, 513, 513, 403, 500),
  frame(SHEET0, 1, 1537, 403, 500),
];

export const SHADOW_FRAME = frame(SHEET0, 1, 513, 404, 500);
export const LOGO_LIGHT_FRAME = frame(SHEET0, 769, 1793, 241, 241);

/** ball's 5-frame idle animation. */
export const BALL_FRAMES: AtlasFrame[] = [
  frame(SHEET1, 1, 897, 120, 120),
  frame(SHEET1, 1, 1025, 120, 120),
  frame(SHEET1, 1, 1153, 120, 120),
  frame(SHEET1, 1, 1281, 120, 120),
  frame(SHEET1, 1, 1409, 120, 120),
];

export const LIGHT_BEAM_FRAME = frame(SHEET1, 123, 1, 4, 2000);
export const SCREEN_ICON_FRAME = frame(SHEET1, 1, 1793, 80, 80);
export const QTY_BADGE_FRAME = frame(SHEET1, 1, 1921, 80, 80);

/** btn_cupCount's 2 states (increase / at-max, or similar toggle). */
export const QTY_STEPPER_FRAMES: AtlasFrame[] = [frame(SHEET2, 1, 65, 40, 40), frame(SHEET2, 1, 1, 40, 40)];

/** CSS for a div that shows exactly one atlas frame, scaled to `displaySize` (defaults to the frame's own native size). */
export function frameStyle(f: AtlasFrame, displayW?: number, displayH?: number): CSSProperties {
  const w = displayW ?? f.w;
  const h = displayH ?? f.h;
  const scaleX = w / f.w;
  const scaleY = h / f.h;
  return {
    width: w,
    height: h,
    backgroundImage: `url(${f.sheet})`,
    backgroundPosition: `${-f.x * scaleX}px ${-f.y * scaleY}px`,
    backgroundSize: `${f.naturalW * scaleX}px ${f.naturalH * scaleY}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}
