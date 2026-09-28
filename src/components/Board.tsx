"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import CardView from "./Card";
import StatsModal from "./StatsModal";
import { SUIT_SYMBOL } from "@/lib/cards";
import {
  allUncovered,
  autoFinishStep,
  deal,
  type DragSource,
  dragMove,
  type DropTarget,
  type GameState,
  tapCard,
  type TapLocation,
} from "@/lib/game";
import { loadStats, recordDeal, recordLoss, recordWin, type Stats } from "@/lib/stats";
import { clearGame, loadGame, saveGame } from "@/lib/storage";

const MAX_HISTORY = 200;
const AUTO_STEP_MS = 150;
const AUTO_STEP_CAP = 600;
const FD_OFFSET = 0.16;
const FU_OFFSET = 0.3;

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Map every card to the pile it lives in, for move detection. */
function pileKeys(s: GameState): Map<string, string> {
  const keys = new Map<string, string>();
  s.stock.forEach((c) => keys.set(c.id, "s"));
  s.waste.forEach((c) => keys.set(c.id, "w"));
  s.foundations.forEach((p, i) => p.forEach((c) => keys.set(c.id, `f${i}`)));
  s.tableau.forEach((p, i) => p.forEach((c) => keys.set(c.id, `t${i}`)));
  return keys;
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
  // Cards that moved recently render above everything that moved earlier;
  // this keeps a card in flight on top without touching animation events.
  const [zMap, setZMap] = useState<Map<string, number>>(() => new Map());
  const seqCounter = useRef(0);
  const foundationEls = useRef<(HTMLDivElement | null)[]>([]);
  const columnEls = useRef<(HTMLDivElement | null)[]>([]);

  const setGameNow = useCallback((state: GameState) => {
    const prev = gameRef.current;
    if (prev) {
      const before = pileKeys(prev);
      const after = pileKeys(state);
      const batch = ++seqCounter.current;
      const liftedColumns = new Set<number>();
      const moved: string[] = [];
      after.forEach((key, id) => {
        if (before.get(id) !== key) {
          moved.push(id);
          if (key.startsWith("t")) liftedColumns.add(Number(key.slice(1)));
        }
      });
      if (moved.length > 0) {
        setZMap((old) => {
          const next = new Map(old);
          moved.forEach((id) => next.set(id, batch));
          // Lift the whole receiving column so cards in flight stay on top
          // of neighbouring columns (cards nest inside their column root).
          liftedColumns.forEach((i) => {
            const root = state.tableau[i][0];
            if (root) next.set(root.id, batch);
          });
          return next;
        });
      }
    }
    gameRef.current = state;
    setGame(state);
  }, []);

  const zOf = useCallback(
    (id: string, index: number) => (zMap.get(id) ?? 0) * 64 + index + 1,
    [zMap]
  );

  // Restore the saved game (or deal fresh) on the client only. Deferred with
  // setTimeout (not rAF, which never fires in a hidden tab).
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = loadGame();
      if (saved) {
        setGameNow(saved.state);
        setElapsedMs(saved.elapsedMs);
        setCounted(saved.counted);
      } else {
        setGameNow(deal());
      }
      setStats(loadStats());
    }, 0);
    return () => clearTimeout(t);
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

  const handleDragEnd = useCallback(
    (from: DragSource, point: { x: number; y: number }) => {
      const current = gameRef.current;
      if (!current || current.won || autoFinishing) return;
      const x = point.x - window.scrollX;
      const y = point.y - window.scrollY;
      const hit = (el: HTMLDivElement | null) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      };
      let target: DropTarget | null = null;
      foundationEls.current.forEach((el, i) => {
        if (!target && hit(el)) target = { kind: "foundation", index: i };
      });
      columnEls.current.forEach((el, i) => {
        if (!target && hit(el)) target = { kind: "tableau", index: i };
      });
      if (!target) return; // snap back
      const next = dragMove(current, from, target);
      if (next) applyMove(current, next);
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
    setZMap(new Map());
    seqCounter.current = 0;
    gameRef.current = null;
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
    const t = setTimeout(() => {
      autoSteps.current = 0;
      setAutoFinishing(true);
    }, 0);
    return () => clearTimeout(t);
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

  const interactive = !game.won && !autoFinishing;

  /** Build a tableau column as nested cards, so a drag carries the stack. */
  const columnNodes = (pile: GameState["tableau"][number], col: number): ReactNode => {
    let node: ReactNode = null;
    for (let row = pile.length - 1; row >= 0; row--) {
      const card = pile[row];
      const below = pile[row - 1];
      const top =
        row === 0
          ? "0px"
          : `calc(var(--card-h) * ${(below.faceUp ? FU_OFFSET : FD_OFFSET).toFixed(2)})`;
      node = (
        <CardView
          key={card.id}
          card={card}
          z={zOf(card.id, row)}
          top={top}
          shaking={shake?.id === card.id}
          draggable={card.faceUp && interactive}
          onTap={
            card.faceUp && interactive
              ? () => handleTap({ pile: "tableau", index: col, cardIndex: row }, card.id)
              : undefined
          }
          onDragEnd={(pt) =>
            handleDragEnd({ pile: "tableau", index: col, cardIndex: row }, pt)
          }
        >
          {node}
        </CardView>
      );
    }
    return node;
  };

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
            <div
              className="pile"
              key={`f${i}`}
              ref={(el) => {
                foundationEls.current[i] = el;
              }}
            >
              <div className="placeholder">A</div>
              {pile.map((card, j) => (
                <CardView
                  key={card.id}
                  card={card}
                  z={zOf(card.id, j)}
                  shaking={shake?.id === card.id}
                  draggable={j === pile.length - 1 && interactive}
                  onDragEnd={(pt) => handleDragEnd({ pile: "foundation", index: i }, pt)}
                />
              ))}
            </div>
          ))}
          <div className="pile pile-waste">
            <div className="placeholder" />
            {game.waste.map((card, j) => {
              const isTop = j === game.waste.length - 1;
              return (
                <CardView
                  key={card.id}
                  card={card}
                  z={zOf(card.id, j)}
                  shaking={shake?.id === card.id}
                  draggable={isTop && interactive}
                  onTap={
                    isTop && interactive
                      ? () => handleTap({ pile: "waste" }, card.id)
                      : undefined
                  }
                  onDragEnd={(pt) => handleDragEnd({ pile: "waste" }, pt)}
                />
              );
            })}
          </div>
          <div className="pile" onClick={() => handleTap({ pile: "stock" })}>
            <div className="placeholder placeholder-recycle">
              {game.waste.length > 0 ? "↻" : ""}
            </div>
            {game.stock.map((card, j) => (
              <CardView key={card.id} card={card} z={zOf(card.id, j)} />
            ))}
          </div>
        </div>

        <div className="tableau">
          {game.tableau.map((pile, col) => (
            <div
              className="column"
              key={`t${col}`}
              ref={(el) => {
                columnEls.current[col] = el;
              }}
            >
              <div className="placeholder" />
              {columnNodes(pile, col)}
            </div>
          ))}
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
