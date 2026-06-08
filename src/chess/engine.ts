import { Chess, Move } from "chess.js";

// Piece values (centipawns)
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables (from white's perspective). Encourage central control,
// king safety, pawn advancement, etc. Values adapted from the well-known
// Sunfish / Chess Programming Wiki tables.
const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const BISHOP_TABLE = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

const ROOK_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
];

const QUEEN_TABLE = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

const KING_TABLE = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];

const TABLES: Record<string, number[]> = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: ROOK_TABLE,
  q: QUEEN_TABLE,
  k: KING_TABLE,
};

// Convert algebraic square (e.g. "e4") to table index (0..63) from white's POV.
function squareToIndex(square: string): number {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = parseInt(square[1], 10) - 1; // 0..7 (rank 1 = 0)
  // Table is stored with rank 8 first (index 0), so flip ranks.
  return (7 - rank) * 8 + file;
}

// Evaluate the position from WHITE's perspective (positive = white advantage).
export function evaluateFromWhite(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? -100000 : 100000;
  }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return 0;
  }

  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type];
      const table = TABLES[piece.type];
      const fileChar = String.fromCharCode("a".charCodeAt(0) + f);
      const rankChar = (8 - r).toString();
      const square = fileChar + rankChar;
      const tableIdx = squareToIndex(square);
      const positional = table[tableIdx];
      const total = value + positional;
      score += piece.color === "w" ? total : -total;
    }
  }
  return score;
}

// Evaluate the position from the side-to-move perspective.
function evaluate(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? -100000 : 100000;
  }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return 0;
  }

  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type];
      const table = TABLES[piece.type];
      // board[r][f]: r=0 is rank 8 (top). Convert to algebraic.
      const fileChar = String.fromCharCode("a".charCodeAt(0) + f);
      const rankChar = (8 - r).toString();
      const square = fileChar + rankChar;
      const tableIdx = squareToIndex(square);
      const positional = table[tableIdx];
      const total = value + positional;
      score += piece.color === "w" ? total : -total;
    }
  }
  // Return score relative to side to move.
  return game.turn() === "w" ? score : -score;
}

function orderMoves(moves: Move[]): Move[] {
  // Prefer captures (MVV-LVA-ish) and promotions.
  return [...moves].sort((a, b) => {
    const aScore = (a.captured ? PIECE_VALUES[a.captured] : 0) + (a.promotion ? 800 : 0);
    const bScore = (b.captured ? PIECE_VALUES[b.captured] : 0) + (b.promotion ? 800 : 0);
    return bScore - aScore;
  });
}

function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluate(game);
  }
  const moves = orderMoves(game.moves({ verbose: true }) as Move[]);
  let best = -Infinity;
  for (const move of moves) {
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha);
    game.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

export interface EngineOptions {
  depth: number; // 1 = instant / weak, 2 = easy, 3 = medium
}

// Pick the best move for the side to move and also return its score.
export function findBestMoveWithScore(
  game: Chess,
  opts: EngineOptions,
): { move: Move | null; score: number } {
  const moves = orderMoves(game.moves({ verbose: true }) as Move[]);
  if (moves.length === 0) return { move: null, score: 0 };

  let bestMove: Move = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    game.move(move);
    const score = -negamax(game, opts.depth - 1, -beta, -alpha);
    game.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
  }

  return { move: bestMove, score: bestScore };
}

// Pick the best move for the side to move. Returns null if no legal move.
export function findBestMove(game: Chess, opts: EngineOptions): Move | null {
  const moves = orderMoves(game.moves({ verbose: true }) as Move[]);
  if (moves.length === 0) return null;

  let bestMove: Move = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    game.move(move);
    const score = -negamax(game, opts.depth - 1, -beta, -alpha);
    game.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
  }

  return bestMove;
}
