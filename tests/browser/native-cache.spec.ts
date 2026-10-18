import { expect, test } from '@playwright/test';
import { verifyNativeBfcache } from './native-bfcache.mjs';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

test('native CDP restores the actual cached heap and rereads the other window save', async ({ baseURL }, testInfo) => {
  if (!baseURL) throw new Error('Missing native fixture origin');
  const result = await verifyNativeBfcache(baseURL);
  expect(result).toMatchObject({ nativePersisted: true, heapRetained: true, restoredMode: 'readonly',
    latestRevision: 1, staleRejected: 'stale_session', resumedMode: 'writer' });
  const hashes: Record<string, string> = {};
  for (const file of await readdir('dist')) if (file.endsWith('.js')) {
    hashes[file] = createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex');
  }
  const evidence = testInfo.outputPath('native-bfcache-evidence.json');
  await writeFile(evidence, JSON.stringify({ recordedAt: new Date().toISOString(), result, buildSha256: hashes }, null, 2) + '\n');
  await testInfo.attach('native-bfcache-evidence', { path: evidence, contentType: 'application/json' });
});
