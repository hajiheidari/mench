import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  contextText,
  validHex,
  type DiceContext,
  type DiceProof,
} from "./context";
export type { DiceContext, DiceProof } from "./context";
export function secureSeed(): string {
  return randomBytes(32).toString("hex");
}
export function commitment(seed: string, context: DiceContext): string {
  if (!validHex(seed)) throw new Error("INVALID_SEED");
  return createHash("sha256")
    .update(JSON.stringify([contextText(context), seed]))
    .digest("hex");
}
export function diceValue(
  seed: string,
  context: DiceContext,
  nonce: string,
): number {
  if (!validHex(seed) || !validHex(nonce)) throw new Error("INVALID_ENTROPY");
  for (let counter = 0; ; counter++) {
    const bytes = createHmac("sha256", Buffer.from(seed, "hex"))
      .update(JSON.stringify([contextText(context), nonce, counter]))
      .digest();
    for (const byte of bytes) if (byte < 252) return (byte % 6) + 1;
  }
}
export function reveal(
  seed: string,
  context: DiceContext,
  nonce: string,
): DiceProof {
  return {
    context: structuredClone(context),
    commitment: commitment(seed, context),
    seed,
    nonce,
    value: diceValue(seed, context, nonce),
  };
}
export function verifyProof(
  proof: DiceProof,
  publishedCommitment: string,
  expectedNonce: string,
): boolean {
  try {
    if (
      !validHex(publishedCommitment) ||
      proof.nonce !== expectedNonce ||
      proof.commitment !== publishedCommitment
    )
      return false;
    return (
      timingSafeEqual(
        Buffer.from(commitment(proof.seed, proof.context), "hex"),
        Buffer.from(publishedCommitment, "hex"),
      ) && diceValue(proof.seed, proof.context, proof.nonce) === proof.value
    );
  } catch {
    return false;
  }
}
