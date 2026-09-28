# Klondike

[![Deploy](https://img.shields.io/github/actions/workflow/status/vramdhanie/klondike/deploy.yml?branch=main&label=deploy&logo=github)](https://github.com/vramdhanie/klondike/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/github/license/vramdhanie/klondike?color=green)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

Classic Klondike solitaire (draw one), fully static — no server, no accounts.
Built with Next.js (static export), TypeScript, Tailwind, and Motion for the
card animations.

Live at [klondike.vincentramdhanie.com](https://klondike.vincentramdhanie.com).

## How it plays

- **Drag and drop** any face-up card (a tableau card carries its stack, and
  a foundation card can come back down); an illegal drop snaps back.
- **Or tap a card and it makes the obvious move** — foundation first, then
  the best tableau move (kings only go to an empty column when that frees a
  card). No move: the card shakes.
- Tap the stock to draw one card; tap it again when empty to recycle the
  waste (−100 points, standard scoring).
- **Auto-finish**: as soon as every tableau card is face up, the rest of the
  game plays itself with an animated cascade to the foundations.
- Standard scoring (+5 waste→tableau and card flips, +10 to a foundation),
  a timer that starts on your first move, and a move counter.
- Undo, and the deal in progress survives a page reload.

## Statistics

Tracked in `localStorage`, shown from the Stats button: games played, won,
lost (a deal with at least one move counts as a loss when you abandon it),
win rate, current and best streak, best and average win time, fewest moves,
and high score.

## Architecture

The rules live in pure functions in [`src/lib/game.ts`](src/lib/game.ts) —
dealing, legal-move checks, the tap resolver, scoring, and the auto-finish
stepper — with React ([`src/components/Board.tsx`](src/components/Board.tsx))
only holding state and rendering. Card movement between piles animates via
Motion shared layout (`layoutId` per card); flips are a 3D rotate.

## Local development

```bash
npm install
npm run dev
```

`npm run build` writes the static site to `out/`.

## Deployment (one-time setup)

1. Push to GitHub; the Deploy workflow builds `out/` and publishes to
   GitHub Pages on every push to `main`.
2. Repo **Settings → Pages**: set *Source* to **GitHub Actions**, and set
   *Custom domain* to `klondike.vincentramdhanie.com` (enforce HTTPS once
   the certificate is issued).
3. At the DNS provider, add a CNAME record:
   `klondike` → `vramdhanie.github.io`
