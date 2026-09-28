/**
 * Levels are earned with lifetime points (each deal's final score is banked
 * when the deal ends). Level 1 costs 1000 points; the cumulative requirement
 * grows as n·log n so each level asks a little more than the last:
 *   T(n) = 1000 · n · log2(n + 1)   →  1000, 3170, 6000, 9288, 12925, …
 */
export function levelThreshold(level: number): number {
  if (level <= 0) return 0;
  return Math.round(1000 * level * Math.log2(level + 1));
}

export function levelForPoints(points: number): number {
  let level = 0;
  while (points >= levelThreshold(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  /** Points earned within the current level. */
  into: number;
  /** Points spanning the current level. */
  span: number;
  /** 0..1 progress toward the next level. */
  fraction: number;
}

export function levelProgress(points: number): LevelProgress {
  const level = levelForPoints(points);
  const floor = levelThreshold(level);
  const ceil = levelThreshold(level + 1);
  const span = ceil - floor;
  const into = points - floor;
  return { level, into, span, fraction: Math.min(1, into / span) };
}
