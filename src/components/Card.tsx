"use client";

import { motion } from "motion/react";
import { useState } from "react";

import { type Card as CardType, isRed, RANK_LABEL, SUIT_SYMBOL } from "@/lib/cards";

interface Props {
  card: CardType;
  z: number;
  top?: string;
  shaking?: boolean;
  onClick?: () => void;
}

export default function Card({ card, z, top, shaking, onClick }: Props) {
  const [moving, setMoving] = useState(false);
  const red = isRed(card.suit);
  const symbol = SUIT_SYMBOL[card.suit];
  const label = RANK_LABEL[card.rank];

  return (
    <motion.div
      layoutId={card.id}
      layout
      onLayoutAnimationStart={() => setMoving(true)}
      onLayoutAnimationComplete={() => setMoving(false)}
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      animate={shaking ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
      className="card-slot"
      style={{ top: top ?? 0, zIndex: moving ? 100 + z : z }}
      onClick={onClick}
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
            <span>{symbol}</span>
          </div>
          <div className="card-pip">{symbol}</div>
        </div>
        <div className="card-face card-back" />
      </motion.div>
    </motion.div>
  );
}
