import { describe, expect, test } from "vitest";
import {
  applyAction,
  boardCell,
  createGame,
  currentPlayer,
  FINISH,
  legalMoves,
  replay,
  STANDARD_RULES,
} from "./index";
function game() {
  return createGame(["a", "b"]);
}
function roll(value: number) {
  return applyAction(game(), { type: "roll", playerId: "a", value });
}
describe("configuration", () => {
  test.each([2, 3, 4])("%i players get four yard pawns", (count) => {
    const s = createGame(Array.from({ length: count }, (_, i) => String(i)));
    expect(s.players).toHaveLength(count);
    expect(s.players.every((p) => p.pawns.join(",") === "-1,-1,-1,-1")).toBe(
      true,
    );
  });
  test("invalid players and rules rejected", () => {
    for (const ids of [["a"], ["a", "a"], ["a", "b", "c", "d", "e"]])
      expect(() => createGame(ids)).toThrow();
    expect(() =>
      createGame(["a", "b"], { ...STANDARD_RULES, enterOn: [7] }),
    ).toThrow();
  });
  test("two seats opposite and safe lanes do not share ring", () => {
    const s = game();
    expect(s.players.map((p) => p.seat)).toEqual([0, 2]);
    expect(boardCell(s.players[0]!, 52)).toBeNull();
  });
});
describe("turn and move validation", () => {
  test.each([0, 7, 1.5, NaN])("invalid roll %s", (value) =>
    expect(() => roll(value)).toThrow("INVALID_DICE"),
  );
  test("yard entry requires six and immutable state", () => {
    const a = game();
    const b = applyAction(a, { type: "roll", playerId: "a", value: 6 });
    expect(legalMoves(b)).toEqual([0, 1, 2, 3]);
    const c = applyAction(b, { type: "move", playerId: "a", pawn: 0 });
    expect(c.players[0]!.pawns[0]).toBe(0);
    expect(a.players[0]!.pawns[0]).toBe(-1);
    expect(c.phase).toBe("roll");
    expect(c.turn).toBe(0);
  });
  test("no legal moves automatically advances", () => {
    expect(roll(2).turn).toBe(1);
    expect(roll(2).phase).toBe("roll");
  });
  test("rejects ownership, out of turn, duplicate roll and illegal pawns", () => {
    expect(() =>
      applyAction(game(), { type: "roll", playerId: "b", value: 6 }),
    ).toThrow("NOT_YOUR_TURN");
    expect(() =>
      applyAction(game(), { type: "roll", playerId: "x", value: 6 }),
    ).toThrow("UNKNOWN_PLAYER");
    expect(() =>
      applyAction(roll(6), { type: "roll", playerId: "a", value: 6 }),
    ).toThrow("ALREADY_ROLLED");
    expect(() =>
      applyAction(roll(6), { type: "move", playerId: "a", pawn: 4 }),
    ).toThrow("ILLEGAL_MOVE");
  });
  test("three consecutive sixes forfeit turn", () => {
    let s = game();
    for (let i = 0; i < 2; i++) {
      s = applyAction(s, { type: "roll", playerId: "a", value: 6 });
      s = applyAction(s, { type: "move", playerId: "a", pawn: 0 });
    }
    s = applyAction(s, { type: "roll", playerId: "a", value: 6 });
    expect(s.turn).toBe(1);
    expect(s.players[0]!.pawns[0]).toBe(6);
    expect(s.sixes).toBe(0);
  });
  test("normal move advances turn", () => {
    const s = game();
    s.players[0]!.pawns[0] = 5;
    const b = applyAction(s, { type: "roll", playerId: "a", value: 2 });
    expect(applyAction(b, { type: "move", playerId: "a", pawn: 0 }).turn).toBe(
      1,
    );
  });
  test("configuration supports different entry and no extra six", () => {
    const s = createGame(["a", "b"], {
      ...STANDARD_RULES,
      enterOn: [1],
      extraOnSix: false,
    });
    const b = applyAction(s, { type: "roll", playerId: "a", value: 1 });
    expect(applyAction(b, { type: "move", playerId: "a", pawn: 0 }).turn).toBe(
      1,
    );
  });
});
describe("capture and finishing", () => {
  test("captures opposing stack on unsafe square and rewards turn", () => {
    const s = game();
    s.players[0]!.pawns[0] = 26;
    s.players[1]!.pawns = [1, 1, -1, -1];
    const b = applyAction(s, { type: "roll", playerId: "a", value: 1 });
    const c = applyAction(b, { type: "move", playerId: "a", pawn: 0 });
    expect(c.players[1]!.pawns).toEqual([-1, -1, -1, -1]);
    expect(c.turn).toBe(0);
  });
  test("safe square protects opponent", () => {
    const s = game();
    s.players[0]!.pawns[0] = 25;
    s.players[1]!.pawns[0] = 0;
    const c = applyAction(
      applyAction(s, { type: "roll", playerId: "a", value: 1 }),
      { type: "move", playerId: "a", pawn: 0 },
    );
    expect(c.players[1]!.pawns[0]).toBe(0);
    expect(c.turn).toBe(1);
  });
  test("home lane cannot capture or be captured", () => {
    const s = game();
    s.players[0]!.pawns[0] = 51;
    s.players[1]!.pawns[0] = 26;
    const c = applyAction(
      applyAction(s, { type: "roll", playerId: "a", value: 1 }),
      { type: "move", playerId: "a", pawn: 0 },
    );
    expect(c.players[0]!.pawns[0]).toBe(52);
    expect(c.players[1]!.pawns[0]).toBe(26);
  });
  test("exact finish rejects overshoot and finished pawn", () => {
    const s = game();
    s.players[0]!.pawns = [56, 57, -1, -1];
    const b = applyAction(s, { type: "roll", playerId: "a", value: 2 });
    expect(b.turn).toBe(1);
    expect(legalMoves(b)).toEqual([]);
  });
  test("nonexact finish configurable", () => {
    const s = createGame(["a", "b"], { ...STANDARD_RULES, exactFinish: false });
    s.players[0]!.pawns[0] = 56;
    const c = applyAction(
      applyAction(s, { type: "roll", playerId: "a", value: 2 }),
      { type: "move", playerId: "a", pawn: 0 },
    );
    expect(c.players[0]!.pawns[0]).toBe(FINISH);
  });
  test("all pawns home identifies winner and stops further actions", () => {
    const s = game();
    s.players[0]!.pawns = [57, 57, 57, 56];
    const c = applyAction(
      applyAction(s, { type: "roll", playerId: "a", value: 1 }),
      { type: "move", playerId: "a", pawn: 3 },
    );
    expect(c.winner).toBe("a");
    expect(c.phase).toBe("finished");
    expect(() => applyAction(c, { type: "timeout", playerId: "a" })).toThrow(
      "GAME_FINISHED",
    );
  });
});
describe("replay, connection, timeout", () => {
  test("timeout skips pending move without moving a pawn", () => {
    const s = applyAction(roll(6), { type: "timeout", playerId: "a" });
    expect(s.turn).toBe(1);
    expect(s.players[0]!.pawns[0]).toBe(-1);
  });
  test("disconnect preserves turn and reconnect preserves pawns", () => {
    const a = roll(6);
    const b = applyAction(a, {
      type: "connection",
      playerId: "a",
      connected: false,
    });
    expect(b.turn).toBe(0);
    expect(b.phase).toBe("move");
    const c = applyAction(b, {
      type: "connection",
      playerId: "a",
      connected: true,
    });
    expect(c.players[0]!.connected).toBe(true);
  });
  test("deterministic replay", () => {
    const actions = [
      { type: "roll", playerId: "a", value: 6 },
      { type: "move", playerId: "a", pawn: 0 },
      { type: "roll", playerId: "a", value: 3 },
      { type: "move", playerId: "a", pawn: 0 },
    ] as const;
    expect(replay(game(), actions)).toEqual(replay(game(), actions));
  });
  test("full 2/3/4 player simulations maintain bounds and complete", () => {
    for (const count of [2, 3, 4]) {
      let s = createGame(Array.from({ length: count }, (_, i) => String(i)));
      let random = 123;
      for (let i = 0; i < 30000 && s.phase !== "finished"; i++) {
        random = (random * 1664525 + 1013904223) >>> 0;
        const playerId = currentPlayer(s).id;
        if (s.phase === "roll")
          s = applyAction(s, {
            type: "roll",
            playerId,
            value: (random % 6) + 1,
          });
        else {
          s = applyAction(s, {
            type: "move",
            playerId,
            pawn: legalMoves(s)[random % legalMoves(s).length]!,
          });
        }
        expect(
          s.players.every((p) => p.pawns.every((n) => n >= -1 && n <= 57)),
        ).toBe(true);
      }
      expect(s.winner).not.toBeNull();
    }
  });
});
