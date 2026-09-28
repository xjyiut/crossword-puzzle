import * as THREE from 'three';
import type { AtlasFrame } from '../spriteAtlas';

const loader = new THREE.TextureLoader();
const baseTextureCache = new Map<string, THREE.Texture>();

function baseTexture(sheetUrl: string): THREE.Texture {
  let tex = baseTextureCache.get(sheetUrl);
  if (!tex) {
    tex = loader.load(sheetUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    baseTextureCache.set(sheetUrl, tex);
  }
  return tex;
}

/**
 * One atlas frame as its own Texture, cropped via offset/repeat - clones the
 * shared sheet image rather than loading it again, since offset/repeat are
 * per-Texture properties and every frame needs its own independent crop.
 * Three's UV space is bottom-up (V=0 at the image's bottom row once
 * flipY's default upload flip is accounted for), unlike the frame rects
 * here which are top-down CSS/Construct pixel rects - hence the
 * `naturalH - y - h` flip when computing the V offset.
 */
export function frameTexture(f: AtlasFrame): THREE.Texture {
  const tex = baseTexture(f.sheet).clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.offset.set(f.x / f.naturalW, (f.naturalH - f.y - f.h) / f.naturalH);
  tex.repeat.set(f.w / f.naturalW, f.h / f.naturalH);
  return tex;
}
