import { verifyProof as portableVerify } from "./portable";
import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import {
  commitment,
  diceValue,
  reveal,
  secureSeed,
  verifyProof,
} from "./index";
import { verifyProof as browserVerify } from "./browser";
const context = { gameId: "test-game", roll: 0, playerId: "a", version: 0 };
const seed = "11".repeat(32);
const nonce = "22".repeat(32);
test("secure entropy, deterministic commitment and roll", () => {
  expect(secureSeed()).toMatch(/^[a-f0-9]{64}$/);
  expect(secureSeed()).not.toBe(secureSeed());
  expect(diceValue(seed, context, nonce)).toBe(diceValue(seed, context, nonce));
  expect(commitment(seed, context)).not.toBe(
    commitment(seed, { ...context, roll: 1 }),
  );
});
test("tampered seed, nonce, result, context, commitment fail verification", () => {
  const p = reveal(seed, context, nonce);
  expect(verifyProof(p, p.commitment, nonce)).toBe(true);
  for (const changed of [
    { seed: "ff".repeat(32) },
    { nonce: "fe".repeat(32) },
    { value: 9 },
    { context: { ...context, playerId: "b" } },
    { commitment: "00".repeat(32) },
  ])
    expect(verifyProof({ ...p, ...changed }, p.commitment, nonce)).toBe(false);
  expect(verifyProof({ ...p, seed: "bad" }, p.commitment, nonce)).toBe(false);
});
test("browser independently verifies server proof", async () => {
  const p = reveal(seed, context, nonce);
  expect(await browserVerify(p, p.commitment, nonce)).toBe(true);
  expect(await browserVerify({ ...p, value: 7 }, p.commitment, nonce)).toBe(
    false,
  );
});
test("invalid input rejected", () => {
  expect(() => commitment("bad", context)).toThrow();
  expect(() => diceValue(seed, context, "bad")).toThrow();
  expect(() => commitment(seed, { ...context, roll: -1 })).toThrow();
});
test("100000 reproducible rolls show approximate uniform distribution", () => {
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 100000; i++) {
    const s = createHash("sha256")
      .update("mench-simulation-" + i)
      .digest("hex");
    const value = diceValue(s, { ...context, roll: i }, nonce);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
    counts[value - 1] = counts[value - 1]! + 1;
  }
  const expected = 100000 / 6;
  const chi = counts.reduce(
    (sum, c) => sum + (c - expected) ** 2 / expected,
    0,
  );
  expect(chi).toBeLessThan(30);
  console.log(JSON.stringify({ rolls: 100000, counts, chiSquare: chi }));
}, 15000);

test("portable native verifier agrees with server and rejects altered context", () => {
  const p = reveal(seed, context, nonce);
  expect(portableVerify(p, p.commitment, nonce)).toBe(true);
  expect(
    portableVerify(
      { ...p, context: { ...context, roll: 99 } },
      p.commitment,
      nonce,
    ),
  ).toBe(false);
});
