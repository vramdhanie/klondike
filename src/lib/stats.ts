export interface Stats {
  dealt: number;
  won: number;
  lost: number;
  currentStreak: number;
  bestStreak: number;
  bestTimeMs: number | null;
  bestMoves: number | null;
  highScore: number;
  totalWinTimeMs: number;
}

const STATS_KEY = "klondike.stats.v1";

export const emptyStats: Stats = {
  dealt: 0,
  won: 0,
  lost: 0,
  currentStreak: 0,
  bestStreak: 0,
  bestTimeMs: null,
  bestMoves: null,
  highScore: 0,
  totalWinTimeMs: 0,
};

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...emptyStats };
    return { ...emptyStats, ...(JSON.parse(raw) as Partial<Stats>) };
  } catch {
    return { ...emptyStats };
  }
}

function saveStats(stats: Stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // storage unavailable; stats just aren't persisted
  }
}

/** A new deal was played (first move made). */
export function recordDeal(): Stats {
  const stats = loadStats();
  stats.dealt++;
  saveStats(stats);
  return stats;
}

/** The current deal was abandoned without winning. */
export function recordLoss(): Stats {
  const stats = loadStats();
  stats.lost++;
  stats.currentStreak = 0;
  saveStats(stats);
  return stats;
}

export function recordWin(timeMs: number, moves: number, score: number): Stats {
  const stats = loadStats();
  stats.won++;
  stats.currentStreak++;
  stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
  stats.totalWinTimeMs += timeMs;
  if (stats.bestTimeMs === null || timeMs < stats.bestTimeMs) stats.bestTimeMs = timeMs;
  if (stats.bestMoves === null || moves < stats.bestMoves) stats.bestMoves = moves;
  stats.highScore = Math.max(stats.highScore, score);
  saveStats(stats);
  return stats;
}
