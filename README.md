# ♟️ Chess Master

A modern, premium chess game built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS** — featuring a glassmorphism UI, animated particle background, AI opponent, chess clock, statistics tracking, PGN import/export, and a full dark/light theme.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)

---
📸 Screenshot

<img width="1901" height="1077" alt="Screenshot 2026-06-08 215654" src="https://github.com/user-attachments/assets/080e0165-e84b-407f-b60b-b6c9e2f49ce4" />

---

## 🌟 Features

### ♟️ Core Chess
- Full chess rules (castling, en passant, promotion, all draw conditions)
- Legal move validation with visual indicators (dots + capture rings)
- Check / checkmate / stalemate detection with animations
- Move history with click-to-jump navigation (⏮ ◀ ▶ ⏭)
- Undo, restart, resign
- Last-move highlight
- Board flip

### 🤖 AI & Game Modes
- **Player vs Player** — local two-player mode
- **Player vs AI** — choose your color, pick difficulty
- **AI vs AI** — watch two engines play each other
- **Practice Mode** — free-play with no opponent
- 3 difficulty levels (Easy / Medium / Hard)
- 💡 **Move hint** system (highlights engine's best move)
- 📊 **Live evaluation bar** (centipawn evaluation from engine)

### 🎨 Modern UI
- **Glassmorphism** design with backdrop blur
- **Dark / Light mode** (persisted to `localStorage`)
- **Animated particle background** with connecting lines
- Ambient gradient orbs
- Neon glow effects on active player, check, selected square
- Responsive layout (mobile → desktop)

### ✨ Animations (Framer Motion + canvas-confetti)
- Animated entrance for header, cards, board
- Spring-animated promotion popup with staggered pieces
- **Check warning** — board shakes + pulsing glow
- **Checkmate celebration** — multi-burst confetti + trophy bounce
- "Thinking…" indicator with pinging dot
- Hover/tap micro-interactions on every button
- Smooth piece transitions via react-chessboard

### ⏱️ Chess Clock
- Presets: **1+0, 3+0, 5+3, 10+0**
- Flag detection + time-loss win
- Low-time warning (red) under 30s
- Tenths display under 20s

### 📊 Statistics & Persistence
- Lifetime stats: games, wins, losses, draws, moves, captures, checks, mates
- Win-rate progress bar
- Match duration + live move/capture counters
- **Save / Load games** (up to 20 in `localStorage`)
- **PGN export** (copies to clipboard)
- **PGN import** (paste any PGN)
- **Opening explorer** — 30+ openings identified by move sequence

### 🎵 Sound System (Web Audio API)
- Synthesized tones for: move, capture, check, checkmate, victory, click, promote
- No external audio files needed
- Toggle on/off

### 🏆 Additional
- Fullscreen mode
- Toast notifications
- About-AI panel explaining the algorithm
- Touch / drag-and-drop support

---

## 🛠️ Tech Stack

| Tool | Purpose |
|------|---------|
| **React 18** | UI library |
| **TypeScript 5** | Type safety |
| **Vite 5** | Dev server & bundler |
| **Tailwind CSS 4** | Styling |
| **Framer Motion** | Animations |
| **chess.js** | Chess rules & game logic |
| **react-chessboard v5** | Board rendering |
| **canvas-confetti** | Victory effects |

---

## 📋 Prerequisites

- **Node.js** 18+ (LTS recommended) — [download](https://nodejs.org/)
- **npm** (comes with Node.js) or **pnpm** / **yarn**
- A modern browser (Chrome, Firefox, Edge, Safari)

Verify installation:
```bash
node --version   # should print v18+
npm --version    # should print 9+
```

---

## 🚀 Step-by-Step Installation

### 1. Clone or download the project

```bash
git clone <your-repo-url>
cd chess-master
```

Or download and unzip the source archive, then `cd` into the folder.

### 2. Install dependencies

```bash
npm install
```

This installs all packages listed in `package.json`, including:
- `react`, `react-dom`
- `chess.js`
- `react-chessboard`
- `framer-motion`
- `canvas-confetti`
- `tailwindcss` (via Vite plugin)
- TypeScript & dev tooling

⏱️ Takes about 30–60 seconds on first run.

### 3. Start the development server

```bash
npm run dev
```

You should see output like:
```
  VITE v5.x.x  ready in 400 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 4. Open the app in your browser

Visit **http://localhost:5173/** — the chess game is ready to play.

> The dev server has hot-reload: any changes you make to the source code will
> automatically refresh in the browser.

---

## 📦 Building for Production

To create an optimized production build:

```bash
npm run build
```

Output goes to the `dist/` folder. Everything is inlined into a single
`dist/index.html` (thanks to `vite-plugin-singlefile`) — you can open it
directly or deploy it anywhere static files are served.

### Preview the production build locally

```bash
npm run preview
```

This serves `dist/` at **http://localhost:4173/** so you can verify the build
before deploying.

---

## 📁 Project Structure

```
chess-master/
├── index.html                  # HTML entry point
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite build config
├── README.md                   # ← You are here
│
└── src/
    ├── main.tsx                # React entry, mounts <App/> with providers
    ├── App.tsx                 # Main component: all UI + game wiring
    ├── index.css               # Tailwind + custom animations + glass styles
    ├── theme.tsx               # ThemeProvider (dark/light mode + persistence)
    ├── dialog.tsx              # DialogProvider (modal panel state)
    │
    ├── chess/
    │   ├── engine.ts           # AI: minimax + alpha-beta + piece-square tables
    │   ├── openings.ts         # Opening book (30+ named openings)
    │   ├── clock.ts            # Chess clock hook (useClock)
    │   ├── sounds.ts           # Web Audio synthesized sound effects
    │   └── storage.ts          # Save/load games, PGN, statistics
    │
    ├── components/
    │   ├── Particles.tsx       # Animated particle background
    │   └── EvalBar.tsx         # Vertical evaluation bar
    │
    └── utils/
        └── cn.ts               # (optional) class-name helper
```

---

## 🧠 How the Code Works

### 1. Entry Point (`src/main.tsx`)

```tsx
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>        {/* dark/light mode */}
      <DialogProvider>     {/* modal panel state */}
        <App />
      </DialogProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
```

Wraps `<App />` in two context providers so every child can access theme and
dialog state.

### 2. Game State (`src/App.tsx`)

The app uses **two sources of truth**:

| Source | Purpose | Where |
|--------|---------|-------|
| `game` (a `Chess` instance from `chess.js`) | The live, mutable chess position | `useRef<Chess>` |
| `history` (array of `Move`) | Move list, navigation, stats | React state |

Every user or AI move must update **both**:
1. Call `game.move(...)` to mutate the live position
2. Call `applyMove(move)` to push into React state

`tryMove(from, to, promotion)` is the human-move pipeline; the AI effect uses
the same pattern.

#### Derived state (recomputed on every render)
- `atHead` — are we looking at the latest position?
- `liveGame` — the `Chess` instance for the currently viewed ply (used for
  highlighting, status text, etc.)
- `turn`, `inCheck`, `isCheckmate`, `isStalemate`, `isDraw`, `gameOver`
- `legalTargets` — legal destination squares for the currently selected piece
- `opening` — identified opening from the move sequence
- `customSquareStyles` — highlighting for last move, selected square, legal
  targets, check, and hint

#### The AI effect

```tsx
const aiTurn = useMemo(() => {
  if (!atHead || gameOver || clock.state.flag) return false;
  if (mode === "aivai") return true;
  if (mode === "practice") return false;
  if (mode === "pvc") return turn !== playerSide;
  return false;
}, [...]);

useEffect(() => {
  if (!aiTurn || thinkingRef.current) return;
  thinkingRef.current = true;
  setIsThinking(true);

  const timer = setTimeout(() => {
    try {
      const best = findBestMove(game, { depth: difficulty });
      if (best) {
        const applied = game.move(best);       // apply to live position
        if (applied) applyMove(applied);       // push to React state
      }
    } finally {
      thinkingRef.current = false;
      setIsThinking(false);
    }
  }, 220);

  return () => { clearTimeout(timer); thinkingRef.current = false; setIsThinking(false); };
}, [aiTurn, difficulty, game, applyMove, history.length]);
```

> **Why `thinkingRef`?** If we used `isThinking` (a state variable) inside
> `aiTurn`, every `setIsThinking(true)` would flip `aiTurn` to `false`, trigger
> cleanup, cancel the timeout, and flip it back — an infinite loop where the
> AI never plays. A ref guards against double-invocation without re-rendering.

### 3. The AI Engine (`src/chess/engine.ts`)

The engine is ~180 lines and has three key pieces:

#### a. Evaluation (`evaluateFromWhite`)

Walks the board and sums:
- **Material values**: P=100, N=320, B=330, R=500, Q=900, K=20000
- **Piece-square tables**: 64-entry arrays that give positional bonuses
  (central knights, active bishops, advanced pawns, safe king, etc.)

Returns centipawns from **White's** perspective — used by the evaluation bar.

#### b. Negamax with Alpha-Beta Pruning

```ts
function negamax(game, depth, alpha, beta) {
  if (depth === 0 || game.isGameOver()) return evaluate(game);
  let best = -Infinity;
  for (const move of orderMoves(game.moves(...))) {
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha);
    game.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break; // PRUNE
  }
  return best;
}
```

Negamax is minimax written once — the opponent's perspective is just `-score`.
The `alpha >= beta` cutoff prunes ~90% of the search tree.

#### c. Move Ordering (`orderMoves`)

Captures (MVV-LVA-ish) and promotions are searched first — this dramatically
increases pruning effectiveness.

#### d. Top-Level (`findBestMove`)

Tries every legal move at the root, runs `negamax` to the configured depth,
and returns whichever move scored highest.

**Difficulty mapping:**
| Level | Depth | Lookahead |
|-------|-------|-----------|
| Easy | 1 | 1 ply |
| Medium | 2 | 1 full move |
| Hard | 3 | 1.5 moves |

> Want a stronger AI? Bump depth to 4 (slower) or add a quiescence search /
> transposition table / iterative deepening.

### 4. Chess Clock (`src/chess/clock.ts`)

The `useClock` hook:
- Ticks every 100 ms using `setInterval`
- Switches active side on each move via `onMove(sideJustMoved)`
- Adds increment to the moving side
- Detects flag (time-out) and calls `onFlag` callback

Stable callbacks (`onMove`, `reset`, `pause`) are wrapped in `useCallback` so
consumers don't re-render unnecessarily.

### 5. Sound System (`src/chess/sounds.ts`)

Uses the **Web Audio API** to synthesize tones on demand — no binary files.
Each sound is a combination of `OscillatorNode` (pitched tones) and noise
buffers (for captures):

| Sound | Character |
|-------|-----------|
| move | Short triangle chirp |
| capture | Noise burst + low sawtooth |
| check | Three ascending square-wave beeps |
| checkmate/victory | C major arpeggio (C-E-G-C) |
| promote | Ascending triad |
| click | Tiny high ping |

Toggle via `sounds.setEnabled(bool)`.

### 6. Theme (`src/theme.tsx`)

A simple context provider:
- Reads initial value from `localStorage` (`chess-theme`)
- Adds/removes the `dark` class on `<html>`
- Tailwind's `@custom-variant dark (&:where(.dark, .dark *));` in
  `src/index.css` enables `dark:` utility classes

### 7. Storage (`src/chess/storage.ts`)

Pure `localStorage` helpers:
- **Saved games** (up to 20): `{ id, name, fen, pgn, mode, createdAt }`
- **Lifetime stats**: `{ gamesPlayed, wins, losses, draws, totalMoves, ... }`
- **PGN import/export** via `chess.js`'s `loadPgn` / `pgn` methods

### 8. Opening Book (`src/chess/openings.ts`)

A static list of ~35 common openings keyed by SAN move sequence. The
`identifyOpening` function finds the longest matching line from the current
move history and displays it above the board.

---

## 🎮 How to Play

1. **Move a piece** by dragging it to a destination, or by clicking the piece
   then clicking the target square.
2. Legal destinations show **blue dots** (empty) or **red rings** (captures).
3. When a pawn reaches the back rank, a **promotion popup** appears — choose
   Queen, Rook, Bishop, or Knight.
4. The **AI responds automatically** when it's its turn. The "Thinking…" pill
   appears briefly while the engine searches.
5. Click any move in the **move history** list to review that position. Use
   ⏮ ◀ ▶ ⏭ to step through the game.
6. Hit **💡 Hint** to see the engine's recommended move (highlighted in purple).

---

## ⚙️ Customization Guide

### Change the AI difficulty beyond the 3 presets

Open `src/App.tsx`, find the difficulty selector, and add a new entry:

```tsx
{([1, 2, 3, 4] as Difficulty[]).map((d) => ( ... ))}
```

Then in the AI effect, pass `{ depth: difficulty }` to `findBestMove`. Depth 4
takes noticeably longer — consider running it in a Web Worker for smoothness.

### Change piece values / positional tables

Edit `src/chess/engine.ts`:
- `PIECE_VALUES` — material scores
- `PAWN_TABLE`, `KNIGHT_TABLE`, … — 64-entry positional bonuses

### Add new openings

Add entries to `OPENINGS` array in `src/chess/openings.ts`:
```ts
{ eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
```

### Change the color scheme

Edit `boardTheme` in `src/App.tsx`:
```ts
const boardTheme = {
  dark:  "#475569",   // dark squares
  light: "#cbd5e1",   // light squares
};
```

### Replace the synthesized sounds with real audio files

Swap the Web Audio functions in `src/chess/sounds.ts` with `<audio>` elements
or the Howler.js library. Keep the same `sounds.play(name)` API so callers
don't need to change.

---

## 🐛 Troubleshooting

### "The AI only shows 'Thinking…' and never moves"
This was an early bug. Make sure your `src/App.tsx` matches the fixed version:
- `thinkingRef` must exist as a `useRef(false)` and gate the effect
- `isThinking` must NOT be in the `aiTurn` dependency list
- `applyMove` must depend on `clock.onMove`, not the whole `clock` object
- The effect must call `game.move(best)` **before** `applyMove(applied)`

### "Pieces snap back when I drop them"
The move is illegal. The board is controlled (via `positionAtView`), so illegal
drops are rejected and the piece returns to its source square.

### "Clock doesn't tick"
Make sure the **⏱️ Clock** button in the header is active (amber glow). If
grayed out, click it to enable.

### "Build fails with Tailwind errors"
Make sure you're using Node 18+ and run `npm install` again. The project uses
Tailwind v4 with the `@import "tailwindcss";` syntax.

### "Stats aren't saving"
The app uses `localStorage`. Check that your browser isn't blocking it
(private/incognito mode sometimes clears it on tab close).

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Preview production build locally |

---

## 📄 License

MIT — use it however you like.

---

👨‍💻 Author

Ritesh Deshmukh
---

Built with ♟️ and ☕ — happy chess!
