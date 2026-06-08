import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, Move, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { findBestMove, findBestMoveWithScore, evaluateFromWhite } from "./chess/engine";
import { identifyOpening } from "./chess/openings";
import { sounds } from "./chess/sounds";
import {
  exportPGN,
  importPGN,
  listSavedGames,
  loadSavedGame,
  saveGame as persistGame,
  deleteSavedGame,
  loadStats,
  recordGameEnd,
  type GameStats,
  type SavedGame,
} from "./chess/storage";
import { useClock, formatClock } from "./chess/clock";
import { useTheme } from "./theme";
import { useDialog } from "./dialog";
import { Particles } from "./components/Particles";
import { EvalBar } from "./components/EvalBar";

type Side = "w" | "b";
type GameMode = "pvp" | "pvc" | "aivai" | "practice";
type Difficulty = 1 | 2 | 3;

const GLYPHS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

interface PendingPromotion {
  from: Square;
  to: Square;
  color: Side;
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { panel, open: openPanel, close: closePanel } = useDialog();

  // ---- Core game state ----
  const gameRef = useRef<Chess>(new Chess());
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((v) => v + 1), []);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [mode, setMode] = useState<GameMode>("pvc");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [playerSide, setPlayerSide] = useState<Side>("w");
  const [history, setHistory] = useState<Move[]>([]);
  const [viewingPly, setViewingPly] = useState<number>(0);
  const [isThinking, setIsThinking] = useState(false);
  // Non-render ref that gates the AI effect. We keep isThinking as state only
  // for the UI pill, but use this ref to prevent the effect from re-firing
  // itself in a loop (setState -> re-render -> aiTurn flip -> cancel timeout).
  const thinkingRef = useRef(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const pendingPromotionRef = useRef(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [evaluation, setEvaluation] = useState(0);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [showGameOver, setShowGameOver] = useState<null | "white" | "black" | "draw">(null);
  const [matchStart, setMatchStart] = useState<number>(Date.now());
  const [now, setNow] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [clockEnabled, setClockEnabled] = useState(true);
  const [clockPreset, setClockPreset] = useState(600_000); // 10 min
  const [increment, setIncrement] = useState(0);
  const [savedGames, setSavedGames] = useState<SavedGame[]>(() => listSavedGames());
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  const [pgnInput, setPgnInput] = useState("");
  const [saveName, setSaveName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const lastResultRef = useRef<"win" | "loss" | "draw" | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // Tick for match duration display.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Sound toggle sync.
  useEffect(() => {
    sounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const game = gameRef.current;

  // Snapshot for browsing history.
  const positionAtView = useMemo(() => {
    const view = new Chess();
    for (let i = 0; i < viewingPly; i++) view.move(history[i]);
    return view.fen();
  }, [history, viewingPly]);

  const atHead = viewingPly === history.length;
  const liveGame = useMemo(() => {
    if (atHead) return game;
    const g = new Chess();
    for (let i = 0; i < viewingPly; i++) g.move(history[i]);
    return g;
  }, [atHead, game, history, viewingPly]);

  const turn: Side = liveGame.turn();
  const inCheck = liveGame.inCheck();
  const isCheckmate = liveGame.isCheckmate();
  const isStalemate = liveGame.isStalemate();
  const isDraw = liveGame.isDraw();
  const gameOver = liveGame.isGameOver();

  // Chess clock.
  const clock = useClock({
    enabled: clockEnabled && !gameOver && atHead,
    initialMs: clockPreset,
    incrementMs: increment,
    onFlag: (side) => {
      if (mode === "pvp" || mode === "pvc") {
        const winner = side === "w" ? "black" : "white";
        setShowGameOver(winner);
      }
    },
  });

  // Checked king square for highlighting.
  const checkedKingSquare: Square | null = useMemo(() => {
    if (!inCheck) return null;
    const board = liveGame.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (piece && piece.type === "k" && piece.color === turn) {
          const file = String.fromCharCode("a".charCodeAt(0) + f);
          const rank = (8 - r).toString();
          return (file + rank) as Square;
        }
      }
    }
    return null;
  }, [liveGame, inCheck, turn]);

  // Legal destinations from selected square.
  const legalTargets: Square[] = useMemo(() => {
    if (!selectedSquare || !atHead) return [];
    const moves = liveGame.moves({ square: selectedSquare, verbose: true }) as Move[];
    return moves.map((m) => m.to as Square);
  }, [selectedSquare, liveGame, atHead]);

  // Opening identification.
  const opening = useMemo(() => {
    const sans = history.slice(0, viewingPly).map((m) => m.san);
    return identifyOpening(sans);
  }, [history, viewingPly]);

  // Custom square styles (last move, selected, legal targets, check, hint).
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove && atHead) {
      styles[lastMove.from] = {
        background: "linear-gradient(135deg, rgba(251,191,36,0.45), rgba(251,146,60,0.35))",
      };
      styles[lastMove.to] = {
        background: "linear-gradient(135deg, rgba(251,191,36,0.55), rgba(251,146,60,0.45))",
      };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        background: "radial-gradient(circle, rgba(56,189,248,0.55), rgba(56,189,248,0.25))",
        boxShadow: "inset 0 0 0 3px rgba(56,189,248,0.9), 0 0 24px rgba(56,189,248,0.4)",
      };
    }
    for (const sq of legalTargets) {
      const piece = liveGame.get(sq);
      styles[sq] = piece
        ? {
            background:
              "radial-gradient(circle, rgba(0,0,0,0) 55%, rgba(244,63,94,0.75) 56%, rgba(244,63,94,0.75) 72%, rgba(0,0,0,0) 73%)",
          }
        : {
            background:
              "radial-gradient(circle, rgba(56,189,248,0.55) 24%, rgba(0,0,0,0) 26%)",
          };
    }
    if (hintMove && atHead) {
      styles[hintMove.from] = {
        ...(styles[hintMove.from] || {}),
        background: "linear-gradient(135deg, rgba(168,85,247,0.5), rgba(236,72,153,0.4))",
        boxShadow: "inset 0 0 0 3px rgba(168,85,247,0.9), 0 0 24px rgba(168,85,247,0.5)",
      };
      styles[hintMove.to] = {
        ...(styles[hintMove.to] || {}),
        background: "linear-gradient(135deg, rgba(168,85,247,0.6), rgba(236,72,153,0.5))",
      };
    }
    if (checkedKingSquare) {
      styles[checkedKingSquare] = {
        ...(styles[checkedKingSquare] || {}),
        background:
          "radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.45) 55%, rgba(0,0,0,0) 75%)",
        boxShadow: "inset 0 0 0 3px rgba(239,68,68,1), 0 0 30px rgba(239,68,68,0.6)",
      };
    }
    return styles;
  }, [lastMove, selectedSquare, legalTargets, hintMove, checkedKingSquare, liveGame, atHead]);

  // Apply a move to the live game and update history.
  // NOTE: depends on `clock.onMove` (stable via useCallback inside useClock),
  // NOT on the whole `clock` object (which is a new object every render).
  // Otherwise `applyMove` would be a new function every render, the AI effect
  // would re-run every render, and its cleanup would cancel the in-flight
  // setTimeout before the AI ever got to play.
  const applyMove = useCallback(
    (move: Move) => {
      setHistory((h) => [...h, move]);
      setViewingPly((p) => p + 1);
      setLastMove(move);
      setSelectedSquare(null);
      setHintMove(null);
      clock.onMove(move.color);
      rerender();
    },
    [clock.onMove, rerender],
  );

  // Try to make a move.
  const tryMove = useCallback(
    (from: Square, to: Square, promotion?: string): boolean => {
      if (!atHead) return false;
      const piece = game.get(from);
      if (
        piece &&
        piece.type === "p" &&
        ((piece.color === "w" && to[1] === "8") ||
          (piece.color === "b" && to[1] === "1"))
      ) {
        if (!promotion) {
          setPendingPromotion({ from, to, color: piece.color });
          pendingPromotionRef.current = true;
          return false;
        }
      }
      try {
        const move = game.move({
          from,
          to,
          promotion: (promotion as "q" | "r" | "b" | "n" | undefined) || "q",
        });
        if (move) {
          applyMove(move);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
    [game, atHead, applyMove],
  );

  // Play sound effects based on the move made.
  const prevHistoryLen = useRef(0);
  useEffect(() => {
    if (history.length === prevHistoryLen.current) {
      prevHistoryLen.current = history.length;
      return;
    }
    prevHistoryLen.current = history.length;
    const last = history[history.length - 1];
    if (!last) return;
    if (last.san.includes("#")) sounds.play("checkmate");
    else if (last.san.includes("+")) sounds.play("check");
    else if (last.captured) sounds.play("capture");
    else if (last.promotion) sounds.play("promote");
    else sounds.play("move");
  }, [history]);

  // Update evaluation after each move (and initial).
  useEffect(() => {
    if (gameOver) return;
    const timer = window.setTimeout(() => {
      const score = evaluateFromWhite(liveGame);
      setEvaluation(score);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [liveGame, history.length, gameOver]);

  // AI turn handling: PvC, AIvAI, Practice (if not player's side).
  // NOTE: `isThinking` is intentionally NOT included here. Including it would
  // cause a ping-pong: setting isThinking=true → aiTurn flips to false → effect
  // cleanup cancels the setTimeout → setIsThinking(false) → aiTurn flips back
  // to true → loop forever, timeout never fires. We use thinkingRef instead
  // to guard against double-invocation without triggering a re-render.
  const aiTurn = useMemo(() => {
    if (!atHead || gameOver || clock.state.flag) return false;
    if (mode === "aivai") return true;
    if (mode === "practice") return false;
    if (mode === "pvc") return turn !== playerSide;
    return false;
  }, [atHead, gameOver, mode, turn, playerSide, clock.state.flag]);

  useEffect(() => {
    if (!aiTurn) return;
    if (thinkingRef.current) return; // already in flight — don't double-fire
    thinkingRef.current = true;
    setIsThinking(true);

    const timer = window.setTimeout(() => {
      try {
        // findBestMove searches the tree but leaves `game` in its original
        // state (every internal game.move is paired with game.undo). We still
        // need to actually PLAY the chosen move on the live Chess instance.
        const best = findBestMove(game, { depth: difficulty });
        if (best) {
          const applied = game.move(best);
          if (applied) applyMove(applied);
        }
      } finally {
        thinkingRef.current = false;
        setIsThinking(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      thinkingRef.current = false;
      setIsThinking(false);
    };
  }, [aiTurn, difficulty, game, applyMove, history.length]);

  // Game over detection + confetti + stats.
  useEffect(() => {
    if (!gameOver || showGameOver) return;
    let result: "win" | "loss" | "draw" = "draw";
    let side: "white" | "black" | "draw" = "draw";
    if (isCheckmate) {
      side = turn === "w" ? "black" : "white";
      if (mode === "pvc") {
        result = side === (playerSide === "w" ? "white" : "black") ? "win" : "loss";
      }
    } else if (isStalemate || isDraw) {
      side = "draw";
      result = "draw";
    }
    setShowGameOver(side);
    lastResultRef.current = result;
    setStats((s) => recordGameEnd(s, result, history));
    if (side !== "draw") {
      sounds.play("victory");
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ["#fbbf24", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"],
      });
      window.setTimeout(() => {
        confetti({
          particleCount: 100,
          angle: 60,
          spread: 70,
          origin: { x: 0, y: 0.7 },
        });
        confetti({
          particleCount: 100,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.7 },
        });
      }, 250);
    }
  }, [gameOver, isCheckmate, isStalemate, isDraw, turn, history, mode, playerSide, showGameOver]);

  // Auto-flip when player side changes.
  useEffect(() => {
    if (mode === "pvc") setOrientation(playerSide === "w" ? "white" : "black");
  }, [playerSide, mode]);

  // ---- User interactions ----
  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }): boolean => {
      if (!targetSquare) return false;
      if (gameOver) return false;
      if (pendingPromotion) return false;
      if (!atHead) return false;
      if (mode === "pvc" && turn !== playerSide) return false;
      if (mode === "aivai") return false;
      pendingPromotionRef.current = false;
      const moved = tryMove(sourceSquare as Square, targetSquare as Square);
      return moved || pendingPromotionRef.current;
    },
    [gameOver, pendingPromotion, atHead, mode, turn, playerSide, tryMove],
  );

  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (gameOver || !atHead) return;
      if (mode === "pvc" && turn !== playerSide) return;
      if (mode === "aivai") return;
      const sq = square as Square;
      if (selectedSquare && legalTargets.includes(sq)) {
        tryMove(selectedSquare, sq);
        return;
      }
      const piece = game.get(sq);
      if (piece && piece.color === turn) setSelectedSquare(sq);
      else setSelectedSquare(null);
    },
    [gameOver, atHead, mode, turn, playerSide, selectedSquare, legalTargets, tryMove, game],
  );

  const completePromotion = useCallback(
    (piece: "q" | "r" | "b" | "n") => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      setPendingPromotion(null);
      pendingPromotionRef.current = false;
      sounds.play("promote");
      tryMove(from, to, piece);
    },
    [pendingPromotion, tryMove],
  );

  const newGame = useCallback(
    (opts?: { asWhite?: boolean }) => {
      gameRef.current = new Chess();
      setHistory([]);
      setViewingPly(0);
      setSelectedSquare(null);
      setLastMove(null);
      setPendingPromotion(null);
      setHintMove(null);
      thinkingRef.current = false;
      setIsThinking(false);
      setShowGameOver(null);
      setEvaluation(0);
      setMatchStart(Date.now());
      clock.reset(clockPreset);
      if (mode === "pvc") {
        const asWhite = opts?.asWhite ?? true;
        setPlayerSide(asWhite ? "w" : "b");
        setOrientation(asWhite ? "white" : "black");
      }
      rerender();
    },
    [mode, rerender, clock, clockPreset],
  );

  const undoMove = useCallback(() => {
    if (!atHead || history.length === 0) return;
    if (mode === "aivai") return;
    const pliesToUndo = mode === "pvc" && history.length >= 2 ? 2 : 1;
    for (let i = 0; i < pliesToUndo; i++) game.undo();
    const newHist = history.slice(0, history.length - pliesToUndo);
    setHistory(newHist);
    setViewingPly(Math.max(0, newHist.length));
    setSelectedSquare(null);
    setHintMove(null);
    setLastMove(newHist.length ? newHist[newHist.length - 1] : null);
    thinkingRef.current = false;
    setIsThinking(false);
    setShowGameOver(null);
    sounds.play("click");
    rerender();
  }, [atHead, history, game, mode, rerender]);

  const goToPly = useCallback(
    (ply: number) => {
      if (ply < 0 || ply > history.length) return;
      setViewingPly(ply);
      setSelectedSquare(null);
      setLastMove(ply === 0 ? null : history[ply - 1]);
    },
    [history],
  );

  const hint = useCallback(() => {
    if (gameOver || !atHead) return;
    if (mode === "aivai") return;
    if (mode === "pvc" && turn !== playerSide) return;
    sounds.play("click");
    const { move } = findBestMoveWithScore(game, { depth: Math.max(2, difficulty) });
    if (move) setHintMove(move);
  }, [gameOver, atHead, mode, turn, playerSide, game, difficulty]);

  const resign = useCallback(() => {
    if (gameOver) return;
    if (mode === "pvc") {
      const loser = playerSide === "w" ? "white" : "black";
      setShowGameOver(loser === "white" ? "black" : "white");
      setStats((s) => recordGameEnd(s, "loss", history));
    } else if (mode === "pvp") {
      const loser = turn === "w" ? "white" : "black";
      setShowGameOver(loser === "white" ? "black" : "white");
      setStats((s) => recordGameEnd(s, "loss", history));
    }
    sounds.play("click");
  }, [gameOver, mode, playerSide, turn, history]);

  // Save / Load / PGN handlers
  const handleSave = useCallback(() => {
    persistGame(game, saveName || `Game ${new Date().toLocaleString()}`, mode);
    setSavedGames(listSavedGames());
    setSaveName("");
    closePanel();
    showToast("Game saved");
    sounds.play("click");
  }, [game, saveName, mode, closePanel, showToast]);

  const handleLoad = useCallback(
    (id: string) => {
      const saved = loadSavedGame(id);
      if (!saved) return;
      gameRef.current = new Chess(saved.fen);
      const moves: Move[] = [];
      try {
        gameRef.current.loadPgn(saved.pgn);
        // Re-derive move list by replaying.
        const tmp = new Chess();
        tmp.loadPgn(saved.pgn);
        for (const m of tmp.history({ verbose: true })) moves.push(m as Move);
      } catch {
        // fall back
      }
      setHistory(moves);
      setViewingPly(moves.length);
      setLastMove(moves.length ? moves[moves.length - 1] : null);
      setSelectedSquare(null);
      setHintMove(null);
      setShowGameOver(null);
      clock.reset(clockPreset);
      closePanel();
      showToast("Game loaded");
      rerender();
    },
    [clock, clockPreset, closePanel, showToast, rerender],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteSavedGame(id);
      setSavedGames(listSavedGames());
    },
    [],
  );

  const handleImportPgn = useCallback(() => {
    const result = importPGN(pgnInput);
    if (!result.ok) {
      showToast("Invalid PGN: " + result.error);
      return;
    }
    gameRef.current = result.game;
    const moves = result.game.history({ verbose: true }) as Move[];
    setHistory(moves);
    setViewingPly(moves.length);
    setLastMove(moves.length ? moves[moves.length - 1] : null);
    setSelectedSquare(null);
    setShowGameOver(null);
    setPgnInput("");
    closePanel();
    showToast("PGN imported");
    rerender();
  }, [pgnInput, closePanel, showToast, rerender]);

  const handleExportPgn = useCallback(() => {
    const pgn = exportPGN(game);
    navigator.clipboard.writeText(pgn).then(
      () => showToast("PGN copied to clipboard"),
      () => showToast("Copy failed"),
    );
    sounds.play("click");
  }, [game, showToast]);

  // Captured pieces + material.
  const captured = useMemo(() => {
    const byWhite: string[] = [];
    const byBlack: string[] = [];
    for (let i = 0; i < viewingPly; i++) {
      const m = history[i];
      if (m.captured) {
        if (m.color === "w") byWhite.push(m.captured);
        else byBlack.push(m.captured);
      }
    }
    const order = "qnbrp";
    byWhite.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    byBlack.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { byWhite, byBlack };
  }, [history, viewingPly]);

  const materialAdvantage = useMemo(() => {
    const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let diff = 0;
    for (const p of captured.byWhite) diff += values[p] || 0;
    for (const p of captured.byBlack) diff -= values[p] || 0;
    return diff;
  }, [captured]);

  const statusText = useMemo(() => {
    if (isCheckmate) return `Checkmate · ${turn === "w" ? "Black" : "White"} wins`;
    if (isStalemate) return "Stalemate · Draw";
    if (clock.state.flag) return `${clock.state.flag === "w" ? "Black" : "White"} wins on time`;
    if (game.isInsufficientMaterial()) return "Draw · Insufficient material";
    if (game.isThreefoldRepetition()) return "Draw · Threefold repetition";
    if (isDraw) return "Draw";
    if (inCheck) return `${turn === "w" ? "White" : "Black"} is in check`;
    if (isThinking) return "Computer is thinking…";
    return `${turn === "w" ? "White" : "Black"} to move`;
  }, [isCheckmate, isStalemate, isDraw, inCheck, turn, isThinking, game, clock.state.flag]);

  // Pair moves into rows.
  const moveRows = useMemo(() => {
    const rows: { num: number; white?: Move; black?: Move; whiteIdx: number; blackIdx: number }[] = [];
    for (let i = 0; i < history.length; i += 2) {
      rows.push({
        num: Math.floor(i / 2) + 1,
        white: history[i],
        black: history[i + 1],
        whiteIdx: i + 1,
        blackIdx: i + 2,
      });
    }
    return rows;
  }, [history]);

  const playerCanInteract =
    atHead &&
    !gameOver &&
    !clock.state.flag &&
    !pendingPromotion &&
    mode !== "aivai" &&
    (mode === "pvp" || mode === "practice" || turn === playerSide) &&
    !isThinking;

  const matchDuration = Math.floor((now - matchStart) / 1000);
  const durationStr = `${Math.floor(matchDuration / 60)}:${(matchDuration % 60).toString().padStart(2, "0")}`;

  // ---- Board theme ----
  const boardTheme = useMemo(() => {
    if (theme === "dark") {
      return {
        dark: "#475569",
        light: "#cbd5e1",
      };
    }
    return { dark: "#64748b", light: "#f1f5f9" };
  }, [theme]);

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden transition-colors duration-500 ${
        theme === "dark"
          ? "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-slate-100"
          : "bg-gradient-to-br from-slate-100 via-indigo-50 to-amber-50 text-slate-900"
      }`}
    >
      <Particles count={45} />

      {/* Ambient gradient orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }}
        />
        <div
          className="absolute top-1/3 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)", animationDelay: "2s" }}
        />
        <div
          className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full opacity-20 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)", animationDelay: "4s" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 lg:py-8">
        {/* ---- Header ---- */}
        <motion.header
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -20, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl shadow-lg shadow-amber-500/30"
            >
              ♛
            </motion.div>
            <div>
              <h1 className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
                Chess Master
              </h1>
              <p className={`text-xs sm:text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                Premium chess experience · AI · Stats · Analysis
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <IconButton onClick={() => setSoundEnabled((s) => !s)} active={soundEnabled} label="Sound">
              {soundEnabled ? "🔊" : "🔇"}
            </IconButton>
            <IconButton onClick={() => setClockEnabled((c) => !c)} active={clockEnabled} label="Clock">
              ⏱️
            </IconButton>
            <IconButton onClick={toggleFullscreen} label="Fullscreen">
              ⛶
            </IconButton>
            <IconButton onClick={toggleTheme} label="Theme">
              {theme === "dark" ? "☀" : "☾"}
            </IconButton>
            <IconButton onClick={() => openPanel("stats")} label="Stats">
              📊
            </IconButton>
            <IconButton onClick={() => openPanel("about")} label="About AI">
              🧠
            </IconButton>
          </div>
        </motion.header>

        {/* ---- Status Banner ---- */}
        <motion.div
          key={statusText}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm backdrop-blur-md ${
            isCheckmate
              ? "border-rose-500/50 bg-rose-500/15 text-rose-300 animate-pulse-glow"
              : inCheck
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300 animate-shake"
                : gameOver
                  ? theme === "dark"
                    ? "border-slate-600/50 bg-slate-700/40 text-slate-200"
                    : "border-slate-400/50 bg-slate-200/70 text-slate-800"
                  : theme === "dark"
                    ? "border-slate-700/50 bg-slate-900/40 text-slate-300"
                    : "border-slate-300/50 bg-white/60 text-slate-700"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isCheckmate
                ? "bg-rose-400 animate-pulse"
                : inCheck
                  ? "bg-amber-400 animate-pulse"
                  : gameOver
                    ? "bg-slate-400"
                    : turn === "w"
                      ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                      : "bg-slate-900 ring-1 ring-slate-500"
            }`}
          />
          <span className="font-medium">{statusText}</span>
        </motion.div>

        {/* ---- Main Grid ---- */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Board column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <PlayerBar
              color={orientation === "white" ? "b" : "w"}
              label={
                mode === "pvc"
                  ? orientation === "white"
                    ? "Computer"
                    : "You"
                  : mode === "aivai"
                    ? orientation === "white"
                      ? "AI (Black)"
                      : "AI (White)"
                    : orientation === "white"
                      ? "Black"
                      : "White"
              }
              captured={orientation === "white" ? captured.byBlack : captured.byWhite}
              advantage={orientation === "white" ? -materialAdvantage : materialAdvantage}
              active={turn === (orientation === "white" ? "b" : "w") && !gameOver}
              thinking={isThinking && turn === (orientation === "white" ? "b" : "w")}
              clock={clockEnabled ? (orientation === "white" ? clock.state.black : clock.state.white) : null}
              clockFlag={clock.state.flag === (orientation === "white" ? "b" : "w")}
            />

            <div className="relative flex w-full max-w-[min(92vw,640px)] gap-2">
              {/* Evaluation bar */}
              <EvalBar evaluation={evaluation} orientation={orientation} />

              <div
                className={`relative flex-1 overflow-hidden rounded-xl shadow-2xl ${
                  theme === "dark"
                    ? "ring-1 ring-white/10 shadow-amber-500/5"
                    : "ring-1 ring-slate-900/10 shadow-slate-900/20"
                } ${inCheck ? "animate-shake" : ""}`}
              >
                <Chessboard
                  options={{
                    position: positionAtView,
                    onPieceDrop,
                    onSquareClick,
                    boardOrientation: orientation,
                    squareStyles: customSquareStyles,
                    boardStyle: { borderRadius: "12px" },
                    darkSquareStyle: { backgroundColor: boardTheme.dark },
                    lightSquareStyle: { backgroundColor: boardTheme.light },
                    animationDurationInMs: 220,
                    allowDragging: playerCanInteract,
                    allowDragOffBoard: false,
                    allowDrawingArrows: false,
                  }}
                />

                {/* Promotion modal */}
                <AnimatePresence>
                  {pendingPromotion && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-md"
                    >
                      <motion.div
                        initial={{ scale: 0.7, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.7, y: 20 }}
                        transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        className="glass rounded-2xl p-6 shadow-2xl"
                      >
                        <p className={`mb-4 text-center text-sm font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                          Promote pawn to:
                        </p>
                        <div className="flex gap-3">
                          {(["q", "r", "b", "n"] as const).map((p, i) => {
                            const glyph =
                              pendingPromotion.color === "w" ? GLYPHS[p.toUpperCase()] : GLYPHS[p];
                            return (
                              <motion.button
                                key={p}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                whileHover={{ scale: 1.1, y: -4 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => completePromotion(p)}
                                className={`flex h-16 w-16 items-center justify-center rounded-xl text-5xl shadow-lg transition ${
                                  theme === "dark"
                                    ? "bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-slate-600 hover:ring-amber-400 hover:shadow-amber-500/30"
                                    : "bg-gradient-to-br from-white to-slate-100 ring-1 ring-slate-300 hover:ring-amber-500 hover:shadow-amber-500/30"
                                }`}
                              >
                                <span
                                  className={
                                    pendingPromotion.color === "b"
                                      ? "text-slate-900 drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]"
                                      : "text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                                  }
                                >
                                  {glyph}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Thinking overlay */}
                <AnimatePresence>
                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-1.5 text-xs font-medium text-amber-300 shadow-lg backdrop-blur-sm ring-1 ring-amber-500/30"
                    >
                      <span className="mr-2 inline-block h-2 w-2 animate-ping rounded-full bg-amber-400" />
                      Thinking…
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <PlayerBar
              color={orientation === "white" ? "w" : "b"}
              label={
                mode === "pvc"
                  ? orientation === "white"
                    ? "You"
                    : "Computer"
                  : mode === "aivai"
                    ? orientation === "white"
                      ? "AI (White)"
                      : "AI (Black)"
                    : orientation === "white"
                      ? "White"
                      : "Black"
              }
              captured={orientation === "white" ? captured.byWhite : captured.byBlack}
              advantage={orientation === "white" ? materialAdvantage : -materialAdvantage}
              active={turn === (orientation === "white" ? "w" : "b") && !gameOver}
              thinking={isThinking && turn === (orientation === "white" ? "w" : "b")}
              clock={clockEnabled ? (orientation === "white" ? clock.state.white : clock.state.black) : null}
              clockFlag={clock.state.flag === (orientation === "white" ? "w" : "b")}
            />

            {/* Opening display */}
            {opening && (
              <motion.div
                key={opening.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-3 rounded-full px-4 py-1.5 text-xs font-medium ${
                  theme === "dark"
                    ? "bg-slate-800/60 text-amber-300 ring-1 ring-amber-500/20"
                    : "bg-white/70 text-amber-700 ring-1 ring-amber-500/30"
                }`}
              >
                📖 {opening.eco} · {opening.name}
              </motion.div>
            )}
          </motion.div>

          {/* Right sidebar */}
          <aside className="flex flex-col gap-4">
            {/* Game mode */}
            <GlassCard title="Game Mode">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: "pvp", label: "👥 2 Players" },
                  { v: "pvc", label: "🤖 vs AI" },
                  { v: "aivai", label: "🧠 AI vs AI" },
                  { v: "practice", label: "🎯 Practice" },
                ] as { v: GameMode; label: string }[]).map((m) => (
                  <motion.button
                    key={m.v}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setMode(m.v);
                      sounds.play("click");
                    }}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      mode === m.v
                        ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                        : theme === "dark"
                          ? "bg-slate-800/60 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
                          : "bg-slate-200/60 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-300"
                    }`}
                  >
                    {m.label}
                  </motion.button>
                ))}
              </div>

              {(mode === "pvc" || mode === "aivai") && (
                <div className="mt-3">
                  <Label>AI Depth</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([1, 2, 3] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setDifficulty(d);
                          sounds.play("click");
                        }}
                        className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                          difficulty === d
                            ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md"
                            : theme === "dark"
                              ? "bg-slate-800/60 text-slate-300 ring-1 ring-slate-700"
                              : "bg-slate-200/60 text-slate-700 ring-1 ring-slate-300"
                        }`}
                      >
                        {d === 1 ? "Easy" : d === 2 ? "Medium" : "Hard"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "pvc" && (
                <div className="mt-3">
                  <Label>Play as</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => newGame({ asWhite: true })}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        playerSide === "w"
                          ? "bg-gradient-to-br from-slate-100 to-slate-300 text-slate-900 ring-1 ring-amber-400"
                          : theme === "dark"
                            ? "bg-slate-800/60 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
                            : "bg-slate-200/60 text-slate-700 ring-1 ring-slate-300"
                      }`}
                    >
                      ♔ White
                    </button>
                    <button
                      onClick={() => newGame({ asWhite: false })}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        playerSide === "b"
                          ? "bg-gradient-to-br from-slate-800 to-slate-950 text-white ring-1 ring-amber-400"
                          : theme === "dark"
                            ? "bg-slate-800/60 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
                            : "bg-slate-200/60 text-slate-700 ring-1 ring-slate-300"
                      }`}
                    >
                      ♚ Black
                    </button>
                  </div>
                </div>
              )}

              {/* Clock settings */}
              <div className="mt-3">
                <Label>Time Control</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "1+0", ms: 60_000, inc: 0 },
                    { label: "3+0", ms: 180_000, inc: 0 },
                    { label: "5+3", ms: 300_000, inc: 3_000 },
                    { label: "10+0", ms: 600_000, inc: 0 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setClockPreset(p.ms);
                        setIncrement(p.inc);
                        clock.reset(p.ms);
                        sounds.play("click");
                      }}
                      className={`rounded-md px-1.5 py-1 text-[10px] font-semibold transition ${
                        clockPreset === p.ms && increment === p.inc
                          ? "bg-amber-500 text-slate-950"
                          : theme === "dark"
                            ? "bg-slate-800/60 text-slate-400 ring-1 ring-slate-700"
                            : "bg-slate-200/60 text-slate-600 ring-1 ring-slate-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Actions */}
            <GlassCard title="Controls">
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn onClick={() => newGame()} primary>
                  🔄 New Game
                </ActionBtn>
                <ActionBtn onClick={hint} disabled={gameOver || !atHead || mode === "aivai"}>
                  💡 Hint
                </ActionBtn>
                <ActionBtn onClick={undoMove} disabled={!atHead || history.length === 0 || mode === "aivai"}>
                  ↶ Undo
                </ActionBtn>
                <ActionBtn onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
                  ⇅ Flip
                </ActionBtn>
                <ActionBtn onClick={handleExportPgn}>📋 Export PGN</ActionBtn>
                <ActionBtn onClick={() => openPanel("import")}>📥 Import PGN</ActionBtn>
                <ActionBtn onClick={() => openPanel("save")}>💾 Save</ActionBtn>
                <ActionBtn onClick={() => { setSavedGames(listSavedGames()); openPanel("load"); }}>📂 Load</ActionBtn>
                <ActionBtn onClick={resign} danger disabled={gameOver || mode === "aivai" || mode === "practice"}>
                  🏳 Resign
                </ActionBtn>
              </div>
            </GlassCard>

            {/* Move history */}
            <GlassCard title={`Moves · ${history.length}`}>
              <div className="chess-scroll max-h-60 overflow-y-auto pr-1">
                {moveRows.length === 0 ? (
                  <p className={`text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-500"}`}>
                    No moves yet. {mode === "aivai" ? "AI is starting…" : "Drag or click to play."}
                  </p>
                ) : (
                  <ol className="space-y-0.5 text-sm">
                    {moveRows.map((row) => (
                      <li key={row.num} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1">
                        <span className={`font-mono text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                          {row.num}.
                        </span>
                        {row.white && (
                          <button
                            onClick={() => goToPly(row.whiteIdx)}
                            className={`rounded px-2 py-1 text-left font-mono transition ${
                              viewingPly === row.whiteIdx
                                ? "bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/60"
                                : theme === "dark"
                                  ? "text-slate-200 hover:bg-slate-700/60"
                                  : "text-slate-700 hover:bg-slate-300/60"
                            }`}
                          >
                            {row.white.san}
                          </button>
                        )}
                        {row.black ? (
                          <button
                            onClick={() => goToPly(row.blackIdx)}
                            className={`rounded px-2 py-1 text-left font-mono transition ${
                              viewingPly === row.blackIdx
                                ? "bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/60"
                                : theme === "dark"
                                  ? "text-slate-200 hover:bg-slate-700/60"
                                  : "text-slate-700 hover:bg-slate-300/60"
                            }`}
                          >
                            {row.black.san}
                          </button>
                        ) : (
                          <span />
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className={`mt-3 grid grid-cols-4 gap-2 border-t pt-3 ${theme === "dark" ? "border-slate-700/60" : "border-slate-300/60"}`}>
                <NavBtn onClick={() => goToPly(0)} disabled={viewingPly === 0}>⏮</NavBtn>
                <NavBtn onClick={() => goToPly(viewingPly - 1)} disabled={viewingPly === 0}>◀</NavBtn>
                <NavBtn onClick={() => goToPly(viewingPly + 1)} disabled={viewingPly === history.length}>▶</NavBtn>
                <NavBtn onClick={() => goToPly(history.length)} disabled={viewingPly === history.length}>⏭</NavBtn>
              </div>
            </GlassCard>

            {/* Live stats */}
            <GlassCard title="Match">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label="Duration" value={durationStr} />
                <Stat label="Moves" value={String(history.length)} />
                <Stat label="Captures" value={String(captured.byWhite.length + captured.byBlack.length)} />
              </div>
            </GlassCard>
          </aside>
        </div>

        <footer className={`mt-8 text-center text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>
          Built with React · Vite · TypeScript · Tailwind · Framer Motion · chess.js
        </footer>
      </div>

      {/* ---- Dialogs ---- */}
      <AnimatePresence>
        {panel !== "none" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`chess-scroll glass max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl ${
                theme === "dark" ? "text-slate-100" : "text-slate-900"
              }`}
            >
              {panel === "save" && (
                <>
                  <DialogTitle>💾 Save Game</DialogTitle>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Game name (optional)"
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm outline-none ring-1 transition ${
                      theme === "dark"
                        ? "bg-slate-800/60 ring-slate-700 focus:ring-amber-400"
                        : "bg-white/70 ring-slate-300 focus:ring-amber-500"
                    }`}
                  />
                  <div className="mt-4 flex gap-2">
                    <ActionBtn onClick={handleSave} primary>Save</ActionBtn>
                    <ActionBtn onClick={closePanel}>Cancel</ActionBtn>
                  </div>
                </>
              )}

              {panel === "load" && (
                <>
                  <DialogTitle>📂 Load Game</DialogTitle>
                  {savedGames.length === 0 ? (
                    <p className="mt-4 text-sm opacity-60">No saved games yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {savedGames.map((g) => (
                        <li
                          key={g.id}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                            theme === "dark" ? "bg-slate-800/50" : "bg-slate-200/50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{g.name}</div>
                            <div className="text-xs opacity-60">
                              {g.mode.toUpperCase()} · {new Date(g.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="ml-2 flex gap-1">
                            <button
                              onClick={() => handleLoad(g.id)}
                              className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => handleDelete(g.id)}
                              className="rounded-md bg-rose-500/20 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/30"
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {panel === "import" && (
                <>
                  <DialogTitle>📥 Import PGN</DialogTitle>
                  <textarea
                    value={pgnInput}
                    onChange={(e) => setPgnInput(e.target.value)}
                    placeholder="Paste PGN here…"
                    rows={8}
                    className={`mt-4 w-full resize-none rounded-lg px-3 py-2 font-mono text-xs outline-none ring-1 transition ${
                      theme === "dark"
                        ? "bg-slate-800/60 ring-slate-700 focus:ring-amber-400"
                        : "bg-white/70 ring-slate-300 focus:ring-amber-500"
                    }`}
                  />
                  <div className="mt-4 flex gap-2">
                    <ActionBtn onClick={handleImportPgn} primary>Import</ActionBtn>
                    <ActionBtn onClick={closePanel}>Cancel</ActionBtn>
                  </div>
                </>
              )}

              {panel === "stats" && (
                <>
                  <DialogTitle>📊 Lifetime Statistics</DialogTitle>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatTile label="Games" value={stats.gamesPlayed} />
                    <StatTile label="Wins" value={stats.wins} color="text-emerald-400" />
                    <StatTile label="Losses" value={stats.losses} color="text-rose-400" />
                    <StatTile label="Draws" value={stats.draws} color="text-amber-400" />
                    <StatTile label="Moves" value={stats.totalMoves} />
                    <StatTile label="Captures" value={stats.totalCaptures} />
                    <StatTile label="Checks" value={stats.totalChecks} />
                    <StatTile label="Checkmates" value={stats.totalCheckmates} />
                  </div>
                  {stats.gamesPlayed > 0 && (
                    <div className="mt-4">
                      <Label>Win Rate</Label>
                      <div className={`mt-2 h-3 overflow-hidden rounded-full ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(stats.wins / stats.gamesPlayed) * 100}%` }}
                          transition={{ duration: 0.8 }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-amber-500"
                        />
                      </div>
                      <p className="mt-1 text-xs opacity-70">
                        {((stats.wins / stats.gamesPlayed) * 100).toFixed(1)}% win rate
                      </p>
                    </div>
                  )}
                </>
              )}

              {panel === "about" && (
                <>
                  <DialogTitle>🧠 How the AI plays</DialogTitle>
                  <div className={`mt-4 space-y-3 text-sm leading-relaxed ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                    <p>
                      The computer uses a <strong>minimax search</strong> with{" "}
                      <strong>alpha-beta pruning</strong> — the classical game-tree algorithm
                      behind every traditional chess engine.
                    </p>
                    <p>
                      From the current position it builds a tree of possible future moves up
                      to a configurable depth:
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li><strong>Easy</strong> — depth 1 (looks 1 ply ahead)</li>
                      <li><strong>Medium</strong> — depth 2 (sees a full move pair)</li>
                      <li><strong>Hard</strong> — depth 3 (plans 3 plies ahead)</li>
                    </ul>
                    <p>
                      At each leaf node it evaluates the position using:
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li><strong>Material</strong> — standard piece values (P=1, N=3, B=3, R=5, Q=9)</li>
                      <li><strong>Positional tables</strong> — bonuses for central knights, active bishops, advanced pawns, safe king</li>
                    </ul>
                    <p>
                      The search uses <strong>negamax</strong> (a cleaner variant of minimax)
                      and <strong>alpha-beta pruning</strong> to skip branches that can't
                      affect the decision. Captures and promotions are searched first (move
                      ordering), which dramatically increases the effectiveness of pruning.
                    </p>
                    <p className="opacity-70">
                      See <code className="rounded bg-slate-800/50 px-1 py-0.5 text-xs">src/chess/engine.ts</code>{" "}
                      for the complete implementation.
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game over modal */}
      <AnimatePresence>
        {showGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 30 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              className="glass max-w-sm rounded-2xl p-8 text-center shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.8 }}
                className="mb-4 text-6xl"
              >
                {showGameOver === "draw" ? "🤝" : "🏆"}
              </motion.div>
              <h2 className="mb-2 text-2xl font-bold">
                {showGameOver === "draw"
                  ? "Draw"
                  : `${showGameOver === "white" ? "White" : "Black"} wins!`}
              </h2>
              <p className={`mb-6 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                {isCheckmate
                  ? "By checkmate"
                  : isStalemate
                    ? "By stalemate"
                    : clock.state.flag
                      ? "On time"
                      : "Game over"}
              </p>
              <div className="flex gap-2">
                <ActionBtn onClick={() => { setShowGameOver(null); newGame(); }} primary>
                  New Game
                </ActionBtn>
                <ActionBtn onClick={() => setShowGameOver(null)}>Review</ActionBtn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm font-medium text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Sub-components ----

function PlayerBar({
  color,
  label,
  captured,
  advantage,
  active,
  thinking,
  clock,
  clockFlag,
}: {
  color: Side;
  label: string;
  captured: string[];
  advantage: number;
  active: boolean;
  thinking: boolean;
  clock: number | null;
  clockFlag: boolean;
}) {
  const { theme } = useTheme();
  return (
    <motion.div
      animate={{
        boxShadow: active
          ? "0 0 24px rgba(251,191,36,0.35)"
          : "0 0 0 rgba(0,0,0,0)",
      }}
      className={`my-2 flex w-full max-w-[min(92vw,640px)] items-center justify-between rounded-xl px-3 py-2 transition ${
        active
          ? theme === "dark"
            ? "bg-amber-500/10 ring-1 ring-amber-500/40"
            : "bg-amber-100/70 ring-1 ring-amber-400/60"
          : theme === "dark"
            ? "bg-slate-900/40 ring-1 ring-slate-800"
            : "bg-white/50 ring-1 ring-slate-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-xl shadow-md ${
            color === "w"
              ? "bg-gradient-to-br from-slate-100 to-slate-300 text-slate-900"
              : "bg-gradient-to-br from-slate-700 to-slate-950 text-white"
          }`}
        >
          {color === "w" ? "♔" : "♚"}
        </div>
        <div>
          <div className={`text-sm font-semibold ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
            {label}
            {thinking && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-400">
                thinking…
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className={`font-mono text-base leading-none ${color === "w" ? "text-slate-400" : "text-slate-500"}`}>
              {captured.map((p, i) => (
                <span key={i}>{GLYPHS[p]}</span>
              ))}
            </span>
            {advantage !== 0 && (
              <span className={`ml-1 text-xs font-bold ${advantage > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                {advantage > 0 ? `+${advantage}` : advantage}
              </span>
            )}
          </div>
        </div>
      </div>
      {clock !== null && (
        <div
          className={`rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
            clockFlag
              ? "bg-rose-500 text-white"
              : clock < 30_000
                ? "bg-rose-500/20 text-rose-300"
                : theme === "dark"
                  ? "bg-slate-800/60 text-slate-200"
                  : "bg-slate-200/70 text-slate-800"
          }`}
        >
          {formatClock(clock)}
        </div>
      )}
    </motion.div>
  );
}

function GlassCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`glass rounded-xl p-4 shadow-lg ${theme === "dark" ? "" : ""}`}
    >
      <h2 className={`mb-3 text-[11px] font-bold uppercase tracking-widest ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
        {title}
      </h2>
      {children}
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>
      {children}
    </p>
  );
}

function ActionBtn({
  onClick,
  children,
  disabled,
  primary,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : primary
            ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30 hover:shadow-amber-500/50"
            : danger
              ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/30"
              : theme === "dark"
                ? "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700"
                : "bg-slate-200/60 text-slate-800 ring-1 ring-slate-300 hover:bg-slate-300"
      }`}
    >
      {children}
    </motion.button>
  );
}

function NavBtn({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg py-1.5 text-sm transition ${
        disabled
          ? "opacity-40"
          : theme === "dark"
            ? "bg-slate-800/60 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
            : "bg-slate-200/60 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <div className={`rounded-lg py-2 ${theme === "dark" ? "bg-slate-800/40" : "bg-slate-200/40"}`}>
      <div className={`text-[9px] font-bold uppercase tracking-wider ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${theme === "dark" ? "text-amber-300" : "text-amber-700"}`}>
        {value}
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color?: string }) {
  const { theme } = useTheme();
  return (
    <div className={`rounded-lg p-3 text-center ${theme === "dark" ? "bg-slate-800/50" : "bg-slate-200/50"}`}>
      <div className={`font-mono text-2xl font-bold ${color || (theme === "dark" ? "text-amber-300" : "text-amber-700")}`}>
        {value}
      </div>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
        {label}
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  children,
  active,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  label: string;
}) {
  const { theme } = useTheme();
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => {
        sounds.play("click");
        onClick();
      }}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition ${
        active
          ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30"
          : theme === "dark"
            ? "bg-slate-900/60 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800"
            : "bg-white/70 text-slate-700 ring-1 ring-slate-300 hover:bg-white"
      }`}
    >
      {children}
    </motion.button>
  );
}

function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xl font-bold">{children}</h3>;
}

function toggleFullscreen() {
  if (typeof document === "undefined") return;
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen();
  }
  sounds.play("click");
}
