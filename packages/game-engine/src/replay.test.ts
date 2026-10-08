import { expect, test } from "vitest";
import { applyAction, createGame, verifyReplay, type Action } from "./index";
test("replay verification ignores JSON object key ordering and detects altered outcomes/actions", () => {
  const initial = createGame(["a", "b"]);
  const actions: Action[] = [
    { type: "roll", playerId: "a", value: 6 },
    { type: "move", playerId: "a", pawn: 0 },
    { type: "connection", playerId: "b", connected: false },
  ];
  const final = actions.reduce(applyAction, initial);
  // Database JSONB reorders object properties; arrays and values must still determine equality.
  const reordered = {
    winner: final.winner,
    sixes: final.sixes,
    dice: final.dice,
    phase: final.phase,
    turn: final.turn,
    rules: { ...final.rules },
    players: final.players.map((p) => ({
      connected: p.connected,
      pawns: [...p.pawns],
      seat: p.seat,
      id: p.id,
    })),
    version: final.version,
  };
  expect(
    verifyReplay(
      initial,
      actions,
      JSON.parse(JSON.stringify(reordered)) as typeof final,
    ),
  ).toBe(true);
  expect(
    verifyReplay(initial, actions, { ...final, version: final.version + 1 }),
  ).toBe(false);
  expect(
    verifyReplay(
      initial,
      [...actions, { type: "move", playerId: "b", pawn: 0 }],
      final,
    ),
  ).toBe(false);
});
