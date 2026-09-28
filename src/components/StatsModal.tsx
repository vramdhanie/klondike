"use client";

import { motion } from "motion/react";

import { levelProgress } from "@/lib/levels";
import type { Stats } from "@/lib/stats";

function formatTime(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function StatsModal({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const winRate = stats.dealt > 0 ? Math.round((stats.won / stats.dealt) * 100) : 0;
  const avgWinTime =
    stats.won > 0 ? formatTime(Math.round(stats.totalWinTimeMs / stats.won)) : "—";
  const progress = levelProgress(stats.totalPoints);

  const rows: [string, string | number][] = [
    ["Games played", stats.dealt],
    ["Games won", stats.won],
    ["Games lost", stats.lost],
    ["Win rate", `${winRate}%`],
    ["Current streak", stats.currentStreak],
    ["Best streak", stats.bestStreak],
    ["Best time", formatTime(stats.bestTimeMs)],
    ["Average win time", avgWinTime],
    ["Fewest moves", stats.bestMoves ?? "—"],
    ["High score", stats.highScore],
    ["Lifetime points", stats.totalPoints.toLocaleString()],
  ];

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.div
        className="dialog"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Statistics</h2>
        <div className="level-block">
          <div className="level-row">
            <span className="level-badge">Level {progress.level}</span>
            <span className="level-caption">
              {progress.into.toLocaleString()} / {progress.span.toLocaleString()} to level{" "}
              {progress.level + 1}
            </span>
          </div>
          <div className="progress-track">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress.fraction * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
        <dl className="stats-list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <button className="primary" onClick={onClose}>
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}
