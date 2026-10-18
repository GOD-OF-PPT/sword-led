export interface Point { readonly x: number; readonly y: number }
export interface Rect extends Point { readonly w: number; readonly h: number }
export type ArtId = 'workshop' | 'anvil' | 'hammer-light' | 'hammer-standard' | 'hammer-heavy' | 'iron' | 'steel' | 'meteorite' | 'merchant-kit';
export interface ArtFrame { readonly tier: number; readonly sourceRect: Rect; readonly visibleBounds: Rect; readonly anchor: Point }
export interface ArtAsset {
  readonly id: ArtId; readonly src: string; readonly width: number; readonly height: number;
  readonly visibleBounds: Rect; readonly anchor: Point; readonly pivot: Point; readonly strike: Point; readonly frames: readonly ArtFrame[];
}
export interface ArtStage {
  readonly width: number; readonly height: number; readonly contact: Point; readonly anvilWidth: number; readonly pieceWidth: number;
  readonly hammerWidths: { readonly light: number; readonly standard: number; readonly heavy: number };
  readonly idleAngle: number; readonly impactHeightRatio: number;
}
export interface ArtBundle { readonly stage: ArtStage; readonly assets: ReadonlyMap<ArtId, ArtAsset>; readonly images: ReadonlyMap<ArtId, HTMLImageElement> }

const IDS: readonly ArtId[] = ['workshop', 'anvil', 'hammer-light', 'hammer-standard', 'hammer-heavy', 'iron', 'steel', 'meteorite', 'merchant-kit'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const record = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error('美术清单格式不正确');
  return value;
};
const number = (value: unknown): number => { if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100000) throw new Error('美术尺寸不正确');return value; };
const point = (value: unknown): Point => { const data = record(value);return { x: number(data.x), y: number(data.y) }; };
const rectangle = (value: unknown): Rect => { const data = record(value);const rect = { ...point(data), w: number(data.w), h: number(data.h) };
  if (rect.x < 0 || rect.y < 0 || rect.w <= 0 || rect.h <= 0) throw new Error('美术矩形不正确');return rect; };
function inside(rect: Rect, width: number, height: number) { if (rect.x + rect.w > width || rect.y + rect.h > height) throw new Error('美术矩形超出图片'); }

export async function loadArt(base = new URL('.', document.baseURI)): Promise<ArtBundle> {
  const response = await fetch(new URL('assets/b/manifest.json', base));
  if (!response.ok) throw new Error('工坊美术清单未能载入');
  const data = record(await response.json());
  if (data.schemaVersion !== 1 || data.direction !== 'B' || !Array.isArray(data.assets) || data.assets.length !== IDS.length) throw new Error('工坊美术版本不匹配');
  const rawStage = record(data.stage), widths = record(rawStage.hammerWidths);
  const stage: ArtStage = { width: number(rawStage.width), height: number(rawStage.height), contact: point(rawStage.contact),
    anvilWidth: number(rawStage.anvilWidth), pieceWidth: number(rawStage.pieceWidth), idleAngle: number(rawStage.idleAngle),
    impactHeightRatio: number(rawStage.impactHeightRatio), hammerWidths: { light: number(widths.light), standard: number(widths.standard), heavy: number(widths.heavy) } };
  if (stage.width <= 0 || stage.height <= 0 || stage.anvilWidth <= 0 || stage.pieceWidth <= 0
    || Object.values(stage.hammerWidths).some(width => width <= 0) || stage.impactHeightRatio < 0 || stage.impactHeightRatio > 1
    || stage.contact.x < 0 || stage.contact.x > stage.width || stage.contact.y < 0 || stage.contact.y > stage.height) throw new Error('工坊画板尺寸不正确');
  const assets = new Map<ArtId, ArtAsset>();
  for (const id of IDS) {
    const raw = data.assets.find((value: unknown) => record(value).id === id);
    if (!raw) throw new Error('工坊美术不完整');
    const item = record(raw), width = number(item.width), height = number(item.height);
    if (width < 1 || height < 1 || width > 4096 || height > 4096 || typeof item.src !== 'string'
      || !/^\/assets\/b\/[a-z0-9-]+\.webp$/.test(item.src)) throw new Error('工坊图片信息不正确');
    const visibleBounds = rectangle(item.visibleBounds);inside(visibleBounds, width, height);
    const frames: ArtFrame[] = [];
    if (id === 'iron' || id === 'steel' || id === 'meteorite') {
      if (!Array.isArray(item.frames) || item.frames.length !== 8) throw new Error('材料图集不完整');
      for (const [tier, entry] of item.frames.entries()) {
        const frame = record(entry);if (frame.tier !== tier) throw new Error('材料图集顺序不正确');
        const sourceRect = rectangle(frame.sourceRect), bounds = rectangle(frame.visibleBounds);
        inside(sourceRect, width, height);inside(bounds, sourceRect.w, sourceRect.h);
        frames.push({ tier, sourceRect, visibleBounds: bounds, anchor: point(frame.anchor) });
      }
    }
    assets.set(id, { id, src: new URL(item.src.slice(1), base).href, width, height, visibleBounds, frames,
      anchor: item.anchor === undefined ? { x: .5, y: .5 } : point(item.anchor),
      pivot: item.pivot === undefined ? { x: .5, y: .5 } : point(item.pivot),
      strike: item.strike === undefined ? { x: .5, y: 1 } : point(item.strike) });
  }
  const images = new Map<ArtId, HTMLImageElement>();
  try {
    await Promise.all([...assets.values()].map(async asset => {
      const image = new Image();images.set(asset.id, image);image.src = asset.src;
      try { await image.decode(); } catch { throw new Error('有一张工坊图片未能载入，请重试'); }
      if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) throw new Error('工坊图片尺寸与清单不匹配');
    }));
  } catch (error) { for (const image of images.values()) image.src = '';throw error; }
  return { stage, assets, images };
}

export function artAsset(art: ArtBundle, id: ArtId): ArtAsset { const value = art.assets.get(id);if (!value) throw new Error('工坊素材不存在');return value; }
export function artImage(art: ArtBundle, id: ArtId): HTMLImageElement { const value = art.images.get(id);if (!value) throw new Error('工坊图片不存在');return value; }
