import { mkdir, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Public, anonymous Steam endpoint. Raw review text stays in ignored tmp/;
// the committed evidence contains query identity, hashes and review permalinks.
const games = [
  [2305640, 'Bladesong'], [1587540, 'Anvil Saga'],
  [2292800, 'Blacksmith Master'], [959520, 'Fantasy Blacksmith'],
  [980940, 'My Little Blacksmith Shop'], [1210320, 'Potion Craft'],
  [5245810, 'ForgeTax'],
];
const appArgument = process.argv[2];
if (process.argv.length > 4 || (appArgument && !games.some(([id]) => String(id) === appArgument))) throw Error('Usage: node scripts/research/steam-reviews.mjs [listed-app-id] [new-output-directory]');
const selection = appArgument ? games.filter(([id]) => String(id) === appArgument) : games;
const buckets = [
  ['en-helpful-positive', 'english', 0, 1, 3],
  ['en-helpful-negative', 'english', 0, 2, 3],
  ['en-recent-positive', 'english', 1, 1, 3],
  ['en-recent-negative', 'english', 1, 2, 3],
  ['zh-helpful-positive', 'schinese', 0, 1, 2],
  ['zh-helpful-negative', 'schinese', 0, 2, 2],
];
const rawDir = `tmp/research/steam-${new Date().toISOString().replace(/[:.]/g, '-')}-${appArgument ?? 'all'}`;
const outputDir = process.argv[3] ?? 'docs/research/evidence/2026-10-18';
const target = `${outputDir}/steam-sample${appArgument ? `-${appArgument}` : ''}.json`;
try { await access(target); throw Error(`Evidence already exists: ${target}. Select a new output directory.`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(rawDir, { recursive: true });
await mkdir(outputDir, { recursive: true });
const hash = (text) => createHash('sha256').update(text).digest('hex');
const manifest = { collectedAt: new Date().toISOString(), endpoint: 'https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/', purchaseType: 'Steam purchases only', sampling: 'First page only; 4 English buckets of 3 and 2 Chinese buckets of 2 per game. Helpful day_range=0. Not representative; deduplicate recommendation IDs.', games: [], failures: [] };
for (const [appid, title] of selection) {
  const game = { appid, title, store: `https://store.steampowered.com/app/${appid}/`, queries: [], reviews: [] };
  const seen = new Map();
  for (const [bucket, language, filter, reviewType, count] of buckets) {
    const parameters = { appid, filter, languages: [language], review_type: reviewType, purchase_type: 0, num_per_page: count, day_range: 0, filter_offtopic_activity: true, use_review_quality: true };
    const url = new URL(manifest.endpoint);
    url.searchParams.set('input_json', JSON.stringify(parameters));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw Error(`HTTP ${res.status}`);
      const raw = await res.text();
      const data = JSON.parse(raw).response;
      if (!data || !Array.isArray(data.reviews)) throw Error('Invalid response');
      const rawPath = `${rawDir}/${appid}-${bucket}.json`;
      await writeFile(rawPath, raw);
      game.queries.push({ bucket, parameters, fetchedAt: new Date().toISOString(), count: data.reviews.length, rawPath, sha256: hash(raw), totalMatching: data.total_matching ?? null, dayRangeUsed: data.day_range_used ?? null });
      for (const review of data.reviews) {
        const id = String(review.recommendationid);
        if (review.language !== language || review.voted_up !== (reviewType === 1)) throw Error(`Filter mismatch ${id}`);
        const existing = seen.get(id);
        if (existing) { existing.buckets.push(bucket); continue; }
        const entry = { id, url: `https://steamcommunity.com/profiles/${review.author.steamid}/recommended/${appid}/`, language, recommended: review.voted_up, createdAt: new Date(review.timestamp_created * 1000).toISOString(), updatedAt: new Date(review.timestamp_updated * 1000).toISOString(), playtimeMinutesAtReview: review.author.playtime_at_review ?? null, helpfulVotes: review.votes_up, earlyAccess: review.written_during_early_access, receivedFree: review.received_for_free, refunded: review.refunded ?? null, textSha256: hash(review.review), buckets: [bucket] };
        seen.set(id, entry);
        game.reviews.push(entry);
      }
    } catch (error) {
      manifest.failures.push({ appid, bucket, message: String(error) });
    }
  }
  game.uniqueCount = game.reviews.length;
  manifest.games.push(game);
  console.log(`${title}: ${game.queries.length}/6 queries, ${game.uniqueCount} unique reviews`);
}
manifest.totalRows = manifest.games.reduce((n, g) => n + g.queries.reduce((m, q) => m + q.count, 0), 0);
manifest.totalUnique = manifest.games.reduce((n, g) => n + g.uniqueCount, 0);
manifest.finishedAt = new Date().toISOString();
await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ rows: manifest.totalRows, unique: manifest.totalUnique, failures: manifest.failures }));
if (manifest.failures.length) process.exitCode = 1;
