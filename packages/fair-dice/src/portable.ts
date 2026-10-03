import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { contextText, validHex, type DiceProof } from "./context";
export function verifyProof(
  proof: DiceProof,
  published: string,
  expectedNonce: string,
): boolean {
  try {
    if (
      !validHex(proof.seed) ||
      !validHex(proof.nonce) ||
      proof.nonce !== expectedNonce ||
      proof.commitment !== published
    )
      return false;
    if (
      bytesToHex(
        sha256(
          utf8ToBytes(JSON.stringify([contextText(proof.context), proof.seed])),
        ),
      ) !== published
    )
      return false;
    for (let counter = 0; ; counter++) {
      const bytes = hmac(
        sha256,
        hexToBytes(proof.seed),
        utf8ToBytes(
          JSON.stringify([contextText(proof.context), proof.nonce, counter]),
        ),
      );
      for (const b of bytes) if (b < 252) return (b % 6) + 1 === proof.value;
    }
  } catch {
    return false;
  }
}
