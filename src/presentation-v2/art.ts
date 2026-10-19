import type { RequestKind, HammerMode } from '../core-v2/index.js';
import { element } from '../presentation/dom.js';

export const D_ASSETS = ['forge-backdrop-v2','hammer-light-v1','hammer-standard-v1','hammer-heavy-v1','portraits-v1','water-v1','oil-v1','metal-atlas-v1','commission-guard-v2'] as const;
export const artPath = (name: string) => `/assets/d/${name}.webp`;
export const hammerPath = (mode: HammerMode) => artPath(`hammer-${mode}-v1`);
export const portraitIndex = (kind: RequestKind | 'merchant' | null) => kind === 'merchant' ? 3 : kind === 'ceremony' ? 2 : kind === 'guard' || kind === 'protector' || kind === 'duelist' ? 1 : 0;
export function portrait(index: number, className = '') {
  const node = element('span', undefined, `d-portrait portrait-${index} ${className}`);
  node.setAttribute('aria-hidden','true');return node;
}
/** Load each complete export once; no creative processing or per-frame work. */
export function loadDArt(ready: () => void, problem: (name: string) => void) {
  let disposed = false;
  const images = new Map<string, HTMLImageElement>();
  for (const name of D_ASSETS) {
    const image = new Image();images.set(name,image);
    image.onload = () => { if (!disposed) ready(); };
    image.onerror = () => { if (!disposed) problem(name); };
    image.src = artPath(name);
  }
  return {
    texture: () => { const image = images.get('metal-atlas-v1');return image?.complete && image.naturalWidth > 0 ? image : undefined; },
    dispose() { disposed = true;for (const image of images.values()) { image.onload = null;image.onerror = null; } },
  };
}
