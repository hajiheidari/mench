import { test, expect } from "vitest";
import {
  applyAction,
  createGame,
  currentPlayer,
  legalMoves,
} from "@mench/game-engine";
import { chooseMove, type Difficulty } from "./index";
test("bot chooses only legal moves and cannot alter its input", () => {
  let state = createGame(["a", "b"]);
  expect(chooseMove(state)).toBe(null);
  state = applyAction(state, { type: "roll", playerId: "a", value: 6 });
  const before = structuredClone(state);
  Object.freeze(state);
  Object.freeze(state.players);
  for (const p of state.players) {
    Object.freeze(p);
    Object.freeze(p.pawns);
  }
  for (const level of ["easy", "normal", "hard"] as const)
    for (let n = 0; n < 20; n++)
      expect(legalMoves(state)).toContain(chooseMove(state, level, n));
  expect(state).toEqual(before);
  expect(() => chooseMove(state, "easy", -1)).toThrow("INVALID_ENTROPY");
});
test("normal prefers capture; hard weighs a threatened destination against safety", () => {
  const state = createGame(["a", "b"]);
  state.players[0]!.pawns = [1, 10, -1, -1];
  state.players[1]!.pawns = [28, -1, -1, -1];
  state.phase = "move";
  state.dice = 1;
  // Opponent seat2 + progress28 = global2: pawn0 captures at cell2.
  expect(chooseMove(state, "normal")).toBe(0);
  state.players[1]!.pawns = [11, -1, -1, -1];
  state.players[0]!.pawns = [7, 10, -1, -1];
  // Pawn0 lands on safe8; pawn1 lands on11, threatened from opponent global37? Adjust to global10.
  state.players[1]!.pawns[0] = 36;
  expect(chooseMove(state, "hard")).toBe(0);
});
test.each(["easy", "normal", "hard"] as Difficulty[])(
  "%s bots complete deterministic 2/3/4-player games",
  (level) => {
    for (const count of [2, 3, 4])
      for (let seed = 1; seed <= 20; seed++) {
        let state = createGame(
          Array.from({ length: count }, (_, i) => String(i)),
        );
        let random = seed;
        for (
          let steps = 0;
          steps < 10000 && state.phase !== "finished";
          steps++
        ) {
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          const playerId = currentPlayer(state).id;
          if (state.phase === "roll")
            state = applyAction(state, {
              type: "roll",
              playerId,
              value: (random % 6) + 1,
            });
          else {
            const pawn = chooseMove(state, level, random);
            expect(pawn).not.toBe(null);
            expect(legalMoves(state)).toContain(pawn);
            state = applyAction(state, { type: "move", playerId, pawn: pawn! });
          }
        }
        expect(state.phase).toBe("finished");
        expect(state.winner).not.toBe(null);
      }
  },
);
