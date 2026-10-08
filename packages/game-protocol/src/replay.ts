import { applyAction, verifyReplay } from "@mench/game-engine";
import { verifyProof } from "@mench/fair-dice/portable";
import type { GameTranscript } from "./index";
// Checks internal consistency only: an archive cannot witness prior commitment publication.
export function verifyTranscriptConsistency(
  transcript: GameTranscript,
): boolean {
  try {
    if (
      !verifyReplay(
        transcript.initialState,
        transcript.actions,
        transcript.finalState,
      )
    )
      return false;
    let state = transcript.initialState;
    let roll = 0;
    let commitmentVersion = state.version;
    const gameId = transcript.proofs[0]?.context.gameId;
    for (const action of transcript.actions) {
      if (action.type === "roll") {
        const proof = transcript.proofs[roll];
        if (
          !proof ||
          proof.context.gameId !== gameId ||
          proof.context.roll !== roll ||
          proof.context.version !== commitmentVersion ||
          proof.context.playerId !== action.playerId ||
          proof.value !== action.value ||
          !verifyProof(proof, proof.commitment, proof.nonce)
        )
          return false;
        roll++;
      }
      state = applyAction(state, action);
      if (action.type !== "connection") commitmentVersion = state.version;
    }
    return roll === transcript.proofs.length;
  } catch {
    return false;
  }
}
