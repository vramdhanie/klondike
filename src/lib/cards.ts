export type Suit = "S" | "H" | "D" | "C";

export interface Card {
  id: string;
  rank: number; // 1 (ace) .. 13 (king)
  suit: Suit;
  faceUp: boolean;
}

export const SUITS: Suit[] = ["S", "H", "D", "C"];

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

export const RANK_LABEL = [
  "",
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function isRed(suit: Suit): boolean {
  return suit === "H" || suit === "D";
}

export function newShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}${rank}`, rank, suit, faceUp: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
