import {
  applyAction,
  boardCell,
  currentPlayer,
  FINISH,
  legalMoves,
  type GameState,
} from "@mench/game-engine";
export type Difficulty = "easy" | "normal" | "hard";
export function chooseMove(
  state: GameState,
  difficulty: Difficulty = "normal",
  entropy = 0,
): number | null {
  const moves = legalMoves(state);
  if (!moves.length) return null;
  if (!Number.isInteger(entropy) || entropy < 0) throw Error("INVALID_ENTROPY");
  if (difficulty === "easy") return moves[entropy % moves.length]!;
  const player = currentPlayer(state);
  const scored = moves.map((pawn) => {
    const next = applyAction(state, {
      type: "move",
      playerId: player.id,
      pawn,
    });
    const after = next.players.find((p) => p.id === player.id)!;
    const position = after.pawns[pawn]!;
    const before = player.pawns[pawn]!;
    let score =
      next.winner === player.id ? 100000 : position === FINISH ? 1000 : 0;
    const captures = state.players
      .filter((p) => p.id !== player.id)
      .reduce(
        (sum, p) =>
          sum +
          p.pawns.filter(
            (n, i) =>
              n >= 0 &&
              next.players.find((other) => other.id === p.id)!.pawns[i] === -1,
          ).length,
        0,
      );
    score +=
      captures * 100 +
      (before === -1 ? 40 : position - before) +
      position * 0.2;
    if (difficulty === "hard") {
      const cell = boardCell(after, position);
      if (cell === null) score += 30;
      else if (state.rules.safeCells.includes(cell)) score += 25;
      else
        for (const opponent of state.players.filter((p) => p.id !== player.id))
          for (const progress of opponent.pawns) {
            const opponentCell = boardCell(opponent, progress);
            if (opponentCell !== null) {
              const distance = (cell - opponentCell + 52) % 52;
              if (distance >= 1 && distance <= 6) score -= 35;
            }
          }
    }
    return { pawn, score };
  });
  const best = Math.max(...scored.map((candidate) => candidate.score));
  const candidates = scored.filter((candidate) => candidate.score === best);
  return candidates[entropy % candidates.length]!.pawn;
}
