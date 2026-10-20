import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';

const root = 'design/d/v07-chapter2/';
const outputRoot = 'public/assets/d/v07-chapter2/';
const ids = ['winter-forge-v1', 'returning-blade-v1', 'cracked-work-v1', 'rescue-path-v1', 'twin-stations-dark-v1', 'twin-stations-one-v1', 'twin-stations-lit-v1'];
const exportLog = JSON.parse(fs.readFileSync(`${root}export-log.json`));
const visualReview = JSON.parse(fs.readFileSync(`${root}visual-review.json`));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = path => fs.readFileSync(path);
const describe = path => { const bytes = read(path); return { path, bytes: bytes.length, sha256: sha(bytes) }; };
const assert = (condition, reason) => { if (!condition) throw Error(reason); };
const checkFile = expected => {
  const actual = describe(expected.path);
  assert(actual.bytes === expected.bytes && actual.sha256 === expected.sha256, `Provenance mismatch: ${expected.path}`);
  return actual;
};
const pngInfo = path => {
  const b = read(path);
  assert(b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `PNG signature: ${path}`);
  const chunks = [];
  for (let p = 8; p < b.length;) {
    const length = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8);
    assert(p + length + 12 <= b.length, `PNG chunk bounds: ${path}`);
    chunks.push(type); p += length + 12;
  }
  assert(chunks.includes('IDAT') && chunks.at(-1) === 'IEND', `PNG complete image: ${path}`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bitDepth: b[24], colorType: b[25], interlace: b[28], transparencyChunk: chunks.includes('tRNS'), alpha: [4, 6].includes(b[25]) || chunks.includes('tRNS') };
};
const webpInfo = path => {
  const result = spawnSync('webpinfo', ['-summary', path], { encoding: 'utf8' });
  const log = result.stdout + result.stderr;
  assert(result.status === 0 && log.includes('No error detected.'), `WebP validation: ${path}`);
  const value = label => Number(log.match(new RegExp(`  ${label}: (\\d+)`))?.[1]);
  const info = { width: value('Width'), height: value('Height'), alpha: Boolean(value('Alpha')), animation: Boolean(value('Animation')), log };
  assert(Number.isFinite(info.width) && Number.isFinite(info.height), `WebP dimensions: ${path}`);
  // Decode all RGBA pixels to memory only, to verify opacity independently of the chunk flag.
  const decoded = spawnSync('dwebp', [path, '-pam', '-o', '-'], { maxBuffer: 32 * 1024 ** 2 });
  assert(decoded.status === 0, `WebP decode: ${path}`);
  const marker = Buffer.from('ENDHDR\n');
  const end = decoded.stdout.indexOf(marker) + marker.length;
  const header = decoded.stdout.subarray(0, end).toString('ascii');
  const depth = Number(header.match(/DEPTH (\d+)/)?.[1]);
  const pixels = decoded.stdout.subarray(end);
  assert(end >= marker.length && depth === 4 && pixels.length === info.width * info.height * 4, `PAM data: ${path}`);
  let alphaMin = 255, alphaMax = 0;
  for (let i = 3; i < pixels.length; i += 4) { alphaMin = Math.min(alphaMin, pixels[i]); alphaMax = Math.max(alphaMax, pixels[i]); }
  assert(alphaMin === 255 && alphaMax === 255, `Opaque decoder alpha: ${path}`);
  return { ...info, decodedAlpha: { min: alphaMin, max: alphaMax }, decodedRGBASha256: sha(pixels) };
};

// Read-only PNG decoder for comparing existing output pixels; it writes no images.
const rgbPixels = path => {
  const b = read(path), info = pngInfo(path);
  assert(info.bitDepth === 8 && info.colorType === 2 && info.interlace === 0, `Expected non-interlaced RGB8 PNG: ${path}`);
  const chunks = [];
  for (let p = 8; p < b.length;) {
    const n = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') chunks.push(b.subarray(p + 8, p + 8 + n));
    p += n + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = info.width * 3, pixels = Buffer.alloc(stride * info.height);
  assert(raw.length === (stride + 1) * info.height, `PNG scanline size: ${path}`);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < info.height; y++) {
    const filter = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    assert(filter <= 4, `PNG filter: ${path}`);
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? pixels[dst + x - 3] : 0, up = y ? pixels[dst + x - stride] : 0, corner = y && x >= 3 ? pixels[dst + x - stride - 3] : 0;
      const prediction = [0, a, up, Math.floor((a + up) / 2), paeth(a, up, corner)][filter];
      pixels[dst + x] = (raw[src + x] + prediction) & 255;
    }
  }
  return { ...info, pixels };
};
const difference = (a, b, rectangle) => {
  assert(a.width === b.width && a.height === b.height, 'PNG comparison dimensions');
  const [x0, y0, x1, y1] = rectangle, w = a.width, h = a.height;
  let sum = 0, squared = 0, maximum = 0, samples = 0;
  for (let y = Math.round(y0 * h); y < Math.round(y1 * h); y++) for (let x = Math.round(x0 * w); x < Math.round(x1 * w); x++) for (let c = 0; c < 3; c++) {
    const i = (y * w + x) * 3 + c, d = Math.abs(a.pixels[i] - b.pixels[i]); sum += d; squared += d * d; maximum = Math.max(maximum, d); samples++;
  }
  return { rectangleNormalized: rectangle, channelSamples: samples, meanAbsoluteChannelDifference: sum / samples, rootMeanSquaredChannelDifference: Math.sqrt(squared / samples), maximumChannelDifference: maximum };
};

const records = [];
for (const id of [...ids, 'twin-stations-dark-v1-attempt1']) {
  const sourceRecordPath = `${root}${id}-source.json`, sourceRecord = JSON.parse(read(sourceRecordPath));
  assert(sourceRecord.mode === 'built-in image_gen' && sourceRecord.id === id, `Generation mode and identity: ${id}`);
  const source = checkFile(sourceRecord.source), original = checkFile(sourceRecord.original), prompt = checkFile(sourceRecord.prompt), references = sourceRecord.references.map(checkFile);
  assert(source.sha256 === original.sha256, `Exact source copy: ${id}`);
  const png = pngInfo(original.path);
  assert(png.width === 1672 && png.height === 941 && png.colorType === 2 && !png.alpha, `Opaque source dimensions: ${id}`);
  assert(sourceRecord.width === png.width && sourceRecord.height === png.height && sourceRecord.colorType === png.colorType, `Source metadata: ${id}`);
  const common = { id, sourceRecord: describe(sourceRecordPath), source, original, prompt, references, png, exactSourceCopy: true, provenanceVerified: true };
  if (!ids.includes(id)) { records.push({ ...common, selection: 'preserved rejected framing attempt; not exported' }); continue; }
  const runtime = describe(`${outputRoot}${id}.webp`), webp = webpInfo(runtime.path);
  assert(webp.width === png.width && webp.height === png.height && !webp.alpha && !webp.animation, `Runtime dimensions and opacity: ${id}`);
  const expectedArgs = ['-q', '78', '-m', '6', '-metadata', 'none', original.path, '-o', runtime.path];
  const logged = exportLog.results.find(item => item.id === id);
  assert(logged && logged.source === original.path && logged.output === runtime.path && logged.bytes === runtime.bytes && JSON.stringify(logged.args) === JSON.stringify(expectedArgs), `Export log and arguments: ${id}`);
  // Encode to memory, leaving every public runtime byte untouched, to prove the final file came from this exact PNG and setting set.
  const reproduced = spawnSync('cwebp', [...expectedArgs.slice(0, -1), '-'], { maxBuffer: 16 * 1024 ** 2 });
  assert(reproduced.status === 0 && sha(reproduced.stdout) === runtime.sha256, `Exact source-to-runtime reproduction: ${id}`);
  const reviewed = visualReview.assets.find(item => item.id === id);
  assert(reviewed && reviewed.reviewedOriginalSha256 === original.sha256 && reviewed.reviewedRuntimeSha256 === runtime.sha256, `Manual visual review pins: ${id}`);
  records.push({ ...common, selection: 'runtime', runtime, webp, export: { tool: 'cwebp', quality: 78, method: 6, metadata: 'none', resized: false, cropped: false, reproducedToMemorySha256: sha(reproduced.stdout), encodedFromExactOriginalVerified: true }, visualReview: reviewed });
}
const masterPath = `${root}originals/twin-stations-dark-v1.png`;
const master = rgbPixels(masterPath), one = rgbPixels(`${root}originals/twin-stations-one-v1.png`), lit = rgbPixels(`${root}originals/twin-stations-lit-v1.png`);
for (const id of ['twin-stations-one-v1', 'twin-stations-lit-v1']) {
  const record = records.find(item => item.id === id);
  assert(record.references.length === 1 && record.references[0].path === masterPath && record.references[0].sha256 === describe(masterPath).sha256, `Direct common master reference: ${id}`);
}
const observations = {
  method: 'read-only RGB8 PNG scanline decoding; numerical comparison supports visual review but does not prove identical geometry',
  one: { sky: difference(master, one, [0, 0, 1, 0.30]), rightStation: difference(master, one, [0.58, 0.32, 0.85, 0.62]), centralMountain: difference(master, one, [0.43, 0.30, 0.57, 0.59]) },
  lit: { sky: difference(master, lit, [0, 0, 1, 0.30]), centralMountain: difference(master, lit, [0.43, 0.30, 0.57, 0.59]) },
  visualReview: visualReview.twinStations
};
const runtimeBytes = records.reduce((sum, item) => sum + (item.runtime?.bytes ?? 0), 0);
const budget = { bytes: runtimeBytes, MiB: runtimeBytes / 1024 ** 2, targetBytes: 2 * 1024 ** 2, hardBudgetBytes: 2.5 * 1024 ** 2, targetMet: runtimeBytes <= 2 * 1024 ** 2, hardBudgetMet: runtimeBytes <= 2.5 * 1024 ** 2 };
assert(budget.targetMet, 'Target 2 MiB combined runtime budget');
const manifest = { schema: 1, generationMode: 'built-in image_gen', sourceDimensions: { width: 1672, height: 941 }, exportOperation: 'format conversion only; no source painting, resize, crop, or compositing', commonTwinMaster: describe(masterPath), budget, assets: records.filter(item => item.runtime).map(({ id, runtime, original, prompt, references, sourceRecord, export: settings }) => ({ id, runtime, original, prompt, references, sourceRecord, export: settings })) };
const verification = { schema: 1, verifiedAt: new Date().toISOString(), allChecksPassed: true, budget, visualReviewRecord: describe(`${root}visual-review.json`), checks: records, twinMasterComparison: observations };
fs.writeFileSync(`${root}manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(`${root}verification.json`, JSON.stringify(verification, null, 2) + '\n');
console.log(JSON.stringify({ allChecksPassed: true, generationRecords: records.length, runtimeFiles: ids.length, budget, twinMasterComparison: observations }, null, 2));
