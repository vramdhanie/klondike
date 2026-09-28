import type { GameState } from "./game";

const GAME_KEY = "klondike.game.v1";

export interface SavedGame {
  state: GameState;
  elapsedMs: number;
  /** The deal has at least one move, so abandoning it counts as a loss. */
  counted: boolean;
}

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedGame;
    if (!saved.state || saved.state.won) return null;
    return saved;
  } catch {
    return null;
  }
}

export function saveGame(saved: SavedGame) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(saved));
  } catch {
    // storage unavailable
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(GAME_KEY);
  } catch {
    // storage unavailable
  }
}
