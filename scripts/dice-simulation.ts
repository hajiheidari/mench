import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { commitment, reveal, verifyProof } from "@mench/fair-dice";
const count = 1_000_000;
const counts = Array<number>(6).fill(0);
const started = performance.now();
for (let roll = 0; roll < count; roll++) {
  // Reproducible simulation only. Production uses randomBytes, never these seeds.
  const seed = createHash("sha256")
    .update(`simulation-server-${roll}`)
    .digest("hex");
  const nonce = createHash("sha256")
    .update(`simulation-client-${roll}`)
    .digest("hex");
  const context = {
    gameId: "simulation-v1",
    playerId: "simulation-player",
    version: roll,
    roll,
  };
  const observed = commitment(seed, context);
  const proof = reveal(seed, context, nonce);
  if (!verifyProof(proof, observed, nonce)) throw Error("INVALID_PROOF");
  counts[proof.value - 1]!++;
}
const expected = count / 6;
const chiSquare = counts.reduce(
  (sum, n) => sum + (n - expected) ** 2 / expected,
  0,
);
if (chiSquare > 30) throw Error(`DISTRIBUTION_CHECK_FAILED:${chiSquare}`);
const report = {
  generatedAt: new Date().toISOString(),
  count,
  counts,
  chiSquare,
  degreesOfFreedom: 5,
  threshold: 30,
  verifiedProofs: count,
  elapsedMs: Math.round(performance.now() - started),
  limitation:
    "Deterministic distribution regression, not proof of server honesty or adversarial fairness.",
};
await writeFile(
  new URL("../docs/DICE_SIMULATION.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
