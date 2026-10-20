import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// Format export only: never resize, crop, paint, composite, or change the source PNGs.
const ids = ['winter-forge-v1', 'returning-blade-v1', 'cracked-work-v1', 'rescue-path-v1', 'twin-stations-dark-v1', 'twin-stations-one-v1', 'twin-stations-lit-v1'];
const root = 'design/d/v07-chapter2/';
const outputRoot = 'public/assets/d/v07-chapter2/';
fs.mkdirSync(outputRoot, { recursive: true });
const run = args => {
  const result = spawnSync('cwebp', args, { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr || result.stdout || 'cwebp failed');
  return (result.stdout + result.stderr).trim();
};
const results = [];
for (const id of ids) {
  const source = `${root}originals/${id}.png`;
  const output = `${outputRoot}${id}.webp`;
  const args = ['-q', '78', '-m', '6', '-metadata', 'none', source, '-o', output];
  const log = run(args);
  results.push({ id, source, output, args, bytes: fs.statSync(output).size, log });
}
const bytes = results.reduce((sum, item) => sum + item.bytes, 0);
const report = { tool: 'cwebp', version: run(['-version']), operation: 'format conversion only; no resize or crop', quality: 78, method: 6, metadata: 'none', bytes, targetBytes: 2 * 1024 ** 2, hardBudgetBytes: 2.5 * 1024 ** 2, results };
fs.writeFileSync(`${root}export-log.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ bytes, MiB: bytes / 1024 ** 2, targetMet: bytes <= report.targetBytes, hardBudgetMet: bytes <= report.hardBudgetBytes, files: results.map(({ id, bytes }) => ({ id, bytes })) }, null, 2));
if (bytes > report.hardBudgetBytes) process.exitCode = 1;
