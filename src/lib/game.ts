import { type Card, isRed, newShuffledDeck } from "./cards";

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // 4 piles, top = last element
  tableau: Card[][]; // 7 columns, top = last element
  score: number;
  moves: number;
  won: boolean;
}

export type TapLocation =
  | { pile: "stock" }
  | { pile: "waste" }
  | { pile: "tableau"; index: number; cardIndex: number };

export type DragSource =
  | { pile: "waste" }
  | { pile: "foundation"; index: number }
  | { pile: "tableau"; index: number; cardIndex: number };

export type DropTarget =
  | { kind: "foundation"; index: number }
  | { kind: "tableau"; index: number };

export function deal(): GameState {
  const deck = newShuffledDeck();
  const tableau: Card[][] = [[], [], [], [], [], [], []];
  let d = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[d++];
      tableau[col].push(row === col ? { ...card, faceUp: true } : card);
    }
  }
  return {
    stock: deck.slice(d),
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    score: 0,
    moves: 0,
    won: false,
  };
}

export function clone(s: GameState): GameState {
  return {
    ...s,
    stock: s.stock.map((c) => ({ ...c })),
    waste: s.waste.map((c) => ({ ...c })),
    foundations: s.foundations.map((p) => p.map((c) => ({ ...c }))),
    tableau: s.tableau.map((p) => p.map((c) => ({ ...c }))),
  };
}

function canPlaceOnFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 1;
  const top = pile[pile.length - 1];
  return top.suit === card.suit && card.rank === top.rank + 1;
}

function canPlaceOnTableau(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 13;
  const top = pile[pile.length - 1];
  return top.faceUp && isRed(top.suit) !== isRed(card.suit) && card.rank === top.rank - 1;
}

function addScore(s: GameState, points: number) {
  s.score = Math.max(0, s.score + points);
}

/** Flip the newly exposed top card of a tableau column, if any. */
function flipExposed(s: GameState, col: number) {
  const pile = s.tableau[col];
  const top = pile[pile.length - 1];
  if (top && !top.faceUp) {
    top.faceUp = true;
    addScore(s, 5);
  }
}

function checkWin(s: GameState) {
  s.won = s.foundations.reduce((n, p) => n + p.length, 0) === 52;
}

/** Draw one card from stock to waste, or recycle the waste when empty. */
export function drawOrRecycle(s0: GameState): GameState | null {
  const s = clone(s0);
  if (s.stock.length > 0) {
    const card = s.stock.pop()!;
    card.faceUp = true;
    s.waste.push(card);
    s.moves++;
    return s;
  }
  if (s.waste.length === 0) return null;
  s.stock = s.waste
    .reverse()
    .map((c) => ({ ...c, faceUp: false }));
  s.waste = [];
  addScore(s, -100);
  s.moves++;
  return s;
}

/** Find the foundation index that accepts this card, or -1. */
function foundationFor(s: GameState, card: Card): number {
  // Prefer the pile already holding this suit; aces take the first empty slot.
  for (let i = 0; i < 4; i++) {
    const pile = s.foundations[i];
    if (pile.length > 0 && pile[0].suit === card.suit) {
      return canPlaceOnFoundation(card, pile) ? i : -1;
    }
  }
  if (card.rank === 1) {
    for (let i = 0; i < 4; i++) if (s.foundations[i].length === 0) return i;
  }
  return -1;
}

/**
 * The "obvious move" for a tapped card. Returns the new state, or null when
 * the tap has no legal move (the UI shakes the card).
 */
export function tapCard(s0: GameState, loc: TapLocation): GameState | null {
  if (loc.pile === "stock") return drawOrRecycle(s0);

  if (loc.pile === "waste") {
    if (s0.waste.length === 0) return null;
    const card = s0.waste[s0.waste.length - 1];
    const f = foundationFor(s0, card);
    if (f >= 0) {
      const s = clone(s0);
      s.foundations[f].push(s.waste.pop()!);
      addScore(s, 10);
      s.moves++;
      checkWin(s);
      return s;
    }
    const target = bestTableauTarget(s0, card, -1);
    if (target >= 0) {
      const s = clone(s0);
      s.tableau[target].push(s.waste.pop()!);
      addScore(s, 5);
      s.moves++;
      return s;
    }
    return null;
  }

  const { index, cardIndex } = loc;
  const pile = s0.tableau[index];
  const card = pile[cardIndex];
  if (!card || !card.faceUp) return null;
  const isTop = cardIndex === pile.length - 1;

  if (isTop) {
    const f = foundationFor(s0, card);
    if (f >= 0) {
      const s = clone(s0);
      s.foundations[f].push(s.tableau[index].pop()!);
      addScore(s, 10);
      s.moves++;
      flipExposed(s, index);
      checkWin(s);
      return s;
    }
  }

  const target = bestTableauTarget(s0, card, index);
  if (target >= 0) {
    const s = clone(s0);
    const moving = s.tableau[index].splice(cardIndex);
    s.tableau[target].push(...moving);
    s.moves++;
    flipExposed(s, index);
    return s;
  }
  return null;
}

/**
 * Pick the best tableau column that accepts `card`; -1 when none.
 * Prefers non-empty targets; a king only moves to an empty column when the
 * move accomplishes something (it isn't already at the base of its column).
 */
function bestTableauTarget(s: GameState, card: Card, fromIndex: number): number {
  let empty = -1;
  for (let i = 0; i < 7; i++) {
    if (i === fromIndex) continue;
    const pile = s.tableau[i];
    if (!canPlaceOnTableau(card, pile)) continue;
    if (pile.length === 0) {
      if (empty === -1) empty = i;
      continue;
    }
    return i;
  }
  if (empty >= 0) {
    if (fromIndex === -1) return empty; // waste king -> empty column
    const fromPile = s.tableau[fromIndex];
    const cardIndex = fromPile.indexOf(card);
    if (cardIndex > 0) return empty; // frees a card underneath
  }
  return -1;
}

/** Apply a drag from `from` onto `to`; null when the drop is illegal. */
export function dragMove(
  s0: GameState,
  from: DragSource,
  to: DropTarget
): GameState | null {
  // Resolve the cards being moved (top card only, except tableau stacks).
  let moving: Card[];
  if (from.pile === "waste") {
    if (s0.waste.length === 0) return null;
    moving = [s0.waste[s0.waste.length - 1]];
  } else if (from.pile === "foundation") {
    const pile = s0.foundations[from.index];
    if (pile.length === 0) return null;
    moving = [pile[pile.length - 1]];
  } else {
    const pile = s0.tableau[from.index];
    const card = pile[from.cardIndex];
    if (!card || !card.faceUp) return null;
    moving = pile.slice(from.cardIndex);
  }
  const lead = moving[0];

  if (to.kind === "foundation") {
    if (moving.length !== 1) return null;
    if (from.pile === "foundation" && from.index === to.index) return null;
    if (!canPlaceOnFoundation(lead, s0.foundations[to.index])) return null;
    const s = clone(s0);
    if (from.pile === "waste") s.foundations[to.index].push(s.waste.pop()!);
    else if (from.pile === "foundation")
      s.foundations[to.index].push(s.foundations[from.index].pop()!);
    else {
      s.foundations[to.index].push(s.tableau[from.index].pop()!);
      flipExposed(s, from.index);
    }
    addScore(s, 10);
    s.moves++;
    checkWin(s);
    return s;
  }

  if (from.pile === "tableau" && from.index === to.index) return null;
  if (!canPlaceOnTableau(lead, s0.tableau[to.index])) return null;
  const s = clone(s0);
  if (from.pile === "waste") {
    s.tableau[to.index].push(s.waste.pop()!);
    addScore(s, 5);
  } else if (from.pile === "foundation") {
    s.tableau[to.index].push(s.foundations[from.index].pop()!);
    addScore(s, -15);
  } else {
    const stack = s.tableau[from.index].splice(from.cardIndex);
    s.tableau[to.index].push(...stack);
    flipExposed(s, from.index);
  }
  s.moves++;
  return s;
}

/** True when every tableau card is face up — the auto-finish condition. */
export function allUncovered(s: GameState): boolean {
  if (s.won) return false;
  let any = false;
  for (const pile of s.tableau) {
    for (const c of pile) {
      any = true;
      if (!c.faceUp) return false;
    }
  }
  return any || s.stock.length > 0 || s.waste.length > 0;
}

/**
 * One step of the auto-finish: play any eligible card to a foundation
 * (lowest rank first), otherwise draw/recycle. Returns null when won or stuck.
 */
export function autoFinishStep(s0: GameState): GameState | null {
  if (s0.won) return null;
  type Source = { card: Card } & ({ kind: "waste" } | { kind: "tableau"; index: number });
  const sources: Source[] = [];
  if (s0.waste.length > 0) sources.push({ kind: "waste", card: s0.waste[s0.waste.length - 1] });
  s0.tableau.forEach((pile, index) => {
    if (pile.length > 0) sources.push({ kind: "tableau", index, card: pile[pile.length - 1] });
  });
  const playable = sources
    .filter((src) => foundationFor(s0, src.card) >= 0)
    .sort((a, b) => a.card.rank - b.card.rank);
  if (playable.length > 0) {
    const src = playable[0];
    const s = clone(s0);
    const f = foundationFor(s, src.card);
    if (src.kind === "waste") s.foundations[f].push(s.waste.pop()!);
    else s.foundations[f].push(s.tableau[src.index].pop()!);
    addScore(s, 10);
    s.moves++;
    checkWin(s);
    return s;
  }
  if (s0.stock.length > 0 || s0.waste.length > 0) return drawOrRecycle(s0);
  return null;
}
