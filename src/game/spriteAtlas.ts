import type { CSSProperties } from 'react';
import atlasImage from '../assets/images/CircusCharlieSheet1.gif';

/**
 * Pixel-exact frame rects lifted from the original Phaser build's atlas
 * definition (Preloader.js `botData`), all packed into the same single
 * sprite sheet image. Kept as one shared atlas (instead of slicing it into
 * separate files) so every sprite in the game renders from the exact same
 * source pixels as the original.
 */
export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ATLAS_IMAGE = atlasImage;

/** Natural (unscaled) dimensions of CircusCharlieSheet1.gif. */
export const ATLAS_NATURAL_WIDTH = 316;
export const ATLAS_NATURAL_HEIGHT = 352;

export const ATLAS_FRAMES = {
  clown0000: { x: 164, y: 5, w: 16, h: 24 },
  clown0001: { x: 185, y: 5, w: 16, h: 24 },
  clown0002: { x: 205, y: 5, w: 16, h: 24 },
  clownJump0003: { x: 226, y: 5, w: 16, h: 24 },
  clownStand0000: { x: 164, y: 58, w: 15, h: 24 },
  clownStandJump0000: { x: 182, y: 58, w: 15, h: 24 },
  clownburn0000: { x: 164, y: 32, w: 15, h: 24 },

  lion0000: { x: 234, y: 87, w: 33, h: 16 },
  lion0001: { x: 200, y: 87, w: 33, h: 16 },
  lion0002: { x: 164, y: 87, w: 33, h: 16 },
  lionburn0000: { x: 272, y: 87, w: 33, h: 16 },

  firepot0000: { x: 221, y: 194, w: 24, h: 31 },
  firepot0001: { x: 195, y: 194, w: 24, h: 31 },

  firecirclel0000: { x: 136, y: 145, w: 12, h: 80 },
  firecirclel0001: { x: 165, y: 145, w: 12, h: 80 },
  firecircler0000: { x: 148, y: 145, w: 12, h: 80 },
  firecircler0001: { x: 177, y: 145, w: 12, h: 80 },

  endLevel1: { x: 129, y: 243, w: 37, h: 22 },

  walkBalance0: { x: 164, y: 5, w: 16, h: 24 },
  walkBalance1: { x: 185, y: 5, w: 15, h: 24 },
  walkBalance2: { x: 205, y: 5, w: 16, h: 24 },
  jumpBalance: { x: 226, y: 7, w: 16, h: 22 },

  monkey0: { x: 78, y: 106, w: 16, h: 16 },
  monkey1: { x: 98, y: 106, w: 16, h: 16 },
  monkey2: { x: 118, y: 106, w: 17, h: 16 },
} as const satisfies Record<string, AtlasFrame>;

export type FrameName = keyof typeof ATLAS_FRAMES;

/** CSS for a div that shows exactly one atlas frame at the given display scale. */
export function frameStyle(name: FrameName, scale: number): CSSProperties {
  const f = ATLAS_FRAMES[name];
  return {
    width: f.w * scale,
    height: f.h * scale,
    backgroundImage: `url(${ATLAS_IMAGE})`,
    backgroundPosition: `${-f.x * scale}px ${-f.y * scale}px`,
    backgroundSize: `${ATLAS_NATURAL_WIDTH * scale}px ${ATLAS_NATURAL_HEIGHT * scale}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}
