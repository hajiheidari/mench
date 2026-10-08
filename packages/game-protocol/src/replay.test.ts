import { expect, test } from "vitest";
import { createGame, applyAction, type Action } from "@mench/game-engine";
import { reveal } from "@mench/fair-dice";
import { verifyTranscriptConsistency, type GameTranscript } from "./index";
test("archive binds proof contexts and roll values to replay actions without claiming prior witnessing", () => {
  const initialState = createGame(["a", "b"]);
  const proof = reveal(
    "aa".repeat(32),
    { gameId: "archive", playerId: "a", roll: 0, version: 0 },
    "bb".repeat(32),
  );
  const actions: Action[] = [
    { type: "connection", playerId: "a", connected: false },
    { type: "connection", playerId: "a", connected: true },
    { type: "roll", playerId: "a", value: proof.value },
  ];
  const transcript: GameTranscript = {
    initialState,
    actions,
    finalState: actions.reduce(applyAction, initialState),
    proofs: [proof],
  };
  expect(verifyTranscriptConsistency(transcript)).toBe(true);
  expect(verifyTranscriptConsistency({ ...transcript, proofs: [] })).toBe(
    false,
  );
  expect(
    verifyTranscriptConsistency({ ...transcript, proofs: [proof, proof] }),
  ).toBe(false);
  expect(
    verifyTranscriptConsistency({
      ...transcript,
      proofs: [{ ...proof, context: { ...proof.context, version: 1 } }],
    }),
  ).toBe(false);
  expect(
    verifyTranscriptConsistency({
      ...transcript,
      actions: [{ ...actions[0]!, playerId: "b" } as Action],
    }),
  ).toBe(false);
});
