import { Chess, Move } from "chess.js";

// -------- Persisted game state --------

export interface SavedGame {
  id: string;
  name: string;
  fen: string;
  pgn: string;
  mode: string;
  createdAt: number;
}

const SAVED_KEY = "chess-saved-games-v1";

export function listSavedGames(): SavedGame[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedGame[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGame(game: Chess, name: string, mode: string): SavedGame {
  const entry: SavedGame = {
    id: Math.random().toString(36).slice(2, 10),
    name: name || `Game ${new Date().toLocaleString()}`,
    fen: game.fen(),
    pgn: game.pgn(),
    mode,
    createdAt: Date.now(),
  };
  const list = listSavedGames();
  list.unshift(entry);
  const trimmed = list.slice(0, 20);
  localStorage.setItem(SAVED_KEY, JSON.stringify(trimmed));
  return entry;
}

export function deleteSavedGame(id: string) {
  const list = listSavedGames().filter((g) => g.id !== id);
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

export function loadSavedGame(id: string): SavedGame | null {
  return listSavedGames().find((g) => g.id === id) || null;
}

// -------- PGN import/export --------

export function exportPGN(game: Chess): string {
  return game.pgn({ maxWidth: 80, newline: "\n" });
}

export function importPGN(pgn: string): { ok: true; game: Chess } | { ok: false; error: string } {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    return { ok: true, game };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Invalid PGN" };
  }
}

// -------- Statistics --------

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalMoves: number;
  totalCaptures: number;
  totalChecks: number;
  totalCheckmates: number;
}

const STATS_KEY = "chess-stats-v1";

export function loadStats(): GameStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

export function emptyStats(): GameStats {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalMoves: 0,
    totalCaptures: 0,
    totalChecks: 0,
    totalCheckmates: 0,
  };
}

export function saveStats(stats: GameStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordGameEnd(
  stats: GameStats,
  result: "win" | "loss" | "draw",
  moves: Move[],
): GameStats {
  const next: GameStats = {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (result === "win" ? 1 : 0),
    losses: stats.losses + (result === "loss" ? 1 : 0),
    draws: stats.draws + (result === "draw" ? 1 : 0),
    totalMoves: stats.totalMoves + moves.length,
    totalCaptures: stats.totalCaptures + moves.filter((m) => m.captured).length,
    totalChecks: stats.totalChecks + moves.filter((m) => m.san.includes("+")).length,
    totalCheckmates: stats.totalCheckmates + (result !== "draw" ? 1 : 0),
  };
  saveStats(next);
  return next;
}
