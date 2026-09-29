import type { Suit } from "@/lib/cards";

/**
 * Inline SVG suit shapes: the system font's suit glyphs render narrow and
 * pinched at small sizes, so the cards draw their own, filled currentColor.
 */
const SHAPES: Record<Suit, React.ReactNode> = {
  S: (
    <path d="M50 6 C42 24 14 38 14 58 C14 71 24 80 35 80 C41 80 46 77 49 73 C47 83 43 89 37 94 L63 94 C57 89 53 83 51 73 C54 77 59 80 65 80 C76 80 86 71 86 58 C86 38 58 24 50 6 Z" />
  ),
  H: (
    <path d="M50 92 C28 72 6 58 6 36 C6 22 16 12 29 12 C39 12 46 18 50 26 C54 18 61 12 71 12 C84 12 94 22 94 36 C94 58 72 72 50 92 Z" />
  ),
  D: <path d="M50 4 L86 50 L50 96 L14 50 Z" />,
  C: (
    <g>
      <circle cx="50" cy="30" r="19" />
      <circle cx="28" cy="57" r="19" />
      <circle cx="72" cy="57" r="19" />
      <path d="M50 52 C49 68 45 81 38 89 L62 89 C55 81 51 68 50 52 Z" />
    </g>
  ),
};

export default function SuitIcon({
  suit,
  className,
}: {
  suit: Suit;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden>
      {SHAPES[suit]}
    </svg>
  );
}
