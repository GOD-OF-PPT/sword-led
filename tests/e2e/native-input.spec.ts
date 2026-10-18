import { expect, test } from './fixtures';
import { writeFile } from 'node:fs/promises';
import { verifyNativeInput } from './native-input.mjs';

test('native Chrome minimize/restore cancels a held key and preserves the accepted-command stream', async ({ baseURL }, info) => {
  if (!baseURL) throw new Error('Missing game origin');
  const screenshot = info.outputPath('native-window-input.png');
  const result = await verifyNativeInput(baseURL, screenshot);
  expect(result).toMatchObject({ nativeMinimizedHidden: true, nativeBlurObserved: true,
    cancelledRawSaveUnchanged: true, finalRevision: 1, finalStrikes: 1, finalStrikeDraws: 1, errors: [] });
  const evidence = info.outputPath('native-window-input.json');
  await writeFile(evidence, `${JSON.stringify({ recordedAt: new Date().toISOString(), result }, null, 2)}\n`);
  await info.attach('native-window-input', { path: evidence, contentType: 'application/json' });
  await info.attach('native-window-input-screen', { path: screenshot, contentType: 'image/png' });
});
