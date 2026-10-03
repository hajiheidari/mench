import { contextText, validHex, type DiceProof } from "./context";
export type { DiceProof } from "./context";
const encoder = new TextEncoder();
function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function clientNonce(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}
export async function verifyProof(
  proof: DiceProof,
  publishedCommitment: string,
  expectedNonce: string,
): Promise<boolean> {
  try {
    if (
      !validHex(proof.seed) ||
      !validHex(proof.nonce) ||
      proof.nonce !== expectedNonce ||
      proof.commitment !== publishedCommitment
    )
      return false;
    const hash = hex(
      await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(
          JSON.stringify([contextText(proof.context), proof.seed]),
        ),
      ),
    );
    if (hash !== publishedCommitment) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(proof.seed.match(/../g) ?? [], (v) => parseInt(v, 16)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    for (let counter = 0; ; counter++) {
      const bytes = new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          key,
          encoder.encode(
            JSON.stringify([contextText(proof.context), proof.nonce, counter]),
          ),
        ),
      );
      for (const byte of bytes)
        if (byte < 252) return (byte % 6) + 1 === proof.value;
    }
  } catch {
    return false;
  }
}
