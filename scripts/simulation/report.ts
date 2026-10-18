import type { RunResult, Scenario } from './model.js';

export function aggregate(scenario: Scenario, runs: readonly RunResult[]) {
  const mean = (get: (run: RunResult) => number) => runs.reduce((sum, run) => sum + get(run), 0) / runs.length;
  const victories = runs.filter(run => run.metrics.outcome === 'victory');
  const values = runs.map(run => run.metrics.activeInputSeconds).sort((a, b) => a - b);
  const sumMode = (mode: 'light' | 'standard' | 'heavy') => runs.reduce((sum, run) => sum + run.metrics.modeStrikes[mode], 0);
  const sumGrade = (grade: 'precise' | 'ordinary' | 'mishit') => runs.reduce((sum, run) => sum + run.metrics.gradeStrikes[grade], 0);
  return { scenario, count: runs.length, victories: victories.length,
    defeats: runs.filter(run => run.metrics.outcome === 'defeat').length,
    idle: runs.filter(run => run.metrics.outcome === 'idle').length,
    winRate: victories.length / runs.length, meanRounds: mean(run => run.metrics.rounds),
    meanEarned: mean(run => run.metrics.goldEarned), meanSpent: mean(run => run.metrics.goldSpent),
    meanCoins: mean(run => run.metrics.coins), meanScrap: mean(run => run.metrics.scrap),
    meanBroken: mean(run => run.metrics.broken), meanStrikes: mean(run => run.metrics.strikes),
    meanHeats: mean(run => run.metrics.heats), meanAccepted: mean(run => run.metrics.accepted),
    meanActiveInputSeconds: mean(run => run.metrics.activeInputSeconds),
    medianActiveInputSeconds: values[Math.floor(values.length / 2)],
    meanInputSecondsPerRound: mean(run => run.metrics.activeInputSeconds / Math.max(1, run.metrics.rounds)),
    meanVictoryInputSeconds: victories.length ? victories.reduce((sum, run) => sum + run.metrics.activeInputSeconds, 0) / victories.length : null,
    meanVictoryStrikes: victories.length ? victories.reduce((sum, run) => sum + run.metrics.strikes, 0) / victories.length : null,
    brokenPieceFraction: runs.reduce((sum, run) => sum + run.metrics.broken, 0)
      / Math.max(1, runs.reduce((sum, run) => sum + run.metrics.rounds * 3, 0)),
    damageStrikeFraction: runs.reduce((sum, run) => sum + run.state.stats.damagedStrikes, 0)
      / Math.max(1, runs.reduce((sum, run) => sum + run.metrics.strikes, 0)),
    maxStateBytes: Math.max(...runs.map(run => run.metrics.stateBytes)),
    maxAccepted: Math.max(...runs.map(run => run.metrics.accepted)),
    allReplayValid: runs.every(run => run.metrics.replayValid),
    modeStrikes: { light: sumMode('light'), standard: sumMode('standard'), heavy: sumMode('heavy') },
    gradeStrikes: { precise: sumGrade('precise'), ordinary: sumGrade('ordinary'), mishit: sumGrade('mishit') },
    rounds: Array.from({ length: 12 }, (_, index) => {
      const histories = runs.flatMap(run => run.state.history.filter(history => history.round === index + 1));
      const met = histories.filter(history => history.metQuota).length;
      return { round: index + 1, reached: histories.length, met, missed: histories.length - met,
        meanDelivered: histories.length ? histories.reduce((sum, history) => sum + history.delivered, 0) / histories.length : null };
    }),
    purchases: Object.fromEntries(['handle', 'anvil', 'bellows', 'repair'].map(product => [product,
      runs.reduce((sum, run) => sum + run.state.purchases.filter(purchase => purchase.product === product).length, 0)])),
  };
}
