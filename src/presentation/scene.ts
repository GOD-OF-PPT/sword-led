import type { HammerMode, PieceView, TimingGrade } from '../core/index.js';
import { artAsset, artImage } from './assets.js';
import type { ArtBundle, ArtFrame, Point } from './assets.js';

export interface SceneModel {
  readonly piece: PieceView | null; readonly mode: HammerMode; readonly handle: number; readonly anvil: number;
  readonly angle?: number; readonly reduced?: boolean; readonly outcome?: 'success' | 'damage' | 'broken';
  readonly grade?: TimingGrade; readonly flash?: number;
}
interface MaterialCache { readonly key: string; readonly canvas: HTMLCanvasElement; readonly frame: ArtFrame; readonly padding: number }

export class ForgeScene {
  #art: ArtBundle;
  #canvas: HTMLCanvasElement;
  #static = document.createElement('canvas');
  #staticKey = '';
  #material: MaterialCache | null = null;
  #fullRoom: boolean;
  constructor(canvas: HTMLCanvasElement, art: ArtBundle, fullRoom = false) { this.#canvas = canvas;this.#art = art;this.#fullRoom = fullRoom; }

  #layer(piece: PieceView): MaterialCache {
    const key = [piece.material, piece.tier, piece.heat, piece.integrity].join('/');
    if (this.#material?.key === key) return this.#material;
    const frame = artAsset(this.#art, piece.material).frames[piece.tier];if (!frame) throw new Error('材料阶级不存在');
    const rect = frame.sourceRect, padding = 42;
    const base = document.createElement('canvas');base.width = rect.w;base.height = rect.h;
    const ctx = base.getContext('2d', { willReadFrequently: true });if (!ctx) throw new Error('画布不可用');
    ctx.drawImage(artImage(this.#art, piece.material), rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    if (piece.heat > 0) {
      const pixels = ctx.getImageData(0, 0, rect.w, rect.h), data = pixels.data;
      const strength = Math.sqrt(piece.heat / 100) * .86;
      for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] === 0) continue;
        const r = data[offset] ?? 0, g = data[offset + 1] ?? 0, b = data[offset + 2] ?? 0;
        const luminance = .2126 * r + .7152 * g + .0722 * b;
        const amount = strength * Math.max(0, Math.min(1, (luminance - 35) / 90));
        data[offset] = r * (1 - amount) + 255 * amount;data[offset + 1] = g * (1 - amount) + 150 * amount;data[offset + 2] = b * (1 - amount) + 45 * amount;
      }
      ctx.putImageData(pixels, 0, 0);
    }
    ctx.save();ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 1;
    const box = frame.visibleBounds;
    if (piece.heat >= 80) { ctx.strokeStyle = '#ffe3a1';ctx.lineWidth = 4;ctx.beginPath();
      ctx.moveTo(box.x + box.w * .36, box.y + box.h * .43);ctx.lineTo(box.x + box.w * .59, box.y + box.h * .47);ctx.stroke(); }
    if (piece.integrity < piece.maxIntegrity) for (let index = 0; index < (piece.integrity <= 1 ? 2 : 1); index++) {
      const x = box.x + box.w * (.54 + index * .16), top = box.y;
      ctx.beginPath();ctx.moveTo(x, top);ctx.lineTo(x - 10, top + box.h * .28);ctx.lineTo(x + 5, top + box.h * .5);
      ctx.lineTo(x - 9, top + box.h * .73);ctx.lineTo(x + 4, top + box.h);
      ctx.strokeStyle = '#251a17';ctx.lineWidth = 8;ctx.stroke();ctx.strokeStyle = '#f4ce92';ctx.lineWidth = 2;ctx.stroke();
    }
    ctx.restore();
    const canvas = document.createElement('canvas');canvas.width = rect.w + padding * 2;canvas.height = rect.h + padding * 2;
    const glow = canvas.getContext('2d');if (!glow) throw new Error('画布不可用');
    if (piece.heat > 40) { glow.shadowColor = '#fb752a';glow.shadowBlur = piece.heat / 3; }
    glow.drawImage(base, padding, padding);
    this.#material = { key, canvas, frame, padding };return this.#material;
  }

  render(model: SceneModel): void {
    const canvas = this.#canvas, bounds = canvas.getBoundingClientRect();if (bounds.width < 1 || bounds.height < 1) return;
    const dpr = Math.min(2, devicePixelRatio || 1, 4096 / bounds.width);
    const width = Math.max(1, Math.round(bounds.width * dpr)), height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width;canvas.height = height; }
    const ctx = canvas.getContext('2d');if (!ctx) return;
    const stage = this.#art.stage, cameraHeight = this.#fullRoom ? stage.height : 700;
    const scale = Math.min(width / stage.width, height / cameraHeight);
    const ox = (width - stage.width * scale) / 2, oy = (height - cameraHeight * scale) / 2;
    const staticKey = [width, height, model.anvil, cameraHeight].join('/');
    if (staticKey !== this.#staticKey) {
      this.#static.width = width;this.#static.height = height;const back = this.#static.getContext('2d');
      if (!back) return;
      back.fillStyle = '#30251e';back.fillRect(0, 0, width, height);
      // Extend the room softly into wide viewports while keeping the foreground rig undistorted.
      back.save();back.filter = 'blur(18px) brightness(.42)';back.drawImage(artImage(this.#art, 'workshop'), -24, -24, width + 48, height + 48);back.restore();
      back.setTransform(scale, 0, 0, scale, ox, oy);
      back.drawImage(artImage(this.#art, 'workshop'), 0, 0, stage.width, stage.height);
      const anvil = artAsset(this.#art, 'anvil'), aw = stage.anvilWidth, ah = aw * anvil.height / anvil.width;
      const ax = stage.contact.x - anvil.anchor.x * aw, ay = stage.contact.y - anvil.anchor.y * ah;
      back.drawImage(artImage(this.#art, 'anvil'), ax, ay, aw, ah);
      for (let index = 0; index < model.anvil; index++) { back.beginPath();back.arc(ax + aw * (.59 + index * .065), ay + ah * .62, 6, 0, Math.PI * 2);
        back.fillStyle = '#c78b42';back.strokeStyle = '#39271d';back.lineWidth = 2;back.fill();back.stroke(); }
      this.#staticKey = staticKey;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);ctx.clearRect(0, 0, width, height);ctx.drawImage(this.#static, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);ctx.imageSmoothingEnabled = true;ctx.imageSmoothingQuality = 'high';
    let target: Point = { x: stage.contact.x, y: stage.contact.y - 60 };
    const piece = model.piece;
    if (piece) {
      const material = this.#layer(piece), frame = material.frame;
      const bodyWidth = stage.pieceWidth * (.84 + piece.tier / 7 * .16), bodyScale = bodyWidth / frame.visibleBounds.w;
      const x = stage.contact.x, y = stage.contact.y;
      const dx = -(frame.anchor.x * frame.sourceRect.w + material.padding) * bodyScale;
      const dy = -(frame.anchor.y * frame.sourceRect.h + material.padding) * bodyScale;
      ctx.save();ctx.translate(x, y);
      if (piece.status === 'delivered' || piece.status === 'recycled') ctx.globalAlpha = .55;
      if (piece.status === 'broken') {
        for (const side of [-1, 1]) { ctx.save();ctx.translate(side * 14, 5);ctx.rotate(side * .09);
          ctx.beginPath();ctx.rect(side < 0 ? -1000 : 0, -1000, 1000, 2000);ctx.clip();
          ctx.drawImage(material.canvas, dx, dy, material.canvas.width * bodyScale, material.canvas.height * bodyScale);ctx.restore(); }
      } else ctx.drawImage(material.canvas, dx, dy, material.canvas.width * bodyScale, material.canvas.height * bodyScale);
      ctx.restore();
      target = { x, y: y - frame.visibleBounds.h * bodyScale * (1 - stage.impactHeightRatio) };
    }
    const flash = model.flash ?? 0;
    if (flash > 0 && !model.reduced) {
      ctx.save();ctx.translate(target.x, target.y);ctx.globalAlpha = flash;
      const count = model.outcome === 'success' ? (model.grade === 'precise' ? 12 : 6) : 3;
      ctx.strokeStyle = model.outcome === 'success' ? '#ffd68b' : '#f36a3b';ctx.lineWidth = 4;
      for (let i = 0; i < count; i++) { const angle = i * 2.399;const distance = (1 - flash) * 56 + 12;
        ctx.beginPath();ctx.moveTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
        ctx.lineTo(Math.cos(angle) * (distance + 12), Math.sin(angle) * (distance + 12));ctx.stroke(); }
      ctx.restore();
    }
    const hammer = artAsset(this.#art, `hammer-${model.mode}`), hw = stage.hammerWidths[model.mode], hh = hw * hammer.height / hammer.width;
    const px = hammer.pivot.x * hw, py = hammer.pivot.y * hh;
    const sx = (hammer.strike.x - hammer.pivot.x) * hw, sy = (hammer.strike.y - hammer.pivot.y) * hh;
    ctx.save();ctx.translate(target.x - sx, target.y - sy);ctx.rotate(model.angle ?? stage.idleAngle);
    ctx.drawImage(artImage(this.#art, hammer.id), -px, -py, hw, hh);
    for (let i = 0; i < model.handle; i++) { ctx.save();ctx.translate(-hw * (.06 + i * .043), -hh * .02);ctx.rotate(.12);
      ctx.fillStyle = '#c78b42';ctx.strokeStyle = '#39271d';ctx.lineWidth = 2;ctx.fillRect(-3, -9, 6, 18);ctx.strokeRect(-3, -9, 6, 18);ctx.restore(); }
    ctx.restore();
  }

  thumbnail(canvas: HTMLCanvasElement, piece: PieceView): void {
    const asset = artAsset(this.#art, piece.material), frame = asset.frames[piece.tier];if (!frame) return;
    const width = Math.max(1, Math.round(canvas.clientWidth * Math.min(2, devicePixelRatio || 1)));
    const height = Math.max(1, Math.round(canvas.clientHeight * Math.min(2, devicePixelRatio || 1)));
    canvas.width = width;canvas.height = height;const ctx = canvas.getContext('2d');if (!ctx) return;
    const box = frame.visibleBounds, rect = frame.sourceRect, padding = 8;
    const scale = Math.min((width - padding * 2) / box.w, (height - padding * 2) / box.h);
    if (piece.status !== 'active') ctx.globalAlpha = .6;
    ctx.drawImage(artImage(this.#art, piece.material), rect.x + box.x, rect.y + box.y, box.w, box.h,
      (width - box.w * scale) / 2, (height - box.h * scale) / 2, box.w * scale, box.h * scale);
  }
  dispose(): void { this.#material = null;this.#static.width = 1;this.#static.height = 1; }
}
