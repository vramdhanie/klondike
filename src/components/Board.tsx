"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import CardView from "./Card";
import StatsModal from "./StatsModal";
import { SUIT_SYMBOL } from "@/lib/cards";
import {
  allUncovered,
  autoFinishStep,
  deal,
  type GameState,
  tapCard,
  type TapLocation,
} from "@/lib/game";
import { loadStats, recordDeal, recordLoss, recordWin, type Stats } from "@/lib/stats";
import { clearGame, loadGame, saveGame } from "@/lib/storage";

const MAX_HISTORY = 200;
const AUTO_STEP_MS = 150;
const AUTO_STEP_CAP = 600;

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Board() {
  const [game, setGame] = useState<GameState | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [counted, setCounted] = useState(false);
  const [autoFinishing, setAutoFinishing] = useState(false);
  const [shake, setShake] = useState<{ id: string; nonce: number } | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [winStats, setWinStats] = useState<Stats | null>(null);
  const historyRef = useRef<GameState[]>([]);
  const [historyLen, setHistoryLen] = useState(0);
  const autoSteps = useRef(0);
  const wonHandled = useRef(false);
  // Mirrors `game` synchronously so rapid taps never act on a stale state.
  const gameRef = useRef<GameState | null>(null);

  const setGameNow = useCallback((state: GameState) => {
    gameRef.current = state;
    setGame(state);
  }, []);

  // Restore the saved game (or deal fresh) on the client only.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = loadGame();
      if (saved) {
        setGameNow(saved.state);
        setElapsedMs(saved.elapsedMs);
        setCounted(saved.counted);
      } else {
        setGameNow(deal());
      }
      setStats(loadStats());
    });
    return () => cancelAnimationFrame(frame);
  }, [setGameNow]);

  // Timer: runs once the deal has moves and until the game is won.
  const running = !!game && !game.won && game.moves > 0;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000);
    return () => clearInterval(t);
  }, [running]);

  const persist = useCallback((state: GameState, elapsed: number, isCounted: boolean) => {
    if (state.won) clearGame();
    else saveGame({ state, elapsedMs: elapsed, counted: isCounted });
  }, []);

  const applyMove = useCallback(
    (prev: GameState, next: GameState) => {
      historyRef.current.push(prev);
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      setHistoryLen(historyRef.current.length);
      setGameNow(next);
      if (!counted) {
        setStats(recordDeal());
        setCounted(true);
      }
      persist(next, elapsedMs, true);
    },
    [counted, elapsedMs, persist, setGameNow]
  );

  const handleTap = useCallback(
    (loc: TapLocation, cardId?: string) => {
      const current = gameRef.current;
      if (!current || current.won || autoFinishing) return;
      const next = tapCard(current, loc);
      if (next) {
        applyMove(current, next);
      } else if (cardId) {
        setShake((s) => ({ id: cardId, nonce: (s?.nonce ?? 0) + 1 }));
        setTimeout(() => setShake(null), 450);
      }
    },
    [autoFinishing, applyMove]
  );

  const undo = useCallback(() => {
    if (autoFinishing || historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    setHistoryLen(historyRef.current.length);
    setGameNow(prev);
    persist(prev, elapsedMs, counted);
  }, [autoFinishing, counted, elapsedMs, persist, setGameNow]);

  const newGame = useCallback(() => {
    if (gameRef.current && counted && !gameRef.current.won) setStats(recordLoss());
    const fresh = deal();
    historyRef.current = [];
    setHistoryLen(0);
    setGameNow(fresh);
    setElapsedMs(0);
    setCounted(false);
    setAutoFinishing(false);
    setWinStats(null);
    wonHandled.current = false;
    clearGame();
  }, [counted, setGameNow]);

  // Kick off the auto-finish when everything is uncovered.
  useEffect(() => {
    if (!game || game.won || autoFinishing || !allUncovered(game)) return;
    const frame = requestAnimationFrame(() => {
      autoSteps.current = 0;
      setAutoFinishing(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [game, autoFinishing]);

  // Run the auto-finish animation.
  useEffect(() => {
    if (!autoFinishing) return;
    const t = setInterval(() => {
      const prev = gameRef.current;
      if (!prev || prev.won || autoSteps.current++ > AUTO_STEP_CAP) {
        setAutoFinishing(false);
        return;
      }
      const next = autoFinishStep(prev);
      if (!next) {
        setAutoFinishing(false);
        return;
      }
      if (next.won) setAutoFinishing(false);
      setGameNow(next);
    }, AUTO_STEP_MS);
    return () => clearInterval(t);
  }, [autoFinishing, setGameNow]);

  // Record the win once.
  useEffect(() => {
    if (game?.won && !wonHandled.current) {
      wonHandled.current = true;
      const s = recordWin(elapsedMs, game.moves, game.score);
      setStats(s);
      setWinStats(s);
      setCounted(false);
      clearGame();
    }
  }, [game, elapsedMs]);

  if (!game) {
    return <div className="board-loading">Shuffling…</div>;
  }

  const fdOffset = 0.16;
  const fuOffset = 0.3;

  return (
    <div className="board">
      <header className="topbar">
        <div>
          <span className="topbar-label">Score</span>
          <span className="topbar-value">{game.score}</span>
        </div>
        <div>
          <span className="topbar-label">Time</span>
          <span className="topbar-value">{formatTime(elapsedMs)}</span>
        </div>
        <div>
          <span className="topbar-label">Moves</span>
          <span className="topbar-value">{game.moves}</span>
        </div>
      </header>

      <LayoutGroup>
        <div className="top-row">
          {game.foundations.map((pile, i) => (
            <div className="pile" key={`f${i}`}>
              <div className="placeholder">A</div>
              {pile.map((card, j) => (
                <CardView
                  key={card.id}
                  card={card}
                  z={j + 1}
                  shaking={shake?.id === card.id}
                />
              ))}
            </div>
          ))}
          <div className="pile pile-waste">
            <div className="placeholder" />
            {game.waste.map((card, j) => (
              <CardView
                key={card.id}
                card={card}
                z={j + 1}
                shaking={shake?.id === card.id}
                onClick={() => handleTap({ pile: "waste" }, card.id)}
              />
            ))}
          </div>
          <div className="pile" onClick={() => handleTap({ pile: "stock" })}>
            <div className="placeholder placeholder-recycle">
              {game.waste.length > 0 ? "↻" : ""}
            </div>
            {game.stock.map((card, j) => (
              <CardView key={card.id} card={card} z={j + 1} />
            ))}
          </div>
        </div>

        <div className="tableau">
          {game.tableau.map((pile, col) => {
            let offset = 0;
            return (
              <div className="column" key={`t${col}`}>
                <div className="placeholder" />
                {pile.map((card, row) => {
                  const top = `calc(var(--card-h) * ${offset.toFixed(2)})`;
                  offset += card.faceUp ? fuOffset : fdOffset;
                  return (
                    <CardView
                      key={card.id}
                      card={card}
                      z={row + 1}
                      top={top}
                      shaking={shake?.id === card.id}
                      onClick={() =>
                        handleTap({ pile: "tableau", index: col, cardIndex: row }, card.id)
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </LayoutGroup>

      <AnimatePresence>
        {autoFinishing && (
          <motion.div
            className="auto-chip"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            Finishing the game…
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="toolbar">
        <button onClick={newGame}>New Deal</button>
        <button onClick={undo} disabled={historyLen === 0 || autoFinishing || game.won}>
          Undo
        </button>
        <button
          onClick={() => {
            setStats(loadStats());
            setStatsOpen(true);
          }}
        >
          Stats
        </button>
      </footer>

      <AnimatePresence>
        {game.won && winStats && (
          <motion.div
            className="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="dialog"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <div className="win-suits">
                {Object.values(SUIT_SYMBOL).map((s, i) => (
                  <motion.span
                    key={s}
                    className={i % 2 ? "red" : "black"}
                    initial={{ y: -18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 + i * 0.1 }}
                  >
                    {s}
                  </motion.span>
                ))}
              </div>
              <h2>You won!</h2>
              <dl>
                <div>
                  <dt>Score</dt>
                  <dd>{game.score}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{formatTime(elapsedMs)}</dd>
                </div>
                <div>
                  <dt>Moves</dt>
                  <dd>{game.moves}</dd>
                </div>
                <div>
                  <dt>Streak</dt>
                  <dd>{winStats.currentStreak}</dd>
                </div>
              </dl>
              <button className="primary" onClick={newGame}>
                New Deal
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {statsOpen && stats && <StatsModal stats={stats} onClose={() => setStatsOpen(false)} />}
    </div>
  );
}
