// Art assembly only. No game state, save access, RNG, rewards, or rules live here.
export async function loadArt() {
  const response = await fetch('/assets/b/manifest.json');
  if (!response.ok) throw new Error('无法读取美术清单');
  const manifest = await response.json();
  const images = new Map(await Promise.all(manifest.assets.map(async asset => {
    const image = new Image(); image.src = asset.src; await image.decode(); return [asset.id, image];
  })));
  return { manifest, images, assets: new Map(manifest.assets.map(asset => [asset.id, asset])) };
}

export function fitCanvas(canvas, width, height) {
  const pixels = Math.max(1, Math.round(canvas.getBoundingClientRect().width * Math.min(2, devicePixelRatio)));
  const rows = Math.max(1, Math.round(pixels * height / width));
  if (canvas.width !== pixels || canvas.height !== rows) { canvas.width = pixels; canvas.height = rows; }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 不可用');
  ctx.setTransform(pixels / width, 0, 0, rows / height, 0, 0);
  ctx.clearRect(0, 0, width, height); return ctx;
}

export function materialLayer(art, material, tier, heat, integrity) {
  const asset = art.assets.get(material), frame = asset.frames[tier], rect = frame.sourceRect;
  const layer = document.createElement('canvas'); layer.width = rect.w; layer.height = rect.h;
  const ctx = layer.getContext('2d');
  ctx.drawImage(art.images.get(material), rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  if (heat > 0) { ctx.globalAlpha = Math.sqrt(heat / 100) * .8; ctx.fillStyle = '#ff8a25'; ctx.fillRect(0, 0, rect.w, rect.h); }
  ctx.globalAlpha = 1;
  if (heat >= 80) {
    const box = frame.visibleBounds;
    ctx.strokeStyle = '#ffe3a1'; ctx.lineWidth = 4;
    ctx.beginPath();ctx.moveTo(box.x + box.w * .36, box.y + box.h * .43);
    ctx.lineTo(box.x + box.w * .59, box.y + box.h * .47);ctx.stroke();
  }
  const maximum = { iron: 4, steel: 3, meteorite: 2 }[material];
  if (integrity < maximum) {
    const box = frame.visibleBounds;
    for (let index = 0; index < (integrity <= 1 ? 2 : 1); index++) {
      const x = box.x + box.w * (0.54 + index * 0.16), top = box.y;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - 10, top + box.h * .28);
      ctx.lineTo(x + 5, top + box.h * .5); ctx.lineTo(x - 9, top + box.h * .73); ctx.lineTo(x + 4, top + box.h);
      ctx.strokeStyle = '#251a17'; ctx.lineWidth = 8; ctx.stroke();
      ctx.strokeStyle = '#f4ce92'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  ctx.restore(); return { layer, frame };
}

export function drawMaterial(ctx, art, options) {
  const { material, tier, heat = 0, integrity = 4, broken = false, x, y, width } = options;
  const { layer, frame } = materialLayer(art, material, tier, heat, integrity);
  const scale = width / frame.visibleBounds.w;
  const dx = -frame.anchor.x * layer.width * scale, dy = -frame.anchor.y * layer.height * scale;
  ctx.save(); ctx.translate(x, y);
  if (heat > 40) { ctx.shadowColor = '#fb752a'; ctx.shadowBlur = heat / 3; }
  if (broken) {
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * 14, 5); ctx.rotate(side * .09);
      ctx.beginPath(); ctx.rect(side < 0 ? -1000 : 0, -1000, 1000, 2000); ctx.clip();
      ctx.drawImage(layer, dx, dy, layer.width * scale, layer.height * scale); ctx.restore();
    }
  } else ctx.drawImage(layer, dx, dy, layer.width * scale, layer.height * scale);
  ctx.restore();
  return { x: x - width / 2, y: y - frame.visibleBounds.h * scale, w: width, h: frame.visibleBounds.h * scale };
}

function drawHammer(ctx, art, mode, target, angle, level) {
  const asset = art.assets.get(`hammer-${mode}`), width = art.manifest.stage.hammerWidths[mode];
  const scale = width / asset.width, height = asset.height * scale;
  const px = asset.pivot.x * width, py = asset.pivot.y * height;
  const sx = (asset.strike.x - asset.pivot.x) * width, sy = (asset.strike.y - asset.pivot.y) * height;
  const origin = { x: target.x - sx, y: target.y - sy };
  ctx.save(); ctx.translate(origin.x, origin.y); ctx.rotate(angle);
  ctx.drawImage(art.images.get(asset.id), -px, -py, width, height);
  for (let index = 0; index < level; index++) {
    ctx.save(); ctx.translate(-width * (.06 + index * .043), -height * .02); ctx.rotate(.12);
    ctx.fillStyle = '#c78b42'; ctx.strokeStyle = '#39271d'; ctx.lineWidth = 2;
    ctx.fillRect(-3, -9, 6, 18); ctx.strokeRect(-3, -9, 6, 18); ctx.restore();
  }
  ctx.restore();
  const bounds = asset.visibleBounds;
  const points = [[bounds.x, bounds.y], [bounds.x + bounds.w, bounds.y],
    [bounds.x + bounds.w, bounds.y + bounds.h], [bounds.x, bounds.y + bounds.h]].map(([x, y]) => {
      const lx = x * scale - px, ly = y * scale - py;
      return { x: origin.x + lx * Math.cos(angle) - ly * Math.sin(angle), y: origin.y + lx * Math.sin(angle) + ly * Math.cos(angle) };
    });
  return { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)),
    right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) };
}

export function paintWorkshop(canvas, art, options = {}) {
  const { material = 'steel', tier = 3, heat = 40, integrity = 3, hammer = 'standard', level = 0,
    broken = false, pose = 'ready', feedback = 'none', angle: override } = options;
  const stage = art.manifest.stage, ctx = fitCanvas(canvas, stage.width, stage.height);
  ctx.drawImage(art.images.get('workshop'), 0, 0, stage.width, stage.height);
  const anvil = art.assets.get('anvil'), aw = stage.anvilWidth, ah = aw * anvil.height / anvil.width;
  const ax = stage.contact.x - anvil.anchor.x * aw, ay = stage.contact.y - anvil.anchor.y * ah;
  ctx.drawImage(art.images.get('anvil'), ax, ay, aw, ah);
  for (let index = 0; index < level; index++) {
    ctx.beginPath(); ctx.arc(ax + aw * (.59 + index * .065), ay + ah * .62, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#c78b42'; ctx.strokeStyle = '#39271d'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
  }
  const body = drawMaterial(ctx, art, { material, tier, heat, integrity, broken,
    x: stage.contact.x, y: stage.contact.y, width: stage.pieceWidth * (.84 + tier / 7 * .16) });
  const target = { x: stage.contact.x, y: body.y + body.h * stage.impactHeightRatio };
  if (feedback !== 'none') {
    ctx.save(); ctx.translate(target.x, target.y);
    const color = feedback === 'damage' || feedback === 'mishit' ? '#9f2d26' : feedback === 'precise' ? '#66d4c6' : '#ffcc70';
    ctx.strokeStyle = color; ctx.lineWidth = 5;
    if (feedback === 'mishit') {
      ctx.beginPath();ctx.moveTo(20,-15);ctx.lineTo(47,8);ctx.moveTo(27,-20);ctx.lineTo(40,-9);ctx.stroke();
    } else if (feedback === 'damage') {
      ctx.beginPath();ctx.moveTo(-5,-30);ctx.lineTo(-13,-9);ctx.lineTo(6,1);ctx.lineTo(-8,24);ctx.stroke();
    } else {
      for (let index = 0; index < (feedback === 'precise' ? 8 : 4); index++) {
        const a = index * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 19, Math.sin(a) * 19);
        ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke();
      }
    }
    ctx.restore();
  }
  const angle = override ?? (pose === 'contact' ? 0 : stage.idleAngle);
  const hammerBounds = drawHammer(ctx, art, hammer, target, angle, level);
  return { body, hammerBounds, target, stage: { width: stage.width, height: stage.height } };
}

export function paintSwatch(canvas, art, options) {
  const ctx = fitCanvas(canvas, 400, 180);
  drawMaterial(ctx, art, { x: 200, y: 155, width: 310, ...options });
}
