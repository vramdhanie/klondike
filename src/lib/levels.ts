/**
 * Levels are earned with lifetime points (each deal's final score is banked
 * when the deal ends). Level 1 costs 1000 points; the cumulative requirement
 * grows on a binary-log curve so each level asks slightly more than the last:
 *   T(n) = 46.57·n·log2(n) + 106.8·n + 893.2  →  1000, 1200, 1435, 1693, …
 */
export function levelThreshold(level: number): number {
  if (level <= 0) return 0;
  return Math.round(
    46.57 * level * Math.log2(level) + 106.8 * level + 893.2
  );
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
