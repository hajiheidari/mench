export interface DiceContext {
  gameId: string;
  roll: number;
  playerId: string;
  version: number;
}
export interface DiceProof {
  context: DiceContext;
  commitment: string;
  seed: string;
  nonce: string;
  value: number;
}
export function contextText(context: DiceContext): string {
  if (
    !context.gameId ||
    !context.playerId ||
    !Number.isSafeInteger(context.roll) ||
    context.roll < 0 ||
    !Number.isSafeInteger(context.version) ||
    context.version < 0
  )
    throw new Error("INVALID_CONTEXT");
  return JSON.stringify([
    "mench-dice-v1",
    context.gameId,
    context.roll,
    context.playerId,
    context.version,
  ]);
}
export function validHex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
/** Lowercase hex without relying on Buffer, so the same code runs on Node and Workers. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
