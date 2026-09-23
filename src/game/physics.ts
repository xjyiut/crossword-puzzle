import type { Rect } from './types';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
}

/** Integrates gravity + vertical velocity for one frame, clamping to the ground line. */
export function applyGravity(body: Body, gravity: number, groundY: number, dtSec: number) {
  body.vy += gravity * dtSec;
  body.y += body.vy * dtSec;
  if (body.y >= groundY) {
    body.y = groundY;
    body.vy = 0;
    body.onGround = true;
  } else {
    body.onGround = false;
  }
}

export function bodyRect(body: Body): Rect {
  return { left: body.x, top: body.y, right: body.x + body.width, bottom: body.y + body.height };
}

/** Shrinks a rect symmetrically - handy for a slightly-forgiving hitbox versus the full sprite size. */
export function inset(rect: Rect, dx: number, dy: number): Rect {
  return { left: rect.left + dx, right: rect.right - dx, top: rect.top + dy, bottom: rect.bottom - dy };
}
