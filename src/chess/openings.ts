// Common chess openings keyed by move sequence (SAN).
// Used to show which opening is being played.

interface Opening {
  eco: string;
  name: string;
  moves: string[];
}

export const OPENINGS: Opening[] = [
  { eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { eco: "C25", name: "Vienna Game", moves: ["e4", "e5", "Nc3"] },
  { eco: "B01", name: "Scandinavian Defense", moves: ["e4", "d5"] },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5"] },
  { eco: "B10", name: "Caro-Kann Defense", moves: ["e4", "c6"] },
  { eco: "C00", name: "French Defense", moves: ["e4", "e6"] },
  { eco: "B06", name: "Modern Defense", moves: ["e4", "g6"] },
  { eco: "B07", name: "Pirc Defense", moves: ["e4", "d6"] },
  { eco: "B02", name: "Alekhine's Defense", moves: ["e4", "Nf6"] },
  { eco: "A45", name: "Trompowsky Attack", moves: ["d4", "Nf6", "Bg5"] },
  { eco: "D06", name: "Queen's Gambit", moves: ["d4", "d5", "c4"] },
  { eco: "D70", name: "Grünfeld Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"] },
  { eco: "E60", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6"] },
  { eco: "E00", name: "Catalan Opening", moves: ["d4", "Nf6", "c4", "e6", "g3"] },
  { eco: "A40", name: "Queen's Pawn Game", moves: ["d4"] },
  { eco: "D00", name: "London System", moves: ["d4", "d5", "Bf4"] },
  { eco: "E10", name: "Queen's Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"] },
  { eco: "D32", name: "Tarrasch Defense", moves: ["d4", "d5", "c4", "e6", "Nc3", "c5"] },
  { eco: "D02", name: "Slav Defense", moves: ["d4", "d5", "c4", "c6"] },
  { eco: "A10", name: "English Opening", moves: ["c4"] },
  { eco: "A01", name: "Nimzo-Larsen Attack", moves: ["b3"] },
  { eco: "A00", name: "Bird's Opening", moves: ["f4"] },
  { eco: "A00", name: "Réti Opening", moves: ["Nf3"] },
  { eco: "C20", name: "King's Pawn Game", moves: ["e4"] },
  { eco: "C30", name: "King's Gambit", moves: ["e4", "e5", "f4"] },
  { eco: "C42", name: "Petrov's Defense", moves: ["e4", "e5", "Nf3", "Nf6"] },
  { eco: "C44", name: "Scotch Game", moves: ["e4", "e5", "Nf3", "Nc6", "d4"] },
  { eco: "C21", name: "Center Game", moves: ["e4", "e5", "d4"] },
  { eco: "C46", name: "Four Knights Game", moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"] },
  { eco: "C47", name: "Four Knights Scotch", moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6", "d4"] },
  { eco: "E20", name: "Nimzo-Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { eco: "C80", name: "Open Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Nxe4"] },
];

export function identifyOpening(moves: string[]): Opening | null {
  // Find the longest opening line that matches the current move sequence.
  let best: Opening | null = null;
  let bestLen = 0;
  for (const o of OPENINGS) {
    if (o.moves.length > moves.length) continue;
    let match = true;
    for (let i = 0; i < o.moves.length; i++) {
      if (moves[i] !== o.moves[i]) {
        match = false;
        break;
      }
    }
    if (match && o.moves.length > bestLen) {
      best = o;
      bestLen = o.moves.length;
    }
  }
  return best;
}
