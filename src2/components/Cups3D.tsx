import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CUP_COLOR_INDEX,
  CUP_DISPLAY_H,
  CUP_DISPLAY_W,
  CUP_ORIGIN_Y,
  CUP_Y,
  MAX_CUPS,
  MOVE_MS,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  slotX,
} from '../game/constants';
import { CUP_FRAMES, SHADOW_FRAME } from '../game/spriteAtlas';
import { frameTexture } from '../game/three/atlasTexture';
import type { SwapArc } from '../game/useCupsGame';

// How far a swapping cup swings toward/away from the viewer at the peak of
// its crossing - real depth, not a faked scale/z-index trick, so the
// browser's own perspective projection and depth buffer handle the visual
// scaling and front/behind sorting correctly and reliably (unlike CSS 3D
// transforms, which turned out to intermittently drop a cup entirely mid-
// crossing - a real browser compositing glitch, not fixable from here).
const SWAP_Z_PEAK = 55;
const LIFT_Y = 70;
const LIFT_TILT_RAD = (25 * Math.PI) / 180;

function worldX(px: number) {
  return px - STAGE_WIDTH / 2;
}
function worldY(px: number) {
  return STAGE_HEIGHT / 2 - px;
}
/** Matches game/constants.ts's EASE_SINE - the cubic-bezier there is itself an approximation of this. */
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

interface PosAnim {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  start: number;
  duration: number;
  /** Set only for a swap crossing - x/z follow a real semicircle instead of a straight lerp. */
  swap: null | { roleZ: 1 | -1 };
}

interface TiltAnim {
  from: number;
  to: number;
  start: number;
  duration: number;
}

interface Cups3DProps {
  cupCount: number;
  order: number[];
  liftedCupIds: number[];
  clickable: boolean;
  swapArc: SwapArc | null;
  onGuess: (position: number) => void;
}

/**
 * Renders the cups in a real WebGL 3D scene instead of DOM/CSS - swapping
 * cups travel through actual translateZ depth on the table's horizontal
 * plane (one arcing toward the viewer, the other away, in genuinely
 * opposite rotational directions), so perspective scaling and front/behind
 * depth-sorting come from the browser's real 3D pipeline rather than a
 * hand-faked scale()/z-index approximation - and, critically, without the
 * intermittent element-disappearing glitch that CSS `perspective` +
 * `transform-style: preserve-3d` compositing produced under active
 * animation.
 */
export function Cups3D({ cupCount, order, liftedCupIds, clickable, swapArc, onGuess }: Cups3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ cupCount, order, liftedCupIds, clickable, swapArc, onGuess });
  propsRef.current = { cupCount, order, liftedCupIds, clickable, swapArc, onGuess };

  const groupsRef = useRef<THREE.Group[]>([]);
  const bodiesRef = useRef<THREE.Mesh[]>([]);
  const posAnimRef = useRef<(PosAnim | null)[]>([]);
  const tiltAnimRef = useRef<(TiltAnim | null)[]>([]);
  const targetRef = useRef<{ x: number; y: number }[]>([]);
  const tiltTargetRef = useRef<number[]>([]);
  const lastSwapIdRef = useRef<number | null>(null);

  // One-time scene setup - the render loop and click handling live entirely
  // in here, reading the latest props via propsRef so this effect never
  // needs to re-run (and the scene never needs to be torn down/rebuilt) as
  // the game state changes.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // A perspective camera whose distance is chosen so the z=0 plane maps
    // 1:1 onto our existing STAGE_WIDTH x STAGE_HEIGHT pixel space - cups
    // at rest (z=0) render at exactly the same size/position as the old
    // 2D layout; only cups actively crossing (z != 0) get real perspective
    // scaling.
    const fovDeg = 45;
    const camDist = STAGE_HEIGHT / 2 / Math.tan((fovDeg / 2) * (Math.PI / 180));
    const camera = new THREE.PerspectiveCamera(fovDeg, STAGE_WIDTH / STAGE_HEIGHT, 10, camDist * 3);
    camera.position.set(0, 0, camDist);
    camera.lookAt(0, 0, 0);

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(STAGE_WIDTH, STAGE_HEIGHT, true);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    mount.appendChild(renderer.domElement);

    const shadowTex = frameTexture(SHADOW_FRAME);
    const bodyTex = frameTexture(CUP_FRAMES[CUP_COLOR_INDEX]);

    const shadowW = CUP_DISPLAY_W * 0.8;
    const shadowH = (SHADOW_FRAME.h / SHADOW_FRAME.w) * shadowW;
    const shadowGeom = new THREE.PlaneGeometry(shadowW, shadowH);
    const bodyGeom = new THREE.PlaneGeometry(CUP_DISPLAY_W, CUP_DISPLAY_H);

    const groups: THREE.Group[] = [];
    const bodies: THREE.Mesh[] = [];
    for (let cupId = 0; cupId < MAX_CUPS; cupId++) {
      const group = new THREE.Group();

      const shadowMesh = new THREE.Mesh(shadowGeom, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      // CSS anchored the shadow via `bottom: 6px` inside the cup's own box
      // (which itself sits CUP_ORIGIN_Y down from its top) - approximating
      // that same near-base placement here, relative to this group's
      // origin (the cup's anchor point, see bodyMesh below).
      shadowMesh.position.set(0, -(CUP_DISPLAY_H * (1 - CUP_ORIGIN_Y)) + shadowH / 2 + 6, -1);
      group.add(shadowMesh);

      const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshBasicMaterial({ map: bodyTex, transparent: true }));
      // The sprite's own anchor point sits CUP_ORIGIN_Y down from its top
      // edge (it "sits" on the table line rather than being centered) -
      // shifting the mesh up within the group cancels that out, so the
      // group's own origin IS that anchor point, matching how the old 2D
      // layout positioned the cup via `top = CUP_Y - H*ORIGIN_Y`.
      bodyMesh.position.set(0, CUP_DISPLAY_H * (CUP_ORIGIN_Y - 0.5), 0);
      group.add(bodyMesh);

      group.userData.cupId = cupId;
      scene.add(group);
      groups.push(group);
      bodies.push(bodyMesh);
    }
    groupsRef.current = groups;
    bodiesRef.current = bodies;
    posAnimRef.current = new Array(MAX_CUPS).fill(null);
    tiltAnimRef.current = new Array(MAX_CUPS).fill(null);
    targetRef.current = groups.map(() => ({ x: NaN, y: NaN }));
    tiltTargetRef.current = new Array(MAX_CUPS).fill(0);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function handleClick(ev: MouseEvent) {
      const { clickable: isClickable, order: currentOrder, cupCount: currentCount, onGuess: guess } = propsRef.current;
      if (!isClickable) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const visibleBodies = bodies.filter((_, id) => id < currentCount);
      const hits = raycaster.intersectObjects(visibleBodies, false);
      if (hits.length === 0) return;
      const hitCupId = (hits[0].object.parent as THREE.Group).userData.cupId as number;
      const position = currentOrder.indexOf(hitCupId);
      if (position >= 0) guess(position);
    }
    renderer.domElement.addEventListener('click', handleClick);

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const { cupCount: currentCount, clickable: isClickable } = propsRef.current;
      for (let cupId = 0; cupId < MAX_CUPS; cupId++) {
        const group = groups[cupId];
        group.visible = cupId < currentCount;
        if (!group.visible) continue;

        const pAnim = posAnimRef.current[cupId];
        if (pAnim) {
          const t = Math.min(1, (now - pAnim.start) / pAnim.duration);
          const p = easeInOutSine(t);
          if (pAnim.swap) {
            const { roleZ } = pAnim.swap;
            // Cosine-eased x, driven by the ACTUAL from->to distance (not
            // an assumed fixed SLOT_SPACING) - self-correcting even if
            // `fromX` wasn't exactly settled at its old slot when this
            // animation started (e.g. the previous swap's last rAF frame
            // hadn't painted p=1 yet when this one's setTimeout fired),
            // so it always lands exactly on target instead of the error
            // compounding across swaps.
            group.position.x = pAnim.fromX + (pAnim.toX - pAnim.fromX) * ((1 - Math.cos(p * Math.PI)) / 2);
            group.position.z = roleZ * SWAP_Z_PEAK * Math.sin(p * Math.PI);
          } else {
            group.position.x = pAnim.fromX + (pAnim.toX - pAnim.fromX) * p;
            group.position.z = pAnim.fromZ + (pAnim.toZ - pAnim.fromZ) * p;
          }
          group.position.y = pAnim.fromY + (pAnim.toY - pAnim.fromY) * p;
          if (t >= 1) posAnimRef.current[cupId] = null;
        }

        const tAnim = tiltAnimRef.current[cupId];
        const body = bodies[cupId];
        if (tAnim) {
          const t = Math.min(1, (now - tAnim.start) / tAnim.duration);
          const p = easeInOutSine(t);
          const lift = tAnim.from + (tAnim.to - tAnim.from) * p;
          body.position.y = CUP_DISPLAY_H * (CUP_ORIGIN_Y - 0.5) + lift * LIFT_Y;
          body.rotation.z = lift * -LIFT_TILT_RAD;
          if (t >= 1) tiltAnimRef.current[cupId] = null;
        }
      }
      renderer.domElement.style.cursor = isClickable ? 'pointer' : 'default';
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('click', handleClick);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          (obj.material as THREE.MeshBasicMaterial).dispose();
        }
      });
      bodyGeom.dispose();
      shadowGeom.dispose();
      bodyTex.dispose();
      shadowTex.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-target animations whenever the game state that drives cup position
  // or lift changes - starts each animation from wherever the cup's mesh
  // currently sits (not the old target), so an interrupted move smoothly
  // redirects instead of snapping. A swap is detected via swapArc.id
  // specifically (not just position), since the same cup can swap again
  // on the very next step and needs a fresh animation each time.
  useEffect(() => {
    const groups = groupsRef.current;
    if (groups.length === 0) return;
    const now = performance.now();

    const isNewSwap = swapArc != null && swapArc.id !== lastSwapIdRef.current;
    if (swapArc != null) lastSwapIdRef.current = swapArc.id;

    for (let cupId = 0; cupId < cupCount; cupId++) {
      const position = order.indexOf(cupId);
      const targetX = worldX(slotX(position, cupCount));
      const targetY = worldY(CUP_Y);
      const group = groups[cupId];
      const prevTarget = targetRef.current[cupId];

      const isOver = swapArc?.over === cupId;
      const isUnder = swapArc?.under === cupId;

      if ((isOver || isUnder) && isNewSwap) {
        const roleZ: 1 | -1 = isOver ? 1 : -1;
        posAnimRef.current[cupId] = {
          fromX: group.position.x,
          fromY: group.position.y,
          fromZ: group.position.z,
          toX: targetX,
          toY: targetY,
          toZ: 0,
          start: now,
          duration: MOVE_MS,
          swap: { roleZ },
        };
      } else if (!isOver && !isUnder && (targetX !== prevTarget.x || targetY !== prevTarget.y)) {
        posAnimRef.current[cupId] = {
          fromX: group.position.x,
          fromY: group.position.y,
          fromZ: group.position.z,
          toX: targetX,
          toY: targetY,
          toZ: 0,
          start: now,
          duration: MOVE_MS,
          swap: null,
        };
      }
      targetRef.current[cupId] = { x: targetX, y: targetY };

      const liftTarget = liftedCupIds.includes(cupId) ? 1 : 0;
      if (tiltTargetRef.current[cupId] !== liftTarget) {
        const body = bodiesRef.current[cupId];
        const currentLift = (body.position.y - CUP_DISPLAY_H * (CUP_ORIGIN_Y - 0.5)) / LIFT_Y;
        tiltAnimRef.current[cupId] = { from: currentLift, to: liftTarget, start: now, duration: MOVE_MS };
        tiltTargetRef.current[cupId] = liftTarget;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cupCount, order, liftedCupIds, swapArc]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
