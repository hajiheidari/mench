import { test, expect } from "vitest";
import {
  createTournament,
  joinTournament,
  startTournament,
  linkMatch,
  completeMatch,
  type TournamentSize,
} from "./index";
test.each([4, 8, 16, 32] as TournamentSize[])(
  "%i-player bracket advances validated results without byes or duplicate winners",
  (capacity) => {
    let state = createTournament(capacity, "0");
    for (let i = 1; i < capacity; i++) state = joinTournament(state, String(i));
    state = startTournament(state);
    expect(state.rounds.flat()).toHaveLength(capacity - 1);
    const before = structuredClone(state);
    for (let r = 0; r < state.rounds.length; r++)
      for (let m = 0; m < state.rounds[r]!.length; m++) {
        const match = state.rounds[r]![m]!;
        const gameId = `game-${match.id}`;
        state = linkMatch(state, match.id, gameId, `room-${match.id}`);
        const winner = match.players[0]!;
        state = completeMatch(state, gameId, winner);
        expect(completeMatch(state, gameId, winner)).toEqual(state);
        expect(() => completeMatch(state, gameId, match.players[1]!)).toThrow(
          "RESULT_CONFLICT",
        );
      }
    expect(before.phase).toBe("running");
    expect(before.rounds.flat().every((m) => !m.winner)).toBe(true);
    expect(state.phase).toBe("finished");
    expect(state.winner).toBe("0");
  },
);
test("rejects wrong phase, unknown/forged winners, incomplete matches and reused games", () => {
  let state = createTournament(4, "a");
  expect(() => startTournament(state)).toThrow("WAITING_FOR_PLAYERS");
  expect(joinTournament(state, "a")).toEqual(state);
  for (const id of ["b", "c", "d"]) state = joinTournament(state, id);
  expect(() => joinTournament(state, "e")).toThrow("TOURNAMENT_FULL");
  state = startTournament(state);
  expect(() => joinTournament(state, "e")).toThrow("TOURNAMENT_STARTED");
  expect(() => linkMatch(state, "r1m0", "x", "code")).toThrow(
    "MATCH_UNAVAILABLE",
  );
  state = linkMatch(state, "r0m0", "x", "code");
  expect(() => linkMatch(state, "r0m1", "x", "code")).toThrow(
    "MATCH_ALREADY_LINKED",
  );
  expect(() => completeMatch(state, "x", "c")).toThrow("INVALID_WINNER");
  expect(() => completeMatch(state, "unknown", "a")).toThrow(
    "MATCH_UNAVAILABLE",
  );
});
