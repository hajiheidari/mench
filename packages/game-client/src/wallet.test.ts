import { createHash, randomBytes } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import {
  WalletClient,
  formatRecoveryCode,
  normalizeRecoveryCode,
} from "./wallet";

const crypto = {
  bytes: (n: number) => new Uint8Array(randomBytes(n)),
  sha256Hex: async (t: string) => createHash("sha256").update(t).digest("hex"),
};
afterEach(() => vi.unstubAllGlobals());

test("recovery codes survive retyping", () => {
  expect(normalizeRecoveryCode("k7qm-3xzd 9p2a-ht4r")).toBe("K7QM3XZD9P2AHT4R");
  // O and I/L are read as 0 and 1; anything else is rejected.
  expect(normalizeRecoveryCode("OOOO-IIII-LLLL-0000")).toBe("0000111111110000");
  expect(normalizeRecoveryCode("K7QM-3XZD")).toBeNull();
  expect(normalizeRecoveryCode("K7QM-3XZD-9P2A-HT4U")).toBeNull();
  expect(formatRecoveryCode("K7QM3XZD9P2AHT4R")).toBe("K7QM-3XZD-9P2A-HT4R");
});

test("a new device saves its code; the same code opens the same wallet elsewhere", async () => {
  const seen: { id: string; token: string; url: string }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const h = init.headers as Record<string, string>;
    seen.push({ id: h["X-Wallet-Id"]!, token: h["X-Wallet-Token"]!, url });
    return new Response(JSON.stringify({ wallet: { coins: 0 } }));
  });
  let saved: string | null = null;
  const first = new WalletClient(
    "https://x",
    { load: async () => null, save: async (c) => void (saved = c) },
    crypto,
  );
  await first.open();
  expect(seen[0]!.url).toBe("https://x/api/wallet/create");
  expect(saved).toMatch(/^[0-9A-Z]{16}$/);
  expect(first.code).toBe(formatRecoveryCode(saved!));
  expect(seen[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(seen[0]!.token).toMatch(/^[0-9a-f]{64}$/);

  const second = new WalletClient(
    "https://x",
    { load: async () => null, save: async () => undefined },
    crypto,
  );
  await second.recover(first.code!.toLowerCase());
  expect(seen[1]!.url).toBe("https://x/api/wallet/wallet");
  expect(seen[1]!.id).toBe(seen[0]!.id);
  expect(seen[1]!.token).toBe(seen[0]!.token);
});
