"use client";

import { motion, type MotionValue, type PanInfo } from "motion/react";
import { useRef, useState } from "react";

import SuitIcon from "./Suit";
import { type Card as CardType, isRed, RANK_LABEL } from "@/lib/cards";

interface Props {
  card: CardType;
  z: number;
  top?: string;
  shaking?: boolean;
  draggable?: boolean;
  onTap?: () => void;
  onDragBegin?: () => void;
  onDragMove?: (offset: { x: number; y: number }) => void;
  onDragEnd?: (point: { x: number; y: number }) => void;
  /** Bound while this card is part of a dragged stack; follows the lead. */
  follow?: { x: MotionValue<number>; y: MotionValue<number> };
}

/** Above every move-sequence z, so a dragged card clears all piles. */
export const DRAG_Z = 10_000_000;

export default function Card({
  card,
  z,
  top,
  shaking,
  draggable = false,
  onTap,
  onDragBegin,
  onDragMove,
  onDragEnd,
  follow,
}: Props) {
  const [dragging, setDragging] = useState(false);
  // Motion's tap gesture is not reliably cancelled by its drag gesture, so
  // a drag could also fire onTap and apply a second move. Track per-gesture.
  const draggedRef = useRef(false);
  const red = isRed(card.suit);
  const label = RANK_LABEL[card.rank];

  return (
    <motion.div
      layoutId={card.id}
      layout
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      animate={shaking ? { x: [0, -7, 7, -5, 5, 0] } : undefined}
      className="card-slot"
      style={{ top: top ?? 0, zIndex: dragging ? DRAG_Z : z, x: follow?.x, y: follow?.y }}
      drag={draggable}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={1}
      onDragStart={() => {
        draggedRef.current = true;
        setDragging(true);
        onDragBegin?.();
      }}
      onDrag={(_e: unknown, info: PanInfo) => onDragMove?.(info.offset)}
      onDragEnd={(_e: unknown, info: PanInfo) => onDragEnd?.(info.point)}
      onDragTransitionEnd={() => setDragging(false)}
      onPointerDown={() => {
        draggedRef.current = false;
      }}
      onTap={
        onTap
          ? () => {
              if (draggedRef.current) return;
              onTap();
            }
          : undefined
      }
    >
      <motion.div
        className="card-inner"
        initial={false}
        animate={{ rotateY: card.faceUp ? 0 : 180 }}
        transition={{ duration: 0.25 }}
      >
        <div className={`card-face card-front ${red ? "red" : "black"}`}>
          <div className="card-corner">
            <span>{label}</span>
            <SuitIcon suit={card.suit} className="corner-suit" />
          </div>
          <div className="card-pip">
            <SuitIcon suit={card.suit} className="pip-suit" />
          </div>
        </div>
        <div className="card-face card-back" />
      </motion.div>
    </motion.div>
  );
}
